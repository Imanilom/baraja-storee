'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { api, getStoredUser } from '../../lib/api';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  ShieldAlert,
  Eye,
  Check
} from 'lucide-react';

export default function ApprovalsPage() {
  const [pendingList, setPendingList] = useState([]);
  const [selectedMl, setSelectedMl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await api.getMarketlists('?status=submitted');
      if (res?.data?.items) {
        setPendingList(res.data.items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    fetchPending();
  }, []);

  const handleOpenReview = async (id) => {
    try {
      const res = await api.getMarketlistById(id);
      setSelectedMl(res.data);
      setDecisionNote('Marketlist disetujui.');
    } catch (err) {
      alert('Gagal memuat detail');
    }
  };

  const handleApprove = async () => {
    if (!selectedMl) return;
    setActionLoading(true);
    try {
      await api.approveMarketlist(selectedMl._id, decisionNote);
      alert(`Marketlist ${selectedMl.marketlist_number} berhasil disetujui!`);
      setSelectedMl(null);
      fetchPending();
    } catch (err) {
      alert(err.message || 'Gagal approve marketlist');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedMl) return;
    const reason = prompt('Masukkan alasan penolakan:');
    if (!reason) return;

    setActionLoading(true);
    try {
      await api.rejectMarketlist(selectedMl._id, reason);
      alert(`Marketlist ${selectedMl.marketlist_number} ditolak.`);
      setSelectedMl(null);
      fetchPending();
    } catch (err) {
      alert(err.message || 'Gagal menolak marketlist');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedMl) return;
    const note = prompt('Masukkan instruksi perbaikan/revisi:');
    if (!note) return;

    setActionLoading(true);
    try {
      await api.requestRevision(selectedMl._id, note);
      alert(`Revisi diminta untuk Marketlist ${selectedMl.marketlist_number}.`);
      setSelectedMl(null);
      fetchPending();
    } catch (err) {
      alert(err.message || 'Gagal meminta revisi');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Admin Approval Gate" />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Info Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-bold">Aturan Pokok #3: Single Approval Gate Admin</p>
              <p className="text-amber-800/80">
                Hanya akun dengan role Admin yang dapat menyetujui Marketlist. Tanpa approval, barang tidak dapat diterima di mobile maupun digenerate invoice.
              </p>
            </div>
          </div>
          <span className="font-bold text-amber-800 bg-amber-200/50 px-3 py-1 rounded-full">
            {pendingList.length} Menunggu Persetujuan
          </span>
        </div>

        {/* Pending Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-bold text-sm text-slate-800">Antrean Marketlist Menunggu Approval</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Nomor ML</th>
                  <th className="px-6 py-3.5">Tanggal Butuh</th>
                  <th className="px-6 py-3.5">Pembuat</th>
                  <th className="px-6 py-3.5">Jumlah Item</th>
                  <th className="px-6 py-3.5">Estimasi Pengajuan</th>
                  <th className="px-6 py-3.5 text-right">Tindakan Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingList.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                      {loading ? 'Memeriksa antrean...' : 'Tidak ada Marketlist yang menunggu persetujuan Admin saat ini.'}
                    </td>
                  </tr>
                ) : (
                  pendingList.map((ml) => (
                    <tr key={ml._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-900">{ml.marketlist_number}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(ml.required_date || ml.date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{ml.created_by?.name || '-'}</td>
                      <td className="px-6 py-4 text-slate-700">{ml.totals?.total_items || 0} item</td>
                      <td className="px-6 py-4 font-black text-emerald-700">
                        Rp {(ml.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenReview(ml._id)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Periksa & Setujui
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Review Modal */}
        {selectedMl && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Pemeriksaan Approval — {selectedMl.marketlist_number}</h3>
                  <p className="text-xs text-slate-300">Dibuat oleh: {selectedMl.created_by?.name}</p>
                </div>
                <button onClick={() => setSelectedMl(null)} className="text-slate-400 hover:text-white font-bold text-lg">
                  &times;
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                {/* Items details */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">Item yang Diajukan:</h4>
                  <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Barang</th>
                        <th className="p-2.5">Qty</th>
                        <th className="p-2.5">Harga Diajukan</th>
                        <th className="p-2.5">Subtotal</th>
                        <th className="p-2.5">Supplier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedMl.items?.map((it) => (
                        <tr key={it._id}>
                          <td className="p-2.5 font-bold text-slate-800">
                            {it.product_snapshot?.name || it.product_id?.name}
                          </td>
                          <td className="p-2.5">{it.requested_qty} {it.product_snapshot?.unit_name}</td>
                          <td className="p-2.5">Rp {it.unit_price?.toLocaleString('id-ID')}</td>
                          <td className="p-2.5 font-bold text-slate-900">Rp {it.subtotal?.toLocaleString('id-ID')}</td>
                          <td className="p-2.5 text-slate-600">{it.supplier_id?.name || 'Belum dipilih'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total */}
                <div className="p-4 bg-slate-50 rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-slate-600">Total Nilai Disetujui:</span>
                  <span className="text-lg font-black text-emerald-700">
                    Rp {(selectedMl.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Admin Note Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Keputusan Admin (Approval Note):
                  </label>
                  <input
                    type="text"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Tolak Marketlist
                  </button>
                  <button
                    onClick={handleRequestRevision}
                    disabled={actionLoading}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Minta Revisi
                  </button>
                </div>

                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Setujui Marketlist (Approve)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

