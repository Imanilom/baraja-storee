const { randomUUID } = require('crypto');
const GoodsReceipt = require('../receiving/goods-receipt.model');
const GoodsReceiptItem = require('../receiving/goods-receipt-item.model');
const Marketlist = require('../marketlists/marketlist.model');
const MarketlistItem = require('../marketlists/marketlist-item.model');
const Purchase = require('../purchases/purchase.model');
const PurchaseItem = require('../purchases/purchase-item.model');
const Waste = require('../waste/waste.model');
const IntegrationEvent = require('./integration-event.model');
const { PURCHASE_STATUS } = require('@purchasing/constants');

const RETRY_LIMIT = 10;

const sameId = (left, right) => left && right && left.toString() === right.toString();

async function buildGoodsReceiptPayload(receiptId) {
  const receipt = await GoodsReceipt.findById(receiptId)
    .populate({
      path: 'marketlist_id',
      populate: { path: 'location_id', select: 'name code' }
    })
    .populate('supplier_id', 'name code')
    .lean();

  if (!receipt) {
    const error = new Error('Goods receipt not found');
    error.statusCode = 404;
    throw error;
  }

  const marketlist = receipt.marketlist_id;
  if (!marketlist) throw new Error('Goods receipt marketlist is unavailable');

  const receiptItems = await GoodsReceiptItem.find({ receipt_id: receipt._id })
    .populate({
      path: 'marketlist_item_id',
      populate: { path: 'product_id', select: 'name sku unit_id' }
    })
    .lean();
  if (!receiptItems.length) throw new Error('Goods receipt has no items');

  const marketlistItemIds = receiptItems
    .map((item) => item.marketlist_item_id?._id)
    .filter(Boolean);
  const purchases = await Purchase.find({
    marketlist_id: marketlist._id,
    status: PURCHASE_STATUS.VERIFIED
  }).select('_id supplier_id purchase_number');
  const purchaseById = new Map(purchases.map((purchase) => [purchase._id.toString(), purchase]));
  const purchaseItems = purchases.length
    ? await PurchaseItem.find({
        purchase_id: { $in: purchases.map((purchase) => purchase._id) },
        marketlist_item_id: { $in: marketlistItemIds }
      }).lean()
    : [];
  const priorReceipts = await GoodsReceipt.find({
    marketlist_id: marketlist._id,
    _id: { $ne: receipt._id },
    status: { $ne: 'cancelled' }
  }).select('_id supplier_id').lean();
  const priorReceiptSupplier = new Map(priorReceipts.map((prior) => [
    prior._id.toString(),
    prior.supplier_id?.toString() || ''
  ]));
  const priorItems = priorReceipts.length
    ? await GoodsReceiptItem.find({
        receipt_id: { $in: priorReceipts.map((prior) => prior._id) },
        marketlist_item_id: { $in: marketlistItemIds }
      }).select('receipt_id marketlist_item_id accepted_qty receiving_waste_qty').lean()
    : [];
  const priorReceivedBySupplierAndItem = new Map();
  for (const priorItem of priorItems) {
    const key = `${priorReceiptSupplier.get(priorItem.receipt_id.toString()) || '*'}:${priorItem.marketlist_item_id}`;
    priorReceivedBySupplierAndItem.set(
      key,
      (priorReceivedBySupplierAndItem.get(key) || 0) +
        Math.max(0, (priorItem.accepted_qty || 0) - (priorItem.receiving_waste_qty || 0))
    );
  }
  const candidateMap = new Map();
  for (const purchaseItem of purchaseItems) {
    const purchase = purchaseById.get(purchaseItem.purchase_id.toString());
    if (!purchase) continue;
    const key = purchaseItem.marketlist_item_id.toString();
    if (!candidateMap.has(key)) candidateMap.set(key, []);
    candidateMap.get(key).push({ purchaseItem, purchase });
  }

  const items = receiptItems.map((receiptItem) => {
    const marketlistItem = receiptItem.marketlist_item_id;
    if (!marketlistItem?.product_id) {
      throw new Error(`Receipt item ${receiptItem._id} has no linked product`);
    }

    const candidates = candidateMap.get(marketlistItem._id.toString()) || [];
    const expectedSupplierId = receipt.supplier_id?._id || marketlistItem.supplier_id;
    const matching = candidates.filter(({ purchase }) =>
      !expectedSupplierId || sameId(purchase.supplier_id, expectedSupplierId)
    );
    if (matching.length !== 1) {
      throw new Error(
        matching.length
          ? `Receipt item ${receiptItem._id} matches multiple verified purchase lines; correct the purchase linkage before syncing`
          : `Receipt item ${receiptItem._id} has no verified purchase line for its supplier`
      );
    }

    const { purchaseItem, purchase } = matching[0];
    if (!Number.isFinite(purchaseItem.actual_qty) || purchaseItem.actual_qty < 0) {
      throw new Error(`Purchase item ${purchaseItem._id} has an invalid purchased quantity`);
    }

    const product = marketlistItem.product_id;
    const sourceUnit = purchaseItem.unit_name || marketlistItem.product_snapshot?.unit_name || '';
    const productUnit = marketlistItem.product_snapshot?.unit_name || '';
    const productUnitId = product.unit_id?._id?.toString() || product.unit_id?.toString() || '';
    const externalUnitId = sourceUnit && productUnit &&
      sourceUnit.trim().toLowerCase() !== productUnit.trim().toLowerCase()
      ? sourceUnit.trim()
      : productUnitId;
    const supplierId = (expectedSupplierId || purchase.supplier_id)?.toString() || '';
    const historicalReceivedQty =
      (priorReceivedBySupplierAndItem.get(`${supplierId}:${marketlistItem._id}`) || 0) +
      (priorReceivedBySupplierAndItem.get(`*:${marketlistItem._id}`) || 0);
    const receivingWasteQty = Number(receiptItem.receiving_waste_qty) || 0;
    if (receivingWasteQty > Number(receiptItem.accepted_qty || 0) + 1e-9) {
      throw new Error(`Receiving waste exceeds accepted quantity for receipt item ${receiptItem._id}`);
    }
    return {
      external_receipt_item_id: receiptItem._id.toString(),
      external_product_id: product._id.toString(),
      product_name: product.name || marketlistItem.product_snapshot?.name || '',
      product_sku: product.sku || marketlistItem.product_snapshot?.sku || '',
      external_purchase_id: purchase._id.toString(),
      purchase_number: purchase.purchase_number,
      external_purchase_item_id: purchaseItem._id.toString(),
      external_marketlist_item_id: marketlistItem._id.toString(),
      external_unit_id: externalUnitId,
      source_unit: sourceUnit || product.unit_id?.toString() || 'unmapped',
      purchased_qty: purchaseItem.actual_qty,
      previously_received_qty: historicalReceivedQty,
      received_qty: receiptItem.received_qty,
      accepted_qty: Math.max(0, receiptItem.accepted_qty - receivingWasteQty),
      received_waste_qty: receivingWasteQty,
      rejected_qty: receiptItem.rejected_qty,
      condition: receiptItem.condition,
      notes: receiptItem.item_note || (receivingWasteQty ? `Waste saat penerimaan: ${receivingWasteQty} ${sourceUnit}` : '')
    };
  });

  return {
    event_id: randomUUID(),
    event_type: 'GOODS_RECEIPT_SUBMITTED',
    source_system: 'BARAJA_STORE',
    external_receipt_id: receipt._id.toString(),
    receipt_number: receipt.receipt_number,
    external_marketlist_id: marketlist._id.toString(),
    marketlist_number: marketlist.marketlist_number,
    external_supplier_id: receipt.supplier_id?._id?.toString() || '',
    supplier_name: receipt.supplier_id?.name || '',
    external_purchase_ids: [...new Set(items.map((item) => item.external_purchase_id))],
    location: marketlist.location_id ? {
      external_location_id: marketlist.location_id._id.toString(),
      name: marketlist.location_id.name || '',
      code: marketlist.location_id.code || ''
    } : null,
    received_at: receipt.received_at,
    submitted_by: receipt.received_by?.toString() || '',
    notes: receipt.general_condition || '',
    items
  };
}

