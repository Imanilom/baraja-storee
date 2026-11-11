const GoodsReceipt = require('./goods-receipt.model');
const GoodsReceiptItem = require('./goods-receipt-item.model');
const Marketlist = require('../marketlists/marketlist.model');
const MarketlistItem = require('../marketlists/marketlist-item.model');
const auditService = require('../audit/audit.service');
const { generateGoodsReceiptNumber } = require('../../utils/number-generator');
const { MARKETLIST_STATUS, GOODS_RECEIPT_STATUS, RECEIVING_STATUS } = require('@purchasing/constants');

const getItemReceivingStatus = (accepted, rejected, requested, isChecked) => {
  if (!isChecked) return RECEIVING_STATUS.PENDING;
  if (accepted === 0 && rejected > 0) return RECEIVING_STATUS.REJECTED;
  if (accepted === requested) return RECEIVING_STATUS.COMPLETE;
  if (accepted < requested) return RECEIVING_STATUS.PARTIAL;
  return RECEIVING_STATUS.OVER_RECEIVED;
};

class ReceivingService {
  async getReceiptsByMarketlist(marketlistId) {
    const receipts = await GoodsReceipt.find({ marketlist_id: marketlistId })
      .populate('received_by', 'name email')
      .populate('supplier_id', 'name code')
      .sort({ received_at: -1 });

    const receiptIds = receipts.map((r) => r._id);
    const allItems = await GoodsReceiptItem.find({ receipt_id: { $in: receiptIds } })
      .populate({
        path: 'marketlist_item_id',
        select: 'product_snapshot requested_qty unit_price subtotal'
      });

    const itemsMap = new Map();
    allItems.forEach((it) => {
      const rid = it.receipt_id.toString();
      if (!itemsMap.has(rid)) itemsMap.set(rid, []);
      itemsMap.get(rid).push(it);
    });

    return receipts.map((r) => ({
      ...r.toObject(),
      items: itemsMap.get(r._id.toString()) || []
    }));
  }

  async getReceiptById(id) {
    const receipt = await GoodsReceipt.findById(id)
      .populate('received_by', 'name email role')
      .populate('supplier_id', 'name code')
      .populate('marketlist_id', 'marketlist_number status required_date');

    if (!receipt) return null;

    const items = await GoodsReceiptItem.find({ receipt_id: id })
      .populate({
        path: 'marketlist_item_id',
        populate: { path: 'product_id', select: 'name sku unit_id' }
      });

    return {
      ...receipt.toObject(),
      items
    };
  }

