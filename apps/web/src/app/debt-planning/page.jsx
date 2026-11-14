'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  RefreshCw,
  TrendingUp,
  Wallet
} from 'lucide-react';

const formatAmount = (value) => `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`;

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id-ID');
};

const getDaysUntilDue = (value) => {
  if (!value) return null;
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return null;

  const today = new Date();
  const dueDay = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((dueDay - todayDay) / 86400000);
};

const getDebtStatus = (daysUntilDue) => {
  if (daysUntilDue === null) return { label: 'Tempo belum ditentukan', className: 'bg-slate-100 text-slate-600' };
  if (daysUntilDue < 0) return { label: `Terlambat ${Math.abs(daysUntilDue)} hari`, className: 'bg-rose-100 text-rose-800' };
  if (daysUntilDue <= 3) return { label: daysUntilDue === 0 ? 'Jatuh tempo hari ini' : `H-${daysUntilDue}`, className: 'bg-amber-100 text-amber-800' };
  return { label: `${daysUntilDue} hari lagi`, className: 'bg-emerald-100 text-emerald-800' };
};

export default function DebtPlanningPage() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const pageSize = 500;
      const [purchaseResponse, overheadResponse] = await Promise.all([
        api.getDebts(`?page=1&limit=${pageSize}`),
        api.getOverheadDebts()
      ]);

      const purchaseDebts = purchaseResponse.data || [];
      const pageCount = Math.ceil((Number(purchaseResponse.total) || purchaseDebts.length) / pageSize);
      const additionalPages = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
          api.getDebts(`?page=${index + 2}&limit=${pageSize}`)
        )
      );
      const allPurchaseDebts = [
        ...purchaseDebts,
        ...additionalPages.flatMap((response) => response.data || [])
      ];
      const overheadDebts = overheadResponse.debts || [];

      setDebts([
        ...allPurchaseDebts.map((debt) => ({
          id: `purchase-${debt._id}`,
          type: 'Pembelian',
          reference: debt.marketlist_id?.marketlist_number || debt.purchase_number || '-',
          creditor: debt.supplier_id?.name || 'Supplier',
          invoice: debt.invoice_ref || '-',
          date: debt.purchased_at,
          dueDate: debt.due_date,
          amount: Number(debt.amount_remaining) || 0,
          href: '/transactions'
        })),
        ...overheadDebts.map((debt) => ({
          id: `overhead-${debt._id}`,
          type: 'Overhead',
          reference: debt.title || 'Tagihan overhead',
          creditor: debt.vendor_recipient || '-',
          invoice: debt.invoice_ref || '-',
          date: debt.expense_date,
          dueDate: debt.due_date,
          amount: Number(debt.amount_remaining) || 0,
          href: '/overhead'
        }))
      ].sort((first, second) => {
        const firstDue = first.dueDate ? new Date(first.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const secondDue = second.dueDate ? new Date(second.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return firstDue - secondDue;
      }));
    } catch (fetchError) {
      setError(fetchError.message || 'Gagal memuat data hutang.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const debtsWithTiming = debts.map((debt) => ({
    ...debt,
    daysUntilDue: getDaysUntilDue(debt.dueDate)
  }));
  const totalOutstanding = debtsWithTiming.reduce((total, debt) => total + debt.amount, 0);
  const longTermDebts = debtsWithTiming.filter(
    (debt) => debt.daysUntilDue !== null && debt.daysUntilDue > 3
  );
  const dueSoonDebts = debtsWithTiming.filter(
    (debt) => debt.daysUntilDue !== null && debt.daysUntilDue >= 0 && debt.daysUntilDue <= 3
  );
  const overdueDebts = debtsWithTiming.filter(
    (debt) => debt.daysUntilDue !== null && debt.daysUntilDue < 0
  );
  const noDueDateDebts = debtsWithTiming.filter((debt) => debt.daysUntilDue === null);

  return (
    <div className="flex-1 flex min-w-0 flex-col">
      <Navbar title="Perencanaan Hutang & Tempo" />

      <main className="w-full min-w-0 max-w-none space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-950">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
            <div>
              <h2 className="font-bold">Ruang perencanaan modal</h2>
              <p className="mt-1 leading-relaxed text-indigo-900">
                Nilai hutang dengan tempo lebih dari 3 hari membantu melihat kewajiban yang belum mendesak
                untuk direncanakan. Angka ini adalah sisa hutang, bukan saldo kas atau dana bebas pakai.
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchDebts}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-bold hover:bg-rose-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Coba lagi
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
              <Wallet className="h-4 w-4" />
              Total sisa hutang
            </div>
            <p className="text-2xl font-black text-slate-900">{formatAmount(totalOutstanding)}</p>
            <p className="mt-2 text-xs text-slate-500">{debtsWithTiming.length} tagihan aktif</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
              <TrendingUp className="h-4 w-4" />
              Tempo lebih dari 3 hari
            </div>
            <p className="text-2xl font-black text-emerald-700">
              {formatAmount(longTermDebts.reduce((total, debt) => total + debt.amount, 0))}
            </p>
            <p className="mt-2 text-xs text-slate-500">{longTermDebts.length} tagihan belum dekat jatuh tempo</p>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${dueSoonDebts.length ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800">
              <Clock3 className="h-4 w-4" />
              Jatuh tempo H-3
            </div>
            <p className="text-2xl font-black text-amber-700">
              {formatAmount(dueSoonDebts.reduce((total, debt) => total + debt.amount, 0))}
            </p>
            <p className="mt-2 text-xs text-slate-600">{dueSoonDebts.length} tagihan perlu disiapkan</p>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${overdueDebts.length ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-rose-800">
              <AlertTriangle className="h-4 w-4" />
              Sudah lewat tempo
            </div>
            <p className="text-2xl font-black text-rose-700">
              {formatAmount(overdueDebts.reduce((total, debt) => total + debt.amount, 0))}
            </p>
            <p className="mt-2 text-xs text-slate-600">{overdueDebts.length} tagihan terlambat</p>
          </div>
        </section>

        {dueSoonDebts.length > 0 && (
          <section role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h2 className="font-bold text-amber-950">Peringatan: ada tagihan jatuh tempo dalam 3 hari</h2>
                <p className="mt-1 text-sm text-amber-900">
                  Siapkan pembayaran sebesar {formatAmount(dueSoonDebts.reduce((total, debt) => total + debt.amount, 0))}.
                  Periksa daftar tagihan di bawah untuk melihat tanggal tempo setiap tagihan.
                </p>
              </div>
            </div>
          </section>
        )}

        {overdueDebts.length > 0 && (
          <section role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
              <div>
                <h2 className="font-bold text-rose-950">Perhatian: terdapat hutang yang sudah melewati jatuh tempo</h2>
                <p className="mt-1 text-sm text-rose-900">
                  Total {formatAmount(overdueDebts.reduce((total, debt) => total + debt.amount, 0))} dari {overdueDebts.length} tagihan perlu ditindaklanjuti.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">Daftar hutang tempo aktif</h2>
              <p className="mt-1 text-xs text-slate-500">Diurutkan dari tanggal jatuh tempo terdekat</p>
            </div>
            <button
              type="button"
              onClick={fetchDebts}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Perbarui
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Jenis</th>
                  <th className="px-5 py-3">Marketlist / Keperluan</th>
                  <th className="px-5 py-3">Supplier / Vendor</th>
                  <th className="px-5 py-3">Tanggal tagihan</th>
                  <th className="px-5 py-3">Jatuh tempo</th>
                  <th className="px-5 py-3">Status tempo</th>
                  <th className="px-5 py-3 text-right">Sisa hutang</th>
                  <th className="px-5 py-3 text-right">Sumber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="8" className="px-5 py-12 text-center text-slate-500">Memuat daftar hutang...</td></tr>
                ) : debtsWithTiming.length === 0 ? (
                  <tr><td colSpan="8" className="px-5 py-12 text-center text-slate-500">Tidak ada hutang tempo aktif.</td></tr>
                ) : debtsWithTiming.map((debt) => {
                  const status = getDebtStatus(debt.daysUntilDue);
                  return (
                    <tr key={debt.id} className={debt.daysUntilDue !== null && debt.daysUntilDue <= 3 ? 'bg-amber-50/50' : 'hover:bg-slate-50'}>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{debt.type}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{debt.reference}</td>
                      <td className="px-5 py-3.5 text-slate-700">{debt.creditor}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{formatDate(debt.date)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{formatDate(debt.dueDate)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-black text-slate-900">{formatAmount(debt.amount)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={debt.href} className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900">
                          Buka <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {!loading && debtsWithTiming.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan="6" className="px-5 py-3.5 text-right font-bold text-slate-700">Total sisa hutang</td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900">{formatAmount(totalOutstanding)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {noDueDateDebts.length > 0 && (
          <p className="text-xs text-slate-500">
            {noDueDateDebts.length} tagihan tidak memiliki tanggal tempo, sehingga tidak dimasukkan ke total tempo panjang, H-3, atau terlambat.
          </p>
        )}
      </main>
    </div>
  );
}
