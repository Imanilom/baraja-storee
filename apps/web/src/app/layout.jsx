import './globals.css';
import Sidebar from '../components/Sidebar';

export const metadata = {
  title: 'Purchasing Management System - Baraja Store',
  description: 'Integrated Purchasing, Marketlist, Digital Delivery Note, and Profit-Loss Analytics',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
