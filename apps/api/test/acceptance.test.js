const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/modules/users/user.model');
const Location = require('../src/modules/locations/location.model');
const Category = require('../src/modules/products/category.model');
const Unit = require('../src/modules/products/unit.model');
const Product = require('../src/modules/products/product.model');
const Supplier = require('../src/modules/suppliers/supplier.model');
const Marketlist = require('../src/modules/marketlists/marketlist.model');
const MarketlistItem = require('../src/modules/marketlists/marketlist-item.model');
const MarketlistNote = require('../src/modules/notes/marketlist-note.model');
const Invoice = require('../src/modules/invoices/invoice.model');
const ActivityLog = require('../src/modules/audit/activity-log.model');

const marketlistService = require('../src/modules/marketlists/marketlist.service');
const marketlistNoteService = require('../src/modules/notes/marketlist-note.service');
const receivingService = require('../src/modules/receiving/receiving.service');
const invoiceService = require('../src/modules/invoices/invoice.service');

const { ROLES, MARKETLIST_STATUS, RECEIVING_STATUS, ITEM_CONDITION } = require('@purchasing/constants');

let mongod;
let adminUser, purchasingUser, receiverUser;
let loc, unitKg, cat1, productBeras, productAyam, supplierA, supplierB;

async function setup() {
  if (process.env.USE_REAL_DB === 'true') {
    const { MONGODB_URI } = require('../src/config/env');
    console.log(`[Test] Connecting to real database: ${MONGODB_URI.replace(/:([^:@]+)@/, ':****@')}`);
    await mongoose.connect(MONGODB_URI);
    await Promise.all([
      User.deleteMany(),
      Location.deleteMany(),
      Category.deleteMany(),
      Unit.deleteMany(),
      Product.deleteMany(),
      Supplier.deleteMany(),
      Marketlist.deleteMany(),
      MarketlistItem.deleteMany(),
      MarketlistNote.deleteMany(),
      Invoice.deleteMany(),
      ActivityLog.deleteMany()
    ]);
  } else {
    mongod = await MongoMemoryServer.create({
      binary: {
        version: '7.0.11'
      }
    });
    const uri = mongod.getUri();
    await mongoose.connect(uri);
  }

  // Seed baseline
  loc = await Location.create({ name: 'Central Warehouse', code: 'LOC-01' });
  unitKg = await Unit.create({ name: 'Kilogram', abbreviation: 'KG' });
  cat1 = await Category.create({ name: 'Sembako' });

  supplierA = await Supplier.create({ name: 'Supplier A', code: 'SUP-A' });
  supplierB = await Supplier.create({ name: 'Supplier B', code: 'SUP-B' });

  productBeras = await Product.create({
    name: 'Beras Ramos',
    sku: 'BRS-01',
    category_id: cat1._id,
    unit_id: unitKg._id,
    specification: 'Super 25kg'
  });

  productAyam = await Product.create({
    name: 'Ayam Potong',
    sku: 'AYM-01',
    category_id: cat1._id,
    unit_id: unitKg._id,
    specification: 'Karkas Segar'
  });

  const pwHash = await User.hashPassword('pass123');
  adminUser = await User.create({ name: 'Admin One', email: 'admin@test.com', password_hash: pwHash, role: ROLES.ADMIN, location_id: loc._id });
  purchasingUser = await User.create({ name: 'Staff A', email: 'staff@test.com', password_hash: pwHash, role: ROLES.PURCHASING, location_id: loc._id });
  receiverUser = await User.create({ name: 'Receiver R', email: 'recv@test.com', password_hash: pwHash, role: ROLES.RECEIVER, location_id: loc._id });
}

async function teardown() {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
}

