'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SidebarContext = createContext({
  isOpenMobile: false,
  isCollapsedDesktop: false,
  toggleMobileSidebar: () => {},
  closeMobileSidebar: () => {},
  toggleDesktopSidebar: () => {}
});

export function SidebarProvider({ children }) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isCollapsedDesktop, setIsCollapsedDesktop] = useState(false);
  const pathname = usePathname();

  // Otomatis tutup sidebar di mobile setiap kali berpindah halaman
  useEffect(() => {
    setIsOpenMobile(false);
  }, [pathname]);

  const toggleMobileSidebar = () => {
    setIsOpenMobile((prev) => !prev);
  };

  const closeMobileSidebar = () => {
    setIsOpenMobile(false);
  };

  const toggleDesktopSidebar = () => {
    setIsCollapsedDesktop((prev) => !prev);
  };

  return (
    <SidebarContext.Provider
      value={{
        isOpenMobile,
        isCollapsedDesktop,
        toggleMobileSidebar,
        closeMobileSidebar,
        toggleDesktopSidebar
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
