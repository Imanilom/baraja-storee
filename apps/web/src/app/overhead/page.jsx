'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import {
  Wallet,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  DollarSign,
  TrendingDown,
  CreditCard,
  Layers,
  ArrowRight,
  Filter,
  Search,
  Trash2,
  History,
  X
} from 'lucide-react';

const CATEGORIES = [
  { id: 'listrik_air_gas', label: 'Listrik, Air & Gas', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'sewa_tempat', label: 'Sewa Tempat / Outlet', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'gaji_upah', label: 'Gaji & Upah Karyawan', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'logistik_transport', label: 'Logistik & Bahan Bakar', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'kemasan_packaging', label: 'Packaging & Kemasan', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'pemeliharaan_aset', label: 'Maintenance & Servis Mesin', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'kebersihan_keamanan', label: 'Kebersihan & Keamanan', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { id: 'internet_utilitas', label: 'Internet & Software', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { id: 'marketing_promosi', label: 'Marketing & Promosi', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { id: 'lain_lain', label: 'Lain-lain / Operasional', color: 'bg-slate-100 text-slate-800 border-slate-200' }
];

export default function OverheadPage() {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'debts' | 'categories'
  const [overheads, setOverheads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [debts, setDebts] = useState([]);
  const [debtSummary, setDebtSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOverhead, setSelectedOverhead] = useState(null);

  // Create form state
  const [formData, setFormData] = useState({
    title: '',
    category: 'listrik_air_gas',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    vendor_recipient: '',
    invoice_ref: '',
    payment_method: 'cash',
    due_date: '',
    amount_paid: '',
    notes: ''
  });

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'transfer',
    paid_at: new Date().toISOString().split('T')[0],
    reference_number: '',
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      let queryParams = '?limit=100';
      if (selectedCategory) queryParams += `&category=${selectedCategory}`;
      if (searchQuery) queryParams += `&q=${encodeURIComponent(searchQuery)}`;

      const [listRes, summaryRes, debtsRes] = await Promise.all([
        api.getOverheads(queryParams),
        api.getOverheadSummary(selectedCategory ? `?category=${selectedCategory}` : ''),
        api.getOverheadDebts(selectedCategory ? `?category=${selectedCategory}` : '')
      ]);

      if (listRes?.data) setOverheads(listRes.data);
      if (summaryRes?.data) setSummary(summaryRes.data);
      if (debtsRes?.debts) {
        setDebts(debtsRes.debts);
        setDebtSummary(debtsRes.summary);
      }
    } catch (err) {
      console.error('Error loading overhead data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenCreateModal = () => {
    setFormData({
      title: '',
      category: 'listrik_air_gas',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      vendor_recipient: '',
      invoice_ref: '',
      payment_method: 'cash',
      due_date: '',
      amount_paid: '',
      notes: ''
    });
    setErrorMessage('');
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    if (!formData.title || !formData.amount) {
      setErrorMessage('Nama biaya dan nominal wajib diisi');
      setSubmitting(false);
      return;
    }

    if (formData.payment_method === 'tempo' && !formData.due_date) {
      setErrorMessage('Tanggal jatuh tempo wajib diisi untuk metode Tempo');
      setSubmitting(false);
      return;
    }

    try {
      await api.createOverhead({
        ...formData,
        amount: Number(formData.amount),
        amount_paid: formData.amount_paid ? Number(formData.amount_paid) : 0
      });
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      setErrorMessage(err.message || 'Gagal menyimpan data overhead');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPaymentModal = (item) => {
    setSelectedOverhead(item);
    setPaymentData({
      amount: item.amount_remaining || item.amount,
      payment_method: 'transfer',
      paid_at: new Date().toISOString().split('T')[0],
      reference_number: '',
      notes: `Pelunasan biaya ${item.title}`
    });
    setErrorMessage('');
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      await api.recordOverheadPayment(selectedOverhead._id, {
        ...paymentData,
        amount: Number(paymentData.amount)
      });
      setShowPaymentModal(false);
      loadData();
    } catch (err) {
      setErrorMessage(err.message || 'Gagal memproses pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetailModal = async (item) => {
    try {
      const res = await api.getOverheadById(item._id);
      setSelectedOverhead(res?.data || item);
      setShowDetailModal(true);
    } catch (err) {
      setSelectedOverhead(item);
      setShowDetailModal(true);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Yakin ingin menghapus catatan biaya "${title}"?`)) return;
    try {
      await api.deleteOverhead(id);
      loadData();
    } catch (err) {
      alert(err.message || 'Gagal menghapus data');
    }
  };

  const getCategoryInfo = (catId) => {
    return CATEGORIES.find((c) => c.id === catId) || { label: catId, color: 'bg-slate-100 text-slate-800' };
  };

  const formatRupiah = (val) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const renderStatusBadge = (status, isOverdue) => {
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Lunas
        </span>
      );
    }
    if (isOverdue || status === 'overdue') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
          <AlertTriangle className="w-3 h-3" /> Jatuh Tempo
        </span>
      );
    }
    if (status === 'partial') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3" /> Sebagian
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <Clock className="w-3 h-3" /> Hutang / Tempo
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      <Navbar title="Kelola Biaya Overhead & Operasional" />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Header Title & Quick Action */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Wallet className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-800">Pengelolaan Biaya Overhead</h1>
            </div>
            <p className="text-xs text-slate-500">
              Catat pengeluaran operasional outlet/gudang, lacak hutang tempo operasional, dan integrasikan langsung ke Laporan Laba Rugi Baraja.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Catat Biaya Overhead</span>
          </button>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Biaya Overhead
            </span>
            <div className="text-xl font-black text-slate-900">
              {formatRupiah(summary?.total_expense)}
            </div>
            <p className="text-[10px] text-slate-500">
              {summary?.total_records || 0} catatan operasional
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
              Total Sudah Dibayar
            </span>
            <div className="text-xl font-black text-emerald-700">
              {formatRupiah(summary?.total_paid)}
            </div>
            <p className="text-[10px] text-slate-500">
              Tunai & transfer lunas
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">
                Hutang Overhead (Tempo)
              </span>
              {summary?.overdue_count > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                  {summary.overdue_count} Jatuh Tempo!
                </span>
              )}
            </div>
            <div className="text-xl font-black text-rose-700">
              {formatRupiah(summary?.total_debt)}
            </div>
            <p className="text-[10px] text-slate-500">
              {debts.length} tagihan belum lunas
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-700 text-white p-5 rounded-xl shadow-md space-y-2">
            <span className="text-[11px] font-bold text-amber-100 uppercase tracking-wider">
              Kategori Terbesar
            </span>
            <div className="text-lg font-black truncate">
              {summary?.category_breakdown?.[0]
                ? getCategoryInfo(summary.category_breakdown[0].category).label
                : 'Belum Ada Data'}
            </div>
            <p className="text-[11px] text-amber-100 font-semibold">
              {summary?.category_breakdown?.[0]
                ? formatRupiah(summary.category_breakdown[0].total)
                : 'Rp 0'}
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-sm gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'list'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Daftar Pengeluaran ({overheads.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('debts')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'debts'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Hutang & Tempo Overhead</span>
            {debts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">
                {debts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'categories'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Rincian Kategori</span>
          </button>
        </div>

        {/* Filter Bar (for Tab List) */}
        {activeTab === 'list' && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Semua Kategori</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari biaya / vendor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700"
              >
                Cari
              </button>
            </form>
          </div>
        )}

        {/* Tab 1: Daftar Pengeluaran */}
        {activeTab === 'list' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Memuat data biaya overhead...</div>
            ) : overheads.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Wallet className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-700">Belum Ada Biaya Overhead Dicatat</p>
                <p className="text-xs text-slate-400">
                  Klik tombol "+ Catat Biaya Overhead" di atas untuk menambahkan pengeluaran operasional.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Tanggal</th>
                      <th className="py-3 px-4">Nama Biaya & Vendor</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Metode & Status</th>
                      <th className="py-3 px-4 text-right">Nominal</th>
                      <th className="py-3 px-4 text-right">Sisa Hutang</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overheads.map((item) => {
                      const cat = getCategoryInfo(item.category);
                      return (
                        <tr key={item._id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                            {new Date(item.expense_date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{item.title}</div>
                            <div className="text-[11px] text-slate-400">
                              {item.vendor_recipient && item.vendor_recipient !== '-'
                                ? `Vendor: ${item.vendor_recipient}`
                                : 'Operasional Internal'}
                              {item.invoice_ref && ` • Ref: ${item.invoice_ref}`}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cat.color}`}
                            >
                              {cat.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {renderStatusBadge(item.payment_status, item.is_overdue)}
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.payment_method === 'cash'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : item.payment_method === 'transfer'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}>
                                  {item.payment_method === 'cash' ? '💵 Kas Tunai' : item.payment_method === 'transfer' ? '🏦 Rekening Bank' : '⏳ Tempo'}
                                </span>
                              </div>
                              {item.due_date && item.payment_status !== 'paid' && (
                                <div className="text-[10px] text-rose-600 font-semibold">
                                  Jatuh Tempo:{' '}
                                  {new Date(item.due_date).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short'
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-slate-800">
                            {formatRupiah(item.amount)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                            {item.amount_remaining > 0 ? (
                              <span className="text-rose-600">{formatRupiah(item.amount_remaining)}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.amount_remaining > 0 && (
                                <button
                                  onClick={() => handleOpenPaymentModal(item)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-sm"
                                  title="Bayar Cicilan / Pelunasan"
                                >
                                  Bayar
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenDetailModal(item)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold"
                                title="Lihat Detail & Riwayat Pembayaran"
                              >
                                Detail
                              </button>
                              <button
                                onClick={() => handleDelete(item._id, item.title)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition"
                                title="Hapus Catatan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Hutang & Tempo Overhead */}
        {activeTab === 'debts' && (
          <div className="space-y-4">
            {/* Debt Banner Alert */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-bold">Manajemen Hutang Tagihan Overhead (Tempo)</p>
                  <p className="text-[11px] text-amber-800">
                    Tagihan operasional yang belum lunas. Lakukan pelunasan atau catat pembayaran bertahap agar laporan arus kas tetap akurat.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-amber-700">Total Hutang Overhead:</span>
                <p className="text-base font-black text-amber-950">
                  {formatRupiah(debtSummary?.total_outstanding_debt)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {debts.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Tidak Ada Hutang Overhead Aktif</p>
                  <p className="text-xs text-slate-400">Semua tagihan operasional dan tempo sudah lunas.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Nama Tagihan & Vendor</th>
                        <th className="py-3 px-4">Kategori</th>
                        <th className="py-3 px-4">Jatuh Tempo</th>
                        <th className="py-3 px-4 text-right">Total Biaya</th>
                        <th className="py-3 px-4 text-right">Sudah Dibayar</th>
                        <th className="py-3 px-4 text-right">Sisa Hutang</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Aksi Pelunasan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {debts.map((item) => {
                        const cat = getCategoryInfo(item.category);
                        const progress = Math.min(
                          100,
                          Math.round(((item.amount_paid || 0) / (item.amount || 1)) * 100)
                        );
                        return (
                          <tr key={item._id} className="hover:bg-slate-50 transition">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-800">{item.title}</div>
                              <div className="text-[11px] text-slate-400">
                                {item.vendor_recipient ? `Vendor: ${item.vendor_recipient}` : '-'}
                                {item.invoice_ref && ` • Ref: ${item.invoice_ref}`}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cat.color}`}
                              >
                                {cat.label}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {item.due_date ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-700">
                                    {new Date(item.due_date).toLocaleDateString('id-ID', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </div>
                                  {new Date(item.due_date) < new Date() && (
                                    <span className="text-[10px] text-rose-600 font-bold">
                                      Terlewat jatuh tempo!
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">Tidak ada tanggal</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                              {formatRupiah(item.amount)}
                            </td>
                            <td className="py-3.5 px-4 text-right text-emerald-700 font-semibold">
                              <div>{formatRupiah(item.amount_paid)}</div>
                              <div className="w-16 bg-slate-100 h-1.5 rounded-full ml-auto mt-1 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-rose-600">
                              {formatRupiah(item.amount_remaining)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {renderStatusBadge(item.payment_status, item.is_overdue)}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleOpenPaymentModal(item)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1 mx-auto"
                              >
                                <span>Bayar Hutang</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Rincian Kategori */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-800 flex items-center justify-between border-b pb-3">
                <span>Distribusi Beban Overhead</span>
                <Layers className="w-4 h-4 text-amber-600" />
              </h3>

              <div className="space-y-4">
                {summary?.category_breakdown?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Belum ada pengeluaran per kategori.</p>
                ) : (
                  summary?.category_breakdown?.map((cat) => {
                    const info = getCategoryInfo(cat.category);
                    const pct = Math.min(
                      100,
                      Math.round((cat.total / (summary.total_expense || 1)) * 100)
                    );
                    return (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-700">{info.label}</span>
                          <span className="font-bold text-slate-900">{formatRupiah(cat.total)} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 text-right">{cat.count} transaksi tercatat</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-800 flex items-center justify-between border-b pb-3">
                <span>Dampak ke Laba Bersih Outlet</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </h3>

              <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
                <p className="font-bold text-slate-800">Integrasi Otomatis Laba Rugi:</p>
                <p className="text-slate-600 leading-relaxed">
                  Semua pengeluaran overhead yang Anda catat di sini secara otomatis dijadikan faktor pengurang{' '}
                  <span className="font-bold text-slate-800">Biaya Operasional</span> di menu{' '}
                  <a href="/laba-rugi" className="text-emerald-700 underline font-semibold">
                    Laporan Laba Rugi (OAuth 2.0)
                  </a>.
                </p>
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-mono text-[11px] space-y-1">
                  <div>Laba Bersih = Pendapatan (POS API) - HPP Belanja - Overhead Real</div>
                  <div className="font-bold">
                    Total Pengurang Overhead: {formatRupiah(summary?.total_expense)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Catat Biaya Overhead Baru */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-600" />
                  Catat Biaya Overhead Baru
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama / Keperluan Biaya <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Tagihan Listrik PLN Gudang November"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kategori Overhead</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-xs bg-white font-medium"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nominal Biaya (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Pengeluaran</label>
                    <input
                      type="date"
                      value={formData.expense_date}
                      onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Vendor / Penerima Bayar</label>
                    <input
                      type="text"
                      placeholder="Contoh: PLN, Pemilik Ruko, Toko Aneka"
                      value={formData.vendor_recipient}
                      onChange={(e) => setFormData({ ...formData, vendor_recipient: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-xs"
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-semibold text-slate-700">Sumber Dana / Pembayaran</label>
                    <span className="text-[10px] text-slate-500 font-medium">Terkoneksi ke Arus Kas</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'cash', label: '💵 Kas Tunai', sub: 'Potong kas fisik' },
                      { id: 'transfer', label: '🏦 Rekening Bank', sub: 'Potong saldo bank' },
                      { id: 'tempo', label: '⏳ Tempo / Hutang', sub: 'Bayar nanti' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, payment_method: m.id })}
                        className={`py-2 px-1.5 rounded-lg font-bold text-[11px] border text-center transition flex flex-col items-center justify-center ${
                          formData.payment_method === m.id
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{m.label}</span>
                        <span className={`text-[9px] font-normal ${formData.payment_method === m.id ? 'text-amber-100' : 'text-slate-400'}`}>
                          {m.sub}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Fields if Tempo */}
                  {formData.payment_method === 'tempo' && (
                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-rose-700 mb-1">
                            Tanggal Jatuh Tempo <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={formData.due_date}
                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                            className="w-full px-3 py-2 border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Uang Muka / DP Dibayar (Rp)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0 jika belum bayar sama sekali"
                            value={formData.amount_paid}
                            onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-xs bg-white font-bold"
                          />
                        </div>
                      </div>

                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex justify-between items-center text-xs">
                        <span className="font-semibold text-rose-800">Sisa Hutang Overhead:</span>
                        <span className="font-black text-rose-700">
                          {formatRupiah(
                            Math.max(0, (Number(formData.amount) || 0) - (Number(formData.amount_paid) || 0))
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. Kwitansi / Nota / Ref</label>
                    <input
                      type="text"
                      placeholder="Contoh: INV-PLN-9921"
                      value={formData.invoice_ref}
                      onChange={(e) => setFormData({ ...formData, invoice_ref: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                    <input
                      type="text"
                      placeholder="Keterangan opsional"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Biaya Overhead'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Bayar Hutang Overhead */}
        {showPaymentModal && selectedOverhead && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  Pembayaran Tagihan Overhead
                </h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {errorMessage}
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="font-bold text-slate-800 text-sm">{selectedOverhead.title}</div>
                <div className="text-slate-500">
                  Vendor: {selectedOverhead.vendor_recipient || '-'}
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-600">Total Biaya:</span>
                  <span className="font-bold text-slate-800">{formatRupiah(selectedOverhead.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Sudah Dibayar:</span>
                  <span className="font-bold text-emerald-700">{formatRupiah(selectedOverhead.amount_paid)}</span>
                </div>
                <div className="flex justify-between font-black text-rose-600 text-sm">
                  <span>Sisa Hutang:</span>
                  <span>{formatRupiah(selectedOverhead.amount_remaining)}</span>
                </div>
              </div>

              <form onSubmit={handlePaymentSubmit} className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">
                      Nominal Pembayaran (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentData({ ...paymentData, amount: selectedOverhead.amount_remaining })
                      }
                      className="text-[11px] text-emerald-700 font-bold hover:underline"
                    >
                      Lunasi Semua
                    </button>
                  </div>
                  <input
                    type="number"
                    required
                    min="1"
                    max={selectedOverhead.amount_remaining}
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sumber Rekening / Akun</label>
                    <select
                      value={paymentData.payment_method}
                      onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
                    >
                      <option value="cash">💵 Kas Tunai (Uang Cash Fisik)</option>
                      <option value="transfer">🏦 Rekening Bank (Transfer)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Bayar</label>
                    <input
                      type="date"
                      value={paymentData.paid_at}
                      onChange={(e) => setPaymentData({ ...paymentData, paid_at: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Bukti / Ref Transfer</label>
                  <input
                    type="text"
                    placeholder="Contoh: TRF-BCA-10294"
                    value={paymentData.reference_number}
                    onChange={(e) => setPaymentData({ ...paymentData, reference_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catatan Pembayaran</label>
                  <input
                    type="text"
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Memproses...' : 'Konfirmasi Pembayaran'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Detail & Riwayat Pembayaran Overhead */}
        {showDetailModal && selectedOverhead && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-600" />
                  Detail & Riwayat Pembayaran
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">{selectedOverhead.title}</h4>
                    <p className="text-slate-500">Vendor: {selectedOverhead.vendor_recipient || '-'}</p>
                  </div>
                  <div>{renderStatusBadge(selectedOverhead.payment_status, selectedOverhead.is_overdue)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-500">Kategori:</span>
                    <p className="font-bold text-slate-800">
                      {getCategoryInfo(selectedOverhead.category).label}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Tanggal Pengeluaran:</span>
                    <p className="font-bold text-slate-800">
                      {new Date(selectedOverhead.expense_date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-500">Total Nominal:</span>
                    <p className="font-black text-slate-800">{formatRupiah(selectedOverhead.amount)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Sudah Dibayar:</span>
                    <p className="font-black text-emerald-700">{formatRupiah(selectedOverhead.amount_paid)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Sisa Tagihan:</span>
                    <p className="font-black text-rose-600">{formatRupiah(selectedOverhead.amount_remaining)}</p>
                  </div>
                </div>
              </div>

              {/* Payment Timeline / History */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Riwayat Pembayaran Cicilan / Pelunasan
                </h4>

                {selectedOverhead.payments?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
                    Belum ada catatan pembayaran cicilan.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {selectedOverhead.payments?.map((pay, idx) => (
                      <div key={pay._id || idx} className="p-3 text-xs flex justify-between items-center bg-white hover:bg-slate-50">
                        <div className="space-y-0.5">
                          <div className="font-bold text-emerald-700">{formatRupiah(pay.amount)}</div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(pay.paid_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}{' '}
                            • {pay.payment_method === 'bank' || pay.payment_method === 'transfer' ? '🏦 Rekening Bank' : '💵 Kas Tunai'}
                            {pay.reference_number && ` • Ref: ${pay.reference_number}`}
                          </div>
                          {pay.notes && <div className="text-[11px] text-slate-500 italic">{pay.notes}</div>}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Tercatat
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

