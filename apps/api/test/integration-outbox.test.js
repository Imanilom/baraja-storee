const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('../src/database/registerModels');
const IntegrationEvent = require('../src/modules/integrations/integration-event.model');
const integrationService = require('../src/modules/integrations/integration.service');

const Product = mongoose.model('Product');
const Unit = mongoose.model('Unit');
const Supplier = mongoose.model('Supplier');
const Location = mongoose.model('Location');
const Marketlist = mongoose.model('Marketlist');
const MarketlistItem = mongoose.model('MarketlistItem');
const Purchase = mongoose.model('Purchase');
const PurchaseItem = mongoose.model('PurchaseItem');
const GoodsReceipt = mongoose.model('GoodsReceipt');
const GoodsReceiptItem = mongoose.model('GoodsReceiptItem');

async function run() {
  const mongod = await MongoMemoryServer.create({ binary: { version: '7.0.11' } });
  const originalFetch = global.fetch;
  const originalUrl = process.env.BARAJA_AMPHITHEATER_API_URL;
  const originalSecret = process.env.BARAJA_STORE_INTEGRATION_SECRET;
  let fetchCount = 0;
  const sentPayloads = [];

  try {
    await mongoose.connect(mongod.getUri());
    const [unit, supplier, location] = await Promise.all([
      Unit.create({ name: 'Kilogram', abbreviation: 'KG' }),
      Supplier.create({ name: 'Receiving Integration Supplier', code: 'RCV-SUP' }),
      Location.create({ name: 'Receiving Integration Location', code: 'RCV-LOC' })
    ]);
    const product = await Product.create({
      name: 'Integration Rice',
      sku: 'RCV-RICE',
      unit_id: unit._id
    });
    const marketlist = await Marketlist.create({
      marketlist_number: 'ML-RECEIVING-TEST',
      date: new Date(),
      required_date: new Date(),
      location_id: location._id,
      created_by: new mongoose.Types.ObjectId()
    });
    const marketlistItem = await MarketlistItem.create({
      marketlist_id: marketlist._id,
      product_id: product._id,
      product_snapshot: { name: product.name, sku: product.sku, unit_name: 'KG' },
      supplier_id: supplier._id,
      requested_qty: 10,
      unit_price: 2,
      subtotal: 20
    });
    const purchase = await Purchase.create({
      purchase_number: 'PO-RECEIVING-TEST',
      marketlist_id: marketlist._id,
      supplier_id: supplier._id,
      total_actual: 20,
      status: 'verified'
    });
    const purchaseItem = await PurchaseItem.create({
      purchase_id: purchase._id,
      marketlist_item_id: marketlistItem._id,
      product_id: product._id,
      product_name: product.name,
      unit_name: 'KG',
      actual_qty: 10,
      actual_unit_price: 2,
      actual_subtotal: 20
    });
    const userId = new mongoose.Types.ObjectId();
    const priorReceipt = await GoodsReceipt.create({
      receipt_number: 'GR-RECEIVING-PRIOR',
      marketlist_id: marketlist._id,
      received_by: userId,
      supplier_id: supplier._id
    });
    await GoodsReceiptItem.create({
      receipt_id: priorReceipt._id,
      marketlist_item_id: marketlistItem._id,
      ordered_qty: 10,
      received_qty: 3,
      accepted_qty: 3,
      rejected_qty: 0,
      is_checked: true
    });
    const receipt = await GoodsReceipt.create({
      receipt_number: 'GR-RECEIVING-OUTBOX',
      marketlist_id: marketlist._id,
      received_by: userId,
      supplier_id: supplier._id
    });
    const receiptItem = await GoodsReceiptItem.create({
      receipt_id: receipt._id,
      marketlist_item_id: marketlistItem._id,
      ordered_qty: 10,
      received_qty: 4,
      accepted_qty: 4,
      rejected_qty: 0,
      is_checked: true
    });

    const exported = await integrationService.buildGoodsReceiptPayload(receipt._id);
    assert.equal(exported.items.length, 1);
    assert.equal(exported.items[0].external_purchase_item_id, purchaseItem._id.toString());
    assert.equal(exported.items[0].previously_received_qty, 3);

    const event = await IntegrationEvent.create({
      event_id: 'store-receiving-outbox-test',
      event_type: 'GOODS_RECEIPT_SUBMITTED',
      aggregate_id: receipt._id,
      status: 'pending'
    });
    process.env.BARAJA_AMPHITHEATER_API_URL = 'https://amphitheater.test';
    process.env.BARAJA_STORE_INTEGRATION_SECRET = 'test-only-shared-secret';
    global.fetch = async (url, options) => {
      fetchCount += 1;
      assert.equal(url, 'https://amphitheater.test/api/integration/receivings');
      assert.equal(options.headers.authorization, 'Bearer test-only-shared-secret');
      const requestPayload = JSON.parse(options.body);
      assert.equal(requestPayload.items[0].external_purchase_item_id, purchaseItem._id.toString());
      sentPayloads.push(requestPayload);
      if (fetchCount === 1) return { ok: false, status: 503 };
      return {
        ok: true,
        status: 201,
        json: async () => ({ data: { receipt_id: 'AMP-GR-1', status: 'submitted' } })
      };
    };

    assert.equal(await integrationService.processOneEvent(), true);
    let updatedEvent = await IntegrationEvent.findById(event._id);
    assert.equal(updatedEvent.status, 'failed');
    assert.equal(updatedEvent.attempts, 1);
    await IntegrationEvent.updateOne({ _id: event._id }, { $set: { next_attempt_at: new Date(0) } });

    assert.equal(await integrationService.processOneEvent(), true);
    updatedEvent = await IntegrationEvent.findById(event._id);
    assert.equal(updatedEvent.status, 'delivered');
    assert.equal(updatedEvent.attempts, 2);
    assert.equal(fetchCount, 2);
    assert.deepEqual(sentPayloads[0], sentPayloads[1], 'retry payloads must be stable');
    assert.deepEqual(JSON.parse(JSON.stringify(updatedEvent.payload)), sentPayloads[0]);

    const syncedReceipt = await GoodsReceipt.findById(receipt._id);
    assert.equal(syncedReceipt.amphitheater_status, 'submitted');
    assert.equal(syncedReceipt.amphitheater_receipt_id, 'AMP-GR-1');
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.BARAJA_AMPHITHEATER_API_URL;
    else process.env.BARAJA_AMPHITHEATER_API_URL = originalUrl;
    if (originalSecret === undefined) delete process.env.BARAJA_STORE_INTEGRATION_SECRET;
    else process.env.BARAJA_STORE_INTEGRATION_SECRET = originalSecret;
    await mongoose.disconnect();
    await mongod.stop();
  }
}

run().then(() => {
  console.log('Store integration outbox checks passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
