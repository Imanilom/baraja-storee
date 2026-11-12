'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Link from 'next/link';
import { api, getStoredUser } from '../../lib/api';
import {
  ClipboardList,
  Plus,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  Filter,
  FileText,
  AlertCircle,
  Printer,
  PackageCheck,
  Pencil,
  X,
  XCircle
} from 'lucide-react';

const STATUS_TABS = [
  { id: '', label: 'Semua' },
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Menunggu Approval' },
  { id: 'approved', label: 'Disetujui' },
  { id: 'partial_rejection', label: 'Partial Rejection' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'partially_received', label: 'Partial Received' },
  { id: 'completed', label: 'Selesai' },
];

const canManageInvoice = (marketlist) =>
  marketlist.has_invoice ||
  marketlist.purchase_tracking_started ||
  marketlist.items?.some((item) => Number(item.purchased_qty) > 0);

export default function MarketlistPage() {
  const [marketlists, setMarketlists] = useState([]);
  const [selectedMl, setSelectedMl] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [completingMarketlist, setCompletingMarketlist] = useState(null);
  const [rejectingMarketlist, setRejectingMarketlist] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingRejection, setSubmittingRejection] = useState(false);
  const [itemReviewDecisions, setItemReviewDecisions] = useState({});
  const [savingItemReview, setSavingItemReview] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMarketlists = async () => {
    setLoading(true);
    try {
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.getMarketlists(query);
      if (res?.data?.items) {
        setMarketlists(res.data.items);
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat daftar marketlist', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUser(getStoredUser());
    fetchMarketlists();
  }, [statusFilter]);

  const handleSubmitToAdmin = async (id) => {
    setActionLoading(true);
    try {
      await api.submitMarketlist(id);
      showToast('Marketlist berhasil diajukan untuk approval!');
      fetchMarketlists();
      if (selectedMl?._id === id) {
        const detail = await api.getMarketlistById(id);
        setSelectedMl(detail.data);
      }
    } catch (err) {
      showToast(err.message || 'Gagal mengajukan marketlist', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteMarketlist = async (ml) => {
    if (!confirm(`Selesaikan Marketlist ${ml.marketlist_number}?\n\nSisa barang yang belum diterima tidak akan dimasukkan ke invoice, dan penerimaan baru tidak dapat dicatat setelah selesai.`)) return;
    setCompletingMarketlist(ml._id);
    try {
      await api.completeMarketlist(ml._id);
      showToast(`Marketlist ${ml.marketlist_number} berhasil diselesaikan.`);
      await fetchMarketlists();
      if (selectedMl?._id === ml._id) {
        const detail = await api.getMarketlistById(ml._id);
        setSelectedMl(detail.data);
      }
    } catch (err) {
      showToast(err.message || 'Gagal menyelesaikan marketlist', 'error');
    } finally {
      setCompletingMarketlist(null);
    }
  };

  const canCompleteMarketlists = [
    'admin',
    'purchasing',
    'receiver',
    'leader',
    'staff',
    'management'
  ].includes(user?.role);
  const canReviewMarketlists = ['admin', 'management', 'leader'].includes(user?.role);
  const canRejectMarketlist = (marketlist) =>
    marketlist.status === 'submitted' && canReviewMarketlists;
  const canReviewActiveItems = (marketlist) =>
    canReviewMarketlists &&
    ['approved', 'in_progress', 'partial_rejection'].includes(marketlist.status);

  const handleRejectMarketlist = async (event) => {
    event.preventDefault();
    if (!rejectingMarketlist || !rejectionReason.trim()) {
      showToast('Alasan penolakan wajib diisi.', 'error');
      return;
    }

    setSubmittingRejection(true);
    try {
      await api.rejectMarketlist(rejectingMarketlist._id, rejectionReason.trim());
      showToast(`Marketlist ${rejectingMarketlist.marketlist_number} berhasil ditolak.`);
      setRejectingMarketlist(null);
      setRejectionReason('');
      await fetchMarketlists();
      if (selectedMl?._id === rejectingMarketlist._id) {
        setSelectedMl(null);
      }
    } catch (err) {
      showToast(err.message || 'Gagal menolak marketlist.', 'error');
    } finally {
      setSubmittingRejection(false);
    }
  };

  const handleOpenDetail = async (id) => {
    try {
      const res = await api.getMarketlistById(id);
      const marketlist = res.data;
      setSelectedMl(marketlist);
      setItemReviewDecisions(Object.fromEntries(
        (marketlist.items || []).map((item) => [item._id, {
          approved: item.item_status !== 'rejected',
          reason: item.rejection_reason || ''
        }])
      ));
    } catch (err) {
      showToast('Gagal memuat detail marketlist', 'error');
    }
  };

  const handleSaveItemReview = async () => {
    if (!selectedMl) return;
    const items = (selectedMl.items || []).flatMap((item) => {
      const decision = itemReviewDecisions[item._id] || { approved: true, reason: '' };
      const currentApproved = item.item_status !== 'rejected';
      const currentReason = item.rejection_reason || '';
      if (decision.approved === currentApproved &&
          (decision.approved || decision.reason.trim() === currentReason)) {
        return [];
      }
      return [{
        id: item._id,
        approved: decision.approved,
        reason: decision.reason.trim()
      }];
    });
    if (items.length === 0) {
      showToast('Tidak ada perubahan status item untuk disimpan.', 'error');
      return;
    }
    if (items.some((item) => !item.approved && !item.reason)) {
      showToast('Isi alasan untuk setiap item yang ditolak.', 'error');
      return;
    }

    setSavingItemReview(true);
    try {
      await api.approveItems(selectedMl._id, { items });
      const detail = await api.getMarketlistById(selectedMl._id);
      setSelectedMl(detail.data);
      setItemReviewDecisions(Object.fromEntries(
        (detail.data.items || []).map((item) => [item._id, {
          approved: item.item_status !== 'rejected',
          reason: item.rejection_reason || ''
        }])
      ));
      await fetchMarketlists();
      showToast('Status item Marketlist berhasil diperbarui.');
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui status item.', 'error');
    } finally {
      setSavingItemReview(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      draft: 'bg-slate-100 text-slate-600 border-slate-200',
      submitted: 'bg-amber-100 text-amber-800 border-amber-200',
      approved: 'bg-blue-100 text-blue-800 border-blue-200',
      partial_rejection: 'bg-rose-100 text-rose-800 border-rose-200',
      revision: 'bg-orange-100 text-orange-800 border-orange-200',
      in_progress: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      partially_received: 'bg-purple-100 text-purple-800 border-purple-200',
      received: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
    };
    return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Navbar title="Manajemen Marketlist" />

      {/* Floating Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border transition-all ${
            toast.type === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      <main className="p-4 sm:p-6 md:p-8 space-y-5 max-w-7xl w-full">
        {/* Top Header Card (Responsive) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-800">Daftar Marketlist</h1>
            <p className="text-xs text-slate-500">Perencanaan pengadaan barang dan single source of truth belanja</p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href="/marketlists/print"
              target="_blank"
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Harian</span>
            </Link>
            <Link
              href="/marketlists/create"
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Marketlist Baru</span>
            </Link>
          </div>
        </div>

        {/* Responsive Tabs & Filter: Tabs hidden on mobile to give maximum room */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Desktop Tabs (hidden on small screens) */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobile Select Filter (shown on small screens only) */}
          <div className="flex sm:hidden items-center gap-2 w-full">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700 focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="submitted">Menunggu Approval</option>
              <option value="approved">Disetujui</option>
              <option value="partial_rejection">Partial Rejection</option>
              <option value="in_progress">In Progress</option>
              <option value="draft">Draft</option>
              <option value="partially_received">Partially Received</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Content Section: Desktop Table vs Mobile Cards */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Nomor ML</th>
                  <th className="px-6 py-3.5">Tanggal Butuh</th>
                  <th className="px-6 py-3.5">Lokasi Gudang</th>
                  <th className="px-6 py-3.5">Pembuat</th>
                  <th className="px-6 py-3.5">Total Item</th>
                  <th className="px-6 py-3.5">Estimasi Biaya</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marketlists.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                      {loading ? 'Memuat data...' : 'Tidak ada Marketlist dengan kriteria ini.'}
                    </td>
                  </tr>
                ) : (
                  marketlists.map((ml) => (
                    <tr key={ml._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 font-mono">{ml.marketlist_number}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(ml.required_date || ml.date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{ml.location_id?.name || 'Gudang Pusat'}</td>
                      <td className="px-6 py-4 text-slate-600">{ml.created_by?.name || '-'}</td>
                      <td className="px-6 py-4 font-medium text-slate-700">{ml.totals?.total_items || 0} item</td>
                      <td className="px-6 py-4 font-black text-slate-800">
                        Rp {(ml.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getStatusBadge(ml.status)}`}>
                          {ml.status?.replace(/_/g, ' ')}
                        </span>
                        {ml.has_invoice && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                            📄 Invoice
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <Link
                            href={`/marketlists/${ml._id}/print`}
                            target="_blank"
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors inline-flex items-center gap-1"
                            title="Cetak PDF Lembar Belanja"
                          >
                            <Printer className="w-3 h-3 text-slate-600" />
                            Cetak
                          </Link>
                          {['draft', 'revision'].includes(ml.status) && (
                            <button
                              onClick={() => handleSubmitToAdmin(ml._id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors inline-flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              Submit
                            </button>
                          )}
                          {canRejectMarketlist(ml) && (
                            <button
                              onClick={() => {
                                setRejectingMarketlist(ml);
                                setRejectionReason('');
                              }}
                              disabled={submittingRejection}
                              className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <XCircle className="w-3 h-3" />
                              Tolak
                            </button>
                          )}
                          {['partially_received', 'received'].includes(ml.status) && canCompleteMarketlists && (
                            <button
                              onClick={() => handleCompleteMarketlist(ml)}
                              disabled={completingMarketlist === ml._id}
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                              title="Selesaikan penerimaan"
                            >
                              <PackageCheck className="w-3 h-3" />
                              {completingMarketlist === ml._id ? '...' : 'Selesaikan'}
                            </button>
                          )}
                          {canManageInvoice(ml) &&
                            ['partial_rejection', 'in_progress', 'partially_received', 'received', 'completed'].includes(ml.status) && (
                            <Link
                              href={`/invoices?marketlistId=${ml._id}`}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors"
                            >
                              {ml.has_invoice ? 'Kelola Invoice' : 'Proses Invoice'}
                            </Link>
                          )}
                          <button
                            onClick={() => handleOpenDetail(ml._id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            {canReviewActiveItems(ml) ? 'Review Item' : 'Detail'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {marketlists.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {loading ? 'Memuat data...' : 'Tidak ada Marketlist dengan kriteria ini.'}
              </div>
            ) : (
              marketlists.map((ml) => (
                <div key={ml._id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-slate-900 text-xs">{ml.marketlist_number}</span>
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(ml.status)}`}>
                        {ml.status?.replace(/_/g, ' ')}
                      </span>
                      {ml.has_invoice && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">??</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Pemohon: <strong>{ml.created_by?.name || '-'}</strong></span>
                    <span className="font-bold text-emerald-700">
                      Rp {(ml.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Dibutuhkan: {new Date(ml.required_date || ml.date).toLocaleDateString('id-ID')} ({ml.totals?.total_items || 0} item)</span>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/marketlists/${ml._id}/print`}
                        target="_blank"
                        className="px-2 py-1 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded inline-flex items-center gap-1"
                        title="Cetak PDF Belanja"
                      >
                        <Printer className="w-2.5 h-2.5 text-slate-600" />
                        Cetak
                      </Link>
                      {['draft', 'revision'].includes(ml.status) && (
                        <button
                          onClick={() => handleSubmitToAdmin(ml._id)}
                          disabled={actionLoading}
                          className="px-2.5 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded"
                        >
                          Submit
                        </button>
                      )}
                      {canRejectMarketlist(ml) && (
                        <button
                          onClick={() => {
                            setRejectingMarketlist(ml);
                            setRejectionReason('');
                          }}
                          disabled={submittingRejection}
                          className="px-2.5 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded disabled:opacity-50"
                        >
                          Tolak
                        </button>
                      )}
                      {['partially_received', 'received'].includes(ml.status) && canCompleteMarketlists && (
                        <button
                          onClick={() => handleCompleteMarketlist(ml)}
                          disabled={completingMarketlist === ml._id}
                          className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded disabled:opacity-50"
                        >
                          {completingMarketlist === ml._id ? '...' : 'Selesaikan'}
                        </button>
                      )}
                      {canManageInvoice(ml) &&
                        ['partial_rejection', 'in_progress', 'partially_received', 'received', 'completed'].includes(ml.status) && (
                        <Link
                          href={`/invoices?marketlistId=${ml._id}`}
                          className="px-2.5 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded"
                        >
                          {ml.has_invoice ? 'Kelola Invoice' : 'Proses Invoice'}
                        </Link>
                      )}
                      <button
                        onClick={() => handleOpenDetail(ml._id)}
                        className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded"
                      >
                        {canReviewActiveItems(ml) ? 'Review Item' : 'Detail'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {rejectingMarketlist && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <form onSubmit={handleRejectMarketlist} className="w-full max-w-md rounded-2xl border border-rose-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-rose-100 bg-rose-50 px-5 py-4 rounded-t-2xl">
                <div>
                  <h3 className="text-sm font-bold text-rose-900">Tolak Marketlist</h3>
                  <p className="mt-1 text-xs text-rose-700">{rejectingMarketlist.marketlist_number}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectingMarketlist(null)}
                  disabled={submittingRejection}
                  className="rounded-lg p-1 text-slate-500 hover:bg-rose-100"
                  aria-label="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-5">
                <label htmlFor="marketlist-rejection-reason" className="block text-xs font-semibold text-slate-700">
                  Alasan penolakan *
                </label>
                <textarea
                  id="marketlist-rejection-reason"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  required
                  autoFocus
                  placeholder="Tuliskan alasan penolakan agar pemohon mengetahui keputusan."
                  className="w-full rounded-lg border border-slate-200 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setRejectingMarketlist(null)}
                    disabled={submittingRejection}
                    className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRejection || !rejectionReason.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {submittingRejection ? 'Memproses...' : 'Konfirmasi Tolak'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Modal Detail Drawer */}
        {selectedMl && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
              {/* Modal Header */}
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Detail {selectedMl.marketlist_number}</h3>
                  <p className="text-xs text-slate-300">Status: {selectedMl.status?.toUpperCase()}</p>
                </div>
                <button
                  onClick={() => setSelectedMl(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                  <div>
                    <span className="text-slate-400 text-[11px]">Tanggal Kebutuhan:</span>
                    <p className="font-semibold text-slate-800">
                      {new Date(selectedMl.required_date || selectedMl.date).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Dibuat Oleh:</span>
                    <p className="font-semibold text-slate-800">{selectedMl.created_by?.name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Gudang Tujuan:</span>
                    <p className="font-semibold text-slate-800">{selectedMl.location_id?.name || 'Pusat'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Total Estimasi:</span>
                    <p className="font-bold text-emerald-700">
                      Rp {(selectedMl.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-2">Item Belanja:</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Barang</th>
                          <th className="p-2.5">Qty</th>
                          <th className="p-2.5">Harga Satuan</th>
                          <th className="p-2.5">Subtotal</th>
                          <th className="p-2.5">Persetujuan Item</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedMl.items?.map((it) => (
                          <tr key={it._id}>
                            <td className="p-2.5 font-bold text-slate-800">
                              {it.product_snapshot?.name || it.product_id?.name}
                            </td>
                            <td className="p-2.5">{it.requested_qty} {it.product_snapshot?.unit_name}</td>
                            <td className="p-2.5">Rp {(it.unit_price || 0).toLocaleString('id-ID')}</td>
                            <td className="p-2.5 font-bold text-slate-900">
                              Rp {(it.subtotal || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="p-2.5">
                              {canReviewActiveItems(selectedMl) ? (
                                <div className="min-w-52 space-y-1.5">
                                  <label className="flex items-center gap-2 font-semibold text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={itemReviewDecisions[it._id]?.approved ?? it.item_status !== 'rejected'}
                                      disabled={Number(it.purchased_qty) > 0 && it.item_status !== 'rejected'}
                                      onChange={(event) => setItemReviewDecisions((current) => ({
                                        ...current,
                                        [it._id]: {
                                          approved: event.target.checked,
                                          reason: event.target.checked
                                            ? ''
                                            : (current[it._id]?.reason || it.rejection_reason || '')
                                        }
                                      }))}
                                    />
                                    {itemReviewDecisions[it._id]?.approved ?? it.item_status !== 'rejected'
                                      ? 'Disetujui'
                                      : 'Ditolak'}
                                  </label>
                                  {!(itemReviewDecisions[it._id]?.approved ?? it.item_status !== 'rejected') && (
                                    <input
                                      type="text"
                                      maxLength={500}
                                      required
                                      value={itemReviewDecisions[it._id]?.reason || ''}
                                      onChange={(event) => setItemReviewDecisions((current) => ({
                                        ...current,
                                        [it._id]: {
                                          approved: false,
                                          reason: event.target.value
                                        }
                                      }))}
                                      placeholder="Alasan penolakan item"
                                      className="w-full rounded border border-rose-200 px-2 py-1 text-[10px]"
                                    />
                                  )}
                                  {Number(it.purchased_qty) > 0 && (
                                    <p className="text-[10px] text-slate-500">Sudah dibeli; item tidak dapat ditolak.</p>
                                  )}
                                </div>
                              ) : it.item_status === 'rejected' ? (
                                <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10px]">
                                  Ditolak ({it.rejection_reason || 'Alasan tidak tersedia'})
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                                  Disetujui
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {canReviewActiveItems(selectedMl) && (
                    <button
                      type="button"
                      onClick={handleSaveItemReview}
                      disabled={savingItemReview}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {savingItemReview ? 'Menyimpan...' : 'Simpan Status Item'}
                    </button>
                  )}
                  <Link
                    href={`/marketlists/${selectedMl._id}/print`}
                    target="_blank"
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak PDF</span>
                  </Link>
                  {['received', 'completed'].includes(selectedMl.status) && (
                    <Link
                      href={`/receiving?marketlistId=${selectedMl._id}`}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Penerimaan</span>
                    </Link>
                  )}
                  {['partially_received', 'received'].includes(selectedMl.status) && canCompleteMarketlists && (
                    <button
                      onClick={() => handleCompleteMarketlist(selectedMl)}
                      disabled={completingMarketlist === selectedMl._id}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      {completingMarketlist === selectedMl._id ? 'Menyelesaikan...' : 'Selesaikan Marketlist'}
                    </button>
                  )}
                  {canManageInvoice(selectedMl) &&
                    ['partial_rejection', 'in_progress', 'partially_received', 'received', 'completed'].includes(selectedMl.status) && (
                    <Link
                      href={`/invoices?marketlistId=${selectedMl._id}`}
                      className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{selectedMl.has_invoice ? 'Kelola Invoice' : 'Proses Invoice'}</span>
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => setSelectedMl(null)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
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
