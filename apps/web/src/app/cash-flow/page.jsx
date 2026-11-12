'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import {
  Landmark, Wallet, ArrowDownRight, ArrowUpRight, ArrowLeftRight,
  Plus, Calendar, Filter, Trash2, CheckCircle2, AlertCircle,
  FileText, ShoppingCart, RefreshCw, X, CreditCard, Banknote, ShieldAlert, Zap
} from 'lucide-react';

const fmt = (v) => `Rp ${(v || 0).toLocaleString('id-ID')}`;
const toLocalDateInput = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const toLocalDateTimeInput = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const dateRangeQuery = (date) => {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  return `startDate=${encodeURIComponent(start.toISOString())}&endDate=${encodeURIComponent(end.toISOString())}`;
};
const recentDays = Array.from({ length: 31 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - index);
  return toLocalDateInput(date);
});
const fmtDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function CashFlowPage() {
  const [summary, setSummary] = useState({
    current_cash_balance: 0,
    current_petty_cash_balance: 0,
    current_bank_balance: 0,
    total_liquidity: 0,
    total_inflow: 0,
    total_in_cash: 0,
    total_in_bank: 0,
    total_withdrawal: 0,
    total_purchase_cash: 0,
    total_purchase_bank: 0,
    total_purchase_petty_cash: 0,
    total_petty_cash_funded: 0,
    total_petty_cash_returned: 0,
    total_purchase: 0,
    total_debt_payment: 0,
    total_overhead: 0,
    total_outflow: 0
  });

  const [mutations, setMutations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'cash' | 'bank' | 'in' | 'withdrawal' | 'purchase'
  const [filterDate, setFilterDate] = useState(toLocalDateInput());

  // Modals
  const [showInModal, setShowInModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);
  const [showPettyModal, setShowPettyModal] = useState(false);
  const [pettyAction, setPettyAction] = useState('fund');
  const [pettyAmount, setPettyAmount] = useState('');
  const [pettyDate, setPettyDate] = useState(toLocalDateTimeInput());
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [inForm, setInForm] = useState({
    amount: '',
    to_account: 'bank',
    category: 'modal',
    description: '',
    reference_number: '',
    date: toLocalDateTimeInput(),
    notes: ''
  });

  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    description: 'Tarik tunai dari rekening bank untuk kas belanja & operasional',
    reference_number: '',
    date: toLocalDateTimeInput(),
    notes: ''
  });

  const [outForm, setOutForm] = useState({
    amount: '',
    source_account: 'cash',
    category: 'operasional_manual',
    description: '',
    reference_number: '',
    date: toLocalDateTimeInput(),
    notes: ''
  });

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const params = `?${dateRangeQuery(filterDate)}`;
      const res = await api.getCashFlowSummary(params);
      setSummary(res.data || {});
    } catch (e) {
      console.error('Gagal memuat ringkasan kas:', e);
    } finally {
      setLoadingSummary(false);
    }
  }, [filterDate]);

  // Fetch mutations
  const fetchMutations = useCallback(async () => {
    setLoading(true);
    try {
      let params = `?limit=500&${dateRangeQuery(filterDate)}`;
      if (['cash', 'bank', 'petty_cash'].includes(activeTab)) {
        params += `&account=${activeTab}`;
      } else if (['in', 'withdrawal', 'purchase', 'overhead', 'petty_cash'].includes(activeTab)) {
        params += `&type=${activeTab}`;
      }

      const res = await api.getCashFlowMutations(params);
      setMutations(res.data || []);
    } catch (e) {
      console.error('Gagal memuat mutasi kas:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchMutations();
  }, [fetchMutations]);

  // Submit Uang Masuk
  const handleSubmitIn = async (e) => {
    e.preventDefault();
    if (!inForm.amount || Number(inForm.amount) <= 0) {
      alert('Nominal uang masuk harus lebih dari 0.');
      return;
    }
    if (!inForm.description.trim()) {
      alert('Keterangan uang masuk wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      await api.recordCashIn({
        amount: Number(inForm.amount),
        to_account: inForm.to_account,
        category: inForm.category,
        description: inForm.description.trim(),
        reference_number: inForm.reference_number.trim(),
        date: new Date(inForm.date).toISOString(),
        notes: inForm.notes.trim()
      });
      alert('✅ Uang masuk berhasil dicatat!');
      setShowInModal(false);
      setInForm({
        amount: '',
        to_account: 'bank',
        category: 'modal',
        description: '',
        reference_number: '',
        date: toLocalDateTimeInput(),
        notes: ''
      });
      fetchSummary();
      fetchMutations();
    } catch (err) {
      alert(`Gagal mencatat uang masuk: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Tarik Tunai
  const handleSubmitWithdraw = async (e) => {
    e.preventDefault();
    if (!withdrawForm.amount || Number(withdrawForm.amount) <= 0) {
      alert('Nominal tarik tunai harus lebih dari 0.');
      return;
    }

    setSubmitting(true);
    try {
      await api.recordWithdrawal({
        amount: Number(withdrawForm.amount),
        description: withdrawForm.description.trim(),
        reference_number: withdrawForm.reference_number.trim(),
        date: new Date(withdrawForm.date).toISOString(),
        notes: withdrawForm.notes.trim()
      });
      alert('✅ Tarik tunai berhasil dicatat! Saldo rekening berkurang dan saldo kas tunai bertambah.');
      setShowWithdrawModal(false);
      setWithdrawForm({
        amount: '',
        description: 'Tarik tunai dari rekening bank untuk kas belanja & operasional',
        reference_number: '',
        date: toLocalDateTimeInput(),
        notes: ''
      });
      fetchSummary();
      fetchMutations();
    } catch (err) {
      alert(`Gagal mencatat tarik tunai: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Kas Keluar Manual
  const handleSubmitOut = async (e) => {
    e.preventDefault();
    if (!outForm.amount || Number(outForm.amount) <= 0) {
      alert('Nominal pengeluaran harus lebih dari 0.');
      return;
    }
    if (!outForm.description.trim()) {
      alert('Keterangan pengeluaran wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      await api.recordCashOut({
        amount: Number(outForm.amount),
        source_account: outForm.source_account,
        category: outForm.category,
        description: outForm.description.trim(),
        reference_number: outForm.reference_number.trim(),
        date: new Date(outForm.date).toISOString(),
        notes: outForm.notes.trim()
      });
      alert('✅ Pengeluaran kas manual berhasil dicatat!');
      setShowOutModal(false);
      setOutForm({
        amount: '',
        source_account: 'cash',
        category: 'operasional_manual',
        description: '',
        reference_number: '',
        date: toLocalDateTimeInput(),
        notes: ''
      });
      fetchSummary();
      fetchMutations();
    } catch (err) {
      alert(`Gagal mencatat pengeluaran: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openPettyModal = (action) => {
    setPettyAction(action);
    setPettyAmount('');
    setPettyDate(`${filterDate}T${toLocalDateTimeInput().slice(11)}`);
    setShowPettyModal(true);
  };

  const handleSubmitPettyCash = async (e) => {
    e.preventDefault();
    if (!pettyAmount || Number(pettyAmount) <= 0) {
      alert('Nominal kas kecil harus lebih dari 0.');
      return;
    }

    setSubmitting(true);
    try {
      await api.transferPettyCash(pettyAction, {
        amount: Number(pettyAmount),
        date: new Date(pettyDate).toISOString(),
        description: pettyAction === 'fund'
          ? 'Pendanaan kas kecil dari kas besar'
          : 'Pengembalian sisa kas kecil ke kas besar'
      });
      setShowPettyModal(false);
      setPettyAmount('');
      fetchSummary();
      fetchMutations();
    } catch (err) {
      alert(`Gagal memproses kas kecil: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Hapus transaksi manual
  const handleDeleteTransaction = async (id, title) => {
    if (!confirm(`Apakah Anda yakin ingin membatalkan/menghapus transaksi "${title}"?`)) {
      return;
    }
    try {
      await api.deleteCashTransaction(id);
      alert('✅ Transaksi berhasil dihapus.');
      fetchSummary();
      fetchMutations();
    } catch (err) {
      alert(`Gagal menghapus transaksi: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Manajemen Arus Kas & Saldo Bank" />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Info Banner */}
        <div className="bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-2xl flex items-start gap-3 text-xs text-indigo-950">
          <Landmark className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Pemantauan Arus Kas (Cash Flow) & Saldo Likuiditas</p>
            <p className="text-indigo-900/80 mt-0.5 leading-relaxed">
              Pantau posisi <strong>Kas Tunai (Fisik)</strong> dan <strong>Rekening Bank</strong> secara realtime.
              Catat modal/uang masuk, penarikan tunai dari rekening ke kas tunai, serta lacak pemotongan otomatis dari transaksi belanja supplier maupun biaya operasional.
            </p>
          </div>
        </div>

        {/* ===== TOP METRICS CARDS ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Kas Tunai */}
          <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                Saldo Kas Tunai Fisik
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                Cash on Hand
              </span>
            </div>
            <p className={`text-2xl font-black ${summary.current_cash_balance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {fmt(summary.current_cash_balance)}
            </p>
            <div className="mt-3 pt-3 border-t border-emerald-100 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Belanja Kas:</span>
                <strong className="text-slate-800">{fmt(summary.total_purchase_cash)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Overhead Kas:</span>
                <strong className="text-amber-700">{fmt(summary.total_overhead_cash)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tarik Tunai Masuk:</span>
                <strong className="text-emerald-700 font-bold">+{fmt(summary.total_withdrawal)}</strong>
              </div>
            </div>
          </div>

          <div className="bg-white border border-violet-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-violet-800 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-violet-600" />
                Saldo Kas Kecil
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-100 text-violet-800 rounded-full">
                Petty Cash
              </span>
            </div>
            <p className={`text-2xl font-black ${summary.current_petty_cash_balance < 0 ? 'text-red-600' : 'text-violet-700'}`}>
              {fmt(summary.current_petty_cash_balance)}
            </p>
            <div className="mt-3 pt-3 border-t border-violet-100 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Didanai hari ini:</span>
                <strong className="text-emerald-700">{fmt(summary.total_petty_cash_funded)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Dikembalikan:</span>
                <strong className="text-violet-700">{fmt(summary.total_petty_cash_returned)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Belanja kas kecil:</span>
                <strong className="text-rose-700">{fmt(summary.total_purchase_petty_cash)}</strong>
              </div>
            </div>
          </div>

          {/* Card 2: Rekening Bank */}
          <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-blue-600" />
                Saldo Rekening Bank
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                Bank Balance
              </span>
            </div>
            <p className={`text-2xl font-black ${summary.current_bank_balance < 0 ? 'text-red-600' : 'text-blue-700'}`}>
              {fmt(summary.current_bank_balance)}
            </p>
            <div className="mt-3 pt-3 border-t border-blue-100 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Belanja Bank:</span>
                <strong className="text-slate-800">{fmt(summary.total_purchase_bank)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Overhead Bank:</span>
                <strong className="text-amber-700">{fmt(summary.total_overhead_bank)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Ditarik ke Kas:</span>
                <strong className="text-rose-600 font-bold">-{fmt(summary.total_withdrawal)}</strong>
              </div>
            </div>
          </div>

          {/* Card 3: Total Uang Masuk */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                Total Uang Masuk
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
                Inflow
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900">
              {fmt(summary.total_inflow)}
            </p>
            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Ke Kas:</span>
                <strong>{fmt(summary.total_in_cash)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Ke Bank:</span>
                <strong>{fmt(summary.total_in_bank)}</strong>
              </div>
            </div>
          </div>

          {/* Card 4: Total Tarik Tunai */}
          <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-amber-600" />
                Total Tarik Tunai
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                ATM / Bank ➔ Kas
              </span>
            </div>
            <p className="text-2xl font-black text-amber-700">
              {fmt(summary.total_withdrawal)}
            </p>
            <div className="mt-3 pt-3 border-t border-amber-100 text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Likuiditas Gabungan:</span>
                <strong className="text-indigo-700 font-bold">{fmt(summary.total_liquidity)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ===== BREAKDOWN PENGELUARAN (BELANJA & OVERHEAD) ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-slate-600" />
                Total Belanja Supplier
              </span>
              <div className="text-lg font-black text-slate-900 mt-1">{fmt(summary.total_purchase)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Kas Tunai: <strong className="text-slate-700">{fmt(summary.total_purchase_cash)}</strong> • Bank: <strong className="text-slate-700">{fmt(summary.total_purchase_bank)}</strong>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                Total Biaya Overhead
              </span>
              <div className="text-lg font-black text-amber-900 mt-1">{fmt(summary.total_overhead)}</div>
              <div className="text-[10px] text-amber-700 mt-0.5">
                Kas Tunai: <strong>{fmt(summary.total_overhead_cash)}</strong> • Bank: <strong>{fmt(summary.total_overhead_bank)}</strong>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-800 uppercase flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                Total Seluruh Pengeluaran
              </span>
              <div className="text-lg font-black text-rose-900 mt-1">{fmt(summary.total_outflow)}</div>
              <div className="text-[10px] text-rose-700 mt-0.5">
                Termasuk belanja, overhead, & bayar hutang
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* ===== TOOLBAR & ACTION BUTTONS ===== */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowInModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ Catat Uang Masuk</span>
            </button>

            <button
              onClick={() => setShowWithdrawModal(true)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>🏧 Catat Tarik Tunai</span>
            </button>

            <button
              onClick={() => setShowOutModal(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>- Pengeluaran Manual</span>
            </button>
            <button
              onClick={() => openPettyModal('fund')}
              className="px-4 py-2.5 bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Kas Besar → Kas Kecil</span>
            </button>
            <button
              onClick={() => openPettyModal('return')}
              className="px-4 py-2.5 bg-white hover:bg-violet-50 text-violet-800 border border-violet-300 font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Kembalikan Sisa Kas Kecil</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="cash-flow-day" className="text-xs font-bold text-slate-600">Pilih hari:</label>
            <select
              id="cash-flow-day"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-700"
            >
              {recentDays.map((date) => (
                <option key={date} value={date}>
                  {date === toLocalDateInput()
                    ? `Hari ini (${date})`
                    : new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', {
                      weekday: 'long', day: '2-digit', month: 'short', year: 'numeric'
                    })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ===== MUTATION TABS ===== */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit flex-wrap">
          {[
            { id: 'all', label: 'Semua Mutasi' },
            { id: 'cash', label: '💵 Kas Tunai' },
            { id: 'petty_cash', label: '🪙 Kas Kecil' },
            { id: 'bank', label: '🏦 Rekening Bank' },
            { id: 'in', label: '📥 Uang Masuk' },
            { id: 'withdrawal', label: '🏧 Tarik Tunai' },
            { id: 'purchase', label: '🛒 Belanja Supplier' },
            { id: 'overhead', label: '⚡ Biaya Overhead' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== MUTATIONS TABLE ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-indigo-600" />
              Buku Mutasi Arus Kas & Bank
            </h3>
            <span className="text-xs text-slate-400 font-semibold">{mutations.length} Catatan Mutasi</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Tanggal</th>
                  <th className="px-5 py-3.5">Jenis Transaksi</th>
                  <th className="px-5 py-3.5">Akun Dana</th>
                  <th className="px-5 py-3.5">Keterangan & Referensi</th>
                  <th className="px-5 py-3.5 text-right">Nominal</th>
                  <th className="px-5 py-3.5">Petugas</th>
                  <th className="px-5 py-3.5 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      Memuat mutasi arus kas...
                    </td>
                  </tr>
                ) : mutations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      Belum ada mutasi arus kas yang tercatat.
                    </td>
                  </tr>
                ) : (
                  mutations.map((m, idx) => {
                    const isIn = m.direction === 'in';
                    const isTransfer = m.direction === 'transfer';
                    const isManual = m.source_type === 'cash_transaction';

                    return (
                      <tr key={m._id ? `${m._id}-${idx}` : idx} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                          {fmtDate(m.date)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isIn
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isTransfer
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-red-50 text-red-800 border border-red-200'
                          }`}>
                            {m.category_label || m.trx_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`font-semibold ${
                            m.account === 'bank'
                              ? 'text-blue-700'
                              : m.account === 'cash'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}>
                            {m.account_label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-800">{m.title}</div>
                          {m.reference_number && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Ref: {m.reference_number}
                            </span>
                          )}
                          {m.notes && (
                            <p className="text-[10px] text-slate-500 italic mt-0.5">{m.notes}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <span className={`text-xs font-black ${
                            isIn
                              ? 'text-emerald-700'
                              : isTransfer
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}>
                            {isIn ? `+${fmt(m.amount)}` : isTransfer ? `⇄ ${fmt(m.amount)}` : `-${fmt(m.amount)}`}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                          {m.creator}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {isManual ? (
                            <button
                              onClick={() => handleDeleteTransaction(m._id, m.title)}
                              className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition"
                              title="Hapus / Batalkan Transaksi Manual"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[10px]">Auto</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== MODAL: CATAT UANG MASUK ===== */}
        {showInModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg my-8">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-emerald-50/60 rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                    Catat Uang Masuk
                  </h3>
                  <p className="text-[11px] text-emerald-800/80 mt-0.5">
                    Tambah saldo ke Rekening Bank atau Kas Tunai Fisik
                  </p>
                </div>
                <button
                  onClick={() => setShowInModal(false)}
                  className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitIn} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nominal Uang Masuk (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Contoh: 10000000"
                    value={inForm.amount}
                    onChange={(e) => setInForm({ ...inForm, amount: e.target.value })}
                    className="w-full p-2.5 border-2 border-emerald-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-emerald-950"
                  />
                  {inForm.amount && (
                    <p className="text-[11px] text-emerald-700 font-bold mt-1">
                      Terbaca: {fmt(Number(inForm.amount))}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Masuk ke Akun *
                    </label>
                    <select
                      value={inForm.to_account}
                      onChange={(e) => setInForm({ ...inForm, to_account: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800"
                    >
                      <option value="bank">🏦 Rekening Bank</option>
                      <option value="cash">💵 Kas Tunai (Fisik)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Kategori *
                    </label>
                    <select
                      value={inForm.category}
                      onChange={(e) => setInForm({ ...inForm, category: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    >
                      <option value="modal">Modal Awal / Tambahan Owner</option>
                      <option value="penjualan_pos">Setoran Penjualan / POS</option>
                      <option value="transfer_masuk">Transfer Masuk dari Rekening Lain</option>
                      <option value="lainnya">Penerimaan Lainnya</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Keterangan Transaksi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Setoran modal operasional bulan November dari Pak Bos"
                    value={inForm.description}
                    onChange={(e) => setInForm({ ...inForm, description: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Tanggal
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={inForm.date}
                      onChange={(e) => setInForm({ ...inForm, date: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      No. Referensi / Bukti Transfer
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: TRF-BCA-98765"
                      value={inForm.reference_number}
                      onChange={(e) => setInForm({ ...inForm, reference_number: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan</label>
                  <input
                    type="text"
                    placeholder="Catatan opsional..."
                    value={inForm.notes}
                    onChange={(e) => setInForm({ ...inForm, notes: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowInModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? 'Menyimpan...' : 'Simpan Uang Masuk'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: CATAT TARIK TUNAI (ATM / BANK ➔ KAS) ===== */}
        {showWithdrawModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg my-8">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-amber-50/70 rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-sm text-amber-950 flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-amber-600" />
                    Catat Tarik Tunai (Bank ➔ Kas Tunai)
                  </h3>
                  <p className="text-[11px] text-amber-800/80 mt-0.5">
                    Penarikan uang dari Rekening Bank untuk dipegang tunai (kas belanja)
                  </p>
                </div>
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitWithdraw} className="p-6 space-y-4 text-xs">
                {/* Visual Flow Banner */}
                <div className="bg-amber-100/60 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div className="text-center flex-1">
                    <p className="text-[10px] text-amber-800 font-bold uppercase">Sumber Dana</p>
                    <p className="font-black text-blue-800 mt-0.5">🏦 Rekening Bank</p>
                    <p className="text-[10px] text-red-600 font-bold">(Saldo Berkurang -)</p>
                  </div>
                  <div className="px-3 text-amber-600 font-black text-lg">➔</div>
                  <div className="text-center flex-1">
                    <p className="text-[10px] text-amber-800 font-bold uppercase">Tujuan Dana</p>
                    <p className="font-black text-emerald-800 mt-0.5">💵 Kas Tunai Fisik</p>
                    <p className="text-[10px] text-emerald-700 font-bold">(Saldo Bertambah +)</p>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nominal yang Ditarik Tunai (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Contoh: 5000000"
                    value={withdrawForm.amount}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                    className="w-full p-2.5 border-2 border-amber-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-bold text-amber-950"
                  />
                  {withdrawForm.amount && (
                    <p className="text-[11px] text-amber-800 font-bold mt-1">
                      Terbaca: {fmt(Number(withdrawForm.amount))}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Keterangan Penarikan
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Tarik tunai ATM BCA untuk belanja sayur & buah pasar induk"
                    value={withdrawForm.description}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, description: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Tanggal Penarikan
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={withdrawForm.date}
                      onChange={(e) => setWithdrawForm({ ...withdrawForm, date: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      No. Resi ATM / Kode Penarikan
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: ATM-20261109-01"
                      value={withdrawForm.reference_number}
                      onChange={(e) => setWithdrawForm({ ...withdrawForm, reference_number: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan</label>
                  <input
                    type="text"
                    placeholder="Catatan opsional..."
                    value={withdrawForm.notes}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, notes: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowWithdrawModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? 'Menyimpan...' : 'Simpan Tarik Tunai'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL: CATAT PENGELUARAN MANUAL ===== */}
        {showOutModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg my-8">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-100 rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-red-600" />
                    Catat Pengeluaran Kas Manual
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pengeluaran kas tunai atau rekening di luar belanja supplier
                  </p>
                </div>
                <button
                  onClick={() => setShowOutModal(false)}
                  className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitOut} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nominal Pengeluaran (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Contoh: 250000"
                    value={outForm.amount}
                    onChange={(e) => setOutForm({ ...outForm, amount: e.target.value })}
                    className="w-full p-2.5 border-2 border-red-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-bold text-red-950"
                  />
                  {outForm.amount && (
                    <p className="text-[11px] text-red-700 font-bold mt-1">
                      Terbaca: {fmt(Number(outForm.amount))}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Keluarkan dari Akun *
                    </label>
                    <select
                      value={outForm.source_account}
                      onChange={(e) => setOutForm({ ...outForm, source_account: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800"
                    >
                      <option value="cash">💵 Kas Tunai (Fisik)</option>
                      <option value="petty_cash">🪙 Kas Kecil</option>
                      <option value="bank">🏦 Rekening Bank</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Kategori *
                    </label>
                    <select
                      value={outForm.category}
                      onChange={(e) => setOutForm({ ...outForm, category: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    >
                      <option value="operasional_manual">Biaya Operasional Lapangan</option>
                      <option value="transport_parkir">Bensin / Parkir / Tol</option>
                      <option value="konsumsi">Konsumsi Karyawan / Lembur</option>
                      <option value="lainnya">Pengeluaran Lainnya</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Keterangan Pengeluaran *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Beli bensin motor operasional belanja pasar"
                    value={outForm.description}
                    onChange={(e) => setOutForm({ ...outForm, description: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Tanggal
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={outForm.date}
                      onChange={(e) => setOutForm({ ...outForm, date: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      No. Kuitansi / Bukti
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: STRUK-001"
                      value={outForm.reference_number}
                      onChange={(e) => setOutForm({ ...outForm, reference_number: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan</label>
                  <input
                    type="text"
                    placeholder="Catatan tambahan..."
                    value={outForm.notes}
                    onChange={(e) => setOutForm({ ...outForm, notes: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowOutModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPettyModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-violet-200 w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-violet-100 bg-violet-50 rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-sm text-violet-950">
                    {pettyAction === 'fund' ? 'Pendanaan Kas Kecil' : 'Pengembalian Sisa Kas Kecil'}
                  </h3>
                  <p className="text-[11px] text-violet-700 mt-1">
                    {pettyAction === 'fund'
                      ? 'Dana berpindah dari kas besar ke kas kecil.'
                      : 'Sisa kas kecil hari ini kembali ke kas besar.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPettyModal(false)}
                  className="p-1 hover:bg-violet-100 rounded-lg text-slate-500"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSubmitPettyCash} className="p-6 space-y-4 text-xs">
                <label className="block font-bold text-slate-700">
                  Nominal (Rp) *
                  <input
                    type="number"
                    min="1"
                    required
                    value={pettyAmount}
                    onChange={(e) => setPettyAmount(e.target.value)}
                    className="mt-1 w-full p-2.5 border border-violet-200 rounded-lg"
                    placeholder="Masukkan nominal"
                  />
                </label>
                <label className="block font-bold text-slate-700">
                  Tanggal dan waktu *
                  <input
                    type="datetime-local"
                    required
                    value={pettyDate}
                    onChange={(e) => setPettyDate(e.target.value)}
                    className="mt-1 w-full p-2.5 border border-violet-200 rounded-lg"
                  />
                </label>
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPettyModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white rounded-lg font-bold disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Transfer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
