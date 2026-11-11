'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Printer } from 'lucide-react';
import { api } from '../../../lib/api';

const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatQuantity = (quantity) =>
  Number(quantity || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

const formatCurrency = (amount) => `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;

const DEPARTMENTS = [
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bar', label: 'Bar' },
  { id: 'unassigned', label: 'Belum Diklasifikasikan' }
];

export default function DailyMarketlistPrintPage() {
  const [selectedDate, setSelectedDate] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedDate(getLocalDateString());
  }, []);

  useEffect(() => {
    if (!selectedDate) return undefined;

    let active = true;
    setLoading(true);
    setError('');

    api.getDailyMarketlistPrint(selectedDate)
      .then((response) => {
        if (active) setReport(response.data);
      })
      .catch((requestError) => {
        if (active) {
          setReport(null);
          setError(requestError.message || 'Gagal memuat marketlist harian.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDate]);

  const departmentItems = useMemo(() => {
    const items = report?.items || [];
    return DEPARTMENTS.map((department) => ({
      ...department,
      items: items.filter((item) => item.department === department.id)
    }));
  }, [report]);

  const formattedDate = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    : '';

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6 print:bg-white print:p-0">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          html, body {
            background: #fff !important;
            color: #000 !important;
            font-size: 10px !important;
          }
          .no-print {
            display: none !important;
          }
          .print-section {
            break-before: page;
            page-break-before: always;
          }
          .print-section:first-of-type {
            break-before: auto;
            page-break-before: auto;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-table th, .print-table td {
            border: 1px solid #555;
            padding: 4px 6px;
          }
          .print-table thead {
            display: table-header-group;
          }
          .print-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <header className="no-print mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/marketlists"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
          <div>
            <h1 className="text-sm font-bold">Cetak Marketlist Harian</h1>
            <p className="text-xs text-slate-500">Kitchen dan Bar terpisah; produk yang belum diklasifikasikan tetap ditampilkan</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="marketlist-date" className="text-xs font-semibold text-slate-600">
            Tanggal kebutuhan
          </label>
          <input
            id="marketlist-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!report || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Cetak / Simpan PDF
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {loading && (
          <p className="py-12 text-center text-sm font-semibold text-slate-500">
            Memuat marketlist tanggal {formattedDate}...
          </p>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-rose-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {!loading && report && (
          <>
            <div className="mb-5 border-b-2 border-slate-900 pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Baraja Store • Purchasing</p>
                  <h2 className="mt-1 text-xl font-black">Marketlist Harian</h2>
                  <p className="mt-1 text-sm font-semibold">{formattedDate}</p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <p>{report.marketlist_count} marketlist</p>
                  <p>{report.total_items} jenis barang • Qty {formatQuantity(report.total_quantity)}</p>
                  <p className="font-bold text-slate-900">{formatCurrency(report.total_estimated_amount)}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Nomor: {report.marketlist_numbers.length ? report.marketlist_numbers.join(', ') : 'Tidak ada marketlist'}
              </p>
            </div>

            {departmentItems.map((department) => {
              const departmentTotal = department.items.reduce(
                (total, item) => total + Number(item.estimated_amount || 0),
                0
              );

              return (
                <section key={department.id} className="print-section mb-6">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-400 pb-1">
                    <h3 className="text-base font-black uppercase tracking-wide">{department.label}</h3>
                    <span className="text-xs font-semibold">
                      {department.items.length} jenis barang • {formatCurrency(departmentTotal)}
                    </span>
                  </div>
                  <table className="print-table w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-100 uppercase text-slate-700">
                      <tr>
                        <th className="w-10 text-center">No.</th>
                        <th>Nama Barang</th>
                        <th>Kategori / Spesifikasi</th>
                        <th className="w-24 text-right">Total Qty</th>
                        <th className="w-16 text-center">Satuan</th>
                        <th className="w-28 text-right">Estimasi</th>
                        <th className="w-16 text-center">Cek</th>
                      </tr>
                    </thead>
                    <tbody>
                      {department.items.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-5 text-center italic text-slate-500">
                            Tidak ada barang untuk bagian ini.
                          </td>
                        </tr>
                      ) : (
                        department.items.map((item, index) => (
                          <tr key={item.product_id || `${department.id}-${item.name}`}>
                            <td className="text-center">{index + 1}</td>
                            <td className="font-bold">{item.name}</td>
                            <td>
                              <span className="font-semibold">{item.category}</span>
                              {item.specification && <span className="block text-[10px] text-slate-600">{item.specification}</span>}
                            </td>
                            <td className="text-right font-bold">{formatQuantity(item.total_requested_qty)}</td>
                            <td className="text-center">{item.unit}</td>
                            <td className="text-right">{formatCurrency(item.estimated_amount)}</td>
                            <td className="text-center">[ &nbsp; ]</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </section>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
