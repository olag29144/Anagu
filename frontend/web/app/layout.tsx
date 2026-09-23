import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anagu Land Administration',
  description: 'Permissioned full-stack land title registration and administration system for Nigeria',
  openGraph: {
    title: 'Anagu Land Administration',
    description: 'Permissioned full-stack land title registration and administration system for Nigeria',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#020305] text-[#F4F7FB] antialiased selection:bg-[#38BDF8]/20 selection:text-[#67E8F9]">
        {children}
      </body>
    </html>
  );
}
