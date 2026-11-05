'use client';

export default function ErrorPage({ error, reset }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold text-rose-700 mb-2">Terjadi Kesalahan</h2>
      <p className="text-xs text-slate-600 mb-4">{error?.message || 'Gagal memuat halaman.'}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
      >
        Coba Lagi
      </button>
    </div>
  );
}