  async createReceipt(marketlistId, data, user) {
    // 1. Check idempotency for offline synchronization
    if (data.client_request_id) {
      const existing = await GoodsReceipt.findOne({ client_request_id: data.client_request_id });
      if (existing) {
        return this.getReceiptById(existing._id);
      }
    }

    // 2. Validate Marketlist status
    const marketlist = await Marketlist.findById(marketlistId);
    if (!marketlist) {
      throw new Error('Marketlist not found');
    }

    const validStatuses = [
      MARKETLIST_STATUS.APPROVED,
      MARKETLIST_STATUS.IN_PROGRESS,
      MARKETLIST_STATUS.PARTIALLY_RECEIVED
    ];

    if (!validStatuses.includes(marketlist.status)) {
      throw new Error(`Cannot receive goods for marketlist with status '${marketlist.status}'. Marketlist must be approved.`);
    }

    // 3. Fetch Marketlist items to validate
    const mlItems = await MarketlistItem.find({ marketlist_id: marketlistId });
    const mlItemMap = new Map(mlItems.map((i) => [i._id.toString(), i]));

    // Generate receipt number
    const count = await GoodsReceipt.countDocuments();
    const receipt_number = generateGoodsReceiptNumber(count + 1);

    const receipt = new GoodsReceipt({
      receipt_number,
      client_request_id: data.client_request_id,
      marketlist_id: marketlistId,
      received_by: user._id,
      supplier_id: data.supplier_id || null,
      general_condition: data.general_condition,
      attachments: (data.attachments && data.attachments.length > 0)
        ? data.attachments
        : (data.photos ? data.photos.map(p => (typeof p === 'string' ? { url: p, type: 'photo' } : p)) : []),
      status: GOODS_RECEIPT_STATUS.SUBMITTED
    });

    await receipt.save();

    // 4. Process items
    const preparedItems = [];
    for (const itemInput of data.items) {
      const mlItem = mlItemMap.get(itemInput.marketlist_item_id.toString());
      if (!mlItem) {
        throw new Error(`Item ${itemInput.marketlist_item_id} does not belong to this Marketlist.`);
      }

      const received = itemInput.received_qty;
      const accepted = itemInput.accepted_qty !== undefined ? itemInput.accepted_qty : received;
      const rejected = itemInput.rejected_qty !== undefined ? itemInput.rejected_qty : Math.max(0, received - accepted);

      // Determine item receiving status
      let status = RECEIVING_STATUS.PENDING;
      if (itemInput.is_checked) {
        if (accepted === 0 && rejected > 0) {
          status = RECEIVING_STATUS.REJECTED;
        } else if (accepted === mlItem.requested_qty) {
          status = RECEIVING_STATUS.COMPLETE;
        } else if (accepted < mlItem.requested_qty) {
          status = RECEIVING_STATUS.PARTIAL;
        } else if (accepted > mlItem.requested_qty) {
          status = RECEIVING_STATUS.OVER_RECEIVED;
        }
      }

      preparedItems.push({
        receipt_id: receipt._id,
        marketlist_item_id: mlItem._id,
        ordered_qty: mlItem.requested_qty,
        received_qty: received,
        accepted_qty: accepted,
        rejected_qty: rejected,
        is_checked: itemInput.is_checked ?? true,
        condition: itemInput.condition || 'good',
        status,
        item_note: itemInput.item_note || '',
        evidence: itemInput.evidence || []
      });
    }

    await GoodsReceiptItem.insertMany(preparedItems);

    // 5. Update overall Marketlist status based on cumulative receiving
    await this.recalculateMarketlistProgress(marketlistId);

    // 6. Log activity
    await auditService.log({
      entity_type: 'goods_receipt',
      entity_id: receipt._id,
      action: 'goods_received',
      performed_by: user._id,
      description: `Surat Jalan Digital / Goods Receipt ${receipt_number} created for Marketlist ${marketlist.marketlist_number}`
    });

    return this.getReceiptById(receipt._id);
  }

