'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import {
  ShoppingCart,
  Plus,
  Eye,
  X,
  Package,
  Calendar,
  CreditCard,
  FileText,
  Store,
  ClipboardList,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Tunai / Cash' },
  { value: 'transfer', label: 'Transfer Bank' },
  { value: 'tempo', label: 'Tempo / Kredit' }
];

const paymentBadge = (method) => {
  const map = {
    cash: 'bg-green-100 text-green-800',
    transfer: 'bg-blue-100 text-blue-800',
    tempo: 'bg-amber-100 text-amber-800'
  };
  return map[method] || 'bg-slate-100 text-slate-600';
};

const fmt = (v) => `Rp ${(v || 0).toLocaleString('id-ID')}`;

export default function TransactionsPage() {
  // ---------- state ----------
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState(null);

  // Form state
  const [approvedMLs, setApprovedMLs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedMlId, setSelectedMlId] = useState('');
  const [selectedMlDetail, setSelectedMlDetail] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [formItems, setFormItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // ---------- data loading ----------
  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      let params = '?limit=50';
      if (filterSupplier) params += `&supplier_id=${filterSupplier}`;
      if (filterStartDate) params += `&startDate=${filterStartDate}`;
      if (filterEndDate) params += `&endDate=${filterEndDate}`;

      const res = await api.getPurchases(params);
      setPurchases(res.data || []);
    } catch (e) {
      console.error('Gagal memuat transaksi:', e);
    } finally {
      setLoading(false);
    }
  }, [filterSupplier, filterStartDate, filterEndDate]);

  const fetchMasterForForm = async () => {
    try {
      const [mlRes, supRes] = await Promise.all([
        api.getMarketlists('?status=approved&limit=50').catch(() => ({ data: [] })),
        api.getSuppliers().catch(() => ({ data: [] }))
      ]);
      setApprovedMLs(mlRes.data?.items || mlRes.data || []);
      setSuppliers(supRes.data?.items || supRes.data || []);
    } catch (_) {}
  };

  useEffect(() => {
    fetchPurchases();
    fetchMasterForForm();
  }, [fetchPurchases]);

  // ---------- handle ML selection ----------
  const handleSelectMarketlist = async (mlId) => {
    setSelectedMlId(mlId);
    setSelectedMlDetail(null);
    setFormItems([]);
    setSelectedSupplierId('');

    if (!mlId) return;
    try {
      const res = await api.getMarketlistById(mlId);
      const ml = res.data;
      setSelectedMlDetail(ml);

      // Pre-fill form items from marketlist items
      const items = (ml.items || []).map((it) => {
        const p = it.product_id;
        return {
          marketlist_item_id: it._id,
          product_id: p?._id || '',
          product_name: p?.name || it.product_name || 'Barang',
          unit_name:
            p?.unit_id?.abbreviation || p?.unit_id?.name || 'Satuan',
          requested_qty: it.requested_qty || 0,
          unit_price_ml: it.unit_price || 0,
          actual_qty: it.requested_qty || 0,
          actual_unit_price: it.unit_price || 0,
          supplier_id: it.supplier_id?._id || it.supplier_id || '',
          notes: ''
        };
      });
      setFormItems(items);
    } catch (e) {
      console.error('Gagal load detail ML:', e);
    }
  };

  // ---------- filter items by supplier ----------
  const filteredFormItems = selectedSupplierId
    ? formItems.filter(
        (it) =>
          it.supplier_id === selectedSupplierId ||
          !it.supplier_id
      )
    : formItems;

  const formTotal = filteredFormItems.reduce(
    (sum, it) => sum + Number(it.actual_qty || 0) * Number(it.actual_unit_price || 0),
    0
  );

  // ---------- handle item changes ----------
  const handleItemChange = (index, field, value) => {
    const updated = [...formItems];
    const realIdx = formItems.indexOf(filteredFormItems[index]);
    updated[realIdx][field] = value;
    setFormItems(updated);
  };

  // ---------- submit ----------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedMlId) {
      alert('Pilih Marketlist terlebih dahulu.');
      return;
    }
    if (!selectedSupplierId) {
      alert('Pilih Supplier terlebih dahulu.');
      return;
    }
    if (filteredFormItems.length === 0) {
      alert('Tidak ada barang yang ditransaksikan untuk supplier ini.');
      return;
    }

    const invalid = filteredFormItems.find(
      (it) => Number(it.actual_qty) <= 0 || Number(it.actual_unit_price) <= 0
    );
    if (invalid) {
      alert('Pastikan semua kuantitas dan harga > 0.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        marketlist_id: selectedMlId,
        supplier_id: selectedSupplierId,
        invoice_ref: invoiceRef.trim(),
        payment_method: paymentMethod,
        purchased_at: purchaseDate,
        notes: notes.trim(),
        items: filteredFormItems.map((it) => ({
          marketlist_item_id: it.marketlist_item_id,
          product_id: it.product_id,
          product_name: it.product_name,
          unit_name: it.unit_name,
          actual_qty: Number(it.actual_qty),
          actual_unit_price: Number(it.actual_unit_price),
          notes: it.notes || ''
        }))
      };

      await api.createPurchase(payload);
      alert('✅ Transaksi pembelian berhasil dicatat!');
      resetForm();
      fetchPurchases();
    } catch (e) {
      alert(`Gagal menyimpan transaksi: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedMlId('');
    setSelectedMlDetail(null);
    setSelectedSupplierId('');
    setPaymentMethod('cash');
    setInvoiceRef('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setFormItems([]);
  };

  // ---------- view detail ----------
  const handleViewDetail = async (id) => {
    try {
      const res = await api.getPurchaseById(id);
      setDetailPurchase(res.data);
    } catch (e) {
      alert('Gagal memuat detail transaksi.');
    }
  };

  // ---------- unique suppliers from ML items ----------
  const mlSupplierIds = [
    ...new Set(formItems.map((it) => it.supplier_id).filter(Boolean))
  ];
  const mlSuppliers = suppliers.filter((s) => mlSupplierIds.includes(s._id));

  // ---------- render ----------
  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Pencatatan Transaksi Pembelian" />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Info Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
          <ShoppingCart className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Pencatatan Transaksi Pembelian ke Supplier
            </p>
            <p className="text-amber-800/80">
              Catat setiap pembelian barang yang dilakukan purchasing staff
              berdasarkan Marketlist yang sudah disetujui Admin. Transaksi
              dikelompokkan per supplier dengan harga aktual saat pembelian.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <button
            onClick={() => {
              fetchMasterForForm();
              setShowForm(true);
            }}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Catat Transaksi Baru
          </button>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Semua Supplier</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Dari"
            />
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Sampai"
            />
          </div>
        </div>

        {/* ===== FORM MODAL ===== */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                  Formulir Pencatatan Transaksi Pembelian
                </h3>
                <button
                  onClick={resetForm}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Row 1: Marketlist selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    <ClipboardList className="w-3.5 h-3.5 inline mr-1" />
                    Pilih Marketlist (Approved)
                  </label>
                  <select
                    value={selectedMlId}
                    onChange={(e) => handleSelectMarketlist(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">
                      -- Pilih Marketlist yang telah disetujui --
                    </option>
                    {approvedMLs.map((ml) => (
                      <option key={ml._id} value={ml._id}>
                        {ml.code || ml.marketlist_number} &bull;{' '}
                        {new Date(
                          ml.required_date || ml.date
                        ).toLocaleDateString('id-ID')}{' '}
                        &bull; Est:{' '}
                        {fmt(ml.estimated_total || ml.totals?.estimated_amount)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row 2: Supplier & Payment */}
                {selectedMlDetail && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          <Store className="w-3.5 h-3.5 inline mr-1" />
                          Supplier Tujuan
                        </label>
                        <select
                          value={selectedSupplierId}
                          onChange={(e) =>
                            setSelectedSupplierId(e.target.value)
                          }
                          required
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">-- Pilih Supplier --</option>
                          {mlSuppliers.length > 0
                            ? mlSuppliers.map((s) => (
                                <option key={s._id} value={s._id}>
                                  {s.name}
                                </option>
                              ))
                            : suppliers.map((s) => (
                                <option key={s._id} value={s._id}>
                                  {s.name}
                                </option>
                              ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                          Metode Pembayaran
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          {PAYMENT_METHODS.map((pm) => (
                            <option key={pm.value} value={pm.value}>
                              {pm.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          <Calendar className="w-3.5 h-3.5 inline mr-1" />
                          Tanggal Pembelian
                        </label>
                        <input
                          type="date"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                          required
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          <FileText className="w-3.5 h-3.5 inline mr-1" />
                          No. Nota / Referensi Invoice Supplier
                        </label>
                        <input
                          type="text"
                          value={invoiceRef}
                          onChange={(e) => setInvoiceRef(e.target.value)}
                          placeholder="Contoh: NOTA-2026-11-001"
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          Catatan Transaksi
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Catatan opsional..."
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    {/* Items Table */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        Daftar Barang yang Dibeli
                        {selectedSupplierId && (
                          <span className="ml-1 text-amber-600">
                            ({filteredFormItems.length} item untuk supplier ini)
                          </span>
                        )}
                      </h4>
                      {filteredFormItems.length === 0 ? (
                        <div className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-lg">
                          <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-slate-300" />
                          {selectedSupplierId
                            ? 'Tidak ada barang di Marketlist untuk supplier yang dipilih.'
                            : 'Pilih Marketlist dan Supplier terlebih dahulu.'}
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">
                                  Nama Barang
                                </th>
                                <th className="px-3 py-2.5 text-center text-slate-500 font-semibold">
                                  Req ML
                                </th>
                                <th className="px-3 py-2.5 text-center text-slate-500 font-semibold">
                                  Harga ML
                                </th>
                                <th className="px-3 py-2.5 text-center text-amber-600 font-bold">
                                  Qty Aktual
                                </th>
                                <th className="px-3 py-2.5 text-center text-amber-600 font-bold">
                                  Harga Aktual
                                </th>
                                <th className="px-3 py-2.5 text-right text-slate-500 font-semibold">
                                  Subtotal
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredFormItems.map((it, idx) => {
                                const sub =
                                  Number(it.actual_qty || 0) *
                                  Number(it.actual_unit_price || 0);
                                return (
                                  <tr
                                    key={it.marketlist_item_id || idx}
                                    className="hover:bg-slate-50/50"
                                  >
                                    <td className="px-3 py-2.5 font-semibold text-slate-800">
                                      {it.product_name}
                                      <span className="ml-1 text-slate-400 font-normal">
                                        ({it.unit_name})
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-slate-500">
                                      {it.requested_qty}
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-slate-500">
                                      {fmt(it.unit_price_ml)}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                      <input
                                        type="number"
                                        value={it.actual_qty}
                                        onChange={(e) =>
                                          handleItemChange(
                                            idx,
                                            'actual_qty',
                                            e.target.value
                                          )
                                        }
                                        min="0"
                                        step="any"
                                        className="w-20 text-xs text-center p-1.5 bg-amber-50 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                                      />
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                      <input
                                        type="number"
                                        value={it.actual_unit_price}
                                        onChange={(e) =>
                                          handleItemChange(
                                            idx,
                                            'actual_unit_price',
                                            e.target.value
                                          )
                                        }
                                        min="0"
                                        step="any"
                                        className="w-28 text-xs text-center p-1.5 bg-amber-50 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                                      />
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                                      {fmt(sub)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="border-t-2 border-slate-300 bg-amber-50/50">
                              <tr>
                                <td
                                  colSpan="5"
                                  className="px-3 py-3 text-right font-black text-slate-700 text-sm"
                                >
                                  TOTAL PEMBELIAN AKTUAL:
                                </td>
                                <td className="px-3 py-3 text-right font-black text-amber-700 text-sm">
                                  {fmt(formTotal)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={
                          submitting || filteredFormItems.length === 0
                        }
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {submitting
                          ? 'Menyimpan...'
                          : 'Simpan Transaksi Pembelian'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        {/* ===== DETAIL MODAL ===== */}
        {detailPurchase && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  Detail Transaksi: {detailPurchase.purchase_number}
                </h3>
                <button
                  onClick={() => setDetailPurchase(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Meta */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'Marketlist',
                      value:
                        detailPurchase.marketlist_id?.code ||
                        detailPurchase.marketlist_id?.marketlist_number ||
                        '-'
                    },
                    {
                      label: 'Supplier',
                      value: detailPurchase.supplier_id?.name || '-'
                    },
                    {
                      label: 'Metode Bayar',
                      value:
                        PAYMENT_METHODS.find(
                          (pm) => pm.value === detailPurchase.payment_method
                        )?.label || detailPurchase.payment_method
                    },
                    {
                      label: 'Tanggal Beli',
                      value: new Date(
                        detailPurchase.purchased_at
                      ).toLocaleDateString('id-ID')
                    }
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="bg-slate-50 p-3 rounded-lg border border-slate-100"
                    >
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">
                        {m.label}
                      </p>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>

                {detailPurchase.invoice_ref && (
                  <p className="text-xs text-slate-600">
                    <span className="font-bold">No. Nota / Invoice Ref:</span>{' '}
                    {detailPurchase.invoice_ref}
                  </p>
                )}
                {detailPurchase.notes && (
                  <p className="text-xs text-slate-600">
                    <span className="font-bold">Catatan:</span>{' '}
                    {detailPurchase.notes}
                  </p>
                )}

                {/* Items */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-slate-500 font-semibold">
                          Nama Barang
                        </th>
                        <th className="px-4 py-2.5 text-center text-slate-500 font-semibold">
                          Qty
                        </th>
                        <th className="px-4 py-2.5 text-center text-slate-500 font-semibold">
                          Harga Satuan
                        </th>
                        <th className="px-4 py-2.5 text-right text-slate-500 font-semibold">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(detailPurchase.items || []).map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {it.product_name ||
                              it.product_id?.name ||
                              'Barang'}
                            <span className="ml-1 text-slate-400 font-normal">
                              ({it.unit_name || 'Satuan'})
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {it.actual_qty}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {fmt(it.actual_unit_price)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold">
                            {fmt(it.actual_subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-300 bg-amber-50/50">
                      <tr>
                        <td
                          colSpan="3"
                          className="px-4 py-3 text-right font-black text-slate-700 text-sm"
                        >
                          TOTAL:
                        </td>
                        <td className="px-4 py-3 text-right font-black text-amber-700 text-sm">
                          {fmt(detailPurchase.total_actual)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <p className="text-[10px] text-slate-400 mt-2">
                  Dicatat oleh: {detailPurchase.purchased_by?.name || '-'} &bull;{' '}
                  {new Date(detailPurchase.createdAt).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== PURCHASE LIST TABLE ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">
              Riwayat Transaksi Pembelian
            </h3>
            <span className="text-xs text-slate-400">
              {purchases.length} Transaksi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">No. Transaksi</th>
                  <th className="px-6 py-3.5">Referensi ML</th>
                  <th className="px-6 py-3.5">Supplier</th>
                  <th className="px-6 py-3.5">Tanggal Beli</th>
                  <th className="px-6 py-3.5">Metode Bayar</th>
                  <th className="px-6 py-3.5">No. Nota</th>
                  <th className="px-6 py-3.5">Total Aktual</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-12 text-center text-slate-400"
                    >
                      {loading
                        ? 'Memuat riwayat transaksi...'
                        : 'Belum ada transaksi pembelian yang dicatat.'}
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {p.purchase_number}
                      </td>
                      <td className="px-6 py-4 text-amber-700 font-semibold">
                        {p.marketlist_id?.code ||
                          p.marketlist_id?.marketlist_number ||
                          '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-medium">
                        {p.supplier_id?.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(p.purchased_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${paymentBadge(p.payment_method)}`}
                        >
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono">
                        {p.invoice_ref || '-'}
                      </td>
                      <td className="px-6 py-4 font-black text-slate-900">
                        {fmt(p.total_actual)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleViewDetail(p._id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                          Lihat Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

