'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, FileSearch, LoaderCircle, Upload, X } from 'lucide-react';
import { api } from '../lib/api';
import {
  cellToText,
  detectMutationColumns,
  parseMutationCsv,
  parseMutationPdf
} from '../lib/mutation-statement';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DATA_ROWS = 2000;
const formatRupiah = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

const statusLabels = {
  matched: 'Cocok otomatis',
  amount_mismatch: 'Nama/ref cocok, nominal berbeda',
  ambiguous: 'Perlu diperiksa',
  invalid_amount: 'Nominal tidak valid',
  invalid_direction: 'Penanda debit/kredit tidak valid',
  unmatched: 'Tidak ditemukan pasangan'
};

const statusStyles = {
  matched: 'bg-emerald-100 text-emerald-800',
  amount_mismatch: 'bg-amber-100 text-amber-800',
  ambiguous: 'bg-orange-100 text-orange-800',
  invalid_amount: 'bg-red-100 text-red-800',
  invalid_direction: 'bg-red-100 text-red-800',
  unmatched: 'bg-slate-100 text-slate-700'
};

function ColumnSelect({ label, headers, value, onChange, required = false, allowNone = false }) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}{required ? ' *' : ''}
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 font-normal"
      >
        {allowNone && <option value={-1}>Tidak dipilih</option>}
        {!allowNone && <option value={-1}>Pilih kolom</option>}
        {headers.map((header, index) => (
          <option key={`${index}-${header}`} value={index}>
            {header || `Kolom ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function PurchaseReconciliationModal({ onClose }) {
  const [statement, setStatement] = useState(null);
  const [mapping, setMapping] = useState({ date: -1, description: -1, reference: -1, amount: -1, direction: -1 });
  const [debitMode, setDebitMode] = useState('positive');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setResult(null);

    if (file.size > MAX_FILE_BYTES) {
      setError('Ukuran file maksimal 10 MB.');
      event.target.value = '';
      return;
    }

    setLoadingFile(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let rawRows;
      if (extension === 'csv') {
        rawRows = parseMutationCsv(await file.text());
      } else if (extension === 'pdf') {
        rawRows = await parseMutationPdf(file);
      } else if (extension === 'xlsx') {
        const { default: readXlsxFile } = await import('read-excel-file/browser');
        rawRows = await readXlsxFile(file, { sheet: 1 });
      } else {
        throw new Error('Gunakan file rekening koran berformat PDF, CSV, atau Excel (.xlsx).');
      }

      const nonEmptyRows = rawRows.filter((row) => row.some((value) => cellToText(value)));
      if (nonEmptyRows.length < 2) {
        throw new Error('File harus memiliki baris header dan setidaknya satu baris mutasi.');
      }
      if (nonEmptyRows.length - 1 > MAX_DATA_ROWS) {
        throw new Error(`Maksimal ${MAX_DATA_ROWS} baris mutasi per file.`);
      }

      const headers = nonEmptyRows[0].map((value, index) => cellToText(value) || `Kolom ${index + 1}`);
      setStatement({
        fileName: file.name,
        headers,
        dataRows: nonEmptyRows.slice(1)
      });
      setMapping(detectMutationColumns(headers));
    } catch (fileError) {
      setStatement(null);
      setError(fileError.message || 'File rekening koran tidak dapat dibaca.');
    } finally {
      setLoadingFile(false);
      event.target.value = '';
    }
  };

  const updateMapping = (key, value) => {
    setMapping((current) => ({ ...current, [key]: value }));
    setResult(null);
  };

  const handleReconcile = async (event) => {
    event.preventDefault();
    if (!statement || mapping.description < 0 || mapping.amount < 0) {
      setError('Pilih file, kolom keterangan, dan kolom nominal debit.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const rows = statement.dataRows.map((row, index) => ({
        rowNumber: index + 2,
        date: mapping.date >= 0 ? cellToText(row[mapping.date]) : '',
        description: cellToText(row[mapping.description]),
        reference: mapping.reference >= 0 ? cellToText(row[mapping.reference]) : '',
        direction: mapping.direction >= 0 ? cellToText(row[mapping.direction]) : '',
        amount: row[mapping.amount] ?? ''
      }));
      const response = await api.reconcilePurchaseMutations({ rows, debitMode });
      setResult(response.data);
    } catch (requestError) {
      setError(requestError.message || 'Rekonsiliasi gagal dijalankan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-reconciliation-title"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <h2 id="purchase-reconciliation-title" className="flex items-center gap-2 text-lg font-black text-slate-900">
              <FileSearch className="h-5 w-5 text-indigo-600" />
              Rekonsiliasi Mutasi Pembelian
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Cocokkan debit rekening koran dengan pembelian transfer dan pembayaran hutang.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
            Pencocokan otomatis memeriksa nama supplier, referensi/no. nota, dan nominal. Rincian barang dari transaksi
            ditampilkan untuk diperiksa; mutasi rekening tidak memuat rincian barang sehingga kecocokan item perlu diverifikasi.
            Kandidat ganda dan selisih nominal tidak dipasangkan otomatis. Persentase tidak cocok dihitung dari baris debit.
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 hover:border-indigo-400 hover:bg-indigo-50/40">
            <span className="rounded-lg bg-indigo-100 p-2.5 text-indigo-700">
              {loadingFile ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-800">
                {loadingFile ? 'Membaca file...' : statement?.fileName || 'Pilih rekening koran'}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                PDF teks, CSV, atau Excel .xlsx · maksimal 10 MB dan 2.000 baris
              </span>
            </span>
            <input
              type="file"
              accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFile}
              disabled={loadingFile || submitting}
              className="sr-only"
            />
          </label>

          {statement && (
            <form onSubmit={handleReconcile} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ColumnSelect
                  label="Tanggal"
                  headers={statement.headers}
                  value={mapping.date}
                  onChange={(value) => updateMapping('date', value)}
                  allowNone
                />
                <ColumnSelect
                  label="Keterangan / nama"
                  headers={statement.headers}
                  value={mapping.description}
                  onChange={(value) => updateMapping('description', value)}
                  required
                />
                <ColumnSelect
                  label="Referensi"
                  headers={statement.headers}
                  value={mapping.reference}
                  onChange={(value) => updateMapping('reference', value)}
                  allowNone
                />
                <ColumnSelect
                  label="Nominal debit"
                  headers={statement.headers}
                  value={mapping.amount}
                  onChange={(value) => updateMapping('amount', value)}
                  required
                />
                <ColumnSelect
                  label="Kolom debit/kredit (opsional)"
                  headers={statement.headers}
                  value={mapping.direction}
                  onChange={(value) => updateMapping('direction', value)}
                  allowNone
                />
              </div>

              <label className="block max-w-md text-xs font-bold text-slate-700">
                Format nominal pada kolom terpilih
                <select
                  value={debitMode}
                  onChange={(event) => {
                    setDebitMode(event.target.value);
                    setResult(null);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 font-normal"
                >
                  <option value="positive">Debit bernilai positif (kredit/blank dilewati)</option>
                  <option value="negative">Debit bernilai negatif (kredit/blank dilewati)</option>
                </select>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  {statement.dataRows.length.toLocaleString('id-ID')} baris data dimuat. Kolom bertanda * wajib dipilih.
                </p>
                <button
                  type="submit"
                  disabled={submitting || loadingFile}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {submitting ? 'Mencocokkan...' : 'Jalankan rekonsiliasi'}
                </button>
              </div>
            </form>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <section aria-live="polite" className="space-y-4 border-t border-slate-200 pt-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Cocok otomatis</p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">{result.summary.matched_rows}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Tidak cocok / perlu cek</p>
                  <p className="mt-1 text-2xl font-black text-amber-700">{result.summary.unmatched_rows}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-800">Persentase tidak cocok</p>
                  <p className="mt-1 text-2xl font-black text-red-700">{result.summary.mismatch_percentage}%</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Debit dianalisis</p>
                  <p className="mt-1 text-2xl font-black text-slate-800">{result.summary.debit_rows}</p>
                  <p className="text-[10px] text-slate-500">{result.summary.excluded_rows} baris kredit/kosong dilewati</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="max-h-[22rem] overflow-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Baris / tanggal</th>
                        <th className="px-3 py-3">Mutasi rekening</th>
                        <th className="px-3 py-3 text-right">Nominal debit</th>
                        <th className="px-3 py-3">Hasil rekonsiliasi</th>
                        <th className="px-3 py-3">Transaksi Baraja Store</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.rows.map((row, index) => {
                        const candidate = row.purchase || row.candidates?.[0];
                        return (
                          <tr key={`${row.rowNumber}-${index}`} className="align-top">
                            <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                              <span className="block font-bold text-slate-700">Baris {row.rowNumber}</span>
                              {row.date || '-'}
                            </td>
                            <td className="max-w-xs px-3 py-3">
                              <p className="font-semibold text-slate-800">{row.description || '(tanpa keterangan)'}</p>
                              {row.reference && <p className="mt-1 text-[10px] text-slate-500">Ref: {row.reference}</p>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-slate-800">
                              {row.amount === null ? '-' : formatRupiah(row.amount)}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-bold ${statusStyles[row.status] || statusStyles.unmatched}`}>
                                {statusLabels[row.status] || row.status}
                              </span>
                              <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-slate-500">{row.reason}</p>
                            </td>
                            <td className="px-3 py-3">
                              {candidate ? (
                                <>
                                  <p className="font-semibold text-slate-800">{candidate.supplier_name || 'Supplier'}</p>
                                  <p className="text-[10px] text-slate-500">{candidate.purchase_number} · {candidate.type}</p>
                                  {candidate.invoice_reference && (
                                    <p className="text-[10px] text-slate-500">No. ref supplier: {candidate.invoice_reference}</p>
                                  )}
                                  <p className="mt-1 text-[10px] font-bold text-slate-700">{formatRupiah(candidate.amount)}</p>
                                  <div className="mt-1 space-y-0.5 text-[10px] text-slate-600">
                                    <p>Nama supplier: {candidate.checks?.supplier_name ? 'cocok' : 'tidak terdeteksi'}</p>
                                    <p>No. ref supplier: {candidate.checks?.supplier_reference ? 'cocok' : 'tidak terdeteksi'}</p>
                                    <p>Nominal mutasi: {candidate.checks?.amount ? 'cocok' : 'berbeda'}</p>
                                  </div>
                                  {candidate.purchase_total !== candidate.amount && (
                                    <p className="text-[10px] text-slate-500">
                                      Total transaksi pembelian: {formatRupiah(candidate.purchase_total)}
                                    </p>
                                  )}
                                  {candidate.amount_difference !== undefined && (
                                    <p className="text-[10px] text-amber-700">
                                      Selisih {candidate.amount_difference > 0 ? '+' : ''}{formatRupiah(candidate.amount_difference)}
                                    </p>
                                  )}
                                  {candidate.items?.length > 0 && (
                                    <div className="mt-2 border-t border-slate-100 pt-2">
                                      <p className="mb-1 text-[10px] font-bold text-slate-700">Item dalam pembelian (periksa manual)</p>
                                      <ul className="space-y-1">
                                        {candidate.items.map((item, itemIndex) => (
                                          <li key={`${item.name}-${itemIndex}`} className="text-[10px] text-slate-600">
                                            {item.name || 'Item tanpa nama'} · {item.quantity} {item.unit} × {formatRupiah(item.unit_price)} = {formatRupiah(item.subtotal)}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </>
                              ) : <span className="text-slate-400">-</span>}
                              {row.candidates?.length > 1 && (
                                <p className="mt-1 text-[10px] text-orange-700">{row.candidates.length} kandidat teratas ditampilkan</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-500">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
                Hasil ini hanya laporan rekonsiliasi; tidak mengubah transaksi, saldo, atau status pembayaran.
              </p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
