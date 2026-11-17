import type { Metadata } from 'next';
import './globals.css';
import { MapsContextProvider } from '@/components/gis/MapsContextProvider';

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
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="min-h-screen bg-[#020305] text-[#F4F7FB] antialiased selection:bg-[#38BDF8]/20 selection:text-[#67E8F9]">
        <MapsContextProvider>{children}</MapsContextProvider>
      </body>
    </html>
  );
}