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
const formatCandidateDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('id-ID')
    : '-';
};

const statusLabels = {
  matched: 'Cocok otomatis',
  manual_matched: 'Dipilih manual',
  amount_mismatch: 'Nama/ref cocok, nominal berbeda',
  ambiguous: 'Perlu diperiksa',
  invalid_amount: 'Nominal tidak valid',
  invalid_direction: 'Penanda debit/kredit tidak valid',
  unmatched: 'Tidak ditemukan pasangan'
};

const statusStyles = {
  matched: 'bg-emerald-100 text-emerald-800',
  manual_matched: 'bg-blue-100 text-blue-800',
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
  const [manualSelections, setManualSelections] = useState({});
  const [result, setResult] = useState(null);
  const [manualSelectionPending, setManualSelectionPending] = useState(false);
  const [beneficiaryNames, setBeneficiaryNames] = useState({});
  const [savedResult, setSavedResult] = useState(null);
  const [withdrawalResult, setWithdrawalResult] = useState(null);
  const [withdrawalSelections, setWithdrawalSelections] = useState({});
  const [overheadOptions, setOverheadOptions] = useState({});
  const [overheadHasMore, setOverheadHasMore] = useState({});
  const [selectedOverheads, setSelectedOverheads] = useState({});
  const [loadingOverheads, setLoadingOverheads] = useState({});
  const [withdrawalSaveResult, setWithdrawalSaveResult] = useState(null);
  const [error, setError] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingWithdrawals, setSavingWithdrawals] = useState(false);

  const resetWithdrawalReconciliation = () => {
    setWithdrawalResult(null);
    setWithdrawalSelections({});
    setOverheadOptions({});
    setOverheadHasMore({});
    setSelectedOverheads({});
    setLoadingOverheads({});
    setWithdrawalSaveResult(null);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setResult(null);
    setManualSelections({});
    setManualSelectionPending(false);
    setBeneficiaryNames({});
    setSavedResult(null);
    resetWithdrawalReconciliation();

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
    setManualSelections({});
    setManualSelectionPending(false);
    setSavedResult(null);
    resetWithdrawalReconciliation();
  };

  const handleReconcile = async (event, applyManual = false) => {
    event?.preventDefault();
    if (!statement || mapping.description < 0 || mapping.amount < 0) {
      setError('Pilih file, kolom keterangan, dan kolom nominal debit.');
      return;
    }

    setError('');
    setSubmitting(true);
    resetWithdrawalReconciliation();
    try {
      const rows = statement.dataRows.map((row, index) => ({
        rowNumber: index + 2,
        date: mapping.date >= 0 ? cellToText(row[mapping.date]) : '',
        description: cellToText(row[mapping.description]),
        reference: mapping.reference >= 0 ? cellToText(row[mapping.reference]) : '',
        direction: mapping.direction >= 0 ? cellToText(row[mapping.direction]) : '',
        amount: row[mapping.amount] ?? ''
      }));
      const selectionsToSubmit = Object.fromEntries(
        Object.entries(manualSelections).filter(([, keys]) => Array.isArray(keys) && keys.length > 0)
      );
      const [purchaseResponse, withdrawalResponse] = await Promise.all([
        api.reconcilePurchaseMutations({
          rows,
          debitMode,
          manualSelections: applyManual ? selectionsToSubmit : {}
        }),
        api.reconcileCashWithdrawals({ rows, debitMode })
      ]);
      setResult(purchaseResponse.data);
      setWithdrawalResult(withdrawalResponse.data);
      setManualSelections(applyManual ? selectionsToSubmit : {});
      setManualSelectionPending(false);
      setBeneficiaryNames({});
      setSavedResult(null);
      setWithdrawalSelections({});
      setOverheadOptions({});
      setOverheadHasMore({});
      setSelectedOverheads({});
      setWithdrawalSaveResult(null);
    } catch (requestError) {
      setError(requestError.message || 'Rekonsiliasi gagal dijalankan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveResults = async () => {
    if (!result || manualSelectionPending) return;
    const rows = result.rows
      .filter((row) => row.status === 'matched' || row.status === 'manual_matched')
      .map((row) => {
        const selected = row.status === 'manual_matched'
          ? row.purchases || []
          : row.purchase
            ? [row.purchase]
            : [];
        return {
          rowNumber: row.rowNumber,
          date: row.date,
          description: row.description,
          reference: row.reference,
          amount: row.amount,
          candidateKeys: selected.map((purchase) => purchase.key),
          matchType: row.status === 'manual_matched' ? 'manual' : 'automatic',
          beneficiaryName: beneficiaryNames[row.rowNumber] ?? row.beneficiary_suggestion ?? ''
        };
      })
      .filter((row) => row.candidateKeys.length > 0);
    if (rows.length === 0) {
      setError('Belum ada hasil cocok yang dapat disimpan.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const response = await api.savePurchaseReconciliations({ rows });
      setSavedResult(response.data);
    } catch (requestError) {
      setError(requestError.message || 'Hasil rekonsiliasi gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleWithdrawalSelection = async (rowNumber, candidateId) => {
    setWithdrawalSaveResult(null);
    setError('');
    setWithdrawalSelections((current) => ({ ...current, [rowNumber]: candidateId }));
    setOverheadOptions((current) => ({ ...current, [rowNumber]: [] }));
    setOverheadHasMore((current) => ({ ...current, [rowNumber]: false }));
    setSelectedOverheads((current) => ({ ...current, [rowNumber]: [] }));
    if (!candidateId) return;

    setLoadingOverheads((current) => ({ ...current, [rowNumber]: true }));
    try {
      const response = await api.getCashWithdrawalOverheads(candidateId);
      setOverheadOptions((current) => ({ ...current, [rowNumber]: response.data.options }));
      setOverheadHasMore((current) => ({ ...current, [rowNumber]: response.data.has_more }));
      setSelectedOverheads((current) => ({
        ...current,
        [rowNumber]: response.data.selected_keys
      }));
    } catch (requestError) {
      setError(requestError.message || 'Daftar overhead tunai gagal dimuat.');
    } finally {
      setLoadingOverheads((current) => ({ ...current, [rowNumber]: false }));
    }
  };

  const handleSaveWithdrawalResults = async () => {
    if (!withdrawalResult) return;
    const rows = withdrawalResult.rows
      .filter((row) => withdrawalSelections[row.rowNumber])
      .map((row) => ({
        rowNumber: row.rowNumber,
        date: row.date,
        description: row.description,
        reference: row.reference,
        amount: row.amount,
        cashTransactionId: withdrawalSelections[row.rowNumber],
        allocationKeys: selectedOverheads[row.rowNumber] || []
      }));
    if (rows.length === 0) {
      setError('Pilih transaksi tarik tunai yang cocok terlebih dahulu.');
      return;
    }

    setError('');
    setSavingWithdrawals(true);
    try {
      const response = await api.saveCashWithdrawalReconciliations({ rows });
      setWithdrawalSaveResult(response.data);
    } catch (requestError) {
      setError(requestError.message || 'Rekonsiliasi tarik tunai gagal disimpan.');
    } finally {
      setSavingWithdrawals(false);
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
              Rekonsiliasi Mutasi Bank
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Cocokkan debit dengan pembelian, tarik tunai, dan overhead tunai yang dibelanjakan selama beberapa hari.
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
            Kandidat ganda dan selisih nominal tidak dipasangkan otomatis. Gunakan pilihan manual bila transaksi yang benar
            sudah tercatat tetapi tidak terdeteksi otomatis. Persentase tidak cocok dihitung dari baris debit.
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
                    setManualSelections({});
                    setManualSelectionPending(false);
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
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Cocok otomatis</p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">{result.summary.matched_rows}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800">Dipilih manual</p>
                  <p className="mt-1 text-2xl font-black text-blue-700">{result.summary.manual_matched_rows || 0}</p>
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

              {manualSelectionPending && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs text-blue-900">
                    Pilihan manual belum diterapkan. Periksa kembali transaksi dan nominal sebelum melanjutkan.
                  </p>
                  <button
                    type="button"
                    onClick={(event) => handleReconcile(event, true)}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Terapkan pilihan manual
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-xs text-emerald-900">
                  <p className="font-bold">Simpan hasil cocok dan pelajari nama penerima transfer</p>
                  <p className="mt-1">
                    {result.rows.filter((row) => row.status === 'matched' || row.status === 'manual_matched').length} baris cocok.
                    Konfirmasi penyimpanan akan mengingat hubungan nama penerima dengan supplier.
                  </p>
                  {savedResult && (
                    <p role="status" className="mt-1 font-semibold">
                      Tersimpan: {savedResult.saved_count} baris; alias supplier {savedResult.alias_saved_count} disimpan,
                      {` ${savedResult.alias_conflict_count} konflik, ${savedResult.alias_skipped_count} dilewati.`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveResults}
                  disabled={saving || submitting || manualSelectionPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {saving ? 'Menyimpan...' : 'Simpan hasil cocok'}
                </button>
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
                        const selectedKeys = manualSelections[row.rowNumber] ??
                          row.purchases?.map((purchase) => purchase.key) ?? [];
                        const selectedManualCandidates = row.manual_candidates?.filter(
                          (option) => selectedKeys.includes(option.key)
                        ) || [];
                        const displayedManualCandidates = row.purchases || selectedManualCandidates;
                        const candidate = row.purchase || displayedManualCandidates[0] || row.candidates?.[0];
                        const canManuallySelect = row.status !== 'matched' &&
                          row.manual_candidates?.length > 0;
                        const manualPurchaseTotal = row.manual_purchase_total ??
                          selectedManualCandidates.reduce((total, option) => total + option.amount, 0);
                        const manualAmountDifference = row.manual_amount_difference ??
                          (selectedManualCandidates.length > 0 ? row.amount - manualPurchaseTotal : null);
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
                                    {candidate.checks?.supplier_alias && (
                                      <p>Nama penerima transfer: cocok dengan alias tersimpan</p>
                                    )}
                                    <p>No. ref supplier: {candidate.checks?.supplier_reference ? 'cocok' : 'tidak terdeteksi'}</p>
                                    <p>Nominal mutasi: {
                                      row.status === 'manual_matched'
                                        ? manualAmountDifference === 0 ? 'cocok' : 'berbeda'
                                        : candidate.checks?.amount ? 'cocok' : 'berbeda'
                                    }</p>
                                  </div>
                                  {candidate.purchase_total !== candidate.amount && (
                                    <p className="text-[10px] text-slate-500">
                                      Total transaksi pembelian: {formatRupiah(candidate.purchase_total)}
                                    </p>
                                  )}
                                  {row.status !== 'manual_matched' &&
                                    selectedManualCandidates.length === 0 &&
                                    candidate.amount_difference !== undefined && (
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
                              {(row.status === 'matched' || row.status === 'manual_matched') && (
                                <label className="mt-2 block text-[10px] font-semibold text-slate-600">
                                  Nama penerima transfer (opsional)
                                  <input
                                    type="text"
                                    maxLength={100}
                                    value={beneficiaryNames[row.rowNumber] ?? row.beneficiary_suggestion ?? ''}
                                    onChange={(event) => {
                                      setSavedResult(null);
                                      setBeneficiaryNames((current) => ({
                                        ...current,
                                        [row.rowNumber]: event.target.value
                                      }));
                                    }}
                                    placeholder="Contoh: Adrian Budianto"
                                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 font-normal"
                                  />
                                </label>
                              )}
                              {row.purchases?.length > 1 && (
                                <div className="mt-2 border-t border-slate-100 pt-2">
                                  <p className="mb-1 text-[10px] font-bold text-slate-700">
                                    Transaksi lain yang dipilih
                                  </p>
                                  <ul className="space-y-1">
                                    {row.purchases.slice(1).map((purchase) => (
                                      <li key={purchase.key} className="text-[10px] text-slate-600">
                                        {purchase.purchase_number} · {purchase.supplier_name || 'Supplier'} · {formatRupiah(purchase.amount)}
                                        {purchase.items?.length > 0 && (
                                          <span className="block text-slate-500">
                                            {purchase.items.map((item) => item.name).filter(Boolean).join(', ')}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {row.status === 'manual_matched' && (
                                <div className="mt-2 rounded-lg bg-blue-50 p-2 text-[10px] text-blue-900">
                                  <p>Total transaksi dipilih: <strong>{formatRupiah(manualPurchaseTotal)}</strong></p>
                                  <p>Selisih terhadap mutasi: {manualAmountDifference > 0 ? '+' : ''}{formatRupiah(manualAmountDifference)}</p>
                                </div>
                              )}
                              {canManuallySelect && selectedManualCandidates.length > 0 && (
                                <div className="mt-2 rounded-lg bg-blue-50 p-2 text-[10px] text-blue-900">
                                  <p>Total pilihan: <strong>{formatRupiah(manualPurchaseTotal)}</strong></p>
                                  <p>Selisih terhadap mutasi: {manualAmountDifference > 0 ? '+' : ''}{formatRupiah(manualAmountDifference)}</p>
                                </div>
                              )}
                              {canManuallySelect && (
                                <fieldset className="mt-3 rounded-lg border border-slate-200 p-2">
                                  <legend className="px-1 text-[10px] font-bold text-slate-700">
                                    Pilih satu atau beberapa transaksi belanja
                                  </legend>
                                  <div className="max-h-40 space-y-1 overflow-y-auto">
                                    {row.manual_candidates.map((option) => (
                                      <label key={option.key} className="flex cursor-pointer items-start gap-2 rounded p-1.5 font-normal hover:bg-slate-50">
                                        <input
                                          type="checkbox"
                                          checked={selectedKeys.includes(option.key)}
                                          onChange={(event) => {
                                            setManualSelectionPending(true);
                                            setManualSelections((current) => {
                                              const next = { ...current };
                                              const currentKeys = next[row.rowNumber] ??
                                                row.purchases?.map((purchase) => purchase.key) ?? [];
                                              next[row.rowNumber] = event.target.checked
                                                ? [...new Set([...currentKeys, option.key])]
                                                : currentKeys.filter((key) => key !== option.key);
                                              return next;
                                            });
                                          }}
                                          className="mt-0.5"
                                        />
                                        <span>
                                          <span className="block font-semibold">
                                            {option.purchase_number || 'Tanpa nomor'} · {option.supplier_name || 'Supplier'}
                                          </span>
                                          <span className="block text-slate-500">
                                            {formatCandidateDate(option.date)} · {formatRupiah(option.amount)} · {option.type}
                                          </span>
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                  <span className="mt-1 block text-[10px] font-normal text-slate-500">
                                    Kandidat mencakup transaksi dengan nominal sama atau tanggal berdekatan (±90 hari).
                                  </span>
                                </fieldset>
                              )}
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
              <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tarik tunai dan alokasi overhead beberapa hari</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Cocokkan mutasi bank ke transaksi tarik tunai yang sudah dicatat. Lalu tautkan overhead tunai
                    sampai maksimal sebesar dana tarik tunai, dalam 30 hari sejak penarikan. Sisa dana tetap menjadi
                    saldo kas; tautan ini tidak membuat pengeluaran baru.
                  </p>
                </div>
                {withdrawalResult?.summary.rows_with_withdrawal_candidates === 0 ? (
                  <p className="rounded-lg bg-white p-3 text-xs text-slate-600">
                    Tidak ada transaksi tarik tunai tersimpan dengan nominal yang sama. Catat transaksi bank ke kas
                    terlebih dahulu, lalu jalankan rekonsiliasi lagi.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {withdrawalResult?.rows
                      .filter((row) => row.candidates.length > 0)
                      .map((row) => {
                        const selectedWithdrawal = row.candidates.find(
                          (candidate) => candidate.id === withdrawalSelections[row.rowNumber]
                        );
                        const options = overheadOptions[row.rowNumber] || [];
                        const selectedKeys = selectedOverheads[row.rowNumber] || [];
                        const allocated = options.reduce(
                          (total, option) => total + (selectedKeys.includes(option.key) ? option.amount : 0),
                          0
                        );
                        return (
                          <div key={row.rowNumber} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
                              <div>
                                <p className="font-bold text-slate-800">
                                  Baris {row.rowNumber} · {formatRupiah(row.amount)}
                                </p>
                                <p className="mt-0.5 text-slate-600">{row.description}</p>
                                <p className="mt-0.5 text-[10px] text-slate-500">{row.date || 'Tanggal tidak tersedia'}</p>
                              </div>
                              <label className="w-full max-w-md text-[10px] font-bold text-slate-700">
                                Transaksi tarik tunai internal
                                <select
                                  value={withdrawalSelections[row.rowNumber] || ''}
                                  onChange={(event) => handleWithdrawalSelection(row.rowNumber, event.target.value)}
                                  className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-xs font-normal"
                                >
                                  <option value="">Pilih transaksi tarik tunai</option>
                                  {row.candidates.map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.transaction_number} · {formatCandidateDate(candidate.date)} · {formatRupiah(candidate.amount)}
                                      {candidate.saved ? ' · sudah pernah disimpan' : ''}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            {row.has_more_candidates && (
                              <p className="mt-1 text-[10px] text-amber-700">
                                Ada lebih dari 30 kandidat tarik tunai; daftar menampilkan 30 yang terdekat tanggalnya.
                              </p>
                            )}
                            {selectedWithdrawal && (
                              <div className="mt-3 border-t border-slate-100 pt-3">
                                {loadingOverheads[row.rowNumber] ? (
                                  <p className="flex items-center gap-2 text-xs text-slate-500">
                                    <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat overhead tunai...
                                  </p>
                                ) : (
                                  <>
                                    <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs">
                                      <p className="font-semibold text-slate-700">
                                        Pilih overhead tunai (tanggal penarikan sampai 30 hari sesudahnya)
                                      </p>
                                      <p className="font-bold text-slate-800">
                                        Dialokasikan {formatRupiah(allocated)} · Sisa kas {formatRupiah(selectedWithdrawal.amount - allocated)}
                                      </p>
                                    </div>
                                    {options.length === 0 ? (
                                      <p className="rounded bg-slate-50 p-2 text-[10px] text-slate-500">
                                        Belum ada overhead tunai yang tersedia dalam rentang tanggal ini.
                                      </p>
                                    ) : (
                                      <div className="max-h-48 space-y-1 overflow-y-auto">
                                        {options.map((option) => {
                                          const checked = selectedKeys.includes(option.key);
                                          const overBudget = !checked &&
                                            allocated + option.amount > selectedWithdrawal.amount;
                                          return (
                                            <label
                                              key={option.key}
                                              className={`flex items-start gap-2 rounded p-2 text-xs ${overBudget ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={overBudget}
                                                onChange={(event) => {
                                                  const nextKeys = event.target.checked
                                                    ? [...selectedKeys, option.key]
                                                    : selectedKeys.filter((key) => key !== option.key);
                                                  setWithdrawalSaveResult(null);
                                                  setSelectedOverheads((current) => ({
                                                    ...current,
                                                    [row.rowNumber]: nextKeys
                                                  }));
                                                }}
                                                className="mt-0.5"
                                              />
                                              <span className="min-w-0 flex-1">
                                                <span className="block font-semibold text-slate-800">
                                                  {option.title} {option.category ? `· ${option.category}` : ''}
                                                </span>
                                                <span className="block text-[10px] text-slate-500">
                                                  {formatCandidateDate(option.date)} · {formatRupiah(option.amount)}
                                                  {option.source_type === 'overhead_payment' ? ' · pembayaran hutang overhead' : ''}
                                                </span>
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {overheadHasMore[row.rowNumber] && (
                                      <p className="mt-1 text-[10px] text-amber-700">
                                        Ada lebih dari 500 overhead dalam rentang tanggal; daftar menampilkan 500 data pertama.
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
                {withdrawalResult?.summary.rows_with_withdrawal_candidates > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-200 pt-3">
                    <div className="text-xs text-slate-700">
                      {withdrawalResult.summary.rows_with_withdrawal_candidates} baris mutasi memiliki kandidat tarik tunai.
                      {withdrawalSaveResult && (
                        <p role="status" className="mt-1 font-semibold text-emerald-800">
                          Tersimpan {withdrawalSaveResult.saved_count} mutasi; {withdrawalSaveResult.allocation_count} overhead
                          dialokasikan {formatRupiah(withdrawalSaveResult.allocated_amount)}; sisa dana {formatRupiah(withdrawalSaveResult.remaining_amount)}.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveWithdrawalResults}
                      disabled={savingWithdrawals || submitting ||
                        Object.values(loadingOverheads).some(Boolean) ||
                        !Object.values(withdrawalSelections).some(Boolean)}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingWithdrawals && <LoaderCircle className="h-4 w-4 animate-spin" />}
                      {savingWithdrawals ? 'Menyimpan...' : 'Simpan tarik tunai & overhead'}
                    </button>
                  </div>
                )}
              </section>
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
