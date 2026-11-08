'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  Truck,
  Receipt,
  ShoppingCart,
  DollarSign,
  Wallet,
  Users,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import { clearStoredAuth, getStoredUser } from '../lib/api';
import { useEffect, useState } from 'react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'management', 'purchasing', 'receiver', 'accounting', 'leader', 'staff']
  },
  {
    name: 'Marketlist',
    href: '/marketlists',
    icon: ClipboardList,
    roles: ['admin', 'management', 'purchasing', 'receiver', 'accounting', 'leader', 'staff']
  },
  {
    name: 'Approval Marketlist',
    href: '/approvals',
    icon: CheckCircle2,
    roles: ['admin', 'management', 'leader'],
    badge: 'Leader'
  },
  {
    name: 'Surat Jalan / Receiving',
    href: '/receiving',
    icon: Truck,
    roles: ['admin', 'management', 'receiver', 'purchasing', 'leader', 'staff']
  },
  {
    name: 'Transaksi Pembelian',
    href: '/transactions',
    icon: ShoppingCart,
    roles: ['admin', 'management', 'purchasing', 'accounting']
  },
  {
    name: 'Kelola Overhead',
    href: '/overhead',
    icon: Wallet,
    roles: ['admin', 'management', 'accounting']
  },
  {
    name: 'Invoices',
    href: '/invoices',
    icon: Receipt,
    roles: ['admin', 'management', 'accounting']
  },
  {
    name: 'Laba Rugi (OAuth 2)',
    href: '/laba-rugi',
    icon: DollarSign,
    roles: ['admin', 'management', 'accounting'],
    highlight: true
  },
  {
    name: 'Manajemen User & RBAC',
    href: '/users',
    icon: Users,
    roles: ['admin'],
    adminOnly: true
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  if (pathname === '/login') {
    return null;
  }

  const handleLogout = () => {
    clearStoredAuth();
    window.location.href = '/login';
  };

  const filteredNavigation = navigation.filter((item) => {
    if (!item.roles) return true;
    if (!user || !user.role) return true; // Tampilkan default sebelum user ter-load
    return item.roles.includes(user.role);
  });

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20">
          BJ
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-white leading-tight">Baraja Store</h1>
          <p className="text-xs text-slate-400 font-medium">Purchasing System</p>
        </div>
      </div>

      {/* Navigation links with RBAC filtering */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : item.highlight
                  ? 'text-emerald-400 hover:bg-slate-800/80 hover:text-emerald-300'
                  : item.adminOnly
                  ? 'text-amber-300 hover:bg-amber-950/30 hover:text-amber-200'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.name}</span>
              {item.highlight && (
                <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Live
                </span>
              )}
              {item.adminOnly && (
                <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  RBAC
                </span>
              )}
              {item.badge && !item.adminOnly && !item.highlight && (
                <span className="ml-auto text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Session Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Staff User'}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider">
                {user?.role || 'Guest'}
              </span>
              {user?.role === 'admin' && (
                <ShieldCheck className="w-3 h-3 text-amber-400 inline" />
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-800 rounded-md transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
