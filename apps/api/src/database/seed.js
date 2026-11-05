const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/env');
const User = require('../modules/users/user.model');
const Location = require('../modules/locations/location.model');
const Unit = require('../modules/products/unit.model');
const Category = require('../modules/products/category.model');
const Product = require('../modules/products/product.model');
const Supplier = require('../modules/suppliers/supplier.model');
const { ROLES } = require('@purchasing/constants');

const seedData = async () => {
  try {
    console.log('[Seed] Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Seed] Connected. Clearing collections...');

    await Promise.all([
      User.deleteMany(),
      Location.deleteMany(),
      Unit.deleteMany(),
      Category.deleteMany(),
      Product.deleteMany(),
      Supplier.deleteMany()
    ]);

    console.log('[Seed] Inserting Locations...');
    const locations = await Location.insertMany([
      { name: 'Gudang Pusat Baraja', code: 'LOC-CENTRAL', address: 'Jl. Pemuda No. 10' },
      { name: 'Outlet Baraja Store 1', code: 'LOC-STR-01', address: 'Jl. Riau No. 45' }
    ]);

    console.log('[Seed] Inserting Units...');
    const units = await Unit.insertMany([
      { name: 'Kilogram', abbreviation: 'KG' },
      { name: 'Gram', abbreviation: 'GR' },
      { name: 'Liter', abbreviation: 'LTR' },
      { name: 'Pieces', abbreviation: 'PCS' },
      { name: 'Pack', abbreviation: 'PCK' }
    ]);
    const unitKg = units.find((u) => u.abbreviation === 'KG');
    const unitLtr = units.find((u) => u.abbreviation === 'LTR');

    console.log('[Seed] Inserting Categories...');
    const categories = await Category.insertMany([
      { name: 'Bahan Pokok', description: 'Beras, gula, minyak' },
      { name: 'Daging & Unggas', description: 'Ayam, sapi' },
      { name: 'Bumbu & Sayuran', description: 'Bawang, cabai' }
    ]);

    console.log('[Seed] Inserting Suppliers...');
    const suppliers = await Supplier.insertMany([
      {
        name: 'Supplier A (Sembako Makmur)',
        code: 'SUP-001',
        contact_person: 'Budi Santoso',
        phone: '081234567890',
        email: 'budi@sembakomakmur.com',
        address: 'Pasar Induk Kramat Jati',
        bank_account: { bank_name: 'BCA', account_number: '1234567890', account_holder: 'CV Sembako Makmur' }
      },
      {
        name: 'Supplier B (Unggas Segar)',
        code: 'SUP-002',
        contact_person: 'Agus Hendra',
        phone: '081298765432',
        email: 'agus@unggasfresh.com',
        address: 'RPH Cakung',
        bank_account: { bank_name: 'Mandiri', account_number: '9876543210', account_holder: 'PT Unggas Segar' }
      },
      {
        name: 'Supplier C (Bumbu Nusantara)',
        code: 'SUP-003',
        contact_person: 'Dewi Lestari',
        phone: '081377889900',
        email: 'dewi@bumbunusantara.com',
        address: 'Pasar Caringin Bandung',
        bank_account: { bank_name: 'BRI', account_number: '5566778899', account_holder: 'Dewi Lestari' }
      }
    ]);

    console.log('[Seed] Inserting Products...');
    await Product.insertMany([
      {
        name: 'Beras Ramos Super',
        sku: 'BRS-001',
        category_id: categories[0]._id,
        unit_id: unitKg._id,
        specification: 'Beras putih bersih kemasan karung 25kg'
      },
      {
        name: 'Ayam Potong Broiler',
        sku: 'AYM-001',
        category_id: categories[1]._id,
        unit_id: unitKg._id,
        specification: 'Karkas ayam segar ukuran 1.0 - 1.2 kg'
      },
      {
        name: 'Bawang Merah Brebes',
        sku: 'BWG-001',
        category_id: categories[2]._id,
        unit_id: unitKg._id,
        specification: 'Bawang merah super kering pilihan'
      },
      {
        name: 'Minyak Goreng Sawit',
        sku: 'MYK-001',
        category_id: categories[0]._id,
        unit_id: unitLtr._id,
        specification: 'Minyak goreng kemasan jerigen 5 Liter'
      },
      {
        name: 'Gula Pasir Kristal Putih',
        sku: 'GLA-001',
        category_id: categories[0]._id,
        unit_id: unitKg._id,
        specification: 'Gula kristal putih grade A'
      }
    ]);

    console.log('[Seed] Inserting Users with RBAC...');
    const adminPass = await User.hashPassword('admin123');
    const purchasingPass = await User.hashPassword('purchasing123');
    const receiverPass = await User.hashPassword('receiver123');
    const accountingPass = await User.hashPassword('accounting123');
    const managementPass = await User.hashPassword('management123');

    await User.insertMany([
      {
        name: 'Super Admin',
        email: 'admin@baraja.com',
        password_hash: adminPass,
        role: ROLES.ADMIN,
        location_id: locations[0]._id
      },
      {
        name: 'Purchasing Staff A',
        email: 'purchasing@baraja.com',
        password_hash: purchasingPass,
        role: ROLES.PURCHASING,
        location_id: locations[0]._id
      },
      {
        name: 'Receiver B (Gudang)',
        email: 'receiver@baraja.com',
        password_hash: receiverPass,
        role: ROLES.RECEIVER,
        location_id: locations[0]._id
      },
      {
        name: 'Accounting Officer',
        email: 'accounting@baraja.com',
        password_hash: accountingPass,
        role: ROLES.ACCOUNTING,
        location_id: locations[0]._id
      },
      {
        name: 'General Manager',
        email: 'management@baraja.com',
        password_hash: managementPass,
        role: ROLES.MANAGEMENT,
        location_id: locations[0]._id
      }
    ]);

    console.log('----------------------------------------------------');
    console.log('✅ SEED COMPLETED SUCCESSFULLY!');
    console.log('Credentials:');
    console.log(' - Admin:      admin@baraja.com / admin123');
    console.log(' - Purchasing: purchasing@baraja.com / purchasing123');
    console.log(' - Receiver:   receiver@baraja.com / receiver123');
    console.log(' - Accounting: accounting@baraja.com / accounting123');
    console.log(' - Management: management@baraja.com / management123');
    console.log('----------------------------------------------------');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
