'use client';

import { Fragment, useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import { Receipt, FileDown, Plus, CheckCircle, ShieldCheck, ExternalLink, Pencil, Save, X, RotateCcw } from 'lucide-react';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [approvedMarketlists, setApprovedMarketlists] = useState([]);
  const [selectedMlId, setSelectedMlId] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [invoiceItemDraft, setInvoiceItemDraft] = useState([]);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceEditError, setInvoiceEditError] = useState('');
  const [refreshingInvoiceId, setRefreshingInvoiceId] = useState(null);
  const [regeneratingAll, setRegeneratingAll] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const [invRes, mlRes] = await Promise.all([
        api.getInvoices().catch(() => ({ data: { items: [] } })),
        api.getMarketlists('?status=approved,received,partially_received,in_progress,completed').catch(() => ({ data: { items: [] } }))
      ]);

      if (invRes?.data?.items) setInvoices(invRes.data.items);
      if (mlRes?.data?.items) setApprovedMarketlists(mlRes.data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshInvoicePrices = async (invoiceId) => {
    setRefreshingInvoiceId(invoiceId);
    try {
      await api.refreshInvoicePrices(invoiceId);
      if (editingInvoiceId === invoiceId) handleCancelInvoiceEdit();
      await fetchInvoices();
      alert('Harga invoice diperbarui dari rekap belanja, master item, atau harga marketlist.');
    } catch (error) {
      alert(error.message || 'Gagal memperbarui harga invoice.');
    } finally {
      setRefreshingInvoiceId(null);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedMlId) return;

    setGenerating(true);
    try {
      const res = await api.generateInvoice(selectedMlId);
      alert(`Invoice berhasil digenerate! (${res.data?.length || 1} supplier invoice)`);
      setSelectedMlId('');
      fetchInvoices();
    } catch (err) {
      alert(err.message || 'Gagal generate invoice');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateAll = async () => {
    setRegeneratingAll(true);
    try {
      const result = await api.regenerateAllInvoices();
      await fetchInvoices();
      alert(`Invoice diperbarui untuk ditinjau. ${result.data?.length || 0} dokumen diproses.`);
    } catch (error) {
      alert(error.message || 'Gagal memperbarui semua invoice.');
    } finally {
      setRegeneratingAll(false);
    }
  };

  const handleDownloadPdf = (id) => {
    const url = api.getInvoicePdfUrl(id);
    window.open(url, '_blank');
  };

  const handleStartInvoiceEdit = (invoice) => {
    setEditingInvoiceId(invoice._id);
    setInvoiceEditError('');
    setInvoiceItemDraft((invoice.items || []).map((item) => ({
      marketlist_item_id: item.marketlist_item_id,
      purchased: item.purchased !== false,
      quantity: item.purchased === false ? 0 : item.quantity,
      unit_price: item.unit_price
    })));
  };

  const handleSaveInvoiceEdit = async (invoiceId) => {
    setSavingInvoice(true);
    setInvoiceEditError('');
    try {
      await api.updateInvoiceItems(invoiceId, invoiceItemDraft);
      setEditingInvoiceId(null);
      setInvoiceItemDraft([]);
      await fetchInvoices();
    } catch (error) {
      setInvoiceEditError(error.message || 'Gagal memperbarui detail pembelian invoice.');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleCancelInvoiceEdit = () => {
    setEditingInvoiceId(null);
    setInvoiceItemDraft([]);
    setInvoiceEditError('');
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Manajemen Invoice & Tagihan Supplier" />

      <main className="p-8 space-y-6 max-w-7xl">
        {/* Aturan Pokok 2 Alert */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-bold">Invoice Awal dari Penerimaan Marketlist</p>
              <p className="text-emerald-800/80">
                Invoice disinkronkan dengan transaksi aktual Marketlist. Periksa status dibeli/tidak dibeli dan kuantitas sebelum invoice diverifikasi.
              </p>
            </div>
          </div>
        </div>

        {/* Generator Form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-sm text-slate-800">Generate Invoice dari Marketlist Approved</h3>
            <button
              type="button"
              onClick={handleRegenerateAll}
              disabled={regeneratingAll || generating}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${regeneratingAll ? 'animate-spin' : ''}`} />
              {regeneratingAll ? 'Memperbarui...' : 'Perbarui Semua Invoice'}
            </button>
          </div>
          <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedMlId}
              onChange={(e) => setSelectedMlId(e.target.value)}
              required
              className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Pilih Marketlist (Approved / Received) --</option>
              {approvedMarketlists.map((ml) => (
                <option key={ml._id} value={ml._id}>
                  {ml.marketlist_number} [{ml.status.toUpperCase()}] &bull; Butuh: {new Date(ml.required_date || ml.date).toLocaleDateString('id-ID')} &bull; Rp {(ml.totals?.estimated_amount || 0).toLocaleString('id-ID')}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={generating || !selectedMlId}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              <Receipt className="w-4 h-4" />
              <span>{generating ? 'Menggenerate...' : 'Generate Invoice Tagihan'}</span>
            </button>
          </form>
        </div>

        {/* Invoice List Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">Daftar Invoice Terbit</h3>
            <span className="text-xs text-slate-400">{invoices.length} Dokumen Tagihan</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Nomor Invoice</th>
                  <th className="px-6 py-3.5">Referensi ML</th>
                  <th className="px-6 py-3.5">Supplier Rekanan</th>
                  <th className="px-6 py-3.5">Tanggal Terbit</th>
                  <th className="px-6 py-3.5">Status Pembelian</th>
                  <th className="px-6 py-3.5">Grand Total Tagihan</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">PDF Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                      {loading ? 'Memuat invoice...' : 'Belum ada invoice yang digenerate.'}
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <Fragment key={inv._id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold text-slate-900">{inv.invoice_number}</td>
                        <td className="px-6 py-4 text-emerald-700 font-semibold">
                          {inv.marketlist_id?.marketlist_number || '-'}
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-medium">
                          {inv.supplier_id?.name || 'Supplier Rekanan'}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(inv.invoice_date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {inv.items?.filter((item) => item.purchased !== false).length || 0} item dibeli
                          {inv.items?.length > 0 && (
                            <span className="block text-[10px] text-slate-400">
                              {inv.items.filter((item) => item.purchased === false).length} tidak dibeli
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-black text-slate-900">
                          Rp {(inv.grand_total || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inv.status === 'generated' && (
                              <>
                                <button
                                  onClick={() => handleRefreshInvoicePrices(inv._id)}
                                  disabled={savingInvoice || refreshingInvoiceId !== null}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  <Receipt className="w-3.5 h-3.5" />
                                  {refreshingInvoiceId === inv._id ? 'Memperbarui...' : 'Update Harga'}
                                </button>
                                <button
                                  onClick={() => editingInvoiceId === inv._id
                                    ? handleCancelInvoiceEdit()
                                    : handleStartInvoiceEdit(inv)}
                                  disabled={savingInvoice || refreshingInvoiceId !== null}
                                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  {editingInvoiceId === inv._id ? 'Batal' : 'Atur Pembelian'}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDownloadPdf(inv._id)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                            >
                              <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                              Unduh PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editingInvoiceId === inv._id && (
                        <tr>
                          <td colSpan="8" className="bg-slate-50 px-6 py-4">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-bold text-slate-800">Konfirmasi barang yang benar-benar dibeli</p>
                                <button
                                  onClick={() => handleSaveInvoiceEdit(inv._id)}
                                  disabled={savingInvoice}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                  {savingInvoice ? 'Menyimpan...' : 'Simpan'}
                                </button>
                              </div>
                              {invoiceEditError && (
                                <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">
                                  {invoiceEditError}
                                </p>
                              )}
                              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                                {(inv.items || []).map((item) => {
                                  const itemId = item.marketlist_item_id?.toString();
                                  const draftIndex = invoiceItemDraft.findIndex(
                                    (draft) => draft.marketlist_item_id?.toString() === itemId
                                  );
                                  const draft = invoiceItemDraft[draftIndex];
                                  return (
                                    <div key={itemId} className="grid grid-cols-1 items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_155px_160px_130px]">
                                      <div>
                                        <p className="font-semibold text-slate-800">{item.product_name}</p>
                                        <p className="text-[11px] text-slate-500">
                                          Sumber harga: {({
                                            purchase_recap: 'Rekap belanja',
                                            master_item: 'Master item',
                                            marketlist: 'Marketlist',
                                            manual: 'Input manual'
                                          })[item.price_source] || 'Marketlist'}
                                        </p>
                                      </div>
                                      <label className="space-y-1 text-[11px] font-semibold text-slate-500">
                                        <span>Status pembelian</span>
                                        <select
                                          value={draft?.purchased ? 'yes' : 'no'}
                                          onChange={(event) => {
                                            const purchased = event.target.value === 'yes';
                                            setInvoiceItemDraft((items) => items.map((entry, index) =>
                                              index === draftIndex
                                                ? { ...entry, purchased, quantity: purchased ? entry.quantity : 0 }
                                                : entry
                                            ));
                                          }}
                                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-slate-800"
                                        >
                                          <option value="yes">Dibeli</option>
                                          <option value="no">Tidak dibeli</option>
                                        </select>
                                      </label>
                                      <label className="space-y-1 text-[11px] font-semibold text-slate-500">
                                        <span>Harga satuan ({item.unit})</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={draft?.unit_price ?? 0}
                                          onChange={(event) => {
                                            const unit_price = event.target.value === '' ? 0 : Number(event.target.value);
                                            setInvoiceItemDraft((items) => items.map((entry, index) =>
                                              index === draftIndex ? { ...entry, unit_price } : entry
                                            ));
                                          }}
                                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-slate-800"
                                        />
                                      </label>
                                      <label className="space-y-1 text-[11px] font-semibold text-slate-500">
                                        <span>Qty dibeli</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          disabled={!draft?.purchased}
                                          value={draft?.quantity ?? 0}
                                          onChange={(event) => {
                                            const quantity = event.target.value === '' ? 0 : Number(event.target.value);
                                            setInvoiceItemDraft((items) => items.map((entry, index) =>
                                              index === draftIndex ? { ...entry, quantity } : entry
                                            ));
                                          }}
                                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                                        />
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
