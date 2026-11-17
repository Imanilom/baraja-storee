'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '../../components/Navbar';
import { api } from '../../lib/api';
import { AlertTriangle, Plus, RefreshCw, Search, ClipboardList } from 'lucide-react';

const today = () => new Date().toLocaleDateString('en-CA');
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const formatDate = (value) => {
  if (!value) return '-';
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? '-' : parsedDate.toLocaleDateString('id-ID');
};

export default function WastePage() {
  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [marketlists, setMarketlists] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [latestPrices, setLatestPrices] = useState([]);
  const [marketlistPurchases, setMarketlistPurchases] = useState([]);
  const [stage, setStage] = useState('received');
  const [marketlistId, setMarketlistId] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingWasteId, setSyncingWasteId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [wasteResponse, productResponse, priceResponse, marketlistResponse, locationResponse] = await Promise.all([
        api.getWasteRecords(),
        api.getProducts('?include_inactive=true'),
        api.getLatestPrices(),
        api.getMarketlists('?status=approved,partial_rejection,in_progress,partially_received,received,completed&limit=500'),
        api.getLocations()
      ]);
      setRecords(Array.isArray(wasteResponse.data) ? wasteResponse.data : []);
      setProducts(Array.isArray(productResponse.data) ? productResponse.data : []);
      setLatestPrices(Array.isArray(priceResponse.data) ? priceResponse.data : []);
      setMarketlists(marketlistResponse.data?.items || marketlistResponse.data || []);
      setLocations(locationResponse.data?.items || locationResponse.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Gagal memuat data waste.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedMarketlist = marketlists.find((marketlist) => marketlist._id === marketlistId);
  const isReceivingStage = stage === 'received';
  const selectedReceipt = receipts.find((receipt) => receipt._id === receiptId);
  const marketlistProducts = (selectedMarketlist?.items || [])
    .filter((item) => item.item_status !== 'rejected')
    .map((item) => {
      const product = item.product_id && typeof item.product_id === 'object'
        ? item.product_id
        : products.find((entry) => entry._id === String(item.product_id || ''));
      return product ? { ...product, marketlistItemId: item._id } : null;
    })
    .filter(Boolean);
  const receiptProducts = (selectedReceipt?.items || [])
    .map((receiptItem) => {
      const marketlistItemId = receiptItem.marketlist_item_id?._id || receiptItem.marketlist_item_id;
      const marketlistItem = selectedMarketlist?.items?.find((item) => item._id === String(marketlistItemId));
      const product = marketlistItem?.product_id && typeof marketlistItem.product_id === 'object'
        ? marketlistItem.product_id
        : products.find((entry) => entry._id === String(marketlistItem?.product_id || ''));
      const purchaseItem = marketlistPurchases
        .flatMap((purchase) => purchase.items || [])
        .find((item) => String(item.marketlist_item_id?._id || item.marketlist_item_id) === String(marketlistItemId));
      return product ? {
        ...product,
        marketlistItemId: String(marketlistItemId),
        receiptItemId: receiptItem._id,
        receiptUnitName: purchaseItem?.unit_name || product.unit_id?.abbreviation || product.unit_id?.name || ''
      } : null;
    })
    .filter(Boolean);
  const normalizedProductSearch = productSearch.trim().toLocaleLowerCase('id-ID');
  const matchingMarketlists = marketlists.filter((marketlist) =>
    (marketlist.items || []).some((item) => {
      if (item.item_status === 'rejected') return false;
      const name = item.product_id?.name || item.product_snapshot?.name || '';
      return !normalizedProductSearch || name.toLocaleLowerCase('id-ID').includes(normalizedProductSearch);
    })
  );
  const visibleMarketlists = normalizedProductSearch ? matchingMarketlists : marketlists;
  const availableProducts = isReceivingStage ? receiptProducts : products;
  const visibleProducts = availableProducts.filter((product) =>
    !normalizedProductSearch || product.name.toLocaleLowerCase('id-ID').includes(normalizedProductSearch)
  );
  const selectedProduct = availableProducts.find((product) => product._id === productId);
  const productDocumentId = selectedProduct?._id;
  const marketlistPurchaseItem = marketlistPurchases
    .flatMap((purchase) => purchase.items || [])
    .find((item) => String(item.marketlist_item_id?._id || item.marketlist_item_id) === selectedProduct?.marketlistItemId);
  const marketlistPurchasePrice = marketlistPurchaseItem?.actual_unit_price;
  const latestPurchasePrice = latestPrices.find(
    (entry) => entry.product?._id === productDocumentId && entry.source === 'purchase'
  )?.latest_price;
  const unitPrice = Number(marketlistPurchasePrice || latestPurchasePrice || selectedProduct?.last_purchase_price) || 0;
  const wasteUnitName = isReceivingStage
    ? marketlistPurchaseItem?.unit_name || selectedProduct?.receiptUnitName || selectedProduct?.unit_id?.abbreviation || selectedProduct?.unit_id?.name || 'unit'
    : selectedProduct?.unit_id?.abbreviation || selectedProduct?.unit_id?.name || 'unit';
  const totalCost = useMemo(() => (Number(quantity) || 0) * unitPrice, [quantity, unitPrice]);

  const saveWaste = async (event) => {
    event.preventDefault();
    if ((isReceivingStage && (!marketlistId || !receiptId || !selectedProduct?.receiptItemId)) ||
        (!isReceivingStage && !locationId) || !productDocumentId ||
        !(Number(quantity) > 0) || !reason.trim() || !date) {
      setError(`${isReceivingStage ? 'Marketlist, penerimaan, dan item penerimaan, ' : 'lokasi stok, '}produk, jumlah, tanggal, dan alasan waste wajib diisi.`);
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
        product_id: productDocumentId,
        unit_name: wasteUnitName,
        ...(isReceivingStage
          ? {
              marketlist_id: marketlistId,
              goods_receipt_id: receiptId,
              goods_receipt_item_id: selectedProduct.receiptItemId
            }
          : { location_id: locationId }),
        quantity: Number(quantity),
        stage,
        reason: reason.trim(),
        wasted_at: new Date(`${date}T12:00:00`).toISOString()
      });
      setQuantity('');
      setReason('');
      setProductId('');
      setProductSearch('');
      setDate(today());
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Gagal mencatat waste.');
    } finally {
      setSaving(false);
    }
  };

  const totalWasteValue = records.reduce((sum, record) => sum + (Number(record.total_cost) || 0), 0);

  const retryWasteSync = async (wasteId) => {
    setSyncingWasteId(wasteId);
    setError('');
    try {
      await api.syncWasteRecord(wasteId);
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Gagal mengirim ulang waste ke Baraja Coffee.');
    } finally {
      setSyncingWasteId('');
    }
  };

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
            <label className="block text-xs font-semibold text-slate-600">Cari nama produk
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={productSearch}
                  onChange={(event) => {
                    setProductSearch(event.target.value);
                    setProductId('');
                  }}
                  placeholder={isReceivingStage ? 'Cari produk dalam Marketlist...' : 'Cari produk di stok...'}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </label>
            <label className="block text-xs font-semibold text-slate-600">Tahap pencatatan
              <select
                value={stage}
                onChange={(event) => {
                  setStage(event.target.value);
                  setMarketlistId('');
                  setReceiptId('');
                  setReceipts([]);
                  setProductId('');
                  setMarketlistPurchases([]);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="received">Saat diterima</option>
                <option value="processing">Saat diolah</option>
                <option value="finished_product">Produk jadi</option>
                <option value="spoiled">Busuk / rusak</option>
                <option value="other">Lainnya</option>
              </select>
            </label>
            {isReceivingStage ? <>
            <label className="block text-xs font-semibold text-slate-600">Pilih Marketlist / PO
              <select
                required
                value={marketlistId}
                onChange={(event) => {
                  const selectedId = event.target.value;
                  setMarketlistId(selectedId);
                  setReceiptId('');
                  setReceipts([]);
                  setProductId('');
                  setMarketlistPurchases([]);
                  if (selectedId) {
                    Promise.all([
                      api.getPurchases(`?marketlist_id=${encodeURIComponent(selectedId)}&limit=500`),
                      api.getReceiptsByMarketlist(selectedId)
                    ])
                      .then(([purchaseResponse, receiptResponse]) => {
                        setMarketlistPurchases(purchaseResponse.data || []);
                        setReceipts((receiptResponse.data || []).filter((receipt) =>
                          receipt.status !== 'cancelled' &&
                          !['verified', 'pending_approval', 'approved', 'posted', 'reversed'].includes(receipt.amphitheater_status)
                        ));
                      })
                      .catch((requestError) => setError(requestError.message || 'Gagal memuat harga pembelian Marketlist.'));
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">
                  {normalizedProductSearch && matchingMarketlists.length === 0
                    ? 'Tidak ada Marketlist dengan produk tersebut'
                    : '-- Pilih Marketlist --'}
                </option>
                {visibleMarketlists.map((marketlist) => {
                  const matchingProducts = (marketlist.items || [])
                    .filter((item) => item.item_status !== 'rejected')
                    .map((item) => item.product_id?.name || item.product_snapshot?.name)
                    .filter((name) => name && (
                      !normalizedProductSearch || name.toLocaleLowerCase('id-ID').includes(normalizedProductSearch)
                    ));
                  return (
                    <option key={marketlist._id} value={marketlist._id}>
                      {marketlist.marketlist_number} · Tgl PO {formatDate(marketlist.date)} · {marketlist.status} · {matchingProducts.join(', ')}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">Pilih penerimaan
              <select
                required
                value={receiptId}
                onChange={(event) => {
                  setReceiptId(event.target.value);
                  setProductId('');
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">-- Pilih penerimaan yang memuat item --</option>
                {receipts.map((receipt) => (
                  <option key={receipt._id} value={receipt._id}>
                    {receipt.receipt_number} · {formatDate(receipt.received_at)} · {receipt.amphitheater_status || 'belum sinkron'}
                  </option>
                ))}
              </select>
            </label>
            {marketlistId && receipts.length === 0 && (
              <p className="text-xs text-amber-700">Tidak ada penerimaan yang masih dapat diubah. Jika sudah diverifikasi atau diposting di Coffee, catat sebagai waste stok.</p>
            )}
            {selectedMarketlist && (
              <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-indigo-950">
                      PO / Marketlist {selectedMarketlist.marketlist_number}
                    </h3>
                    <p className="mt-1 text-[11px] text-indigo-800">
                      Tanggal PO: <strong>{formatDate(selectedMarketlist.date)}</strong>
                      {' · '}
                      Tanggal dibutuhkan: <strong>{formatDate(selectedMarketlist.required_date)}</strong>
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-indigo-700">
                    {selectedMarketlist.status}
                  </span>
                </div>
                <div className="mt-3 border-t border-indigo-200 pt-2">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                    Item dalam PO ({marketlistProducts.length})
                  </p>
                  {marketlistProducts.length === 0 ? (
                    <p className="text-[11px] text-indigo-700">Tidak ada item aktif pada Marketlist ini.</p>
                  ) : (
                    <ul className="max-h-36 space-y-1 overflow-y-auto">
                      {marketlistProducts.map((product) => {
                        const item = selectedMarketlist.items.find(
                          (marketlistItem) => marketlistItem._id === product.marketlistItemId
                        );
                        const unit = product.unit_id?.abbreviation || product.unit_id?.name || 'unit';
                        return (
                          <li
                            key={product.marketlistItemId}
                            className="flex items-start justify-between gap-3 text-[11px] text-indigo-950"
                          >
                            <span className="min-w-0 truncate">{product.name}</span>
                            <span className="shrink-0 text-right text-indigo-700">
                              Minta: {item?.requested_qty ?? 0} {unit}
                              {item?.purchased_qty > 0 && ` · Dibeli: ${item.purchased_qty} ${unit}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            )}
            </> : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Waste akan dikurangi dari stok Baraja Coffee pada lokasi yang dipilih. Stok lokal tidak dikurangi agar tidak terjadi pengurangan ganda.
              </div>
            )}
            {!isReceivingStage && (
              <label className="block text-xs font-semibold text-slate-600">Lokasi stok
                <select
                  required
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih lokasi --</option>
                  {locations.filter((location) => location.is_active !== false).map((location) => (
                    <option key={location._id} value={location._id}>{location.name} {location.code ? `· ${location.code}` : ''}</option>
                  ))}
                </select>
              </label>
            )}
            {normalizedProductSearch && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2 text-[10px] text-blue-800">
                <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {matchingMarketlists.length
                    ? `Ditemukan di ${matchingMarketlists.length} Marketlist. Pilih Marketlist untuk melihat produknya.`
                    : 'Tidak ditemukan di Marketlist yang tersedia.'}
                </span>
              </div>
            )}
            {(isReceivingStage ? marketlistId : true) && (
              <label className="block text-xs font-semibold text-slate-600">
                {isReceivingStage ? 'Produk pada Marketlist' : 'Produk dari stok'}
                <select
                  required
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">{isReceivingStage ? '-- Pilih produk --' : '-- Pilih produk dari stok --'}</option>
                  {visibleProducts.map((product) => (
                    <option key={product.marketlistItemId || product._id} value={product._id}>
                      {product.name} ({isReceivingStage ? product.receiptUnitName : product.unit_id?.abbreviation || product.unit_id?.name || 'unit'})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600">Jumlah waste ({wasteUnitName})
                <input type="number" min="0.000001" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Tanggal
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              <div>Harga beli: <strong>{unitPrice > 0 ? `${money(unitPrice)} / ${wasteUnitName}` : 'Belum tersedia'}</strong></div>
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
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Tanggal / Produk / PO</th><th className="px-4 py-3">Jumlah</th><th className="px-4 py-3">Harga beli/unit</th><th className="px-4 py-3">Nilai</th><th className="px-4 py-3">Alasan</th><th className="px-4 py-3">Sinkronisasi Coffee</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((record) => <tr key={record._id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{record.product_name}<div className="text-[10px] font-normal text-slate-500">{new Date(record.wasted_at).toLocaleDateString('id-ID')} · {record.marketlist_id?.marketlist_number || 'Tanpa Marketlist'}</div></td>
                      <td className="px-4 py-3 text-slate-600">{record.quantity} {record.unit_name}</td>
                      <td className="px-4 py-3 text-slate-600">{money(record.unit_purchase_price)}</td>
                      <td className="px-4 py-3 font-bold text-rose-700">{money(record.total_cost)}</td>
                      <td className="px-4 py-3 text-slate-600">{record.reason}</td>
                      <td className="px-4 py-3">
                        <span className={record.integration_status === 'synced' ? 'font-semibold text-emerald-700' : record.integration_status === 'sync_failed' ? 'font-semibold text-rose-700' : 'font-semibold text-amber-700'}>
                          {record.integration_status === 'synced' ? 'Tersinkron' : record.integration_status === 'sync_failed' ? 'Gagal' : record.integration_status === 'sync_pending' || record.integration_status === 'receipt_sync_pending' ? 'Menunggu' : record.integration_status === 'included_in_receipt' ? 'Di receipt' : 'Belum disinkronkan'}
                        </span>
                        {record.integration_error && <div className="mt-1 max-w-48 text-[10px] text-rose-600">{record.integration_error}</div>}
                        {record.location_id?.name && <div className="text-[10px] text-slate-500">{record.location_id.name}</div>}
                        {record.integration_status === 'sync_failed' && (
                          <button
                            type="button"
                            disabled={syncingWasteId === record._id}
                            onClick={() => retryWasteSync(record._id)}
                            className="mt-1 text-[10px] font-bold text-blue-700 underline disabled:opacity-50"
                          >
                            {syncingWasteId === record._id ? 'Mengirim...' : 'Coba lagi'}
                          </button>
                        )}
                      </td>
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
