const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const GoodsReceipt = require('../src/modules/receiving/goods-receipt.model');
const GoodsReceiptItem = require('../src/modules/receiving/goods-receipt-item.model');
const IntegrationEvent = require('../src/modules/integrations/integration-event.model');

const receiptId = new mongoose.Types.ObjectId();

const receipt = new GoodsReceipt({
  receipt_number: 'GR-TEST-1',
  marketlist_id: new mongoose.Types.ObjectId(),
  received_by: new mongoose.Types.ObjectId(),
  amphitheater_status: 'pending_approval'
});
assert.equal(receipt.validateSync(), undefined);

const item = new GoodsReceiptItem({
  receipt_id: receiptId,
  marketlist_item_id: new mongoose.Types.ObjectId(),
  ordered_qty: 5,
  received_qty: 4,
  accepted_qty: 3,
  rejected_qty: 1,
  amphitheater_posted_qty: 3
});
assert.equal(item.validateSync(), undefined);

const event = new IntegrationEvent({
  event_id: 'STORE-GR:1:1',
  event_type: 'GOODS_RECEIPT_SUBMITTED',
  aggregate_id: receiptId
});
assert.equal(event.validateSync(), undefined);
assert.equal(event.status, 'pending');

console.log('Store integration model checks passed');
