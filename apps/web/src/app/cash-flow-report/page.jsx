'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import { getDateRange, formatDateInput } from '../../lib/date-range';
import {
  cashFlowReportCategories,
  createCashFlowReportExportRows,
  filterCashFlowReportMutations,
  getCashFlowReportCategory,
  getCashFlowReportMetrics
} from '../../lib/cash-flow-report.mjs';
import { downloadCsv } from '../../lib/csv-export.mjs';
import { downloadCashFlowPdf } from '../../lib/api';
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CreditCard,
  Download,
  Filter,
  Landmark,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  Wallet
} from 'lucide-react';

const formatAmount = (value) => `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`;
const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

async function fetchAllPages(fetchPage, params) {
  const pageSize = 500;
  const firstResponse = await fetchPage(`?${params}&page=1&limit=${pageSize}`);
  if (!Array.isArray(firstResponse.data)) {
    throw new Error('Data laporan tidak valid.');
  }

  const totalPages = Math.max(1, Number(firstResponse.totalPages) || 1);
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchPage(`?${params}&page=${index + 2}&limit=${pageSize}`)
    )
  );
  const allResponses = [firstResponse, ...remainingPages];
  if (allResponses.some((response) => !Array.isArray(response.data))) {
    throw new Error('Data laporan tidak valid.');
  }
  return allResponses.flatMap((response) => response.data);
}

