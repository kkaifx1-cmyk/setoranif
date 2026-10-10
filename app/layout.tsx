import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Setoran Ngaji Mobile - Google Sheets Sync',
  description: 'Aplikasi pencatatan setoran ngaji otomatis terintegrasi Google Sheets bergaya HeroUI dan shadcn ui untuk smartphone.',
  openGraph: {
    title: 'Setoran Ngaji Mobile - Google Sheets Sync',
    description: 'Aplikasi pencatatan setoran ngaji otomatis terintegrasi Google Sheets bergaya HeroUI dan shadcn ui untuk smartphone.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Setoran Ngaji Mobile - Google Sheets Sync',
    description: 'Aplikasi pencatatan setoran ngaji otomatis terintegrasi Google Sheets bergaya HeroUI dan shadcn ui untuk smartphone.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="id">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
