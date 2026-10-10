'use client';

import React from 'react';
import { User } from 'firebase/auth';
import { BookOpen, Table, LogOut, CheckCircle2 } from 'lucide-react';
import { SheetMeta } from '@/lib/googleSheets';

interface NavbarProps {
  user: User | null;
  sheetMeta: SheetMeta | null;
  isLoadingSheet: boolean;
  onOpenSheetModal: () => void;
}

export function Navbar({
  user,
  sheetMeta,
  isLoadingSheet,
  onOpenSheetModal,
}: NavbarProps) {
  const accountEmail = user?.email || 'kka.if.x1@gmail.com';
  const displayName = user?.displayName || 'KKA';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Setoran Ngaji
              </h1>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Sheet Aktif
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Sinkronisasi Langsung ke Google Sheets
            </p>
          </div>
        </div>

        {/* Right Action: Sheet status & verified user avatar */}
        <div className="flex items-center gap-2">
          {/* Google Sheet indicator button */}
          <button
            type="button"
            onClick={onOpenSheetModal}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            title="Pengaturan Google Sheet"
            aria-label="Buka pengaturan Google Sheet"
          >
            {isLoadingSheet ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" aria-hidden="true" />
            ) : (
              <Table className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            )}
            <span>Sheet</span>
          </button>

          {/* User Profile Avatar */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-800 text-xs font-bold text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700"
            title={`Akun: ${accountEmail}`}
            aria-label={`Akun ${displayName}`}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
