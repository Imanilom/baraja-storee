'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import { Receipt, FileDown, Plus, CheckCircle, ShieldCheck, ExternalLink } from 'lucide-react';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [approvedMarketlists, setApprovedMarketlists] = useState([]);
  const [selectedMlId, setSelectedMlId] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const [invRes, mlRes] = await Promise.all([
        api.getInvoices().catch(() => ({ data: { items: [] } })),
        api.getMarketlists('?status=approved').catch(() => ({ data: { items: [] } }))
      ]);

      if (invRes?.data?.items) setInvoices(invRes.data.items);
      if (mlRes?.data?.items) setApprovedMarketlists(mlRes.data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const handleDownloadPdf = (id) => {
    const url = api.getInvoicePdfUrl(id);
    window.open(url, '_blank');
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
              <p className="font-bold">Aturan Pokok #2: Invoice Berbasis Snapshot Marketlist Approved</p>
              <p className="text-emerald-800/80">
                Invoice dihitung dari kuantitas dan harga yang disetujui pada Marketlist, terpisah otomatis per supplier, dan tidak berubah jika ada perubahan di masa mendatang.
              </p>
            </div>
          </div>
        </div>

        {/* Generator Form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800">Generate Invoice dari Marketlist Approved</h3>
          <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedMlId}
              onChange={(e) => setSelectedMlId(e.target.value)}
              required
              className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Pilih Marketlist yang Disetujui Admin --</option>
              {approvedMarketlists.map((ml) => (
                <option key={ml._id} value={ml._id}>
                  {ml.marketlist_number} &bull; Butuh: {new Date(ml.required_date || ml.date).toLocaleDateString('id-ID')} &bull; Rp {(ml.totals?.estimated_amount || 0).toLocaleString('id-ID')}
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
                  <th className="px-6 py-3.5">Item Snapshot</th>
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
                    <tr key={inv._id} className="hover:bg-slate-50">
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
                        {inv.items?.length || 0} item barang
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
                        <button
                          onClick={() => handleDownloadPdf(inv._id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                          Unduh PDF
                        </button>
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
