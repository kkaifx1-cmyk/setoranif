import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#047857',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'One Day One Juz - SMAIT Ihsanul Fikri',
  description:
    "Aplikasi pencatatan setoran tahfidz One Day One Juz Guru & Karyawan SMAIT Ihsanul Fikri tersinkronisasi langsung ke Google Sheets.",
  manifest: '/manifest.json',
  applicationName: 'One Day One Juz',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'One Day One Juz',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'One Day One Juz - SMAIT Ihsanul Fikri',
    description:
      "Aplikasi pencatatan setoran tahfidz One Day One Juz Guru & Karyawan SMAIT Ihsanul Fikri tersinkronisasi langsung ke Google Sheets.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'One Day One Juz - SMAIT Ihsanul Fikri',
    description:
      "Aplikasi pencatatan setoran tahfidz One Day One Juz Guru & Karyawan SMAIT Ihsanul Fikri tersinkronisasi langsung ke Google Sheets.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="light">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-zinc-100 text-zinc-900 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
