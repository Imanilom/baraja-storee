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
  CheckCircle,
  Clock,
  Filter,
  FileText
} from 'lucide-react';

export default function MarketlistPage() {
  const [marketlists, setMarketlists] = useState([]);
  const [selectedMl, setSelectedMl] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [user, setUser] = useState(null);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUser(getStoredUser());
    fetchMarketlists();
  }, [statusFilter]);

  const handleSubmitToAdmin = async (id) => {
    if (!confirm('Kirim Marketlist ini ke Admin untuk approval?')) return;
    setActionLoading(true);
    try {
      await api.submitMarketlist(id);
      alert('Marketlist berhasil disubmit ke Admin!');
      fetchMarketlists();
      if (selectedMl?._id === id) {
        const detail = await api.getMarketlistById(id);
        setSelectedMl(detail.data);
      }
    } catch (err) {
      alert(err.message || 'Gagal submit marketlist');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDetail = async (id) => {
    try {
      const res = await api.getMarketlistById(id);
      setSelectedMl(res.data);
    } catch (err) {
      alert('Gagal memuat detail marketlist');
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Manajemen Marketlist" />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Daftar Marketlist</h1>
            <p className="text-xs text-slate-500">Perencanaan pengadaan barang dan single source of truth belanja</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Semua Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted (Menunggu Admin)</option>
                <option value="approved">Approved</option>
                <option value="in_progress">In Progress</option>
                <option value="partially_received">Partially Received</option>
                <option value="received">Received</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <Link
              href="/marketlists/create"
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Marketlist Baru</span>
            </Link>
          </div>
        </div>

        {/* Table Content */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
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
                      <td className="px-6 py-4 font-bold text-slate-900">{ml.marketlist_number}</td>
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
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                          {ml.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {['draft', 'revision'].includes(ml.status) && (
                          <button
                            onClick={() => handleSubmitToAdmin(ml._id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            Submit Admin
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDetail(ml._id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
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

        {/* Modal Detail Drawer */}
        {selectedMl && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Detail Marketlist {selectedMl.marketlist_number}</h3>
                  <p className="text-xs text-slate-300">Status: {selectedMl.status?.toUpperCase()}</p>
                </div>
                <button
                  onClick={() => setSelectedMl(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                {/* Meta Summary */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 font-semibold">Tanggal Butuh:</span>
                    <p className="font-bold text-slate-800 text-sm">
                      {new Date(selectedMl.required_date || selectedMl.date).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Total Nilai Estimasi:</span>
                    <p className="font-bold text-emerald-700 text-sm">
                      Rp {(selectedMl.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Versi Aktif:</span>
                    <p className="font-bold text-slate-800 text-sm">Versi {selectedMl.current_version || 1}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">Daftar Barang Belanja:</h4>
                  <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Barang</th>
                        <th className="p-2.5">Kuantitas</th>
                        <th className="p-2.5">Harga Pengajuan</th>
                        <th className="p-2.5">Subtotal</th>
                        <th className="p-2.5">Supplier Pilihan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedMl.items?.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">
                            {item.product_snapshot?.name || item.product_id?.name}
                          </td>
                          <td className="p-2.5 text-slate-700">
                            {item.requested_qty} {item.product_snapshot?.unit_name || ''}
                          </td>
                          <td className="p-2.5 text-slate-700">Rp {item.unit_price?.toLocaleString('id-ID')}</td>
                          <td className="p-2.5 font-bold text-slate-900">Rp {item.subtotal?.toLocaleString('id-ID')}</td>
                          <td className="p-2.5 text-slate-600">{item.supplier_id?.name || 'Belum ditentukan'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Single Note Section */}
                <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-amber-900 text-xs">Catatan Marketlist (Single Note):</h4>
                  <p className="text-slate-700 italic">
                    {selectedMl.note || 'Tidak ada catatan untuk Marketlist ini.'}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button
                  onClick={() => setSelectedMl(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold"
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