async function buildWastePayload(wasteId, eventId = randomUUID()) {
  const waste = await Waste.findById(wasteId)
    .populate('product_id', 'name sku unit_id')
    .populate('product_id.unit_id', 'name abbreviation')
    .populate('location_id', 'name code')
    .lean();
  if (!waste) {
    const error = new Error('Waste record not found');
    error.statusCode = 404;
    throw error;
  }
  if (waste.stage === 'received' || !waste.location_id) {
    throw new Error('Only post-receiving waste with a mapped location can be synchronized');
  }
  const product = waste.product_id;
  if (!product) throw new Error('Waste product is unavailable');
  return {
    event_id: eventId,
    event_type: 'STOCK_WASTE_RECORDED',
    source_system: 'BARAJA_STORE',
    external_waste_id: waste._id.toString(),
    external_product_id: product._id.toString(),
    external_unit_id: product.unit_id?._id?.toString() || product.unit_id?.toString() || '',
    source_unit: waste.unit_name || product.unit_id?.abbreviation || product.unit_id?.name || '',
    external_location_id: waste.location_id._id.toString(),
    location_name: waste.location_id.name || '',
    quantity: waste.quantity,
    wasted_at: waste.wasted_at,
    reason: waste.reason,
    notes: waste.notes || ''
  };
}