  async updateReceipt(receiptId, data, user, expectedMarketlistId) {
    const receipt = await GoodsReceipt.findById(receiptId);
    if (!receipt) {
      throw new Error('Goods receipt not found');
    }

    if (receipt.status === GOODS_RECEIPT_STATUS.CANCELLED) {
      throw new Error('Cancelled goods receipts cannot be edited');
    }

    const marketlist = await Marketlist.findById(receipt.marketlist_id);
    if (!marketlist) {
      throw new Error('Marketlist not found');
    }
    if (expectedMarketlistId && marketlist._id.toString() !== expectedMarketlistId) {
      throw new Error('Goods receipt does not belong to this marketlist');
    }
    if (marketlist.status === MARKETLIST_STATUS.COMPLETED || marketlist.status === MARKETLIST_STATUS.CANCELLED) {
      throw new Error(`Cannot edit receipts for marketlist with status '${marketlist.status}'`);
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('At least one receipt item is required');
    }

    const existingItems = await GoodsReceiptItem.find({ receipt_id: receipt._id });
    const existingItemMap = new Map(
      existingItems.map((item) => [item.marketlist_item_id.toString(), item])
    );
    const seenIds = new Set();
    const updates = [];

    for (const itemInput of data.items) {
      const itemId = itemInput.marketlist_item_id;
      const existingItem = existingItemMap.get(itemId?.toString());
      if (!existingItem || seenIds.has(existingItem._id.toString())) {
        throw new Error('Receipt item not found or duplicated');
      }
      seenIds.add(existingItem._id.toString());

      const received = Number(itemInput.received_qty);
      const accepted = Number(itemInput.accepted_qty);
      const rejected = Number(itemInput.rejected_qty);
      if (![received, accepted, rejected].every(Number.isFinite) || [received, accepted, rejected].some((qty) => qty < 0)) {
        throw new Error('Receipt quantities must be finite, non-negative numbers');
      }
      if (accepted + rejected > received + 1e-9) {
        throw new Error('Accepted and rejected quantities cannot exceed received quantity');
      }

      const isChecked = itemInput.is_checked ?? existingItem.is_checked;
      const marketlistItem = await MarketlistItem.findById(existingItem.marketlist_item_id)
        .select('requested_qty');
      if (!marketlistItem) {
        throw new Error('Related marketlist item not found');
      }

      const status = getItemReceivingStatus(
        accepted,
        rejected,
        marketlistItem.requested_qty,
        isChecked
      );
      updates.push({
        updateOne: {
          filter: { _id: existingItem._id, receipt_id: receipt._id },
          update: {
            $set: {
              received_qty: received,
              accepted_qty: accepted,
              rejected_qty: rejected,
              is_checked: isChecked,
              condition: itemInput.condition || existingItem.condition,
              status,
              item_note: itemInput.item_note ?? existingItem.item_note
            }
          }
        }
      });
    }

    const before = existingItems
      .filter((item) => seenIds.has(item._id.toString()))
      .map((item) => ({
        marketlist_item_id: item.marketlist_item_id,
        received_qty: item.received_qty,
        accepted_qty: item.accepted_qty,
        rejected_qty: item.rejected_qty
      }));

    await GoodsReceiptItem.bulkWrite(updates);
    if (data.general_condition !== undefined) {
      receipt.general_condition = data.general_condition;
      await receipt.save();
    }

    const updatedItems = existingItems.filter((item) => seenIds.has(item._id.toString()));
    const updatedItemIds = updatedItems.map((item) => item._id);
    const persistedItems = await GoodsReceiptItem.find({ _id: { $in: updatedItemIds } });
    await auditService.log({
      entity_type: 'goods_receipt',
      entity_id: receipt._id,
      action: 'goods_receipt_corrected',
      performed_by: user._id,
      old_value: before,
      new_value: persistedItems.map((item) => ({
        marketlist_item_id: item.marketlist_item_id,
        received_qty: item.received_qty,
        accepted_qty: item.accepted_qty,
        rejected_qty: item.rejected_qty
      })),
      description: `Goods Receipt ${receipt.receipt_number} quantities corrected`
    });

    await this.recalculateMarketlistProgress(receipt.marketlist_id);
    return this.getReceiptById(receipt._id);
  }

  async recalculateMarketlistProgress(marketlistId) {
    const marketlist = await Marketlist.findById(marketlistId);
    if (!marketlist) return;

    // Fetch all marketlist items
    const mlItems = await MarketlistItem.find({ marketlist_id: marketlistId });

    // Fetch all receipt items for this marketlist
    const allReceipts = await GoodsReceipt.find({
      marketlist_id: marketlistId,
      status: { $ne: GOODS_RECEIPT_STATUS.CANCELLED }
    });
    const receiptIds = allReceipts.map((r) => r._id);

    const allReceiptItems = await GoodsReceiptItem.find({ receipt_id: { $in: receiptIds } });

    // Sum accepted quantity per marketlist_item_id
    const acceptedMap = new Map();
    allReceiptItems.forEach((ri) => {
      const key = ri.marketlist_item_id.toString();
      const current = acceptedMap.get(key) || 0;
      acceptedMap.set(key, current + (ri.accepted_qty || 0));
    });

    let allCompleted = true;
    let anyReceived = false;

    for (const item of mlItems) {
      const cumulativeAccepted = acceptedMap.get(item._id.toString()) || 0;
      if (cumulativeAccepted > 0) {
        anyReceived = true;
      }
      if (cumulativeAccepted < item.requested_qty) {
        allCompleted = false;
      }
    }

    if (allCompleted && mlItems.length > 0) {
      marketlist.status = MARKETLIST_STATUS.RECEIVED;
    } else if (anyReceived) {
      marketlist.status = MARKETLIST_STATUS.PARTIALLY_RECEIVED;
    } else {
      marketlist.status = MARKETLIST_STATUS.IN_PROGRESS;
    }

    await marketlist.save();
  }
}

module.exports = new ReceivingService();
