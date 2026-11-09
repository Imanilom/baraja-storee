'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import {
  Printer,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';

export default function MarketlistPrintPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [marketlist, setMarketlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter: Semua / Perishable / Groceries
  const [activeTypeFilter, setActiveTypeFilter] = useState('ALL'); // 'ALL' | 'perishable' | 'groceries'

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

  // Group items by item_type ('perishable' vs 'groceries') and then by sub-category
  const groupedData = useMemo(() => {
    if (!marketlist?.items) return { perishable: {}, groceries: {}, stats: {} };

    // Automatically filter out rejected items
    const items = marketlist.items.filter((it) => it.item_status !== 'rejected');

    const perishableGroups = {};
    const groceriesGroups = {};

    let totalPerishableAmount = 0;
    let totalGroceriesAmount = 0;
    let totalPerishableItems = 0;
    let totalGroceriesItems = 0;

    items.forEach((item) => {
      const type = (
        item.product_snapshot?.item_type ||
        item.product_id?.item_type ||
        'groceries'
      ).toLowerCase();

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
  }, [marketlist]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
        <p className="text-xs font-semibold text-slate-700">Menyiapkan Lembar Belanja Ringkas...</p>
      </div>
    );
  }

  if (error || !marketlist) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
        <h2 className="text-sm font-bold text-slate-800 mb-1">Gagal Memuat Dokumen</h2>
        <p className="text-xs text-slate-500 mb-3">{error || 'Marketlist tidak ditemukan'}</p>
        <Link
          href="/marketlists"
          className="px-3.5 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold"
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
      {/* Print Styles: Ultra-Compact & Paper-Saving */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 9.5px !important;
            line-height: 1.25 !important;
            margin: 0 !important;
            padding: 0 !important;
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
          .print-table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #555 !important;
            padding: 2.5px 4px !important;
            font-size: 9px !important;
          }
          .print-table th {
            background-color: #e5e5e5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-weight: bold !important;
          }
          .print-group-header {
            background-color: #333333 !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-weight: bold !important;
            padding: 3px 5px !important;
          }
          .print-subgroup-header {
            background-color: #f0f0f0 !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-weight: bold !important;
            padding: 2.5px 5px !important;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Screen Controls Header (Hidden in Print) */}
      <header className="no-print sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1"></div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold text-slate-900">
                Format Cetak Ringkas (Hemat Kertas)
              </h1>
              <p className="text-[10px] text-slate-500">
                {marketlist.marketlist_number} • {stats.grandItems} barang
              </p>
            </div>
          </div>

          {/* Filter Type & Options */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded-md font-bold transition text-[11px] ${
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
                className={`px-2 py-1 rounded-md font-bold transition text-[11px] flex items-center gap-1 ${
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
                className={`px-2 py-1 rounded-md font-bold transition text-[11px] flex items-center gap-1 ${
                  activeTypeFilter === 'groceries'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                🌾 Groceries ({stats.totalGroceriesItems})
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Printable Container: Single-Strip Header + Unified Dense Table */}
      <main className="max-w-4xl mx-auto my-3 sm:my-5 p-3 sm:p-5 bg-white border border-slate-200 rounded-xl shadow-sm print:m-0 print:p-0 print:border-none print:shadow-none print-full font-sans text-xs">
        
        {/* COMPACT SINGLE-STRIP HEADER (SAVES 70% VERTICAL SPACE) */}
        <div className="border-b-2 border-slate-900 pb-2 mb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-wider text-slate-900">BARAJA STORE</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-900 text-white rounded">
                  PURCHASING
                </span>
                <span className="font-bold text-xs text-slate-700">| DAFTAR BELANJA PASAR & GROSIR</span>
              </div>
            </div>

            <div className="text-right">
              <span className="font-mono font-black text-sm text-slate-900 mr-2">
                {marketlist.marketlist_number}
              </span>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-slate-100 border border-slate-400 rounded">
                {marketlist.status}
              </span>
            </div>
          </div>

          {/* Compact 1-line Meta Strip */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mt-1.5 pt-1.5 border-t border-slate-300 text-[10px] text-slate-700 print:text-black">
            <div>
              <strong>Tgl Kebutuhan:</strong> {new Date(marketlist.required_date || marketlist.date).toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </div>
            <div>
              <strong>Gudang:</strong> {marketlist.location_id?.name || 'Gudang Pusat'}
            </div>
            <div>
              <strong>Pemohon:</strong> {marketlist.created_by?.name || '-'}
            </div>
            <div>
              <strong>Disetujui:</strong> {marketlist.approval?.approved_by?.name || (marketlist.status === 'approved' ? 'Leader' : '-')}
            </div>
            <div className="font-bold text-slate-900 print:text-black">
              Total: {stats.grandItems} Item (Est. Rp {stats.grandTotal.toLocaleString('id-ID')})
            </div>
          </div>
        </div>

        {/* UNIFIED DENSE TABLE (FITS MAXIMUM ITEMS ON ONE PAGE) */}
        <table className="w-full text-left print-table border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-100 text-slate-800 uppercase font-bold text-[9px] border-b border-slate-400">
              <th className="p-1 text-center w-7">Cek</th>
              <th className="p-1 text-center w-6">No</th>
              <th className="p-1">Nama Barang & Spesifikasi</th>
              <th className="p-1 text-center w-20">Target Qty</th>
              <th className="p-1 text-right w-20">Est. Harga</th>
              <th className="p-1 text-right w-20">Est. Total</th>
              <th className="p-1 text-center w-20">Qty Beli</th>
              <th className="p-1 text-center w-24">Harga Beli</th>
              <th className="p-1 w-28">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {/* SECTION: PERISHABLE */}
            {showPerishable && (
              <>
                <tr className="print-group-header bg-slate-800 text-white font-bold">
                  <td colSpan="9" className="p-1 text-[10px] uppercase tracking-wide">
                    🥩 KATEGORI: PERISHABLE (BARANG BASAH / SEGAR / PASAR) — {stats.totalPerishableItems} Item • Subtotal: Rp {stats.totalPerishableAmount.toLocaleString('id-ID')}
                  </td>
                </tr>

                {Object.keys(perishable).length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-2 text-center text-slate-400 italic">
                      Tidak ada barang perishable
                    </td>
                  </tr>
                ) : (
                  Object.entries(perishable).map(([subCatName, subItems]) => {
                    const subTotal = subItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
                    return (
                      <React.Fragment key={`perish-${subCatName}`}>
                        {/* Sub-category Divider Row */}
                        <tr className="print-subgroup-header bg-rose-50 text-rose-950 font-bold border-y border-slate-300">
                          <td colSpan="9" className="px-1.5 py-0.5 text-[9.5px]">
                            🥬 {subCatName} ({subItems.length} item) — Subtotal: Rp {subTotal.toLocaleString('id-ID')}
                          </td>
                        </tr>

                        {/* Items */}
                        {subItems.map((it, idx) => {
                          const unit = it.product_snapshot?.unit_name || it.product_id?.unit_id?.abbreviation || 'pcs';
                          const name = it.product_snapshot?.name || it.product_id?.name;
                          return (
                            <tr key={it._id} className="hover:bg-slate-50">
                              <td className="p-1 text-center font-mono font-bold text-slate-400">
                                [ &nbsp; ]
                              </td>
                              <td className="p-1 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="p-1 font-bold text-slate-900">
                                <span>{name}</span>
                                {(it.notes || it.product_snapshot?.specification) && (
                                  <span className="text-[9px] font-normal text-slate-500 italic ml-1">
                                    ({it.notes || it.product_snapshot?.specification})
                                  </span>
                                )}
                              </td>
                              <td className="p-1 text-center font-bold text-slate-800 whitespace-nowrap">
                                {it.requested_qty} {unit}
                              </td>
                              <td className="p-1 text-right text-slate-700 whitespace-nowrap">
                                Rp {(it.unit_price || 0).toLocaleString('id-ID')}
                              </td>
                              <td className="p-1 text-right font-bold text-slate-900 whitespace-nowrap">
                                Rp {(it.subtotal || 0).toLocaleString('id-ID')}
                              </td>
                              {/* Blank Columns for Hand Writing */}
                              <td className="p-1 text-center border-l border-slate-300"></td>
                              <td className="p-1 text-center border-l border-slate-300"></td>
                              <td className="p-1 border-l border-slate-300"></td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </>
            )}

            {/* SECTION: GROCERIES */}
            {showGroceries && (
              <>
                <tr className="print-group-header bg-slate-800 text-white font-bold">
                  <td colSpan="9" className="p-1 text-[10px] uppercase tracking-wide">
                    🌾 KATEGORI: GROCERIES (BARANG KERING / KEMASAN / GROSIR) — {stats.totalGroceriesItems} Item • Subtotal: Rp {stats.totalGroceriesAmount.toLocaleString('id-ID')}
                  </td>
                </tr>

                {Object.keys(groceries).length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-2 text-center text-slate-400 italic">
                      Tidak ada barang groceries
                    </td>
                  </tr>
                ) : (
                  Object.entries(groceries).map(([subCatName, subItems]) => {
                    const subTotal = subItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
                    return (
                      <React.Fragment key={`groc-${subCatName}`}>
                        {/* Sub-category Divider Row */}
                        <tr className="print-subgroup-header bg-emerald-50 text-emerald-950 font-bold border-y border-slate-300">
                          <td colSpan="9" className="px-1.5 py-0.5 text-[9.5px]">
                            📦 {subCatName} ({subItems.length} item) — Subtotal: Rp {subTotal.toLocaleString('id-ID')}
                          </td>
                        </tr>

                        {/* Items */}
                        {subItems.map((it, idx) => {
                          const unit = it.product_snapshot?.unit_name || it.product_id?.unit_id?.abbreviation || 'pcs';
                          const name = it.product_snapshot?.name || it.product_id?.name;
                          return (
                            <tr key={it._id} className="hover:bg-slate-50">
                              <td className="p-1 text-center font-mono font-bold text-slate-400">
                                [ &nbsp; ]
                              </td>
                              <td className="p-1 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="p-1 font-bold text-slate-900">
                                <span>{name}</span>
                                {(it.notes || it.product_snapshot?.specification) && (
                                  <span className="text-[9px] font-normal text-slate-500 italic ml-1">
                                    ({it.notes || it.product_snapshot?.specification})
                                  </span>
                                )}
                              </td>
                              <td className="p-1 text-center font-bold text-slate-800 whitespace-nowrap">
                                {it.requested_qty} {unit}
                              </td>
                              <td className="p-1 text-right text-slate-700 whitespace-nowrap">
                                Rp {(it.unit_price || 0).toLocaleString('id-ID')}
                              </td>
                              <td className="p-1 text-right font-bold text-slate-900 whitespace-nowrap">
                                Rp {(it.subtotal || 0).toLocaleString('id-ID')}
                              </td>
                              {/* Blank Columns for Hand Writing */}
                              <td className="p-1 text-center border-l border-slate-300"></td>
                              <td className="p-1 text-center border-l border-slate-300"></td>
                              <td className="p-1 border-l border-slate-300"></td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </>
            )}
          </tbody>
        </table>

        {/* Optional Notes from Creator */}
        {marketlist.notes && (
          <div className="mt-1.5 p-1.5 bg-slate-50 border border-slate-300 rounded text-[9.5px] print:bg-white">
            <strong>Catatan:</strong> <span className="italic">{marketlist.notes}</span>
          </div>
        )}

        {/* ULTRA-COMPACT 1-ROW SIGNATURE STRIP (SAVES 100px VERTICAL SPACE) */}
        <div className="mt-3 pt-2 border-t border-slate-400">
          <div className="grid grid-cols-4 gap-2 text-center text-[9px]">
            <div className="border border-slate-300 p-1 rounded">
              <span className="text-[8.5px] text-slate-500 uppercase font-bold block mb-6">
                Diajukan (Staff)
              </span>
              <div className="border-t border-slate-400 pt-0.5 font-bold truncate">
                {marketlist.created_by?.name || '(...................)'}
              </div>
            </div>

            <div className="border border-slate-300 p-1 rounded">
              <span className="text-[8.5px] text-slate-500 uppercase font-bold block mb-6">
                Disetujui (Leader)
              </span>
              <div className="border-t border-slate-400 pt-0.5 font-bold truncate">
                {marketlist.approval?.approved_by?.name || '(...................)'}
              </div>
            </div>

            <div className="border border-slate-300 p-1 rounded">
              <span className="text-[8.5px] text-slate-500 uppercase font-bold block mb-6">
                Petugas Belanja
              </span>
              <div className="border-t border-slate-400 pt-0.5 font-bold">
                (...................)
              </div>
            </div>

            <div className="border border-slate-300 p-1 rounded">
              <span className="text-[8.5px] text-slate-500 uppercase font-bold block mb-6">
                Penerima (Receiving)
              </span>
              <div className="border-t border-slate-400 pt-0.5 font-bold">
                (...................)
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
