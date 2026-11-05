'use client';

import { useState } from 'react';
import { api, setStoredUser } from '../../lib/api';
import { Shield, ArrowRight, Lock, Mail } from 'lucide-react';

const demoAccounts = [
  { role: 'Admin', email: 'admin@baraja.com', pass: 'admin123', desc: 'Single Gatekeeper Approval' },
  { role: 'Purchasing', email: 'purchasing@baraja.com', pass: 'purchasing123', desc: 'Pembuat Marketlist' },
  { role: 'Receiver', email: 'receiver@baraja.com', pass: 'receiver123', desc: 'Surat Jalan Digital & Cek Fisik' },
  { role: 'Accounting', email: 'accounting@baraja.com', pass: 'accounting123', desc: 'Verifikasi Invoice & Laba Rugi' },
  { role: 'Management', email: 'management@baraja.com', pass: 'management123', desc: 'Monitoring Laba Rugi & KPI' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e, customEmail = null, customPass = null) => {
    if (e) e.preventDefault();
    const loginEmail = customEmail || email;
    const loginPass = customPass || password;

    setLoading(true);
    setError(null);
    try {
      const res = await api.login(loginEmail, loginPass);
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

          <form onSubmit={(e) => handleLogin(e)} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@baraja.com"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Masuk Akun'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Akses Cepat Testing (RBAC):
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleLogin(null, acc.email, acc.pass)}
                  className="flex items-center justify-between px-3 py-2 text-left bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-100 rounded-lg transition-colors group"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">{acc.role}</span>
                    <span className="text-[11px] text-slate-500 ml-2">({acc.desc})</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                    Pilih &rarr;
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
