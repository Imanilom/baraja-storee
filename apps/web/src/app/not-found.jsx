'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-4xl font-extrabold text-slate-800 mb-2">404</h2>
      <p className="text-sm text-slate-600 mb-4">Halaman tidak ditemukan.</p>
      <Link href="/" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
