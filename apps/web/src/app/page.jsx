'use client';

import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Link from 'next/link';
import { api, getStoredUser } from '../lib/api';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Receipt,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  Truck
} from 'lucide-react';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [marketlists, setMarketlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const currentUser = getStoredUser();
    if (!currentUser) {
      window.location.href = '/login';
      return;
    }
    setUser(currentUser);

    async function loadData() {
      try {
        const [metricRes, mlRes] = await Promise.all([
          api.getDashboardMetrics().catch(() => null),
          api.getMarketlists('?limit=5').catch(() => null)
        ]);

        if (metricRes?.data) setMetrics(metricRes.data);
        if (mlRes?.data?.items) setMarketlists(mlRes.data.items);
      } catch (err) {
        console.error('Failed to load dashboard', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-700 border-slate-300',
      submitted: 'bg-amber-100 text-amber-800 border-amber-300',
      approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      revision: 'bg-orange-100 text-orange-800 border-orange-300',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
      partially_received: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      received: 'bg-teal-100 text-teal-800 border-teal-300',
      completed: 'bg-purple-100 text-purple-800 border-purple-300',
      cancelled: 'bg-rose-100 text-rose-800 border-rose-300'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${styles[status] || styles.draft}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Dashboard Purchasing & Operasional" />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Halo, {user?.name || 'Staff Purchasing'} 👋</h1>
            <p className="text-xs text-emerald-100/80">
              Sistem Purchasing Terintegrasi Baraja Store. Single Source of Truth berbasis Marketlist.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/marketlists/create"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
            >
              + Buat Marketlist
            </Link>
            <Link
              href="/laba-rugi"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
              Laba Rugi (OAuth 2)
            </Link>
          </div>
        </div>

        {/* 4 Primary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Total Marketlist</span>
              <ClipboardList className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-800">
              {metrics?.marketlists?.total || 0}
            </div>
            <p className="text-[11px] text-slate-500">Seluruh dokumen rencana belanja</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-xs font-semibold">Menunggu Approval Admin</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-800">
              {metrics?.marketlists?.pending_approval || 0}
            </div>
            <Link href="/approvals" className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 hover:underline">
              Periksa & Setujui &rarr;
            </Link>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Sedang Diterima (Mobile)</span>
              <Truck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-800">
              {metrics?.marketlists?.in_receiving || 0}
            </div>
            <Link href="/receiving" className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 hover:underline">
              Lihat Surat Jalan &rarr;
            </Link>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Invoice Tergenerate</span>
              <Receipt className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-2xl font-black text-slate-800">
              {metrics?.invoices?.total || 0}
            </div>
            <Link href="/invoices" className="text-[11px] text-teal-600 font-semibold flex items-center gap-1 hover:underline">
              Buka Invoice & Cetak PDF &rarr;
            </Link>
          </div>
        </div>

        {/* Recent Marketlists Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800">Marketlist Terbaru</h3>
              <p className="text-xs text-slate-500">Single Source of Truth perencanaan dan realisasi barang</p>
            </div>
            <Link href="/marketlists" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              Lihat Semua &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Nomor Marketlist</th>
                  <th className="px-6 py-3">Tanggal Kebutuhan</th>
                  <th className="px-6 py-3">Lokasi / Cabang</th>
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3">Estimasi Total</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marketlists.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                      Belum ada Marketlist yang dibuat. Klik tombol "+ Buat Marketlist" di atas.
                    </td>
                  </tr>
                ) : (
                  marketlists.map((ml) => (
                    <tr key={ml._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-slate-800">{ml.marketlist_number}</td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {new Date(ml.required_date || ml.date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">{ml.location_id?.name || 'Gudang Pusat'}</td>
                      <td className="px-6 py-3.5 text-slate-600 font-medium">
                        {ml.totals?.total_items || 0} item
                      </td>
                      <td className="px-6 py-3.5 font-bold text-slate-800">
                        Rp {(ml.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-3.5">{getStatusBadge(ml.status)}</td>
                      <td className="px-6 py-3.5 text-right">
                        <Link
                          href={`/marketlists`}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                        >
                          Detail
                        </Link>
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

