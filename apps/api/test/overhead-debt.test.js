const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

require('../src/database/registerModels');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const Overhead = require('../src/modules/overheads/overhead.model');
const OverheadPayment = require('../src/modules/overheads/overhead-payment.model');
const Purchase = require('../src/modules/purchases/purchase.model');
const DebtPayment = require('../src/modules/purchases/debt-payment.model');
const authService = require('../src/modules/auth/auth.service');

async function runTests() {
  console.log('Connecting to MongoDB for Overhead & Debt tests...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected!');

  try {
    // 1. Get or create test admin user
    let user = await User.findOne({ role: 'admin' });
    if (!user) {
      user = await User.create({
        name: 'Admin Test',
        email: `admintest_${Date.now()}@baraja.id`,
        password_hash: 'hash',
        role: 'admin'
      });
    }

    const { accessToken: token } = authService.generateTokens(user);

    console.log('\n--- TEST 1: Catat Pengeluaran Overhead Tunai ---');
    const res1 = await request(app)
      .post('/api/v1/overheads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Tagihan Listrik PLN Outlet Utama',
        category: 'listrik_air_gas',
        amount: 1500000,
        payment_method: 'cash',
        vendor_recipient: 'PLN Persero'
      });

    console.log('Status:', res1.status, 'Success:', res1.body.success, 'Amount:', res1.body.data?.amount);
    if (res1.status !== 201 || res1.body.data?.payment_status !== 'paid') {
      throw new Error(`Test 1 Failed: ${JSON.stringify(res1.body)}`);
    }

    console.log('\n--- TEST 2: Catat Pengeluaran Overhead Tempo (Hutang) ---');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const res2 = await request(app)
      .post('/api/v1/overheads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Sewa Gudang Logistik November',
        category: 'sewa_tempat',
        amount: 5000000,
        payment_method: 'tempo',
        due_date: futureDate.toISOString(),
        amount_paid: 1000000, // DP
        vendor_recipient: 'PT Properti Sejahtera'
      });

    console.log(
      'Status:',
      res2.status,
      'Payment Status:',
      res2.body.data?.payment_status,
      'Sisa Hutang:',
      res2.body.data?.amount_remaining
    );
    if (res2.status !== 201 || res2.body.data?.amount_remaining !== 4000000) {
      throw new Error(`Test 2 Failed: ${JSON.stringify(res2.body)}`);
    }
    const overheadDebtId = res2.body.data?._id;

    console.log('\n--- TEST 3: Cek Daftar Hutang Overhead ---');
    const res3 = await request(app)
      .get('/api/v1/overheads/debts')
      .set('Authorization', `Bearer ${token}`);

    console.log('Total Outstanding Debt:', res3.body.summary?.total_outstanding_debt);
    const foundDebt = res3.body.debts?.find((d) => d._id === overheadDebtId);
    if (!foundDebt) {
      throw new Error('Test 3 Failed: Overhead debt not found in debts list');
    }

    console.log('\n--- TEST 4: Bayar Sebagian Hutang Overhead ---');
    const res4 = await request(app)
      .post(`/api/v1/overheads/${overheadDebtId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 2000000,
        payment_method: 'transfer',
        reference_number: 'TRF-TEST-001',
        notes: 'Cicilan 1 Sewa Gudang'
      });

    console.log('Status:', res4.status, 'Sisa sekarang:', res4.body.data?.overhead?.amount_remaining);
    if (res4.status !== 201 || res4.body.data?.overhead?.amount_remaining !== 2000000) {
      throw new Error(`Test 4 Failed: ${JSON.stringify(res4.body)}`);
    }

    console.log('\n--- TEST 5: Pelunasan Sisa Hutang Overhead ---');
    const res5 = await request(app)
      .post(`/api/v1/overheads/${overheadDebtId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 2000000,
        payment_method: 'transfer',
        reference_number: 'TRF-TEST-002',
        notes: 'Pelunasan Akhir'
      });

    console.log('Status:', res5.status, 'Status Pembayaran:', res5.body.data?.overhead?.payment_status);
    if (res5.status !== 201 || res5.body.data?.overhead?.payment_status !== 'paid') {
      throw new Error(`Test 5 Failed: ${JSON.stringify(res5.body)}`);
    }

    console.log('\n--- TEST 6: Cek Integrasi Laba Rugi dengan Overhead Real ---');
    const res6 = await request(app)
      .get('/api/v1/finance/profit-loss')
      .set('Authorization', `Bearer ${token}`);

    console.log(
      'Status:',
      res6.status,
      'Real Overhead Used:',
      res6.body.data?.summary?.is_real_overhead,
      'Operating Expenses:',
      res6.body.data?.summary?.operating_expenses
    );
    if (res6.status !== 200) {
      throw new Error(`Test 6 Failed: ${JSON.stringify(res6.body)}`);
    }

    // Clean up created test overheads
    await Overhead.deleteMany({ _id: { $in: [res1.body.data?._id, overheadDebtId] } });
    await OverheadPayment.deleteMany({ overhead_id: { $in: [res1.body.data?._id, overheadDebtId] } });

    console.log('\n===========================================');
    console.log('🎉 SEMUA PENGUJIAN HUTANG & OVERHEAD BERHASIL!');
    console.log('===========================================');
  } finally {
    await mongoose.disconnect();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Test error:', e);
    process.exit(1);
  });
