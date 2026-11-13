'use client';

import { useCallback, useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import { getDateRange, formatDateInput } from '../../lib/date-range';
import { CalendarDays, PackageCheck, ReceiptText, ShoppingCart, Trash2, RefreshCw, Wallet } from 'lucide-react';

const reconciliationParams = (date, period) => {
  const { startDate, endDate } = getDateRange(date, period);
  const start = new Date(`${startDate}T00:00:00`).toISOString();
  const end = new Date(`${endDate}T23:59:59.999`).toISOString();
  return `startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
};
const quantity = (amount, unit) => `${Number(amount || 0).toLocaleString('id-ID')} ${unit || ''}`.trim();
const money = (amount) => `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
const timestamp = (value) => value
  ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  : '-';
const eventLabels = {
  po: 'PO / dibeli',
  received: 'Diterima',
  invoice: 'Ditagihkan',
  debt_payment: 'Bayar hutang',
  waste: 'Waste'
};

export default function InventoryPage() {
  const [date, setDate] = useState(() => formatDateInput(new Date()));
  const [period, setPeriod] = useState('daily');
  const [report, setReport] = useState({ totals: {}, items: [], overheads: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getDailyInventoryReconciliation(reconciliationParams(date, period));
      setReport(response.data || { totals: {}, items: [], overheads: [] });
    } catch (requestError) {
      setError(requestError.message || 'Gagal memuat rekonsiliasi inventori.');
    } finally {
      setLoading(false);
    }
  }, [date, period]);

  useEffect(() => { load(); }, [load]);

  const summaryCards = [
    { title: 'Nilai PO / Pembelian', value: money(report.totals.po_amount), detail: 'Termasuk bagian dibayar dan hutang', icon: ShoppingCart, color: 'text-blue-700', style: 'border-blue-200' },
    { title: 'Nilai Tagihan', value: money(report.totals.billed_amount), detail: 'Invoice aktif yang cocok dengan pembelian tanggal terpilih', icon: ReceiptText, color: 'text-amber-700', style: 'border-amber-200' },
    { title: 'Hutang', value: money(report.totals.debt_amount), detail: 'Sisa belum dibayar; sudah termasuk nilai pembelian', icon: ReceiptText, color: 'text-orange-700', style: 'border-orange-200' },
    { title: 'Selisih Pembelian - Tagihan', value: money(report.totals.difference_amount), detail: 'Rp 0 berarti nilai pembelian dan tagihan cocok', icon: ReceiptText, color: Math.abs(Number(report.totals.difference_amount) || 0) < 0.01 ? 'text-emerald-700' : 'text-rose-700', style: Math.abs(Number(report.totals.difference_amount) || 0) < 0.01 ? 'border-emerald-200' : 'border-rose-200' },
    { title: 'Produk Diterima', value: `${report.items.filter((item) => item.received_quantity > 0).length}`, detail: 'Kuantitas diterima ada di tabel per produk', icon: PackageCheck, color: 'text-emerald-700', style: 'border-emerald-200' },
    { title: 'Nilai Waste', value: money(report.totals.waste_cost), detail: 'Jejak jumlah, harga, dan alasan tercatat', icon: Trash2, color: 'text-rose-700', style: 'border-rose-200' },
    { title: 'Nilai Overhead', value: money(report.totals.overhead_amount), detail: `${money(report.totals.overhead_paid_amount)} dibayar · ${money(report.totals.overhead_debt_amount)} masih hutang`, icon: Wallet, color: 'text-violet-700', style: 'border-violet-200' }
  ];

  return (
    <div className="flex-1 flex min-w-0 flex-col bg-slate-50">
      <Navbar title="Rekonsiliasi Inventori" />
      <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Alur Pembelian, Penerimaan, Tagihan & Waste</h1>
            <p className="mt-1 text-xs text-slate-500">Pembelian mengikuti tanggal dibeli; tagihan dicocokkan berdasarkan item pembelian meski invoice dibuat pada tanggal lain. Overhead dicatat terpisah dari pembelian produk.</p>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <label htmlFor="inventory-period" className="text-xs font-semibold text-slate-600">Periode</label>
            <select
              id="inventory-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-xs"
            >
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
            </select>
            <input
              id="inventory-day"
              type="date"
              aria-label={period === 'daily' ? 'Pilih tanggal rekonsiliasi' : 'Pilih tanggal dalam minggu rekonsiliasi'}
              value={date}
              onChange={(event) => {
                if (event.target.value) setDate(event.target.value);
              }}
              className="rounded-lg border border-slate-200 bg-white p-2 text-xs"
            />
            <span className="text-[11px] text-slate-500">
              {(() => {
                const range = getDateRange(date, period);
                return `${range.startDate} – ${range.endDate}`;
              })()}
            </span>
            <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
            </button>
          </div>
        </div>

        {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {summaryCards.map(({ title, value, detail, icon: Icon, color, style }) => (
            <section key={title} className={`rounded-xl border ${style} bg-white p-4`}>
              <div className={`flex items-center gap-2 text-xs font-bold ${color}`}><Icon className="h-4 w-4" />{title}</div>
              <p className={`mt-2 text-xl font-black ${color}`}>{value}</p>
              <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
            </section>
          ))}
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Rincian per Produk</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">Kuantitas PO, diterima, tagihan, dan waste dibandingkan tanpa menggabungkan satuan yang berbeda.</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{report.items?.length || 0} produk</span>
          </div>
          {loading ? <p className="p-6 text-sm text-slate-500">Memuat rekonsiliasi...</p> : report.items?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3">PO / dibeli</th>
                    <th className="px-4 py-3">Hutang</th>
                    <th className="px-4 py-3">Diterima</th>
                    <th className="px-4 py-3">Ditagihkan</th>
                    <th className="px-4 py-3">Waste</th>
                    <th className="px-4 py-3">Urutan kejadian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.items.map((item) => (
                    <tr key={item.product_id || item.product_name} className="align-top">
                      <td className="px-4 py-3 font-bold text-slate-800">{item.product_name}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {quantity(item.po_quantity, item.unit_name)}
                        <div className="mt-1 text-[10px] text-slate-500">{money(item.po_amount)}</div>
                      </td>
                      <td className="px-4 py-3 text-orange-700">{money(item.debt_amount)}</td>
                      <td className="px-4 py-3 text-emerald-700">{quantity(item.received_quantity, item.unit_name)}</td>
                      <td className="px-4 py-3 text-amber-700">
                        {quantity(item.billed_quantity, item.unit_name)}
                        <div className="mt-1 text-[10px] text-slate-500">{money(item.billed_amount)}</div>
                      </td>
                      <td className="px-4 py-3 text-rose-700">
                        {quantity(item.waste_quantity, item.unit_name)}
                        <div className="mt-1 text-[10px] text-slate-500">{money(item.waste_cost)}</div>
                        {item.waste_records?.map((record) => (
                          <div key={record._id} className="mt-2 rounded bg-rose-50 p-2 text-[10px]">
                            <div>{timestamp(record.wasted_at)} · {record.reason}</div>
                            <div>{quantity(record.quantity, item.unit_name)} × {money(record.unit_purchase_price)} = <strong>{money(record.total_cost)}</strong></div>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3">
                        <ol className="space-y-1">
                          {item.event_history?.map((event, index) => (
                            <li key={`${event.type}-${index}`} className="flex gap-2 text-[10px] text-slate-600">
                              <span className="min-w-[78px] font-bold text-slate-700">{eventLabels[event.type]}</span>
                              <span>{timestamp(event.happened_at)} · {event.description}{event.quantity > 0 ? ` · ${quantity(event.quantity, item.unit_name)}` : ''}{event.amount ? ` · ${money(event.amount)}` : ''}</span>
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-6 text-sm text-slate-500">Belum ada peristiwa pembelian, penerimaan, tagihan, atau waste pada periode ini.</p>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Rincian Overhead</h2>
              <p className="mt-0.5 text-[10px] text-slate-500">Biaya overhead yang dicatat pada periode terpilih, beserta pembayaran dan sisa hutangnya.</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{report.overheads?.length || 0} biaya</span>
          </div>
          {loading ? <p className="p-6 text-sm text-slate-500">Memuat overhead...</p> : report.overheads?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Keperluan / Kategori</th>
                    <th className="px-4 py-3">Nilai Biaya</th>
                    <th className="px-4 py-3">Dibayar</th>
                    <th className="px-4 py-3">Sisa Hutang</th>
                    <th className="px-4 py-3">Pembayaran pada Periode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.overheads.map((overhead) => (
                    <tr key={overhead._id}>
                      <td className="px-4 py-3 text-slate-600">{timestamp(overhead.expense_date)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{overhead.title}<div className="text-[10px] font-normal text-slate-500">{overhead.category}</div></td>
                      <td className="px-4 py-3">{money(overhead.amount)}</td>
                      <td className="px-4 py-3 text-emerald-700">{money(overhead.paid_amount)}</td>
                      <td className="px-4 py-3 text-orange-700">{money(overhead.debt_amount)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {overhead.payments?.length
                          ? overhead.payments.map((payment) => (
                            <div key={payment._id}>{timestamp(payment.paid_at)} · {money(payment.amount)}</div>
                          ))
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-6 text-sm text-slate-500">Tidak ada overhead yang dicatat pada periode ini.</p>
          )}
        </section>
      </main>
    </div>
  );
}
