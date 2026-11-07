import './globals.css';
import ClientLayout from '../components/ClientLayout';

export const metadata = {
  title: 'Purchasing Management System - Baraja Store',
  description: 'Integrated Purchasing, Marketlist, Digital Delivery Note, and Profit-Loss Analytics',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

