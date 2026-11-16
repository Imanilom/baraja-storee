const express = require('express');
const mongoose = require('mongoose');
const GoodsReceipt = require('../receiving/goods-receipt.model');
const GoodsReceiptItem = require('../receiving/goods-receipt-item.model');
const IntegrationEvent = require('./integration-event.model');
const integrationAuth = require('./integration-auth');
const integrationService = require('./integration.service');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/rbac');
const { ROLES } = require('@purchasing/constants');

const router = express.Router();

router.post('/receipts/:id/sync', authenticate, authorize(ROLES.ADMIN, ROLES.RECEIVER, ROLES.LEADER, ROLES.PURCHASING), async (req, res) => {
  try {
    const receipt = await GoodsReceipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ success: false, message: 'Goods receipt not found' });
    if (['verified', 'pending_approval', 'approved', 'posted', 'reversed'].includes(receipt.amphitheater_status)) {
      return res.status(409).json({ success: false, message: 'Receipt has advanced in Amphitheater and cannot be re-synced' });
    }
    const event = await integrationService.enqueueGoodsReceiptSync(receipt._id, { force: true });
    await GoodsReceipt.updateOne(
      { _id: receipt._id, amphitheater_status: { $nin: ['approved', 'posted', 'reversed'] } },
      { $set: { amphitheater_status: 'sync_pending' } }
    );
    return res.status(202).json({ success: true, event_id: event.event_id, status: event.status });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/goods-receipts/:id', integrationAuth, async (req, res) => {
  try {
    return res.json(await integrationService.buildGoodsReceiptPayload(req.params.id));
  } catch (error) {
    return res.status(error.statusCode || 422).json({ success: false, message: error.message });
  }
});

router.post('/receiving-status', integrationAuth, async (req, res) => {
  const { external_receipt_id: externalReceiptId, status, receipt_id: amphitheaterReceiptId, items } = req.body || {};
  const allowedStatuses = ['submitted', 'verified', 'pending_approval', 'approved', 'posted', 'rejected', 'reversed', 'sync_failed'];
  const uniqueItemIds = new Set(Array.isArray(items) ? items.map((item) => item.external_receipt_item_id) : []);
  const validItems = Array.isArray(items) && items.every((item) =>
    item.external_receipt_item_id &&
    mongoose.Types.ObjectId.isValid(item.external_receipt_item_id) &&
    Number.isFinite(Number(item.posted_qty || 0)) &&
    Number(item.posted_qty || 0) >= 0
  );
  if (!externalReceiptId || !mongoose.Types.ObjectId.isValid(externalReceiptId) ||
      !allowedStatuses.includes(status) || !Array.isArray(items) ||
      !validItems || uniqueItemIds.size !== items.length) {
    return res.status(400).json({ success: false, message: 'Invalid receiving status callback' });
  }

  try {
    const receipt = await GoodsReceipt.findById(externalReceiptId);
    if (!receipt) return res.status(404).json({ success: false, message: 'Goods receipt not found' });

    const itemIds = items.map((item) => item.external_receipt_item_id).filter(Boolean);
    const existingItems = await GoodsReceiptItem.find({
      receipt_id: receipt._id,
      _id: { $in: itemIds }
    }).select('_id');
    if (existingItems.length !== itemIds.length) {
      return res.status(422).json({ success: false, message: 'Callback contains an unknown receipt item' });
    }

    const operations = items.map((item) => ({
      updateOne: {
        filter: { receipt_id: receipt._id, _id: item.external_receipt_item_id },
        update: {
          $set: {
            amphitheater_movement_id: item.movement_id || null,
            amphitheater_posted_qty: Number(item.posted_qty || 0)
          }
        }
      }
    }));
    if (operations.length) await GoodsReceiptItem.bulkWrite(operations);
    await GoodsReceipt.updateOne(
      { _id: receipt._id },
      {
        $set: {
          amphitheater_status: status,
          amphitheater_receipt_id: amphitheaterReceiptId || receipt.amphitheater_receipt_id,
          amphitheater_posted_at: status === 'posted' ? (req.body.posted_at || new Date()) : receipt.amphitheater_posted_at,
          amphitheater_last_sync_at: new Date()
        }
      }
    );
    await IntegrationEvent.updateMany(
      { aggregate_id: receipt._id, status: { $in: ['pending', 'failed'] } },
      { $set: { status: 'delivered', delivered_at: new Date(), last_error: null, lease_until: null } }
    );
    return res.json({ success: true, status });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
