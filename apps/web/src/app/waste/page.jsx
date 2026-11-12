'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';

const today = () => new Date().toLocaleDateString('en-CA');
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function WastePage() {
  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [latestPrices, setLatestPrices] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [wasteResponse, productResponse, priceResponse] = await Promise.all([
        api.getWasteRecords(),
        api.getProducts('?include_inactive=true'),
        api.getLatestPrices()
      ]);
      setRecords(Array.isArray(wasteResponse.data) ? wasteResponse.data : []);
      setProducts(Array.isArray(productResponse.data) ? productResponse.data : []);
      setLatestPrices(Array.isArray(priceResponse.data) ? priceResponse.data : []);
    } catch (requestError) {
      setError(requestError.message || 'Gagal memuat data waste.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedProduct = products.find((product) => product._id === productId);
  const latestPurchasePrice = latestPrices.find(
    (entry) => entry.product?._id === productId && entry.source === 'purchase'
  )?.latest_price;
  const unitPrice = Number(latestPurchasePrice || selectedProduct?.last_purchase_price) || 0;
  const totalCost = useMemo(() => (Number(quantity) || 0) * unitPrice, [quantity, unitPrice]);

  const saveWaste = async (event) => {
    event.preventDefault();
    if (!productId || !(Number(quantity) > 0) || !reason.trim() || !date) {
      setError('Produk, jumlah, tanggal, dan alasan waste wajib diisi.');
      return;
    }
    if (unitPrice <= 0) {
      setError('Produk belum memiliki harga pembelian terakhir. Catat pembelian terlebih dahulu.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createWasteRecord({
        product_id: productId,
        quantity: Number(quantity),
        reason: reason.trim(),
        wasted_at: new Date(`${date}T12:00:00`).toISOString()
      });
      setQuantity('');
      setReason('');
      setDate(today());
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Gagal mencatat waste.');
    } finally {
      setSaving(false);
    }
  };

  const totalWasteValue = records.reduce((sum, record) => sum + (Number(record.total_cost) || 0), 0);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
      <Navbar title="Pencatatan Waste" />
      <main className="p-4 sm:p-6 md:p-8 space-y-5 max-w-7xl w-full mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Waste Produk</h1>
            <p className="text-xs text-slate-500">Nilai waste dihitung otomatis memakai harga pembelian terakhir produk.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700"><RefreshCw className="h-4 w-4" /> Muat ulang</button>
        </div>

        {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <form onSubmit={saveWaste} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><AlertTriangle className="h-4 w-4 text-amber-600" /> Catat waste</h2>
            <label className="block text-xs font-semibold text-slate-600">Produk
              <select value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="">Pilih produk</option>
                {products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600">Jumlah waste
                <input type="number" min="0.000001" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Tanggal
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              <div>Harga beli terakhir: <strong>{unitPrice > 0 ? `${money(unitPrice)} / ${selectedProduct?.unit_id?.abbreviation || selectedProduct?.unit_id?.name || 'unit'}` : 'Belum tersedia'}</strong></div>
              <div className="mt-1">Nilai waste: <strong>{money(totalCost)}</strong></div>
            </div>
            <label className="block text-xs font-semibold text-slate-600">Alasan waste
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Contoh: kedaluwarsa, rusak, tumpah" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{saving ? 'Menyimpan...' : 'Simpan Waste'}</button>
          </form>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-bold text-slate-800">Riwayat Waste</h2>
              <span className="text-xs font-bold text-rose-700">Total {money(totalWasteValue)}</span>
            </div>
            {loading ? <p className="p-6 text-sm text-slate-500">Memuat data...</p> : records.length === 0 ? <p className="p-6 text-sm text-slate-500">Belum ada waste yang dicatat.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Tanggal / Produk</th><th className="px-4 py-3">Jumlah</th><th className="px-4 py-3">Harga beli/unit</th><th className="px-4 py-3">Nilai</th><th className="px-4 py-3">Alasan</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((record) => <tr key={record._id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{record.product_name}<div className="text-[10px] font-normal text-slate-500">{new Date(record.wasted_at).toLocaleDateString('id-ID')}</div></td>
                      <td className="px-4 py-3 text-slate-600">{record.quantity} {record.unit_name}</td>
                      <td className="px-4 py-3 text-slate-600">{money(record.unit_purchase_price)}</td>
                      <td className="px-4 py-3 font-bold text-rose-700">{money(record.total_cost)}</td>
                      <td className="px-4 py-3 text-slate-600">{record.reason}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