async function enqueueGoodsReceiptSync(receiptId, { force = false } = {}) {
  if (!force) {
    const existing = await IntegrationEvent.findOne({ aggregate_id: receiptId, aggregate_type: 'goods_receipt' })
      .sort({ createdAt: -1 });
    if (existing) return existing;
  }

  const event = await IntegrationEvent.create({
    event_id: randomUUID(),
    event_type: 'GOODS_RECEIPT_SUBMITTED',
    aggregate_type: 'goods_receipt',
    aggregate_id: receiptId,
    status: 'pending',
    attempts: 0,
    next_attempt_at: new Date()
  });
  await GoodsReceipt.updateOne(
    { _id: receiptId, amphitheater_status: { $nin: ['approved', 'posted', 'reversed'] } },
    { $set: { amphitheater_status: 'sync_pending' } }
  );
  return event;
}

async function enqueueWasteSync(wasteId, { force = false } = {}) {
  if (!force) {
    const existing = await IntegrationEvent.findOne({ aggregate_id: wasteId, aggregate_type: 'waste' })
      .sort({ createdAt: -1 });
    if (existing) return existing;
  }
  const eventId = randomUUID();
  const payload = await buildWastePayload(wasteId, eventId);
  const event = await IntegrationEvent.create({
    event_id: eventId,
    event_type: 'STOCK_WASTE_RECORDED',
    aggregate_type: 'waste',
    aggregate_id: wasteId,
    payload,
    status: 'pending',
    attempts: 0,
    next_attempt_at: new Date()
  });
  await Waste.updateOne(
    { _id: wasteId },
    { $set: { integration_status: 'sync_pending', integration_error: '' } }
  );
  return event;
}

