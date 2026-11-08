'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { SidebarProvider } from '../context/SidebarContext';

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <main className="min-h-screen w-full bg-slate-900">{children}</main>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-slate-50 relative">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
