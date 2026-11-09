'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import {
  Printer,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  FileText,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';

export default function MarketlistPrintPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [marketlist, setMarketlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Print controls
  const [activeTypeFilter, setActiveTypeFilter] = useState('ALL'); // 'ALL' | 'perishable' | 'groceries'
  const [hideRejected, setHideRejected] = useState(true);
  const [checkedItems, setCheckedItems] = useState({});

  useEffect(() => {
    if (!id) return;
    const fetchML = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getMarketlistById(id);
        if (res?.data) {
          setMarketlist(res.data);
        } else {
          setError('Data marketlist tidak ditemukan.');
        }
      } catch (err) {
        console.error('Failed to load marketlist detail', err);
        setError(err.message || 'Gagal memuat marketlist.');
      } finally {
        setLoading(false);
      }
    };
    fetchML();
  }, [id]);

  const toggleCheck = (itemId) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Group items by item_type ('perishable' vs 'groceries') and then by sub-category
  const groupedData = useMemo(() => {
    if (!marketlist?.items) return { perishable: {}, groceries: {}, stats: {} };

    let items = [...marketlist.items];

    if (hideRejected) {
      items = items.filter((it) => it.item_status !== 'rejected');
    }

    const perishableGroups = {};
    const groceriesGroups = {};

    let totalPerishableAmount = 0;
    let totalGroceriesAmount = 0;
    let totalPerishableItems = 0;
    let totalGroceriesItems = 0;

    items.forEach((item) => {
      // Determine item_type
      const type = (
        item.product_snapshot?.item_type ||
        item.product_id?.item_type ||
        'groceries'
      ).toLowerCase();

      // Determine sub-category name
      const subCategory =
        item.product_snapshot?.category_name ||
        item.product_id?.category_id?.name ||
        'Lainnya / Umum';

      const subtotal = item.subtotal || (item.requested_qty * (item.unit_price || 0));

      if (type === 'perishable') {
        if (!perishableGroups[subCategory]) {
          perishableGroups[subCategory] = [];
        }
        perishableGroups[subCategory].push(item);
        totalPerishableAmount += subtotal;
        totalPerishableItems += 1;
      } else {
        if (!groceriesGroups[subCategory]) {
          groceriesGroups[subCategory] = [];
        }
        groceriesGroups[subCategory].push(item);
        totalGroceriesAmount += subtotal;
        totalGroceriesItems += 1;
      }
    });

    return {
      perishable: perishableGroups,
      groceries: groceriesGroups,
      stats: {
        totalPerishableAmount,
        totalGroceriesAmount,
        totalPerishableItems,
        totalGroceriesItems,
        grandTotal: totalPerishableAmount + totalGroceriesAmount,
        grandItems: totalPerishableItems + totalGroceriesItems
      }
    };
  }, [marketlist, hideRejected]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold text-slate-700">Menyiapkan Lembar Belanja Marketlist...</p>
      </div>
    );
  }

  if (error || !marketlist) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-base font-bold text-slate-800 mb-1">Gagal Memuat Dokumen</h2>
        <p className="text-xs text-slate-500 mb-4">{error || 'Marketlist tidak ditemukan'}</p>
        <Link
          href="/marketlists"
          className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold"
        >
          Kembali ke Daftar
        </Link>
      </div>
    );
  }

  const { perishable, groceries, stats } = groupedData;
  const showPerishable = activeTypeFilter === 'ALL' || activeTypeFilter === 'perishable';
  const showGroceries = activeTypeFilter === 'ALL' || activeTypeFilter === 'groceries';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white print:p-0">
      {/* Print Styles */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 10mm 12mm;
        }
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .page-break-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #777 !important;
            padding: 4px 6px !important;
          }
          .print-table th {
            background-color: #f0f0f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-header-badge {
            border: 1px solid #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Screen Controls Header (Hidden in Print) */}
      <header className="no-print sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Kembali</span>
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1"></div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 leading-tight">
                Cetak Lembar Belanja: {marketlist.marketlist_number}
              </h1>
              <p className="text-[11px] text-slate-500">
                Pemisahan Perishable & Groceries per Sub-Kategori
              </p>
            </div>
          </div>

          {/* Filter Type & Options */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded-md font-bold transition ${
                  activeTypeFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({stats.grandItems})
              </button>
              <button
                type="button"
                onClick={() => setActiveTypeFilter('perishable')}
                className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                  activeTypeFilter === 'perishable'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                🥩 Perishable ({stats.totalPerishableItems})
              </button>
              <button
                type="button"
                onClick={() => setActiveTypeFilter('groceries')}
                className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                  activeTypeFilter === 'groceries'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                🌾 Groceries ({stats.totalGroceriesItems})
              </button>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 select-none">
              <input
                type="checkbox"
                checked={hideRejected}
                onChange={(e) => setHideRejected(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Sembunyikan Ditolak</span>
            </label>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Printable A4 Paper Container */}
      <main className="max-w-4xl mx-auto my-4 sm:my-6 p-4 sm:p-8 bg-white border border-slate-200 rounded-2xl shadow-sm print:m-0 print:p-0 print:border-none print:shadow-none print-full font-sans">
        
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-wider text-slate-900">BARAJA STORE</span>
                <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded uppercase tracking-wider print-header-badge">
                  Purchasing
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight mt-1">
                LEMBAR DAFTAR BELANJA PASAR & GROSIR
              </h2>
              <p className="text-xs text-slate-600">
                Dokumen resmi acuan belanja dan pemeriksaan penerimaan barang
              </p>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-500 block">Nomor Marketlist</span>
              <span className="font-mono font-black text-base sm:text-lg text-slate-900 block">
                {marketlist.marketlist_number}
              </span>
              <span className="inline-block mt-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full uppercase bg-slate-100 text-slate-800 border border-slate-300">
                STATUS: {marketlist.status}
              </span>
            </div>
          </div>

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Tanggal Kebutuhan</span>
              <span className="font-bold text-slate-900">
                {new Date(marketlist.required_date || marketlist.date).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Gudang / Outlet</span>
              <span className="font-bold text-slate-900">
                {marketlist.location_id?.name || 'Gudang Pusat Baraja'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Dibuat Oleh</span>
              <span className="font-bold text-slate-900">
                {marketlist.created_by?.name || '-'} ({marketlist.created_by?.role || 'Staff'})
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Disetujui Oleh</span>
              <span className="font-bold text-slate-900">
                {marketlist.approval?.approved_by?.name || (marketlist.status === 'approved' ? 'Leader/Admin' : '-')}
              </span>
            </div>
          </div>

          {/* Summary Metric Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs print:bg-slate-100">
            <div className="flex items-center gap-4">
              <span>
                Total Item: <strong>{stats.grandItems} barang</strong>
              </span>
              <span>
                🥩 Perishable: <strong>{stats.totalPerishableItems} item</strong> (Rp {stats.totalPerishableAmount.toLocaleString('id-ID')})
              </span>
              <span>
                🌾 Groceries: <strong>{stats.totalGroceriesItems} item</strong> (Rp {stats.totalGroceriesAmount.toLocaleString('id-ID')})
              </span>
            </div>
            <div className="font-black text-emerald-800 text-sm">
              Total Estimasi: Rp {stats.grandTotal.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        {/* SECTION 1: PERISHABLE (BARANG BASAH / SEGAR / PASAR) */}
        {showPerishable && (
          <div className="mb-6 page-break-avoid">
            {/* Main Header for Perishable */}
            <div className="flex items-center justify-between bg-rose-700 text-white px-3 py-2 rounded-t-lg font-bold text-xs uppercase tracking-wider print:bg-slate-800">
              <div className="flex items-center gap-2">
                <span>🥩 KATEGORI UTAMA: PERISHABLE (BARANG BASAH / SEGAR / PASAR)</span>
              </div>
              <span>{stats.totalPerishableItems} Item • Subtotal: Rp {stats.totalPerishableAmount.toLocaleString('id-ID')}</span>
            </div>

            {Object.keys(perishable).length === 0 ? (
              <div className="p-4 border border-t-0 border-rose-200 text-center text-xs text-slate-500 italic rounded-b-lg">
                Tidak ada item kategori Perishable pada pengajuan ini.
              </div>
            ) : (
              <div className="border border-t-0 border-slate-300 rounded-b-lg divide-y divide-slate-200">
                {Object.entries(perishable).map(([subCatName, subItems]) => {
                  const subTotal = subItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
                  return (
                    <div key={subCatName} className="p-3 page-break-avoid">
                      {/* Sub-Category Title */}
                      <div className="flex items-center justify-between bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-md mb-2 text-xs font-bold text-rose-950 print:bg-slate-100 print:border-slate-300 print:text-black">
                        <span className="flex items-center gap-1.5">
                          <span>🥬 Sub-Kategori:</span>
                          <span className="uppercase">{subCatName}</span>
                          <span className="text-[10px] font-normal text-slate-500">({subItems.length} item)</span>
                        </span>
                        <span>Estimasi: Rp {subTotal.toLocaleString('id-ID')}</span>
                      </div>

                      {/* Items Table */}
                      <table className="w-full text-left text-xs print-table border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-300">
                            <th className="p-1.5 text-center w-8">Cek</th>
                            <th className="p-1.5 text-center w-8">No</th>
                            <th className="p-1.5">Nama Barang & Spesifikasi</th>
                            <th className="p-1.5 text-center w-24">Target Qty</th>
                            <th className="p-1.5 text-right w-24">Est. Harga</th>
                            <th className="p-1.5 text-right w-24">Est. Subtotal</th>
                            <th className="p-1.5 text-center w-24">Qty Aktual</th>
                            <th className="p-1.5 text-center w-28">Harga Aktual</th>
                            <th className="p-1.5 w-32">Catatan Belanja</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {subItems.map((it, idx) => {
                            const isChecked = checkedItems[it._id];
                            const unitName = it.product_snapshot?.unit_name || it.product_id?.unit_id?.abbreviation || 'pcs';
                            const productName = it.product_snapshot?.name || it.product_id?.name;
                            const isRejected = it.item_status === 'rejected';

                            return (
                              <tr
                                key={it._id}
                                className={`hover:bg-slate-50 transition-colors ${
                                  isChecked ? 'bg-emerald-50/50' : ''
                                } ${isRejected ? 'opacity-50 line-through' : ''}`}
                              >
                                <td className="p-1.5 text-center cursor-pointer no-print" onClick={() => toggleCheck(it._id)}>
                                  {isChecked ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-600 inline" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-300 inline" />
                                  )}
                                </td>
                                <td className="p-1.5 text-center font-bold print:table-cell hidden print:visible">
                                  [ &nbsp; ]
                                </td>
                                <td className="p-1.5 text-center font-bold text-slate-500">{idx + 1}</td>
                                <td className="p-1.5 font-bold text-slate-900">
                                  <div>{productName}</div>
                                  {(it.notes || it.product_snapshot?.specification) && (
                                    <div className="text-[10px] font-normal text-slate-500 italic">
                                      {it.notes || it.product_snapshot?.specification}
                                    </div>
                                  )}
                                  {isRejected && (
                                    <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                      Ditolak: {it.rejection_reason || 'Tidak disetujui'}
                                    </span>
                                  )}
                                </td>
                                <td className="p-1.5 text-center font-bold text-slate-800">
                                  {it.requested_qty} {unitName}
                                </td>
                                <td className="p-1.5 text-right font-medium text-slate-700">
                                  Rp {(it.unit_price || 0).toLocaleString('id-ID')}
                                </td>
                                <td className="p-1.5 text-right font-bold text-slate-900">
                                  Rp {(it.subtotal || 0).toLocaleString('id-ID')}
                                </td>
                                {/* Blank columns for shopper physical writing / verification */}
                                <td className="p-1.5 text-center border-l border-slate-200">
                                  <div className="h-5 border-b border-dashed border-slate-400 print:border-slate-500"></div>
                                </td>
                                <td className="p-1.5 text-center border-l border-slate-200">
                                  <div className="h-5 border-b border-dashed border-slate-400 print:border-slate-500"></div>
                                </td>
                                <td className="p-1.5 border-l border-slate-200">
                                  <div className="h-5 border-b border-dashed border-slate-400 print:border-slate-500"></div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: GROCERIES (BARANG KERING / KEMASAN / GROSIR) */}
        {showGroceries && (
          <div className="mb-6 page-break-avoid">
            {/* Main Header for Groceries */}
            <div className="flex items-center justify-between bg-emerald-800 text-white px-3 py-2 rounded-t-lg font-bold text-xs uppercase tracking-wider print:bg-slate-800">
              <div className="flex items-center gap-2">
                <span>🌾 KATEGORI UTAMA: GROCERIES (BARANG KERING / KEMASAN / GROSIR)</span>
              </div>
              <span>{stats.totalGroceriesItems} Item • Subtotal: Rp {stats.totalGroceriesAmount.toLocaleString('id-ID')}</span>
            </div>

            {Object.keys(groceries).length === 0 ? (
              <div className="p-4 border border-t-0 border-emerald-200 text-center text-xs text-slate-500 italic rounded-b-lg">
                Tidak ada item kategori Groceries pada pengajuan ini.
              </div>
            ) : (
              <div className="border border-t-0 border-slate-300 rounded-b-lg divide-y divide-slate-200">
                {Object.entries(groceries).map(([subCatName, subItems]) => {
                  const subTotal = subItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
                  return (
                    <div key={subCatName} className="p-3 page-break-avoid">
                      {/* Sub-Category Title */}
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md mb-2 text-xs font-bold text-emerald-950 print:bg-slate-100 print:border-slate-300 print:text-black">
                        <span className="flex items-center gap-1.5">
                          <span>📦 Sub-Kategori:</span>
                          <span className="uppercase">{subCatName}</span>
                          <span className="text-[10px] font-normal text-slate-500">({subItems.length} item)</span>
                        </span>
                        <span>Estimasi: Rp {subTotal.toLocaleString('id-ID')}</span>
                      </div>

                      {/* Items Table */}
                      <table className="w-full text-left text-xs print-table border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-300">
                            <th className="p-1.5 text-center w-8">Cek</th>
                            <th className="p-1.5 text-center w-8">No</th>
                            <th className="p-1.5">Nama Barang & Spesifikasi</th>
                            <th className="p-1.5 text-center w-24">Target Qty</th>
                            <th className="p-1.5 text-right w-24">Est. Harga</th>
                            <th className="p-1.5 text-right w-24">Est. Subtotal</th>
                            <th className="p-1.5 text-center w-24">Qty Aktual</th>
                            <th className="p-1.5 text-center w-28">Harga Aktual</th>
                            <th className="p-1.5 w-32">Catatan Belanja</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {subItems.map((it, idx) => {
                            const isChecked = checkedItems[it._id];
                            const unitName = it.product_snapshot?.unit_name || it.product_id?.unit_id?.abbreviation || 'pcs';
                            const productName = it.product_snapshot?.name || it.product_id?.name;
                            const isRejected = it.item_status === 'rejected';

                            return (
                              <tr
                                key={it._id}
                                className={`hover:bg-slate-50 transition-colors ${
                                  isChecked ? 'bg-emerald-50/50' : ''
                                } ${isRejected ? 'opacity-50 line-through' : ''}`}
                              >
                                <td className="p-1.5 text-center cursor-pointer no-print" onClick={() => toggleCheck(it._id)}>
                                  {isChecked ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-600 inline" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-300 inline" />
                                  )}
                                </td>
                                <td className="p-1.5 text-center font-bold print:table-cell hidden print:visible">
                                  [ &nbsp; ]
                                </td>
                                <td className="p-1.5 text-center font-bold text-slate-500">{idx + 1}</td>
                                <td className="p-1.5 font-bold text-slate-900">
                                  <div>{productName}</div>
                                  {(it.notes || it.product_snapshot?.specification) && (
                                    <div className="text-[10px] font-normal text-slate-500 italic">
                                      {it.notes || it.product_snapshot?.specification}
                                    </div>
                                  )}
                                  {isRejected && (
                                    <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                      Ditolak: {it.rejection_reason || 'Tidak disetujui'}
                                    </span>
                                  )}
                                </td>
                                <td className="p-1.5 text-center font-bold text-slate-800">
                                  {it.requested_qty} {unitName}
                                </td>
                                <td className="p-1.5 text-right font-medium text-slate-700">
                                  Rp {(it.unit_price || 0).toLocaleString('id-ID')}
                                </td>
                                <td className="p-1.5 text-right font-bold text-slate-900">
                                  Rp {(it.subtotal || 0).toLocaleString('id-ID')}
                                </td>
                                {/* Blank columns for shopper physical writing / verification */}
                                <td className="p-1.5 text-center border-l border-slate-200">
                                  <div className="h-5 border-b border-dashed border-slate-400 print:border-slate-500"></div>
                                </td>
                                <td className="p-1.5 text-center border-l border-slate-200">
                                  <div className="h-5 border-b border-dashed border-slate-400 print:border-slate-500"></div>
                                </td>
                                <td className="p-1.5 border-l border-slate-200">
                                  <div className="h-5 border-b border-dashed border-slate-400 print:border-slate-500"></div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Notes from Creator */}
        {marketlist.notes && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs print:bg-slate-50 print:border-slate-300 page-break-avoid">
            <span className="font-bold text-amber-900 print:text-black block mb-0.5">
              📌 Catatan Khusus Pengajuan:
            </span>
            <p className="text-slate-700 print:text-black italic">{marketlist.notes}</p>
          </div>
        )}

        {/* Signatures / Lembar Pengesahan */}
        <div className="mt-6 pt-4 border-t-2 border-slate-300 page-break-avoid">
          <p className="text-[10px] text-slate-500 text-center mb-3">
            Tanda tangan di bawah ini menyatakan daftar belanja telah diajukan, disetujui, dibelanjakan, dan diterima sesuai SOP.
          </p>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="border border-slate-300 p-2 rounded-lg">
              <span className="text-[10px] font-bold text-slate-600 uppercase block mb-12">
                Dibuat Oleh (Staff)
              </span>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 truncate">
                {marketlist.created_by?.name || '(..........................)'}
              </div>
            </div>

            <div className="border border-slate-300 p-2 rounded-lg">
              <span className="text-[10px] font-bold text-slate-600 uppercase block mb-12">
                Disetujui (Leader/SPV)
              </span>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 truncate">
                {marketlist.approval?.approved_by?.name || '(..........................)'}
              </div>
            </div>

            <div className="border border-slate-300 p-2 rounded-lg">
              <span className="text-[10px] font-bold text-slate-600 uppercase block mb-12">
                Petugas Belanja (Shopper)
              </span>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-900">
                (..........................)
              </div>
            </div>

            <div className="border border-slate-300 p-2 rounded-lg">
              <span className="text-[10px] font-bold text-slate-600 uppercase block mb-12">
                Diterima Gudang (Receiving)
              </span>
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-900">
                (..........................)
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

