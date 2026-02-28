import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Lumina Drop',
  description: 'Minimalist P2P LAN file sharing.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black text-white antialiased dark">
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