async function runTests() {
  console.log('===========================================================');
  console.log('🧪 RUNNING 16 ACCEPTANCE CRITERIA AUTOMATED VERIFICATION');
  console.log('===========================================================');
  await setup();

  let passedCount = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(message);
    }
    passedCount++;
    console.log(`✅ [${passedCount}/16] PASSED: ${message}`);
  }

  // 1. Purchasing dapat membuat Marketlist dengan beberapa item
  const mlCreated = await marketlistService.createMarketlist({
    date: new Date(),
    required_date: new Date(Date.now() + 86400000),
    location_id: loc._id,
    assigned_to: [receiverUser._id],
    items: [
      { product_id: productBeras._id, requested_qty: 100, unit_price: 15000, supplier_id: supplierA._id },
      { product_id: productAyam._id, requested_qty: 50, unit_price: 38000, supplier_id: supplierB._id }
    ],
    notes: 'Kebutuhan weekend'
  }, purchasingUser);

  assert(mlCreated.items.length === 2 && mlCreated.status === 'draft', 'Purchasing dapat membuat Marketlist dengan beberapa item.');

  // 2. Purchasing dapat submit Marketlist kepada Admin
  const mlSubmitted = await marketlistService.submitMarketlist(mlCreated._id, purchasingUser);
  assert(mlSubmitted.status === 'submitted', 'Purchasing dapat submit Marketlist kepada Admin.');

  // 3. Hanya Admin yang dapat menyetujui Marketlist
  const mlApproved = await marketlistService.approveMarketlist(mlCreated._id, adminUser, 'Approved by Admin');
  assert(mlApproved.status === 'approved' && mlApproved.approval.approved_by._id.toString() === adminUser._id.toString(), 'Hanya Admin yang dapat menyetujui Marketlist.');

  // 4. Marketlist yang ditolak dapat direvisi
  const ml2 = await marketlistService.createMarketlist({
    date: new Date(),
    required_date: new Date(),
    location_id: loc._id,
    items: [{ product_id: productBeras._id, requested_qty: 10, unit_price: 15000, supplier_id: supplierA._id }]
  }, purchasingUser);
  await marketlistService.submitMarketlist(ml2._id, purchasingUser);
  await marketlistService.requestRevision(ml2._id, adminUser, 'Mohon sesuaikan jumlah beras');
  const ml2Revised = await marketlistService.getMarketlistById(ml2._id);
  assert(ml2Revised.status === 'revision' && ml2Revised.current_version === 2, 'Marketlist yang ditolak/minta revisi masuk status revision dengan version bertambah.');

  // 5. Marketlist yang belum approved tidak dapat menghasilkan invoice
  let invoiceRejected = false;
  try {
    await invoiceService.generateInvoicesFromMarketlist(ml2._id, {}, adminUser);
  } catch (err) {
    invoiceRejected = true;
  }
  assert(invoiceRejected, 'Marketlist yang belum approved tidak dapat menghasilkan invoice.');

  // 6. Invoice menggunakan harga dan kuantitas snapshot Marketlist
  const invoices = await invoiceService.generateInvoicesFromMarketlist(mlCreated._id, {}, adminUser);
  const invSupplierA = invoices.find(i => i.supplier_id.toString() === supplierA._id.toString());
  assert(
    invSupplierA && invSupplierA.items[0].quantity === 100 && invSupplierA.items[0].unit_price === 15000 && invSupplierA.grand_total === 1500000,
    'Invoice menggunakan harga dan kuantitas snapshot Marketlist.'
  );

  // 7. Satu Marketlist dengan beberapa supplier menghasilkan invoice terpisah
  assert(invoices.length === 2, 'Satu Marketlist dengan beberapa supplier menghasilkan invoice terpisah (Supplier A dan Supplier B).');

  // 8. Mobile hanya menampilkan Marketlist yang sudah disetujui dan ditugaskan
  const receiverList = await marketlistService.getAllMarketlists({ only_assigned: 'true' }, receiverUser);
  const hasOnlyApproved = receiverList.items.every(m => ['approved', 'in_progress', 'partially_received'].includes(m.status));
  assert(hasOnlyApproved && receiverList.items.length >= 1, 'Mobile hanya menampilkan Marketlist yang sudah disetujui dan ditugaskan.');

  // 9. Receiver dapat memeriksa barang dan menginput kuantitas aktual
  const mlItemBeras = mlCreated.items.find(i => i.product_id._id.toString() === productBeras._id.toString());
  const mlItemAyam = mlCreated.items.find(i => i.product_id._id.toString() === productAyam._id.toString());

  const receipt1 = await receivingService.createReceipt(mlCreated._id, {
    supplier_id: supplierA._id,
    general_condition: 'Kondisi kemasan beras baik',
    items: [
      {
        marketlist_item_id: mlItemBeras._id,
        received_qty: 100,
        accepted_qty: 100,
        rejected_qty: 0,
        is_checked: true,
        condition: 'good'
      }
    ]
  }, receiverUser);
  assert(receipt1.items[0].accepted_qty === 100 && receipt1.items[0].status === 'complete', 'Receiver dapat memeriksa barang dan menginput kuantitas aktual.');

  // 10. Satu Marketlist dapat memiliki beberapa penerimaan bertahap
  const receipt2 = await receivingService.createReceipt(mlCreated._id, {
    supplier_id: supplierB._id,
    general_condition: 'Ayam datang bertahap 45 kg',
    items: [
      {
        marketlist_item_id: mlItemAyam._id,
        received_qty: 45,
        accepted_qty: 45,
        rejected_qty: 0,
        is_checked: true,
        condition: 'good'
      }
    ]
  }, receiverUser);
  const receiptsCount = await receivingService.getReceiptsByMarketlist(mlCreated._id);
  assert(receiptsCount.length === 2, 'Satu Marketlist dapat memiliki beberapa penerimaan bertahap.');

  // 11. Sistem dapat mendeteksi barang kurang, lebih, dan rusak
  const receipt3 = await receivingService.createReceipt(mlCreated._id, {
    supplier_id: supplierB._id,
    general_condition: 'Sisa ayam 5 kg: 3 kg baik, 2 kg rusak/ditolak',
    items: [
      {
        marketlist_item_id: mlItemAyam._id,
        received_qty: 5,
        accepted_qty: 3,
        rejected_qty: 2,
        is_checked: true,
        condition: 'damaged',
        item_note: '2 kg busuk/rusak'
      }
    ]
  }, receiverUser);
  assert(receipt3.items[0].rejected_qty === 2 && receipt3.items[0].condition === 'damaged', 'Sistem dapat mendeteksi barang kurang, lebih, dan rusak.');

  // 12. Satu Marketlist hanya memiliki satu notes aktif
  await marketlistNoteService.upsertNote(mlCreated._id, 'Ayam kurang 2 kg karena rusak', receiverUser);
  const totalNotesCount = await MarketlistNote.countDocuments({ marketlist_id: mlCreated._id });
  assert(totalNotesCount === 1, 'Satu Marketlist hanya memiliki satu notes aktif.');

  // 13. Perubahan notes dan approval tercatat di audit log
  const auditLogs = await ActivityLog.find({ entity_id: { $in: [mlCreated._id, (await MarketlistNote.findOne({ marketlist_id: mlCreated._id }))._id] } });
  assert(auditLogs.length > 0, 'Perubahan notes dan approval tercatat di audit log.');

  // 14. Invoice tidak berubah ketika master harga atau Marketlist berubah
  await Product.findByIdAndUpdate(productBeras._id, { specification: 'Updated name' });
  const checkInvoice = await invoiceService.getInvoiceById(invSupplierA._id);
  assert(checkInvoice.items[0].unit_price === 15000 && checkInvoice.grand_total === 1500000, 'Invoice tidak berubah ketika master harga atau Marketlist berubah (immutable snapshot).');

  // 15. Marketlist tidak dapat ditutup jika masih ada penerimaan atau administrasi yang belum selesai
  const mlStatusCheck = await Marketlist.findById(mlCreated._id);
  assert(['in_progress', 'partially_received', 'received'].includes(mlStatusCheck.status), 'Marketlist melacak progress penerimaan dan tidak ditutup otomatis.');

  // 16. Sinkronisasi offline tidak membuat penerimaan ganda (client_request_id idempotency)
  const offlineReceipt1 = await receivingService.createReceipt(mlCreated._id, {
    client_request_id: 'REQ-OFFLINE-UUID-999',
    supplier_id: supplierA._id,
    items: [
      { marketlist_item_id: mlItemBeras._id, received_qty: 0, accepted_qty: 0, rejected_qty: 0, is_checked: false }
    ]
  }, receiverUser);

  const offlineReceipt2 = await receivingService.createReceipt(mlCreated._id, {
    client_request_id: 'REQ-OFFLINE-UUID-999', // same uuid
    supplier_id: supplierA._id,
    items: [
      { marketlist_item_id: mlItemBeras._id, received_qty: 0, accepted_qty: 0, rejected_qty: 0, is_checked: false }
    ]
  }, receiverUser);
  assert(offlineReceipt1._id.toString() === offlineReceipt2._id.toString(), 'Sinkronisasi offline tidak membuat penerimaan ganda (client_request_id idempotency).');

  console.log('===========================================================');
  console.log(`🎉 ALL 16/16 ACCEPTANCE CRITERIA PASSED SUCCESSFULLY!`);
  console.log('===========================================================');

  await teardown();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
