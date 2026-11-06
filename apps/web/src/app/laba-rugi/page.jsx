'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ShieldCheck,
  Building,
  Layers,
  ArrowRight,
  Info,
  Calendar
} from 'lucide-react';

export default function LabaRugiPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [operatingExpense, setOperatingExpense] = useState(2500000);
  const [period, setPeriod] = useState('monthly');
  const [error, setError] = useState(null);

  const fetchProfitLoss = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getProfitLoss(`?period=${period}&operating_expense=${operatingExpense}`);
      if (res?.data) {
        setReport(res.data);
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat perhitungan laba rugi via OAuth 2');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchProfitLoss();
  }, [period]);

  const handleSyncOAuth2 = () => {
    setSyncing(true);
    fetchProfitLoss();
  };

  const handleRecalculate = (e) => {
    e.preventDefault();
    fetchProfitLoss();
  };

  const summary = report?.summary || {
    total_revenue: 0,
    total_cogs: 0,
    gross_profit: 0,
    gross_margin_percentage: 0,
    operating_expenses: 0,
    net_profit: 0,
    net_margin_percentage: 0
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Perhitungan Laba Rugi (Profit & Loss) — OAuth 2.0" />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Header Title & OAuth 2 Status Badge */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">Laporan Laba Rugi Terintegrasi</h1>
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                OAuth 2.0 Connected
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Data pendapatan ditarik secara terotentikasi via API Route eksternal (OAuth 2 Bearer) dan disandingkan dengan HPP belanja Marketlist.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="daily">Hari Ini</option>
              <option value="weekly">Minggu Ini</option>
              <option value="monthly">Bulan Ini (November 2026)</option>
              <option value="yearly">Tahun Ini</option>
            </select>

            <button
              onClick={handleSyncOAuth2}
              disabled={syncing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Menghubungkan OAuth 2...' : 'Tarik Data via OAuth 2'}</span>
            </button>
          </div>
        </div>

        {/* OAuth 2 Source Info Alert */}
        <div className="p-4 bg-slate-900 text-slate-200 rounded-xl text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              O2
            </div>
            <div>
              <p className="font-semibold text-white">OAuth 2.0 Route Integration Active</p>
              <p className="text-slate-400 text-[11px]">
                API Route: <code className="text-emerald-300">/api/v1/external-pos/sales</code> &bull; Token Endpoint: <code className="text-emerald-300">/api/v1/oauth2/token</code> &bull; Scope: <code className="text-emerald-300">read:sales read:revenue</code>
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
            Status: Token Valid (200 OK)
          </span>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* 5 Financial Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Revenue */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              1. Total Pendapatan (Penjualan)
            </span>
            <div className="text-xl font-black text-slate-900">
              Rp {summary.total_revenue.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Ditarik dari POS via OAuth 2
            </p>
          </div>

          {/* HPP / COGS */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              2. HPP (Beban Belanja)
            </span>
            <div className="text-xl font-black text-slate-900">
              Rp {summary.total_cogs.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              Realisasi Marketlist & Invoices
            </p>
          </div>

          {/* Laba Kotor */}
          <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-200 shadow-sm space-y-2">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              3. Laba Kotor (Gross Profit)
            </span>
            <div className="text-xl font-black text-emerald-900">
              Rp {summary.gross_profit.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-emerald-700 font-semibold">
              Gross Margin: {summary.gross_margin_percentage}%
            </p>
          </div>

          {/* Beban Operasional */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                4. Biaya Operasional (Overhead)
              </span>
              {summary.is_real_overhead ? (
                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                  Real DB
                </span>
              ) : (
                <span className="text-[9px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  Simulasi
                </span>
              )}
            </div>
            <div className="text-xl font-black text-slate-900">
              Rp {summary.operating_expenses.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              {summary.is_real_overhead
                ? 'Akumulasi real biaya overhead'
                : 'Logistik, utilitas, sewa'}
            </p>
          </div>

          {/* Laba Bersih */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-xl shadow-md space-y-2">
            <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider">
              5. Laba Bersih (Net Profit)
            </span>
            <div className="text-xl font-black text-white">
              Rp {summary.net_profit.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-emerald-100 font-semibold">
              Net Margin: {summary.net_margin_percentage}%
            </p>
          </div>
        </div>

        {/* Operating Expense Adjuster & Breakdown Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Breakdown by Category */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-800">Rincian Penjualan (OAuth 2 API)</h3>
              <Layers className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="space-y-3">
              {report?.sales_breakdown?.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{item.category}</span>
                    <span>Rp {item.revenue.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (item.revenue / (summary.total_revenue || 1)) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 text-right">{item.qty_sold} unit terjual</p>
                </div>
              ))}
            </div>
          </div>

          {/* Purchasing COGS Breakdown by Supplier */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-800">Alokasi HPP per Supplier</h3>
              <Building className="w-4 h-4 text-teal-600" />
            </div>

            <div className="space-y-3">
              {report?.cogs_breakdown?.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Belum ada invoice per supplier terbit.</p>
              ) : (
                report?.cogs_breakdown?.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{item.supplier}</span>
                      <span>Rp {item.amount.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-teal-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (item.amount / (summary.total_cogs || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Operating Expense Section & Simulator */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-800">Biaya Overhead Operasional</h3>
              <a
                href="/overhead"
                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                Kelola &rarr;
              </a>
            </div>

            {report?.overhead_breakdown?.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Realisasi Overhead Tercatat:
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {report.overhead_breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-50">
                      <span className="text-slate-600 capitalize">{item.category.replace(/_/g, ' ')}</span>
                      <span className="font-bold text-slate-800">Rp {item.amount.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <form onSubmit={handleRecalculate} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Simulasi Biaya Operasional (Rp)
                </label>
                <input
                  type="number"
                  value={operatingExpense}
                  onChange={(e) => setOperatingExpense(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-colors"
              >
                Simulasi Ulang Laba Bersih
              </button>
            </form>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
              <p className="font-bold">Formula Laba Rugi Baraja:</p>
              <p className="text-[11px]">&bull; Laba Kotor = Pendapatan POS (OAuth 2) - HPP Purchasing</p>
              <p className="text-[11px]">&bull; Laba Bersih = Laba Kotor - Beban Operasional</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

