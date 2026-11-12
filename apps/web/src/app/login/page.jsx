'use client';

import { useState } from 'react';
import { api, setStoredUser } from '../../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();

    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      if (res.data?.tokens && res.data?.user) {
        setStoredUser(res.data.user, res.data.tokens.accessToken);
        window.location.href = '/';
      }
    } catch (err) {
      setError(err.message || 'Login gagal, periksa email dan password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-emerald-500 items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-emerald-500/20">
            BJ
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Baraja Store Purchasing</h1>
          <p className="text-xs text-slate-400">Integrated Purchasing Management & Profit-Loss System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-slate-800">Masuk ke Sistem</h2>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@baraja.id"
                required
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm shadow-emerald-600/20"
            >
              {loading ? 'Memproses...' : 'Masuk Akun'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