export default function CashFlowReportPage() {
  const [period, setPeriod] = useState('weekly');
  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [report, setReport] = useState({ summary: {}, mutations: [], purchases: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const dateRange = useMemo(
    () => getDateRange(selectedDate, period),
    [period, selectedDate]
  );

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const start = new Date(`${dateRange.startDate}T00:00:00`);
      const end = new Date(`${dateRange.endDate}T23:59:59.999`);
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }).toString();
      const [summaryResponse, mutations, purchases] = await Promise.all([
        api.getCashFlowSummary(`?${params}`),
        fetchAllPages(api.getCashFlowMutations, `${params}&account=all&type=all`),
        fetchAllPages(api.getPurchases, `${params}`)
      ]);
      if (!summaryResponse?.data) {
        throw new Error('Ringkasan saldo tidak tersedia.');
      }
      setReport({ summary: summaryResponse.data, mutations, purchases });
    } catch (fetchError) {
      setError(fetchError.message || 'Gagal memuat laporan arus kas.');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const metrics = useMemo(
    () => getCashFlowReportMetrics(report.summary, report.purchases, report.mutations),
    [report]
  );
  const filteredMutations = useMemo(
    () => {
      const debtCreationRows = report.purchases
        .filter((purchase) => purchase.payment_method === 'tempo')
        .map((purchase) => ({
          _id: purchase._id,
          source_type: 'purchase',
          trx_type: 'purchase_tempo',
          direction: 'commitment',
          category: 'belanja',
          account_label: 'Hutang supplier',
          title: `Belanja terhutang ${purchase.supplier_id?.name || 'Supplier'} (${purchase.purchase_number || ''})`,
          reference_number: purchase.invoice_ref || purchase.purchase_number || '',
          amount: Number(purchase.total_actual) || 0,
          date: purchase.purchased_at,
          notes: purchase.notes || ''
        }));
      return filterCashFlowReportMutations(
        [...report.mutations, ...debtCreationRows]
          .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()),
        selectedCategory
      );
    },
    [report.mutations, report.purchases, selectedCategory]
  );
  const categoryTotals = useMemo(() => {
    const totals = new Map();
    report.mutations.forEach((mutation) => {
      if (mutation.source_type === 'purchase') return;
      const id = getCashFlowReportCategory(mutation);
      const option = cashFlowReportCategories.find((category) => category.id === id);
      const current = totals.get(id) || { id, label: option?.label || 'Lainnya', count: 0, amount: 0 };
      current.count += 1;
      current.amount += Number(mutation.amount) || 0;
      totals.set(id, current);
    });
    [
      {
        id: 'purchase_direct',
        purchases: report.purchases.filter((purchase) => purchase.payment_method !== 'tempo')
      },
      {
        id: 'purchase_tempo',
        purchases: report.purchases.filter((purchase) => purchase.payment_method === 'tempo')
      }
    ].forEach(({ id, purchases }) => {
      if (purchases.length === 0) return;
      const option = cashFlowReportCategories.find((category) => category.id === id);
      totals.set(id, {
        id,
        label: option.label,
        count: purchases.length,
        amount: purchases.reduce((total, purchase) => total + (Number(purchase.total_actual) || 0), 0)
      });
    });
    return [...totals.values()].sort((first, second) => second.amount - first.amount);
  }, [report.mutations, report.purchases]);

  const handleExport = () => {
    setExporting(true);
    try {
      const rows = createCashFlowReportExportRows(
        metrics,
        categoryTotals,
        filteredMutations,
        dateRange
      );
      downloadCsv(`laporan-arus-kas-${dateRange.startDate}-${dateRange.endDate}.csv`, rows);
    } catch (exportError) {
      setError(exportError.message || 'Gagal menyiapkan file Excel.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    setError('');
    try {
      const reportRows = filteredMutations.map((mutation) => [
        formatDate(mutation.date),
        cashFlowReportCategories.find(
          (category) => category.id === getCashFlowReportCategory(mutation)
        )?.label || mutation.category_label || 'Lainnya',
        mutation.direction === 'in'
          ? 'Masuk'
          : mutation.direction === 'transfer'
            ? 'Transfer'
            : mutation.direction === 'commitment' ? 'Hutang' : 'Keluar',
        mutation.account_label || mutation.account || '',
        mutation.title || '',
        mutation.reference_number || '',
        Number(mutation.amount) || 0,
        mutation.notes || ''
      ]);
      await downloadCashFlowPdf({
        title: 'Laporan Arus Kas',
        subtitle: `Periode ${dateRange.startDate} sampai ${dateRange.endDate}`,
        summary: [
          ['Saldo kas tunai (Rp)', metrics.cashBalance],
          ['Saldo kas kecil (Rp)', metrics.pettyCashBalance],
          ['Saldo rekening bank (Rp)', metrics.bankBalance],
          ['Total dana (Rp)', metrics.totalFunds],
          ['Total uang masuk periode ini (Rp)', metrics.totalInflow],
          ['Belanja langsung periode ini (Rp)', metrics.directPurchases],
          ['Belanja terhutang periode ini (Rp)', metrics.debtCreated],
          ['Total pengeluaran periode (Rp)', metrics.totalOutflow],
          ['Pembayaran hutang periode (Rp)', metrics.debtPaid],
          ['Sisa hutang dari pembelian periode ini (Rp)', metrics.debtRemaining]
        ],
        sections: [
          {
            title: 'Ringkasan kategori',
            headers: ['Kategori', 'Jumlah transaksi', 'Total nominal (Rp)'],
            rows: categoryTotals.map(({ label, count, amount }) => [label, count, amount])
          },
          {
            title: 'Rincian mutasi',
            headers: [
              'Tanggal', 'Kategori', 'Jenis', 'Akun', 'Keterangan',
              'Referensi', 'Nominal (Rp)', 'Catatan'
            ],
            rows: reportRows
          }
        ]
      }, `laporan-arus-kas-${dateRange.startDate}-${dateRange.endDate}.pdf`);
    } catch (exportError) {
      setError(exportError.message || 'Gagal menyiapkan file PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const summaryCards = [
    { title: 'Saldo kas tunai', value: metrics.cashBalance, icon: Banknote, color: 'emerald' },
    { title: 'Saldo kas kecil', value: metrics.pettyCashBalance, icon: Wallet, color: 'violet' },
    { title: 'Saldo rekening bank', value: metrics.bankBalance, icon: Landmark, color: 'blue' },
    { title: 'Total dana tersedia', value: metrics.totalFunds, icon: Wallet, color: 'indigo' },
    { title: 'Belanja langsung periode ini', value: metrics.directPurchases, icon: ShoppingCart, color: 'orange' },
    { title: 'Belanja terhutang periode ini', value: metrics.debtCreated, icon: CreditCard, color: 'amber' },
    { title: 'Hutang dibayar periode ini', value: metrics.debtPaid, icon: TrendingDown, color: 'green' },
    { title: 'Sisa hutang dari belanja periode ini', value: metrics.debtRemaining, icon: CreditCard, color: 'rose' }
  ];
  const cardColors = {
    emerald: { border: 'border-emerald-200', label: 'text-emerald-800', icon: 'text-emerald-600', amount: 'text-emerald-700' },
    violet: { border: 'border-violet-200', label: 'text-violet-800', icon: 'text-violet-600', amount: 'text-violet-700' },
    blue: { border: 'border-blue-200', label: 'text-blue-800', icon: 'text-blue-600', amount: 'text-blue-700' },
    indigo: { border: 'border-indigo-200', label: 'text-indigo-800', icon: 'text-indigo-600', amount: 'text-indigo-700' },
    orange: { border: 'border-orange-200', label: 'text-orange-800', icon: 'text-orange-600', amount: 'text-orange-700' },
    amber: { border: 'border-amber-200', label: 'text-amber-800', icon: 'text-amber-600', amount: 'text-amber-700' },
    green: { border: 'border-green-200', label: 'text-green-800', icon: 'text-green-600', amount: 'text-green-700' },
    rose: { border: 'border-rose-200', label: 'text-rose-800', icon: 'text-rose-600', amount: 'text-rose-700' }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="print:hidden">
        <Navbar title="Laporan Arus Kas" />
      </div>

      <main className="w-full min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Laporan Arus Kas & Kategori</h1>
            <p className="mt-1 text-sm text-slate-500">
              Ringkasan saldo, belanja, serta hutang dan pembayaran berdasarkan periode.
            </p>
            <p className="mt-2 text-xs font-semibold text-indigo-700">
              Periode laporan: {dateRange.startDate} – {dateRange.endDate}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <label htmlFor="cash-report-period" className="sr-only">Pilih periode</label>
            <select
              id="cash-report-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="weekly">Mingguan</option>
              <option value="daily">Harian</option>
            </select>
            <label htmlFor="cash-report-date" className="sr-only">Pilih tanggal laporan</label>
            <input
              id="cash-report-date"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                if (event.target.value) setSelectedDate(event.target.value);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={fetchReport}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Muat ulang
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || exporting}
              title="Unduh CSV yang dapat dibuka di Excel"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Menyiapkan...' : 'Unduh CSV'}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || exportingPdf}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exportingPdf ? 'Menyiapkan PDF...' : 'Unduh PDF'}
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{error}</div>
            <button type="button" onClick={fetchReport} className="shrink-0 font-bold underline">
              Coba lagi
            </button>
          </div>
        )}

        <section aria-label="Ringkasan arus kas" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ title, value, icon: Icon, color }) => (
            <article key={title} className={`rounded-2xl border bg-white p-5 shadow-sm ${cardColors[color].border}`}>
              <div className={`mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${cardColors[color].label}`}>
                <Icon className={`h-4 w-4 ${cardColors[color].icon}`} />
                {title}
              </div>
              <p className={`text-xl font-black ${cardColors[color].amount}`}>{formatAmount(value)}</p>
              {title === 'Hutang dibayar periode ini' && (
                <p className="mt-2 text-[11px] text-slate-500">Termasuk uang muka belanja tempo yang dicatat pada periode ini.</p>
              )}
              {title === 'Sisa hutang dari belanja periode ini' && (
                <p className="mt-2 text-[11px] text-slate-500">Sisa saat ini untuk pembelian tempo pada periode laporan.</p>
              )}
            </article>
          ))}
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-700">
              <TrendingDown className="h-4 w-4 text-slate-600" />
              Total uang masuk
            </div>
            <p className="text-xl font-black text-slate-800">{formatAmount(metrics.totalInflow)}</p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-900">Pengelompokan kategori</h2>
              <p className="mt-1 text-xs text-slate-500">Pilih kategori untuk melihat rinciannya.</p>
            </div>
            {loading ? (
              <p className="p-6 text-sm text-slate-500">Memuat kategori...</p>
            ) : categoryTotals.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Belum ada transaksi pada periode ini.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {categoryTotals.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-slate-50 ${
                      selectedCategory === category.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{category.label}</span>
                      <span className="text-xs text-slate-500">{category.count} transaksi</span>
                    </span>
                    <span className="text-sm font-bold text-slate-800">{formatAmount(category.amount)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Rincian arus kas</h2>
                <p className="mt-1 text-xs text-slate-500">{filteredMutations.length} transaksi</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 print:hidden">
                <Filter className="h-4 w-4" />
                <span className="sr-only">Filter kategori</span>
                <select
                  aria-label="Filter kategori transaksi"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  {cashFlowReportCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Keterangan</th>
                    <th className="px-4 py-3">Akun</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">Memuat mutasi...</td></tr>
                  ) : filteredMutations.length === 0 ? (
                    <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">Tidak ada transaksi untuk kategori ini.</td></tr>
                  ) : filteredMutations.map((mutation, index) => {
                    const category = cashFlowReportCategories.find(
                      (item) => item.id === getCashFlowReportCategory(mutation)
                    );
                    return (
                      <tr key={`${mutation.source_type}-${mutation._id}-${index}`} className="text-slate-700">
                        <td className="whitespace-nowrap px-4 py-3">{formatDate(mutation.date)}</td>
                        <td className="px-4 py-3 font-semibold">{category?.label || mutation.category_label || 'Lainnya'}</td>
                        <td className="px-4 py-3">
                          <span className="block font-medium text-slate-900">{mutation.title || '-'}</span>
                          {mutation.reference_number && <span className="text-slate-500">{mutation.reference_number}</span>}
                        </td>
                        <td className="px-4 py-3">{mutation.account_label || mutation.account || '-'}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right font-bold ${
                          mutation.direction === 'in' ? 'text-emerald-700' : 'text-slate-800'
                        }`}>
                          {mutation.direction === 'in'
                            ? '+'
                            : mutation.direction === 'transfer' ? '↔ ' : mutation.direction === 'commitment' ? 'Hutang ' : '-'}
                          {formatAmount(mutation.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <p className="text-xs text-slate-500">
          Saldo kas dan bank dihitung sampai akhir periode. Sisa hutang adalah posisi terkini dari pembelian tempo yang dibuat dalam periode laporan.
        </p>
      </main>
    </div>
  );
}
