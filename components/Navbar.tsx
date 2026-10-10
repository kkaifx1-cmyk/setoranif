'use client';

import React from 'react';
import Image from 'next/image';
import { Download } from 'lucide-react';

interface NavbarProps {
  onOpenSheetModal?: () => void;
  onOpenInstall?: () => void;
  isInstalled?: boolean;
}

export function Navbar({ onOpenInstall, isInstalled }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
        {/* Logo and Institution Branding */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-28 shrink-0 overflow-hidden">
            <Image
              src="https://infosmait.ihsanulfikri.sch.id/wp-content/uploads/2026/10/Untitled-design-768x431.png"
              alt="Logo SMAIT Ihsanul Fikri"
              fill
              sizes="120px"
              className="object-contain object-left"
              priority
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="border-l border-zinc-200 pl-3">
            <h1 className="text-xs font-bold tracking-tight text-zinc-900">
              One Day One Juz
            </h1>
            <p className="text-[11px] font-medium text-zinc-500">
              SMAIT Ihsanul Fikri
            </p>
          </div>
        </div>

        {/* Action Button & Indicator */}
        <div className="flex items-center gap-2">
          {onOpenInstall && !isInstalled && (
            <button
              onClick={onOpenInstall}
              className="flex items-center justify-center p-1.5 rounded-full text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer active:scale-95 shadow-2xs"
              title="Unduh Aplikasi"
              aria-label="Unduh Aplikasi"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
            </button>
          )}

          <span
            className="flex h-2 w-2 rounded-full bg-emerald-600 ring-2 ring-emerald-100"
            title="Sistem siap"
            aria-label="Sistem aktif"
          />
        </div>
      </div>
    </header>
  );
}
