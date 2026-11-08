'use client';

import { Bell, Search, ShieldCheck, Menu, PanelLeftClose, PanelLeft } from 'lucide-react';
import { getStoredUser } from '../lib/api';
import { useEffect, useState } from 'react';
import { useSidebar } from '../context/SidebarContext';

export default function Navbar({ title = 'Dashboard' }) {
  const [user, setUser] = useState(null);
  const { isOpenMobile, toggleMobileSidebar, isCollapsedDesktop, toggleDesktopSidebar } = useSidebar();

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden focus:outline-none"
          title="Buka / Tutup Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Collapse / Unhide Button */}
        <button
          type="button"
          onClick={toggleDesktopSidebar}
          className="hidden lg:flex p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title={isCollapsedDesktop ? 'Tampilkan Sidebar (Expand)' : 'Sembunyikan Sidebar (Hide)'}
        >
          {isCollapsedDesktop ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">{title}</h2>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari data, nomor ML..."
            className="pl-9 pr-4 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-full w-52 lg:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-[11px] sm:text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="uppercase">{user?.role || 'GUEST'}</span>
        </div>
      </div>
    </header>
  );
}
