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
const Purchase = require('../src/modules/purchases/purchase.model');
const PurchaseItem = require('../src/modules/purchases/purchase-item.model');
const ActivityLog = require('../src/modules/audit/activity-log.model');
const ProductPrice = require('../src/modules/prices/product-price.model');
const Waste = require('../src/modules/waste/waste.model');
const overheadService = require('../src/modules/overheads/overhead.service');
const cashFlowService = require('../src/modules/cash-flow/cash-flow.service');
const inventoryService = require('../src/modules/inventory/inventory.service');

const marketlistService = require('../src/modules/marketlists/marketlist.service');
const marketlistNoteService = require('../src/modules/notes/marketlist-note.service');
const receivingService = require('../src/modules/receiving/receiving.service');
const invoiceService = require('../src/modules/invoices/invoice.service');
const purchaseService = require('../src/modules/purchases/purchase.service');
const priceService = require('../src/modules/prices/prices.service');
const wasteService = require('../src/modules/waste/waste.service');
const productService = require('../src/modules/products/product.service');

const { ROLES, MARKETLIST_STATUS, RECEIVING_STATUS, ITEM_CONDITION } = require('@purchasing/constants');
const { createGoodsReceiptSchema, updateGoodsReceiptSchema } = require('@purchasing/validation');

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
    department: 'kitchen',
    unit_id: unitKg._id,
    specification: 'Super 25kg'
  });

  productAyam = await Product.create({
    name: 'Ayam Potong',
    sku: 'AYM-01',
    category_id: cat1._id,
    department: 'bar',
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
  console.log('🧪 RUNNING 50 ACCEPTANCE CRITERIA AUTOMATED VERIFICATION');
  console.log('===========================================================');
  await setup();

  let passedCount = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(message);
    }
    passedCount++;
    console.log(`✅ [${passedCount}/50] PASSED: ${message}`);
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

  // 2. Marketlist harian menggabungkan kuantitas dan memisahkan Kitchen / Bar
  await marketlistService.createMarketlist({
    date: new Date(),
    required_date: mlCreated.required_date,
    location_id: loc._id,
    items: [
      { product_id: productBeras._id, requested_qty: 25, unit_price: 15000, supplier_id: supplierA._id },
      { product_id: productAyam._id, requested_qty: 5, unit_price: 38000, supplier_id: supplierB._id }
    ]
  }, purchasingUser);
  const dailyPrint = await marketlistService.getDailyPrintData(mlCreated.required_date);
  const dailyBeras = dailyPrint.items.find((item) => item.product_id === productBeras._id.toString());
  const dailyAyam = dailyPrint.items.find((item) => item.product_id === productAyam._id.toString());
  assert(
    dailyPrint.marketlist_count === 2 &&
      dailyBeras?.department === 'kitchen' &&
      dailyBeras.total_requested_qty === 125 &&
      dailyAyam?.department === 'bar' &&
      dailyAyam.total_requested_qty === 55,
    'Cetak harian menggabungkan kuantitas per tanggal kebutuhan dan memisahkan Kitchen / Bar.'
  );

  // 3. Kondisi barang shortage dan overage dari Flutter diterima schema API
  const receiptValidation = createGoodsReceiptSchema.safeParse({
    items: [
      {
        marketlist_item_id: mlCreated.items[0]._id.toString(),
        received_qty: 5,
        accepted_qty: 5,
        rejected_qty: 0,
        condition: ITEM_CONDITION.SHORTAGE,
        is_checked: true
      },
      {
        marketlist_item_id: mlCreated.items[1]._id.toString(),
        received_qty: 55,
        accepted_qty: 55,
        rejected_qty: 0,
        condition: ITEM_CONDITION.OVERAGE,
        is_checked: true
      },
      {
        marketlist_item_id: mlCreated.items[0]._id.toString(),
        received_qty: 1.5,
        accepted_qty: 1.25,
        rejected_qty: 0.25,
        condition: ITEM_CONDITION.SHORTAGE,
        is_checked: true
      }
    ]
  });
  assert(
    receiptValidation.success &&
      receiptValidation.data.items[2].received_qty === 1.5 &&
      receiptValidation.data.items[2].accepted_qty === 1.25 &&
      receiptValidation.data.items[2].rejected_qty === 0.25,
    'Validasi API menerima kondisi shortage / overage dan kuantitas desimal dari Flutter.'
  );

  // 4. Purchasing dapat submit Marketlist kepada Admin
  const mlSubmitted = await marketlistService.submitMarketlist(mlCreated._id, purchasingUser);
  assert(mlSubmitted.status === 'submitted', 'Purchasing dapat submit Marketlist kepada Admin.');

  // 5. Hanya Admin yang dapat menyetujui Marketlist
  const mlApproved = await marketlistService.approveMarketlist(mlCreated._id, adminUser, 'Approved by Admin');
  assert(mlApproved.status === 'approved' && mlApproved.approval.approved_by._id.toString() === adminUser._id.toString(), 'Hanya Admin yang dapat menyetujui Marketlist.');

  // 6. Marketlist yang ditolak dapat direvisi
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

  // 7. Marketlist yang belum approved tidak dapat menghasilkan invoice
  let invoiceRejected = false;
  try {
    await invoiceService.generateInvoicesFromMarketlist(ml2._id, {}, adminUser);
  } catch (err) {
    invoiceRejected = true;
  }
  assert(invoiceRejected, 'Marketlist yang belum approved tidak dapat menghasilkan invoice.');

  // 8. Marketlist approved tanpa barang diterima tidak dapat menghasilkan invoice
  let invoiceWithoutReceiptsRejected = false;
  try {
    await invoiceService.generateInvoicesFromMarketlist(mlCreated._id, {}, adminUser);
  } catch (err) {
    invoiceWithoutReceiptsRejected = err.message.includes('No accepted goods');
  }
  assert(invoiceWithoutReceiptsRejected, 'Marketlist tanpa barang diterima tidak dapat menghasilkan invoice.');

  // 9. Mobile hanya menampilkan Marketlist yang sudah disetujui dan ditugaskan
  const receiverList = await marketlistService.getAllMarketlists({ only_assigned: 'true' }, receiverUser);
  const hasOnlyApproved = receiverList.items.every(m => ['approved', 'partial_rejection', 'in_progress', 'partially_received'].includes(m.status));
  assert(hasOnlyApproved && receiverList.items.length >= 1, 'Mobile hanya menampilkan Marketlist yang sudah disetujui dan ditugaskan.');

  // 10. Receiver dapat memeriksa barang dan menginput kuantitas aktual
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

  // 11. Satu Marketlist dapat memiliki beberapa penerimaan bertahap
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

  // 12. Sistem dapat mendeteksi barang kurang, lebih, dan rusak
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

  // 13. Invoice hanya memasukkan kuantitas diterima baik
  const legacyInvoiceVersion = (await Marketlist.findById(mlCreated._id)).approved_version;
  await Invoice.create([
    {
      invoice_number: 'INV/LEGACY/SUP-A',
      marketlist_id: mlCreated._id,
      supplier_id: supplierA._id,
      marketlist_version: legacyInvoiceVersion,
      items: [{
        marketlist_item_id: mlItemBeras._id,
        product_id: productBeras._id,
        product_name: 'Beras Ramos',
        quantity: 100,
        unit_price: 15000,
        subtotal: 1500000
      }],
      subtotal: 1500000,
      grand_total: 1500000,
      status: 'generated'
    },
    {
      invoice_number: 'INV/LEGACY/SUP-B',
      marketlist_id: mlCreated._id,
      supplier_id: supplierB._id,
      marketlist_version: legacyInvoiceVersion,
      items: [{
        marketlist_item_id: mlItemAyam._id,
        product_id: productAyam._id,
        product_name: 'Ayam',
        quantity: 48,
        unit_price: 38000,
        subtotal: 1824000
      }],
      subtotal: 1824000,
      grand_total: 1824000,
      status: 'generated'
    }
  ]);
  const invoices = await invoiceService.generateInvoicesFromMarketlist(mlCreated._id, {}, adminUser);
  const marketlistInvoice = invoices[0];
  const invoiceBeras = marketlistInvoice?.items.find(
    (item) => item.marketlist_item_id?.toString() === mlItemBeras._id.toString()
  );
  const invoiceAyam = marketlistInvoice?.items.find(
    (item) => item.marketlist_item_id?.toString() === mlItemAyam._id.toString()
  );
  const visibleMarketlistInvoices = await invoiceService.getAllInvoices({
    marketlist_id: mlCreated._id
  });
  assert(
    invoices.length === 1 &&
      marketlistInvoice.supplier_id === null &&
      marketlistInvoice.items.length === 2 &&
      invoiceBeras?.quantity === 100 &&
      invoiceBeras?.unit_price === 15000 &&
      invoiceBeras?.supplier_id.toString() === supplierA._id.toString() &&
      invoiceAyam?.quantity === 48 &&
      invoiceAyam?.supplier_id.toString() === supplierB._id.toString() &&
      marketlistInvoice.grand_total === 3324000 &&
      await Invoice.countDocuments({
        marketlist_id: mlCreated._id,
        status: 'generated'
      }) === 1 &&
      visibleMarketlistInvoices.items.length === 1,
    'Invoice supplier lama dikonsolidasikan menjadi satu dokumen dengan kuantitas aktual dan supplier per baris.'
  );
  assert(
    await Invoice.countDocuments({
      marketlist_id: mlCreated._id,
      status: 'cancelled'
    }) === 1,
    'Invoice supplier lama yang digabung dibatalkan agar tidak ada tagihan ganda.'
  );

  // 14. One Marketlist produces exactly one invoice across its suppliers
  assert(invoices.length === 1, 'Satu Marketlist dengan beberapa supplier menghasilkan satu invoice gabungan.');

  // 15. Satu Marketlist hanya memiliki satu notes aktif
  await marketlistNoteService.upsertNote(mlCreated._id, 'Ayam kurang 2 kg karena rusak', receiverUser);
  const totalNotesCount = await MarketlistNote.countDocuments({ marketlist_id: mlCreated._id });
  assert(totalNotesCount === 1, 'Satu Marketlist hanya memiliki satu notes aktif.');

  // 16. Perubahan notes dan approval tercatat di audit log
  const auditLogs = await ActivityLog.find({ entity_id: { $in: [mlCreated._id, (await MarketlistNote.findOne({ marketlist_id: mlCreated._id }))._id] } });
  assert(auditLogs.length > 0, 'Perubahan notes dan approval tercatat di audit log.');

  // 17. Invoice tidak berubah ketika master harga atau Marketlist berubah
  await Product.findByIdAndUpdate(productBeras._id, { specification: 'Updated name' });
  const checkInvoice = await invoiceService.getInvoiceById(marketlistInvoice._id);
  assert(
    checkInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).unit_price === 15000 &&
      checkInvoice.grand_total === 3324000,
    'Invoice tidak berubah ketika master harga atau Marketlist berubah (immutable snapshot).'
  );

  // 18. Marketlist tetap parsial sampai diselesaikan secara eksplisit
  const mlStatusCheck = await Marketlist.findById(mlCreated._id);
  assert(mlStatusCheck.status === MARKETLIST_STATUS.PARTIALLY_RECEIVED, 'Marketlist parsial tidak otomatis dianggap selesai sebelum ditutup.');

  // 19. Penerimaan dapat dikoreksi dan progres Marketlist dihitung ulang
  const receiptUpdate = updateGoodsReceiptSchema.safeParse({
    items: [{
      marketlist_item_id: mlItemBeras._id.toString(),
      received_qty: 0,
      accepted_qty: 0,
      rejected_qty: 0,
      is_checked: true
    }]
  });
  assert(receiptUpdate.success, 'Validasi menerima bentuk data koreksi penerimaan.');
  const correctedReceipt = await receivingService.updateReceipt(receipt1._id, receiptUpdate.data, receiverUser);
  const correctedMarketlist = await Marketlist.findById(mlCreated._id);
  assert(
    correctedReceipt.items[0].accepted_qty === 0 &&
      correctedMarketlist.status === MARKETLIST_STATUS.PARTIALLY_RECEIVED,
    'Koreksi penerimaan tersimpan dan status Marketlist dihitung ulang.'
  );
  await receivingService.updateReceipt(receipt1._id, {
    items: [{
      marketlist_item_id: mlItemBeras._id.toString(),
      received_qty: 100,
      accepted_qty: 100,
      rejected_qty: 0,
      is_checked: true
    }]
  }, receiverUser);

  // 20. Sinkronisasi offline tidak membuat penerimaan ganda (client_request_id idempotency)
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

  // 21. Marketlist parsial dapat diselesaikan dan tidak menerima barang lagi setelahnya
  const completedMarketlist = await marketlistService.completePartiallyReceivedMarketlist(mlCreated._id, purchasingUser);
  let receiptAfterCompletionRejected = false;
  try {
    await receivingService.createReceipt(mlCreated._id, {
      supplier_id: supplierA._id,
      items: [
        { marketlist_item_id: mlItemBeras._id, received_qty: 1, accepted_qty: 1, rejected_qty: 0, is_checked: true }
      ]
    }, receiverUser);
  } catch (err) {
    receiptAfterCompletionRejected = true;
  }
  assert(
    completedMarketlist.status === MARKETLIST_STATUS.COMPLETED &&
      completedMarketlist.completed_at &&
      receiptAfterCompletionRejected,
    'Marketlist partially received bisa diselesaikan dan penerimaan baru ditolak setelah selesai.'
  );

  // 22. Marketlist fully received dapat diselesaikan
  const fullyReceivedMl = await marketlistService.createMarketlist({
    date: new Date(),
    required_date: new Date(),
    location_id: loc._id,
    items: [{
      product_id: productBeras._id,
      requested_qty: 2,
      unit_price: 15000,
      supplier_id: supplierA._id
    }]
  }, purchasingUser);
  await marketlistService.submitMarketlist(fullyReceivedMl._id, purchasingUser);
  await marketlistService.approveMarketlist(fullyReceivedMl._id, adminUser, 'Approved');
  const fullyReceivedItem = (await marketlistService.getMarketlistById(fullyReceivedMl._id)).items[0];
  const fullReceipt = await receivingService.createReceipt(fullyReceivedMl._id, {
    supplier_id: supplierA._id,
    items: [{
      marketlist_item_id: fullyReceivedItem._id,
      received_qty: 2,
      accepted_qty: 2,
      rejected_qty: 0,
      is_checked: true
    }]
  }, receiverUser);
  const correctedFullReceipt = await receivingService.updateReceipt(fullReceipt._id, {
    items: [{
      marketlist_item_id: fullyReceivedItem._id.toString(),
      received_qty: 0,
      accepted_qty: 0,
      rejected_qty: 0,
      is_checked: true
    }]
  }, receiverUser);
  const statusAfterCorrection = await Marketlist.findById(fullyReceivedMl._id);
  assert(
    correctedFullReceipt.items[0].accepted_qty === 0 &&
      statusAfterCorrection.status === MARKETLIST_STATUS.IN_PROGRESS,
    'Koreksi barang yang tidak datang mengubah status received menjadi in progress.'
  );
  await receivingService.updateReceipt(fullReceipt._id, {
    items: [{
      marketlist_item_id: fullyReceivedItem._id.toString(),
      received_qty: 2,
      accepted_qty: 2,
      rejected_qty: 0,
      is_checked: true
    }]
  }, receiverUser);
  const completedReceivedMl = await marketlistService.completePartiallyReceivedMarketlist(
    fullyReceivedMl._id,
    purchasingUser
  );
  assert(
    completedReceivedMl.status === MARKETLIST_STATUS.COMPLETED,
    'Marketlist dengan status received dapat diselesaikan.'
  );
  const editedCompletedReceipt = await receivingService.updateReceipt(fullReceipt._id, {
    items: [{
      marketlist_item_id: fullyReceivedItem._id.toString(),
      received_qty: 1,
      accepted_qty: 1,
      rejected_qty: 0,
      is_checked: true
    }]
  }, receiverUser);
  const reopenedCompletedMl = await Marketlist.findById(fullyReceivedMl._id);
  assert(
    editedCompletedReceipt.items[0].accepted_qty === 1 &&
      reopenedCompletedMl.status === MARKETLIST_STATUS.PARTIALLY_RECEIVED,
    'Penerimaan pada marketlist completed dapat dikoreksi dan status dihitung ulang.'
  );

  // 26. Regenerate invoice excludes items rejected during marketlist review
  const invoiceCorrectionMl = await marketlistService.createMarketlist({
    date: new Date(),
    required_date: new Date(),
    location_id: loc._id,
    items: [
      { product_id: productBeras._id, requested_qty: 1, unit_price: 15000, supplier_id: supplierA._id },
      { product_id: productAyam._id, requested_qty: 1, unit_price: 50000, supplier_id: supplierA._id }
    ]
  }, purchasingUser);
  await marketlistService.submitMarketlist(invoiceCorrectionMl._id, purchasingUser);
  await marketlistService.approveMarketlist(invoiceCorrectionMl._id, adminUser, 'Approved');
  const correctionItems = (await marketlistService.getMarketlistById(invoiceCorrectionMl._id)).items;
  const correctionBeras = correctionItems.find(
    (item) => item.product_id._id.toString() === productBeras._id.toString()
  );
  const correctionAyam = correctionItems.find(
    (item) => item.product_id._id.toString() === productAyam._id.toString()
  );
  const correctionReceipt = await receivingService.createReceipt(invoiceCorrectionMl._id, {
    supplier_id: supplierA._id,
    items: [correctionBeras, correctionAyam].map((item) => ({
      marketlist_item_id: item._id,
      received_qty: 1,
      accepted_qty: 1,
      rejected_qty: 0,
      is_checked: true
    }))
  }, receiverUser);
  await invoiceService.generateInvoicesFromMarketlist(invoiceCorrectionMl._id, {}, adminUser);
  await MarketlistItem.findByIdAndUpdate(correctionBeras._id, { item_status: 'rejected' });
  const rejectedItemInvoice = (await invoiceService.generateInvoicesFromMarketlist(
    invoiceCorrectionMl._id,
    {},
    adminUser
  ))[0];
  assert(
    rejectedItemInvoice.items.length === 1 &&
      rejectedItemInvoice.items[0].product_name === correctionAyam.product_snapshot.name,
    'Regenerate invoice menghapus item yang ditolak saat review.'
  );

  // 27. Mengoreksi kuantitas ke nol menandai item diperiksa, bukan pending
  const correctedZeroReceipt = await receivingService.updateReceipt(correctionReceipt._id, {
    items: [
      {
        marketlist_item_id: correctionBeras._id.toString(),
        received_qty: 1,
        accepted_qty: 1,
        rejected_qty: 0,
        is_checked: true
      },
      {
        marketlist_item_id: correctionAyam._id.toString(),
        received_qty: 0,
        accepted_qty: 0,
        rejected_qty: 0,
        is_checked: false
      }
    ]
  }, receiverUser);
  const correctedAyamReceiptItem = correctedZeroReceipt.items.find(
    (item) => item.marketlist_item_id._id.toString() === correctionAyam._id.toString()
  );
  assert(
    correctedAyamReceiptItem.status === RECEIVING_STATUS.PARTIAL &&
      correctedAyamReceiptItem.is_checked,
    'Item dengan kuantitas yang dikoreksi tidak lagi berstatus pending.'
  );

  // 28. Regenerate invoice membatalkan invoice generated yang tidak lagi memiliki barang diterima
  const zeroQtyInvoice = (await invoiceService.generateInvoicesFromMarketlist(
    invoiceCorrectionMl._id,
    {},
    adminUser
  ))[0];
  assert(
    zeroQtyInvoice.status === 'cancelled' &&
      zeroQtyInvoice.items.length === 0 &&
      zeroQtyInvoice.grand_total === 0,
    'Regenerate menghapus dan membatalkan invoice generated saat tidak ada barang diterima yang tersisa.'
  );

  // 29. Invoice items can be marked purchased with an actual quantity
  const updatedInvoice = await invoiceService.updateInvoiceItems(marketlistInvoice._id, {
    items: marketlistInvoice.items.map((item) => ({
      marketlist_item_id: item.marketlist_item_id,
      purchase_item_id: item.purchase_item_id,
      supplier_id: item.supplier_id,
      purchased: true,
      quantity: item.marketlist_item_id.toString() === mlItemBeras._id.toString() ? 5 : item.quantity,
      unit_price: item.unit_price
    }))
  }, purchasingUser);
  assert(
    updatedInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).purchased === true &&
      updatedInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).quantity === 5 &&
      updatedInvoice.subtotal === 1899000 &&
      updatedInvoice.grand_total === 1899000,
    'Invoice menyimpan status dibeli, kuantitas aktual, dan menghitung ulang total.'
  );

  // 30. Marking an item not purchased removes it from the bill
  const notPurchasedInvoice = await invoiceService.updateInvoiceItems(marketlistInvoice._id, {
    items: updatedInvoice.items.map((item) => ({
      marketlist_item_id: item.marketlist_item_id,
      purchase_item_id: item.purchase_item_id,
      supplier_id: item.supplier_id,
      purchased: item.marketlist_item_id.toString() === mlItemBeras._id.toString() ? false : item.purchased,
      quantity: item.marketlist_item_id.toString() === mlItemBeras._id.toString() ? 0 : item.quantity,
      unit_price: item.unit_price
    }))
  }, purchasingUser);
  assert(
    notPurchasedInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).purchased === false &&
      notPurchasedInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).quantity === 0 &&
      notPurchasedInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).subtotal === 0 &&
      notPurchasedInvoice.grand_total === 1824000,
    'Invoice barang tidak dibeli bernilai nol dan tidak masuk tagihan.'
  );

  // 31. Regenerating does not overwrite confirmed purchase quantities
  const invoiceAfterRegenerate = (await invoiceService.generateInvoicesFromMarketlist(
    mlCreated._id,
    {},
    adminUser
  ))[0];
  assert(
    invoiceAfterRegenerate.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).purchased === false &&
      invoiceAfterRegenerate.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).quantity === 0 &&
      invoiceAfterRegenerate.grand_total === 1824000,
    'Regenerate mempertahankan status tidak dibeli yang sudah dikonfirmasi.'
  );

  // 32. Invoice can refresh unit prices from a verified purchase recap
  const recapPurchase = await Purchase.create({
    purchase_number: 'TRX-TEST-INVOICE-PRICE',
    marketlist_id: mlCreated._id,
    supplier_id: supplierA._id,
    total_actual: 250000,
    status: 'verified'
  });
  await PurchaseItem.create({
    purchase_id: recapPurchase._id,
    marketlist_item_id: mlItemBeras._id,
    product_id: productBeras._id,
    product_name: 'Beras Ramos',
    unit_name: 'Kilogram',
    actual_qty: 20,
    actual_unit_price: 12500,
    actual_subtotal: 250000
  });
  const recapRefreshedInvoice = await invoiceService.refreshInvoicePrices(
    marketlistInvoice._id,
    purchasingUser
  );
  assert(
    recapRefreshedInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).unit_price === 12500 &&
      recapRefreshedInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).price_source === 'purchase_recap' &&
      recapRefreshedInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemBeras._id.toString()).subtotal === 0 &&
      recapRefreshedInvoice.grand_total === 1824000,
    'Update Harga mengambil harga satuan dari rekap belanja supplier dan item yang sama.'
  );

  // 33. If no supplier purchase recap exists, use the product master price
  await Product.findByIdAndUpdate(productAyam._id, { last_purchase_price: 12345 });
  const masterRefreshedInvoice = await invoiceService.refreshInvoicePrices(marketlistInvoice._id, purchasingUser);
  assert(
    masterRefreshedInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemAyam._id.toString()).price_source === 'master_item' &&
      masterRefreshedInvoice.items.find((item) => item.marketlist_item_id.toString() === mlItemAyam._id.toString()).unit_price === 12345,
    'Update Harga menggunakan last purchase price dari master item jika rekap supplier tidak ada.'
  );

  // 34. Recording a purchase immediately synchronizes the generated invoice quantity
  const purchaseSyncMl = await marketlistService.createMarketlist({
    date: new Date(),
    required_date: new Date(),
    location_id: loc._id,
    items: [{ product_id: productBeras._id, requested_qty: 10, unit_price: 15000, supplier_id: supplierA._id }]
  }, purchasingUser);
  await marketlistService.submitMarketlist(purchaseSyncMl._id, purchasingUser);
  await marketlistService.approveMarketlist(purchaseSyncMl._id, adminUser, 'Approved');
  const purchaseSyncItem = (await marketlistService.getMarketlistById(purchaseSyncMl._id)).items[0];
  await receivingService.createReceipt(purchaseSyncMl._id, {
    supplier_id: supplierA._id,
    items: [{
      marketlist_item_id: purchaseSyncItem._id,
      received_qty: 10,
      accepted_qty: 10,
      rejected_qty: 0,
      is_checked: true
    }]
  }, receiverUser);
  await invoiceService.generateInvoicesFromMarketlist(purchaseSyncMl._id, {}, adminUser);
  const syncPurchase = await purchaseService.createPurchase({
    marketlist_id: purchaseSyncMl._id,
    supplier_id: supplierA._id,
    items: [{
      marketlist_item_id: purchaseSyncItem._id,
      actual_qty: 4,
      actual_unit_price: 16000
    }]
  }, purchasingUser);
  const syncedInvoice = await Invoice.findOne({
    marketlist_id: purchaseSyncMl._id,
    status: 'generated'
  });
  const syncedMarketlist = await marketlistService.getMarketlistById(purchaseSyncMl._id);
  assert(
    syncedInvoice.items[0].quantity === 4 &&
      syncedInvoice.items[0].unit_price === 16000 &&
      syncedMarketlist.items[0].purchased_qty === 4,
    'Transaksi pembelian langsung memperbarui qty dan harga invoice serta menampilkan qty dibeli di Marketlist.'
  );

  // 35. Partial purchases can continue and aggregate, then update when a transaction is deleted
  await purchaseService.createPurchase({
    marketlist_id: purchaseSyncMl._id,
    supplier_id: supplierA._id,
    items: [{
      marketlist_item_id: purchaseSyncItem._id,
      actual_qty: 2,
      actual_unit_price: 17000
    }]
  }, purchasingUser);
  const afterSecondPurchase = await marketlistService.getMarketlistById(purchaseSyncMl._id);
  assert(
    afterSecondPurchase.items[0].purchased_qty === 6,
    'Qty pembelian bertahap dijumlahkan tanpa mengubah qty rencana Marketlist.'
  );
  await purchaseService.deletePurchase(syncPurchase._id, purchasingUser);
  const afterDeleteInvoice = await Invoice.findOne({
    marketlist_id: purchaseSyncMl._id,
    status: 'generated'
  });
  const afterDeleteMarketlist = await marketlistService.getMarketlistById(purchaseSyncMl._id);
  assert(
    afterDeleteInvoice.items[0].quantity === 2 &&
      afterDeleteMarketlist.items[0].purchased_qty === 2,
    'Menghapus transaksi langsung menghitung ulang qty beli dan invoice.'
  );

  // 37. Manual purchases can be recorded without a marketlist
  const manualPurchase = await purchaseService.createPurchase({
    supplier_id: supplierA._id,
    items: [{
      product_id: productAyam._id,
      actual_qty: 3,
      actual_unit_price: 42000
    }]
  }, purchasingUser);
  const manualPurchaseItem = await PurchaseItem.findOne({ purchase_id: manualPurchase._id });
  assert(
    manualPurchase.marketlist_id === null &&
      manualPurchaseItem.marketlist_item_id === null &&
      manualPurchaseItem.product_id.toString() === productAyam._id.toString() &&
      manualPurchase.total_actual === 126000,
    'Transaksi manual tersimpan dengan master barang dan supplier tanpa wajib terhubung ke Marketlist.'
  );

  // 38. A manual item can be allocated to a matching Marketlist item
  await purchaseService.createPurchase({
    marketlist_id: purchaseSyncMl._id,
    supplier_id: supplierA._id,
    items: [{
      marketlist_item_id: purchaseSyncItem._id,
      product_id: productBeras._id,
      actual_qty: 1,
      actual_unit_price: 15500
    }]
  }, purchasingUser);
  const allocatedMarketlist = await marketlistService.getMarketlistById(purchaseSyncMl._id);
  const allocatedInvoice = await Invoice.findOne({
    marketlist_id: purchaseSyncMl._id,
    status: 'generated'
  });
  assert(
    allocatedMarketlist.items[0].purchased_qty === 3 &&
      allocatedInvoice.items[0].quantity === 3,
    'Transaksi manual yang dialokasikan ke item Marketlist memperbarui qty dan invoice terkait.'
  );

  // 39. An unmatched manual purchase line attached to a marketlist is included in its invoice
  const manualInvoicePurchase = await purchaseService.createPurchase({
    marketlist_id: purchaseSyncMl._id,
    supplier_id: supplierA._id,
    items: [{
      product_id: productAyam._id,
      actual_qty: 2,
      actual_unit_price: 43000
    }]
  }, purchasingUser);
  const manualInvoicePurchaseItem = await PurchaseItem.findOne({
    purchase_id: manualInvoicePurchase._id
  });
  const invoiceWithManualLine = await Invoice.findOne({
    marketlist_id: purchaseSyncMl._id,
    status: 'generated'
  });
  assert(
    manualInvoicePurchaseItem.marketlist_item_id === null &&
      invoiceWithManualLine.items.some((item) =>
        item.purchase_item_id?.toString() === manualInvoicePurchaseItem._id.toString() &&
        item.quantity === 2 &&
        item.product_name === productAyam.name
      ),
    'Item manual tanpa pasangan Marketlist tetap masuk invoice saat transaksi dialokasikan ke Marketlist.'
  );

  // 40. Goods receiving target follows the actual purchased quantity
  const receiptQtyMl = await marketlistService.createMarketlist({
    date: new Date(),
    required_date: new Date(),
    location_id: loc._id,
    items: [{ product_id: productBeras._id, requested_qty: 10, unit_price: 15000, supplier_id: supplierA._id }]
  }, purchasingUser);
  await marketlistService.submitMarketlist(receiptQtyMl._id, purchasingUser);
  await marketlistService.approveMarketlist(receiptQtyMl._id, adminUser, 'Approved');
  const receiptQtyItem = (await marketlistService.getMarketlistById(receiptQtyMl._id)).items[0];
  await purchaseService.createPurchase({
    marketlist_id: receiptQtyMl._id,
    supplier_id: supplierA._id,
    items: [{
      marketlist_item_id: receiptQtyItem._id,
      actual_qty: 5,
      actual_unit_price: 15000
    }]
  }, purchasingUser);
  const receiptQtyMlWhileBuying = await marketlistService.getMarketlistById(receiptQtyMl._id);
  assert(
    receiptQtyMlWhileBuying.status === MARKETLIST_STATUS.PARTIAL_REJECTION,
    'Marketlist dengan barang yang belum dipenuhi Purchasing masuk Partial Rejection.'
  );
  const receiptForPurchasedQty = await receivingService.createReceipt(receiptQtyMl._id, {
    supplier_id: supplierA._id,
    items: [{
      marketlist_item_id: receiptQtyItem._id,
      received_qty: 5,
      accepted_qty: 5,
      rejected_qty: 0,
      is_checked: true
    }]
  }, receiverUser);
  const receiptQtyMlAfter = await marketlistService.getMarketlistById(receiptQtyMl._id);
  assert(
    receiptForPurchasedQty.items[0].ordered_qty === 5 &&
      receiptForPurchasedQty.items[0].status === RECEIVING_STATUS.COMPLETE &&
    receiptQtyMlAfter.status === MARKETLIST_STATUS.PARTIAL_REJECTION,
    'Target penerimaan dan status Marketlist mengikuti qty yang dibeli, bukan qty rencana awal.'
  );

  // 41. Existing standalone purchases can be allocated to a Marketlist later
  await purchaseService.updatePurchase(manualPurchase._id, {
    marketlist_id: purchaseSyncMl._id
  }, purchasingUser);
  const allocatedExistingPurchase = await Purchase.findById(manualPurchase._id);
  const allocatedExistingItem = await PurchaseItem.findOne({
    purchase_id: manualPurchase._id
  });
  const invoiceAfterLateAllocation = await Invoice.findOne({
    marketlist_id: purchaseSyncMl._id,
    status: 'generated'
  });
  assert(
    allocatedExistingPurchase.marketlist_id.toString() === purchaseSyncMl._id.toString() &&
      allocatedExistingItem.marketlist_item_id === null &&
      invoiceAfterLateAllocation.items.some((item) =>
        item.purchase_item_id?.toString() === allocatedExistingItem._id.toString() &&
        item.quantity === 3
      ),
    'Transaksi manual yang sudah tersimpan dapat dialokasikan belakangan dan muncul sebagai item manual di invoice Marketlist.'
  );
  const lateMatchingPurchase = await purchaseService.createPurchase({
    supplier_id: supplierA._id,
    items: [{
      product_id: productBeras._id,
      actual_qty: 4,
      actual_unit_price: 16000
    }]
  }, purchasingUser);
  await purchaseService.updatePurchase(lateMatchingPurchase._id, {
    marketlist_id: purchaseSyncMl._id
  }, purchasingUser);
  const lateMatchingItem = await PurchaseItem.findOne({
    purchase_id: lateMatchingPurchase._id
  });
  const marketlistAfterLateMatch = await marketlistService.getMarketlistById(purchaseSyncMl._id);
  assert(
    lateMatchingItem.marketlist_item_id.toString() === purchaseSyncItem._id.toString() &&
      marketlistAfterLateMatch.items[0].purchased_qty === 7,
    'Alokasi belakangan otomatis menautkan produk yang cocok dan memperbarui qty belanja Marketlist.'
  );

  // 43. Purchases from multiple suppliers create one invoice containing bought lines only
  const multiSupplierPurchaseMl = await marketlistService.createMarketlist({
    date: new Date(),
    required_date: new Date(),
    location_id: loc._id,
    items: [
      { product_id: productBeras._id, requested_qty: 5, unit_price: 15000, supplier_id: supplierA._id },
      { product_id: productAyam._id, requested_qty: 4, unit_price: 38000, supplier_id: supplierB._id }
    ]
  }, purchasingUser);
  await marketlistService.submitMarketlist(multiSupplierPurchaseMl._id, purchasingUser);
  await marketlistService.approveMarketlist(multiSupplierPurchaseMl._id, adminUser, 'Approved');
  const multiSupplierItems = (await marketlistService.getMarketlistById(multiSupplierPurchaseMl._id)).items;
  for (const [item, supplierId, quantity, unitPrice] of [
    [multiSupplierItems[0], supplierA._id, 3, 14000],
    [multiSupplierItems[1], supplierB._id, 2, 36000]
  ]) {
    await purchaseService.createPurchase({
      marketlist_id: multiSupplierPurchaseMl._id,
      supplier_id: supplierId,
      items: [{
        marketlist_item_id: item._id,
        actual_qty: quantity,
        actual_unit_price: unitPrice
      }]
    }, purchasingUser);
  }
  const multiSupplierPurchaseInvoices = await invoiceService.generateInvoicesFromMarketlist(
    multiSupplierPurchaseMl._id,
    {},
    adminUser
  );
  const multiSupplierPurchaseInvoice = multiSupplierPurchaseInvoices[0];
  assert(
    multiSupplierPurchaseInvoices.length === 1 &&
      multiSupplierPurchaseInvoice.items.length === 2 &&
      multiSupplierPurchaseInvoice.items.every((item) => item.quantity > 0) &&
      new Set(multiSupplierPurchaseInvoice.items.map((item) => item.supplier_id.toString())).size === 2 &&
      multiSupplierPurchaseInvoice.grand_total === 114000,
    'Pembelian dari beberapa supplier menghasilkan satu invoice dengan hanya dua baris yang benar-benar dibeli.'
  );

  // 46. Actual purchase prices feed price trends and waste valuation
  await purchaseService.createPurchase({
    supplier_id: supplierA._id,
    items: [{
      product_id: productAyam._id,
      actual_qty: 4,
      actual_unit_price: 52000
    }]
  }, purchasingUser);
  const actualPriceHistory = await priceService.getPriceHistoryByProduct(productAyam._id);
  const latestPriceOverview = await priceService.getLatestPrices();
  const ayamLatestPrice = latestPriceOverview.find(
    (entry) => entry._id.toString() === productAyam._id.toString()
  );
  const wasteRecord = await wasteService.createWaste({
    product_id: productAyam._id,
    quantity: 1.5,
    reason: 'Produk rusak'
  }, receiverUser);
  const wasteMarketlist = await marketlistService.createMarketlist({
    date: new Date(),
    required_date: new Date(Date.now() + 86400000),
    location_id: loc._id,
    items: [{
      product_id: productAyam._id,
      requested_qty: 5,
      unit_price: 52000,
      supplier_id: supplierA._id
    }]
  }, purchasingUser);
  const linkedWasteRecord = await wasteService.createWaste({
    product_id: productAyam._id,
    marketlist_id: wasteMarketlist._id,
    quantity: 0.5,
    reason: 'Waste dari Marketlist terpilih'
  }, receiverUser);
  const searchedProducts = await productService.getAllProducts({ search: 'Ayam' });
  assert(
    actualPriceHistory[0].source === 'purchase' &&
      actualPriceHistory[0].price === 52000 &&
      ayamLatestPrice.latest_price === 52000 &&
      wasteRecord.unit_purchase_price === 52000 &&
      wasteRecord.total_cost === 78000 &&
      linkedWasteRecord.marketlist_id.toString() === wasteMarketlist._id.toString() &&
      linkedWasteRecord.marketlist_item_id.toString() === wasteMarketlist.items[0]._id.toString() &&
      searchedProducts.length === 1 &&
      searchedProducts[0]._id.toString() === productAyam._id.toString() &&
      (await Waste.countDocuments({ product_id: productAyam._id })) === 2 &&
      (await ProductPrice.countDocuments({ product_id: productAyam._id, source: 'purchase' })) > 0,
    'Harga transaksi pembelian masuk ke tren harga dan menjadi dasar nilai waste.'
  );

  // 47. Petty cash is funded, spent, and returned within the same day
  const pettyDayStart = new Date();
  pettyDayStart.setHours(0, 0, 0, 0);
  const pettyCashDate = new Date();
  await cashFlowService.recordCashIn({
    amount: 1000000000,
    to_account: 'cash',
    description: 'Saldo awal pengujian kas kecil',
    date: pettyCashDate
  }, adminUser);
  await cashFlowService.recordPettyCashTransfer({
    amount: 600000,
    date: pettyCashDate
  }, adminUser, 'fund');
  await cashFlowService.recordCashOut({
    amount: 100000,
    source_account: 'petty_cash',
    description: 'Belanja operasional kas kecil',
    date: pettyCashDate
  }, adminUser);
  await purchaseService.createPurchase({
    supplier_id: supplierA._id,
    payment_method: 'cash',
    payment_source: 'petty_cash',
    purchased_at: pettyCashDate,
    items: [{
      product_id: productAyam._id,
      actual_qty: 1,
      actual_unit_price: 50000
    }]
  }, purchasingUser);
  await cashFlowService.recordPettyCashTransfer({
    amount: 450000,
    date: pettyCashDate
  }, adminUser, 'return');
  let excessivePettyCashReturnRejected = false;
  try {
    await cashFlowService.recordPettyCashTransfer({
      amount: 1,
      date: pettyCashDate
    }, adminUser, 'return');
  } catch (error) {
    excessivePettyCashReturnRejected = error.message.includes('kas kecil');
  }
  const pettyCashReport = await cashFlowService.getSummary({
    startDate: pettyDayStart.toISOString(),
    endDate: new Date(pettyDayStart.getTime() + 86400000 - 1).toISOString()
  });
  assert(
    excessivePettyCashReturnRejected &&
      pettyCashReport.total_petty_cash_funded === 600000 &&
      pettyCashReport.total_petty_cash_returned === 450000 &&
      pettyCashReport.total_purchase_petty_cash === 50000 &&
      pettyCashReport.current_petty_cash_balance === 0,
    'Kas kecil dibatasi dana yang benar-benar diterima hari itu, dan sisa kembali ke kas besar.'
  );

  // 48. Daily inventory reconciliation keeps timestamps and waste trace
  const inventoryDayEnd = new Date(pettyDayStart);
  inventoryDayEnd.setHours(23, 59, 59, 999);
  const dailyInventory = await inventoryService.getDailyReconciliation({
    startDate: pettyDayStart.toISOString(),
    endDate: inventoryDayEnd.toISOString()
  });
  const dailyInventoryAyam = dailyInventory.items.find(
    (item) => item.product_id?.toString() === productAyam._id.toString()
  );
  assert(
    dailyInventoryAyam?.event_history.some((event) => event.type === 'po' && event.happened_at) &&
      dailyInventoryAyam?.waste_records.some((record) => record.total_cost === 78000 && record.wasted_at),
    'Rekonsiliasi harian menampilkan timestamp pembelian dan jejak waste dengan harga snapshot.'
  );

  // 49. Admin can reject a marketlist after approval
  const adminRejectMl = await marketlistService.createMarketlist({
    date: new Date(),
    required_date: new Date(Date.now() + 86400000),
    location_id: loc._id,
    items: [{ product_id: productBeras._id, requested_qty: 2, unit_price: 15000, supplier_id: supplierA._id }]
  }, purchasingUser);
  await marketlistService.submitMarketlist(adminRejectMl._id, purchasingUser);
  await marketlistService.approveMarketlist(adminRejectMl._id, adminUser, 'Persetujuan awal');
  let wholeMarketlistRejectionBlocked = false;
  try {
    await marketlistService.rejectMarketlist(
      adminRejectMl._id,
      adminUser,
      'Penolakan seluruh marketlist tidak diperbolehkan setelah approval'
    );
  } catch (error) {
    wholeMarketlistRejectionBlocked = error.message.includes('approved');
  }
  const approvedItem = adminRejectMl.items[0];
  const approvedItemRejected = await marketlistService.approveItems(
    adminRejectMl._id,
    [{ id: approvedItem._id, approved: false, reason: 'Item tidak lagi diperlukan' }],
    adminUser
  );
  const rejectionCanBeChanged = await marketlistService.approveItems(
    adminRejectMl._id,
    [{ id: approvedItem._id, approved: true }],
    adminUser
  );
  await Marketlist.findByIdAndUpdate(adminRejectMl._id, {
    status: MARKETLIST_STATUS.IN_PROGRESS
  });
  const inProgressItemRejected = await marketlistService.approveItems(
    adminRejectMl._id,
    [{ id: approvedItem._id, approved: false, reason: 'Perubahan kebutuhan saat berjalan' }],
    adminUser
  );
  const inProgressItemReapproved = await marketlistService.approveItems(
    adminRejectMl._id,
    [{ id: approvedItem._id, approved: true }],
    adminUser
  );
  const finalReviewItem = await MarketlistItem.findById(approvedItem._id);
  assert(
    wholeMarketlistRejectionBlocked &&
      approvedItemRejected.updated === 1 &&
      rejectionCanBeChanged.updated === 1 &&
      inProgressItemRejected.updated === 1 &&
      inProgressItemReapproved.updated === 1 &&
      finalReviewItem.item_status === 'approved',
    'Marketlist approved dan in progress dapat menolak atau memulihkan item tanpa menolak seluruh Marketlist.'
  );

  // 50. Purchase reconciliation includes debt and matches linked invoice items by purchase date
  const debtReconciliationDate = new Date('2024-06-15T12:00:00.000Z');
  const debtPurchase = await purchaseService.createPurchase({
    supplier_id: supplierA._id,
    payment_method: 'tempo',
    amount_paid: 5000,
    due_date: new Date('2024-06-30T00:00:00.000Z'),
    purchased_at: debtReconciliationDate,
    items: [{
      product_id: productBeras._id,
      actual_qty: 2,
      actual_unit_price: 10000
    }]
  }, purchasingUser);
  await Invoice.create({
    invoice_number: 'INV-DEBT-RECON-001',
    marketlist_id: adminRejectMl._id,
    marketlist_version: 1,
    invoice_date: new Date('2024-06-20T12:00:00.000Z'),
    items: [{
      purchase_item_id: debtPurchase.items[0]._id,
      product_id: productBeras._id,
      product_name: productBeras.name,
      quantity: 2,
      purchased: true,
      unit: 'Kilogram',
      unit_price: 10000,
      subtotal: 20000
    }],
    subtotal: 20000,
    grand_total: 20000,
    status: 'verified'
  });
  const debtReconciliation = await inventoryService.getDailyReconciliation({
    startDate: '2024-06-15T00:00:00.000Z',
    endDate: '2024-06-15T23:59:59.999Z'
  });
  await overheadService.createOverhead({
    title: 'Tagihan listrik test rekonsiliasi',
    category: 'listrik_air_gas',
    amount: 12000,
    payment_method: 'tempo',
    amount_paid: 3000,
    due_date: '2024-06-30T00:00:00.000Z',
    expense_date: debtReconciliationDate
  }, adminUser);
  const debtAndOverheadReconciliation = await inventoryService.getDailyReconciliation({
    startDate: '2024-06-15T00:00:00.000Z',
    endDate: '2024-06-15T23:59:59.999Z'
  });
  const dailyOverhead = debtAndOverheadReconciliation.overheads.find(
    (overhead) => overhead.title === 'Tagihan listrik test rekonsiliasi'
  );
  assert(
    debtReconciliation.totals.po_amount === 20000 &&
      debtReconciliation.totals.paid_amount === 5000 &&
      debtReconciliation.totals.debt_amount === 15000 &&
      debtReconciliation.totals.billed_amount === 20000 &&
      debtReconciliation.totals.difference_amount === 0 &&
      debtAndOverheadReconciliation.totals.overhead_amount === 12000 &&
      debtAndOverheadReconciliation.totals.overhead_paid_amount === 3000 &&
      debtAndOverheadReconciliation.totals.overhead_debt_amount === 9000 &&
      dailyOverhead?.payments.some((payment) => payment.amount === 3000),
    'Rekonsiliasi mencocokkan PO/tagihan serta menampilkan overhead harian, pembayaran, dan hutangnya secara terpisah.'
  );

  console.log('===========================================================');
  console.log(`🎉 ALL 50/50 ACCEPTANCE CRITERIA PASSED SUCCESSFULLY!`);
  console.log('===========================================================');

  await teardown();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