async function deliverEvent(event) {
  const baseUrl = process.env.BARAJA_AMPHITHEATER_API_URL;
  const secret = process.env.BARAJA_STORE_INTEGRATION_SECRET;
  if (!baseUrl || !secret) throw new Error('Amphitheater integration URL or shared secret is not configured');

  let payload = event.payload;
  if (!payload) {
    payload = event.aggregate_type === 'waste'
      ? await buildWastePayload(event.aggregate_id, event.event_id)
      : await buildGoodsReceiptPayload(event.aggregate_id);
    if (event.aggregate_type !== 'waste') payload.event_id = event.event_id;
    await IntegrationEvent.updateOne({ _id: event._id }, { $set: { payload } });
  }
  const endpoint = event.aggregate_type === 'waste' ? 'wastes' : 'receivings';
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/integration/${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Amphitheater returned HTTP ${response.status}`);
  }

  const result = await response.json();
  if (event.aggregate_type === 'waste') {
    const data = result.data || result;
    await Waste.updateOne(
      { _id: event.aggregate_id },
      {
        $set: {
          integration_status: 'synced',
          integration_movement_id: data.movement_id || null,
          integration_stock_balance: Number.isFinite(Number(data.stock_balance)) ? Number(data.stock_balance) : undefined,
          integration_last_sync_at: new Date(),
          integration_error: ''
        }
      }
    );
    await IntegrationEvent.updateOne(
      { _id: event._id },
      { $set: { status: 'delivered', delivered_at: new Date(), last_error: null, lease_until: null } }
    );
    return;
  }
  const receiptId = result.data?.receipt_id || result.receipt_id || result.data?.receiptId;
  await GoodsReceipt.updateOne(
    { _id: event.aggregate_id },
    {
      $set: {
        amphitheater_status: result.data?.status || result.status || 'submitted',
        amphitheater_receipt_id: receiptId || null,
        amphitheater_last_sync_at: new Date()
      }
    }
  );
  await IntegrationEvent.updateOne(
    { _id: event._id },
    { $set: { status: 'delivered', delivered_at: new Date(), last_error: null, lease_until: null } }
  );
}

async function processOneEvent() {
  const now = new Date();
  const event = await IntegrationEvent.findOneAndUpdate(
    {
      attempts: { $lt: RETRY_LIMIT },
      next_attempt_at: { $lte: now },
      $or: [
        { status: { $in: ['pending', 'failed'] }, $or: [{ lease_until: null }, { lease_until: { $lte: now } }] },
        { status: 'processing', lease_until: { $lte: now } }
      ]
    },
    {
      $set: { status: 'processing', lease_until: new Date(now.getTime() + 30000) },
      $inc: { attempts: 1 }
    },
    { sort: { createdAt: 1 }, new: true }
  );
  if (!event) return false;

  try {
    await deliverEvent(event);
  } catch (error) {
    const retryDelay = Math.min(15 * 60 * 1000, 1000 * (2 ** Math.min(event.attempts, 10)));
    const aggregateUpdate = event.aggregate_type === 'waste'
      ? Waste.updateOne(
          { _id: event.aggregate_id },
          {
            $set: {
              integration_status: 'sync_failed',
              integration_last_sync_at: new Date(),
              integration_error: error.message.slice(0, 500)
            }
          }
        )
      : GoodsReceipt.updateOne(
          { _id: event.aggregate_id, amphitheater_status: { $ne: 'posted' } },
          { $set: { amphitheater_status: 'sync_failed', amphitheater_last_sync_at: new Date() } }
        );
    const linkedWasteUpdate = event.aggregate_type === 'goods_receipt'
      ? Waste.updateMany(
          { goods_receipt_id: event.aggregate_id },
          {
            $set: {
              integration_status: 'sync_failed',
              integration_last_sync_at: new Date(),
              integration_error: error.message.slice(0, 500)
            }
          }
        )
      : Promise.resolve();
    await Promise.all([
      IntegrationEvent.updateOne(
        { _id: event._id },
        {
          $set: {
            status: 'failed',
            last_error: error.message.slice(0, 500),
            next_attempt_at: new Date(Date.now() + retryDelay),
            lease_until: null
          }
        }
      ),
      aggregateUpdate,
      linkedWasteUpdate
    ]);
    console.error(`[Receiving integration] Event ${event.event_id} failed: ${error.message}`);
  }
  return true;
}

function startOutboxWorker() {
  if (!process.env.BARAJA_AMPHITHEATER_API_URL || !process.env.BARAJA_STORE_INTEGRATION_SECRET) {
    console.warn('[Receiving integration] Outbox worker disabled; integration URL and shared secret are required');
    return;
  }

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processOneEvent();
    } catch (error) {
      console.error(`[Receiving integration] Outbox worker error: ${error.message}`);
    } finally {
      running = false;
    }
  }, 3000);
  timer.unref();
}

module.exports = {
  buildGoodsReceiptPayload,
  enqueueGoodsReceiptSync,
  buildWastePayload,
  enqueueWasteSync,
  processOneEvent,
  startOutboxWorker
};
