'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function PricesPage() {
  const [prices, setPrices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPrices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getLatestPrices();
      setPrices(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.message || 'Gagal memuat harga terbaru.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  const loadHistory = async (price) => {
    setSelected(price);
    setHistoryLoading(true);
    try {
      const response = await api.getProductPriceHistory(price.product._id);
      setHistory(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.message || 'Gagal memuat tren harga produk.');
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const chartHistory = useMemo(() => [...history].reverse(), [history]);
  const historyPrices = chartHistory.map((entry) => Number(entry.price) || 0);
  const minPrice = Math.min(...historyPrices);
  const maxPrice = Math.max(...historyPrices);
  const priceChange = history.length > 1
    ? Number(history[0].price) - Number(history[1].price)
    : null;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
      <Navbar title="Harga Terbaru & Tren Harga" />
      <main className="p-4 sm:p-6 md:p-8 space-y-5 max-w-7xl w-full mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Harga Terbaru & Tren Harga</h1>
            <p className="text-xs text-slate-500">Harga beli aktual terakhir dan riwayat perubahan per produk.</p>
          </div>
          <button onClick={loadPrices} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700">
            <RefreshCw className="h-4 w-4" /> Muat ulang
          </button>
        </div>

        {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b px-4 py-3 text-sm font-bold text-slate-800">Harga beli terakhir</div>
            {loading ? (
              <p className="p-6 text-sm text-slate-500">Memuat harga...</p>
            ) : prices.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Belum ada riwayat harga produk.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr><th className="px-4 py-3">Produk</th><th className="px-4 py-3">Harga terbaru</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Tren</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prices.map((entry) => (
                      <tr key={entry._id} onClick={() => loadHistory(entry)} className={`cursor-pointer hover:bg-amber-50 ${selected?.product?._id === entry.product?._id ? 'bg-amber-50' : ''}`}>
                        <td className="px-4 py-3 font-semibold text-slate-800">{entry.product?.name || 'Produk'}<div className="text-[10px] font-normal text-slate-500">{entry.product?.sku || '-'}</div></td>
                        <td className="px-4 py-3 font-bold text-emerald-700">{money(entry.latest_price)}<div className="text-[10px] font-normal text-slate-500">/{entry.product_unit?.abbreviation || entry.product_unit?.name || 'unit'}</div></td>
                        <td className="px-4 py-3 text-slate-600">{entry.supplier?.name || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{entry.recorded_at ? new Date(entry.recorded_at).toLocaleDateString('id-ID') : '-'}</td>
                        <td className="px-4 py-3 text-indigo-700">{entry.source === 'purchase' ? 'Pembelian' : entry.source === 'marketlist' ? 'Marketlist' : entry.source || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-800">{selected?.product?.name || 'Tren harga produk'}</h2>
            {!selected ? (
              <p className="mt-3 text-xs text-slate-500">Pilih produk untuk melihat riwayat harganya.</p>
            ) : historyLoading ? (
              <p className="mt-3 text-xs text-slate-500">Memuat tren harga...</p>
            ) : history.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">Belum ada riwayat harga untuk produk ini.</p>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3">
                  <span className="text-xs text-slate-500">Perubahan dari pembelian sebelumnya</span>
                  {priceChange === null ? <span className="ml-auto text-xs text-slate-500">Data tunggal</span> : (
                    <span className={`ml-auto inline-flex items-center gap-1 text-xs font-bold ${priceChange > 0 ? 'text-rose-600' : priceChange < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {priceChange > 0 ? <TrendingUp className="h-4 w-4" /> : priceChange < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                      {priceChange > 0 ? '+' : ''}{money(priceChange)}
                    </span>
                  )}
                </div>
                <div className="mt-5 flex h-36 items-end gap-2 border-b border-l px-2 pb-1">
                  {chartHistory.map((entry, index) => {
                    const value = Number(entry.price) || 0;
                    const height = maxPrice === minPrice ? 70 : 20 + ((value - minPrice) / (maxPrice - minPrice)) * 80;
                    return <div key={entry._id} title={`${money(value)} · ${new Date(entry.recorded_at).toLocaleDateString('id-ID')}`} className="flex-1 rounded-t bg-amber-500 hover:bg-amber-600" style={{ height: `${height}%` }} />;
                  })}
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-auto">
                  {history.map((entry) => (
                    <div key={entry._id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                      <span className="text-slate-500">{new Date(entry.recorded_at).toLocaleDateString('id-ID')} · {entry.supplier_id?.name || (entry.source === 'purchase' ? 'Pembelian' : 'Harga tercatat')}</span>
                      <strong className="text-slate-800">{money(entry.price)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
