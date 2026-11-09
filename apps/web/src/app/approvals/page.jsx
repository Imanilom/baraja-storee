'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { api, getStoredUser } from '../../lib/api';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  ShieldAlert,
  Eye,
  Check,
  Filter,
  CheckSquare,
  Square,
  AlertCircle,
  Printer
} from 'lucide-react';

export default function ApprovalsPage() {
  const [pendingList, setPendingList] = useState([]);
  const [selectedMl, setSelectedMl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [notification, setNotification] = useState(null);

  // Per-item decisions state: { [itemId]: { approved: boolean, reason: string } }
  const [itemDecisions, setItemDecisions] = useState({});

  // Inline action forms (replace prompt/alert)
  const [activeActionModal, setActiveActionModal] = useState(null); // 'reject' | 'revision' | null
  const [actionReason, setActionReason] = useState('');

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMarketlists('?status=submitted');
      if (res?.data?.items) {
        setPendingList(res.data.items);
      }
    } catch (err) {
      console.error(err);
      showNotification('Gagal memuat antrean approval', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    fetchPending();
  }, [fetchPending]);

  const handleOpenReview = async (id) => {
    try {
      const res = await api.getMarketlistById(id);
      const ml = res.data;
      setSelectedMl(ml);
      setDecisionNote('Marketlist disetujui');
      setActiveActionModal(null);
      setActionReason('');

      // Initialize all items as approved by default
      const decisions = {};
      (ml.items || []).forEach((it) => {
        decisions[it._id] = {
          approved: it.item_status !== 'rejected',
          reason: it.rejection_reason || ''
        };
      });
      setItemDecisions(decisions);
    } catch (err) {
      showNotification('Gagal memuat detail marketlist', 'error');
    }
  };

  // Toggle individual item checkbox
  const toggleItemApproved = (itemId) => {
    setItemDecisions((prev) => {
      const current = prev[itemId] || { approved: true, reason: '' };
      return {
        ...prev,
        [itemId]: {
          ...current,
          approved: !current.approved
        }
      };
    });
  };

  // Bulk select / deselect all items
  const handleSelectAll = (select) => {
    if (!selectedMl?.items) return;
    const next = {};
    selectedMl.items.forEach((it) => {
      next[it._id] = {
        approved: select,
        reason: select ? '' : (itemDecisions[it._id]?.reason || 'Ditolak oleh leader')
      };
    });
    setItemDecisions(next);
  };

  const updateItemReason = (itemId, reason) => {
    setItemDecisions((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { approved: false }),
        reason
      }
    }));
  };

  // Counts
  const totalItemsCount = selectedMl?.items?.length || 0;
  const approvedItemsCount = Object.values(itemDecisions).filter((d) => d.approved).length;
  const rejectedItemsCount = totalItemsCount - approvedItemsCount;
  const isAllSelected = totalItemsCount > 0 && approvedItemsCount === totalItemsCount;

  // Calculate estimated total based on approved items
  const approvedTotalAmount = (selectedMl?.items || []).reduce((sum, it) => {
    if (itemDecisions[it._id]?.approved) {
      return sum + (it.subtotal || 0);
    }
    return sum;
  }, 0);

  const handleApprove = async () => {
    if (!selectedMl) return;
    setActionLoading(true);
    try {
      // 1. Simpan review item per item terlebih dahulu
      const itemsPayload = Object.entries(itemDecisions).map(([id, val]) => ({
        id,
        approved: !!val.approved,
        reason: val.reason || (val.approved ? '' : 'Ditolak oleh leader')
      }));

      if (itemsPayload.length > 0) {
        try {
          await api.approveItems(selectedMl._id, { items: itemsPayload });
        } catch (itemErr) {
          console.warn('Review per item warning:', itemErr);
        }
      }

      // 2. Setujui marketlist
      await api.approveMarketlist(selectedMl._id, decisionNote);

      showNotification(`Marketlist ${selectedMl.marketlist_number} berhasil disetujui! (${approvedItemsCount}/${totalItemsCount} item disetujui)`);
      setSelectedMl(null);
      fetchPending();
    } catch (err) {
      showNotification(err.message || 'Gagal menyetujui marketlist', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedMl || !activeActionModal) return;
    if (!actionReason.trim()) {
      showNotification('Mohon isi alasan / catatan terlebih dahulu', 'error');
      return;
    }

    setActionLoading(true);
    try {
      if (activeActionModal === 'reject') {
        await api.rejectMarketlist(selectedMl._id, actionReason);
        showNotification(`Marketlist ${selectedMl.marketlist_number} ditolak`);
      } else if (activeActionModal === 'revision') {
        await api.requestRevision(selectedMl._id, actionReason);
        showNotification(`Permintaan revisi dikirim untuk ${selectedMl.marketlist_number}`);
      }
      setSelectedMl(null);
      setActiveActionModal(null);
      setActionReason('');
      fetchPending();
    } catch (err) {
      showNotification(err.message || 'Gagal memproses tindakan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const canApprove = ['admin', 'management', 'leader'].includes(currentUser?.role);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Navbar title="Approval Gate Marketlist" />

      {/* Floating Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border transition-all ${
            notification.type === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{notification.message}</span>
        </div>
      )}

      <main className="p-4 md:p-8 space-y-6 max-w-7xl w-full">
        {/* Info Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 md:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">Approval Gate: Admin & Leader</p>
              <p className="text-amber-800/80 mt-0.5">
                Leader dan Admin dapat menyetujui seluruh PO atau memilih (checklist) item yang disetujui dan menolak item yang tidak sesuai.
              </p>
            </div>
          </div>
          <span className="font-bold text-amber-800 bg-amber-200/50 px-3 py-1 rounded-full whitespace-nowrap self-start sm:self-auto">
            {pendingList.length} Menunggu Persetujuan
          </span>
        </div>

        {/* Pending Table / Cards (Responsive) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">Antrean Marketlist Menunggu Approval</h3>
            <span className="text-xs text-slate-500">{pendingList.length} Pengajuan</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Memuat data pengajuan...</div>
          ) : pendingList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <p className="font-semibold text-slate-700">Tidak ada marketlist yang menunggu approval.</p>
              <p className="text-[11px] text-slate-400">Semua pengajuan sudah diproses atau disetujui.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View (hidden on small screens) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Nomor ML</th>
                      <th className="px-6 py-3.5">Tanggal Butuh</th>
                      <th className="px-6 py-3.5">Pembuat</th>
                      <th className="px-6 py-3.5">Jumlah Item</th>
                      <th className="px-6 py-3.5">Estimasi Nilai</th>
                      <th className="px-6 py-3.5 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingList.map((ml) => (
                      <tr key={ml._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-3.5 font-bold font-mono text-slate-900">{ml.marketlist_number}</td>
                        <td className="px-6 py-3.5 text-slate-600">
                          {ml.needed_date ? new Date(ml.needed_date).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="font-medium text-slate-800">{ml.created_by?.name || 'Staff'}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                            {ml.items?.length || 0} item
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-bold text-emerald-700">
                          Rp {(ml.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => handleOpenReview(ml._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Periksa & Approve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (shown only on small screens) */}
              <div className="block md:hidden divide-y divide-slate-100">
                {pendingList.map((ml) => (
                  <div key={ml._id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-mono text-slate-900 text-xs">{ml.marketlist_number}</span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-bold">
                        {ml.items?.length || 0} item
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Pembuat: <strong>{ml.created_by?.name || 'Staff'}</strong></span>
                      <span className="font-bold text-emerald-700">
                        Rp {(ml.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Dibutuhkan: {ml.needed_date ? new Date(ml.needed_date).toLocaleDateString('id-ID') : '-'}</span>
                      <button
                        onClick={() => handleOpenReview(ml._id)}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Periksa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Modal Periksa & Approval Checklist */}
        {selectedMl && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">Approval Marketlist: {selectedMl.marketlist_number}</h3>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                      PO Menunggu Review
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pemohon: <span className="text-slate-200 font-semibold">{selectedMl.created_by?.name}</span> | Lokasi: {selectedMl.location_id?.name || 'Pusat'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/marketlists/${selectedMl._id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
                    title="Buka format cetak PDF belanja"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-400" />
                    <span>Cetak Lembar Belanja</span>
                  </a>
                  <button
                    onClick={() => setSelectedMl(null)}
                    className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
                {/* Checkbox Toolbar / Summary */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(!isAllSelected)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm"
                    >
                      {isAllSelected ? (
                        <>
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                          <span>Batalkan Pilih Semua</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-4 h-4 text-slate-400" />
                          <span>Pilih / Setujui Semua ({totalItemsCount} item)</span>
                        </>
                      )}
                    </button>

                    <div className="text-xs">
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mr-2">
                        {approvedItemsCount} Disetujui
                      </span>
                      {rejectedItemsCount > 0 && (
                        <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                          {rejectedItemsCount} Ditolak
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-500">Estimasi Total Disetujui:</span>
                    <p className="text-base font-black text-emerald-700">
                      Rp {approvedTotalAmount.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                {/* Items Table with Checkbox */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[550px]">
                      <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-center w-12">Setujui</th>
                          <th className="p-3">Nama Barang</th>
                          <th className="p-3">Jumlah</th>
                          <th className="p-3">Harga Satuan</th>
                          <th className="p-3">Subtotal</th>
                          <th className="p-3">Supplier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedMl.items?.map((it) => {
                          const decision = itemDecisions[it._id] || { approved: true, reason: '' };
                          const isApproved = decision.approved;

                          return (
                            <tr
                              key={it._id}
                              className={`transition-colors ${
                                isApproved ? 'bg-white hover:bg-slate-50' : 'bg-rose-50/60'
                              }`}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isApproved}
                                  onChange={() => toggleItemApproved(it._id)}
                                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                />
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-800">
                                  {it.product_snapshot?.name || it.product_id?.name || 'Item'}
                                </div>
                                {!isApproved && (
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <span className="text-[10px] text-rose-600 font-semibold">Alasan tolak:</span>
                                    <input
                                      type="text"
                                      value={decision.reason}
                                      onChange={(e) => updateItemReason(it._id, e.target.value)}
                                      placeholder="Contoh: Stok masih cukup / Harga terlalu mahal"
                                      className="text-[11px] px-2 py-0.5 border border-rose-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 flex-1 max-w-xs"
                                    />
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-slate-700">
                                {it.requested_qty} {it.product_snapshot?.unit_name || it.product_id?.unit_id?.abbreviation || ''}
                              </td>
                              <td className="p-3 text-slate-600">
                                Rp {(it.unit_price || 0).toLocaleString('id-ID')}
                              </td>
                              <td className="p-3 font-bold text-slate-900">
                                Rp {(it.subtotal || 0).toLocaleString('id-ID')}
                              </td>
                              <td className="p-3 text-slate-500">
                                {it.supplier_id?.name || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Catatan Keputusan Approval */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Catatan Keputusan Leader / Admin:
                  </label>
                  <input
                    type="text"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="Contoh: Disetujui dengan revisi item belanja"
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Inline Action Form for Reject / Revision */}
                {activeActionModal && (
                  <div className="p-4 rounded-xl border space-y-3 animate-fade-in bg-slate-50 border-slate-300">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-xs text-slate-800">
                        {activeActionModal === 'reject' ? '❌ Tolak Seluruh Marketlist' : '🔄 Minta Revisi ke Pemohon'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveActionModal(null)}
                        className="text-slate-400 hover:text-slate-600 text-xs"
                      >
                        Batal
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder={
                        activeActionModal === 'reject'
                          ? 'Jelaskan alasan penolakan seluruh marketlist ini...'
                          : 'Jelaskan poin yang perlu diperbaiki oleh pemohon...'
                      }
                      className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-700"
                    />

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveActionModal(null)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-white"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmAction}
                        disabled={actionLoading || !actionReason.trim()}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm disabled:opacity-50 ${
                          activeActionModal === 'reject'
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                      >
                        {actionLoading ? 'Menyimpan...' : 'Kirim Keputusan'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveActionModal('reject')}
                    disabled={actionLoading || !canApprove}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Tolak Marketlist
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveActionModal('revision')}
                    disabled={actionLoading || !canApprove}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Minta Revisi
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading || !canApprove || approvedItemsCount === 0}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {actionLoading
                    ? 'Memproses...'
                    : `Setujui (${approvedItemsCount}/${totalItemsCount} Item)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
