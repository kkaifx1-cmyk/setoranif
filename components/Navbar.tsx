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
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-3 py-2">
        {/* Logo and Institution Branding */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative h-9 w-24 shrink-0 overflow-hidden">
            <Image
              src="https://infosmait.ihsanulfikri.sch.id/wp-content/uploads/2026/10/Untitled-design-768x431.png"
              alt="Logo SMAIT Ihsanul Fikri"
              fill
              sizes="100px"
              className="object-contain object-left"
              priority
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="border-l border-zinc-200 pl-2 min-w-0">
            <h1 className="text-xs font-bold tracking-tight text-zinc-900 truncate">
              One Day One Juz
            </h1>
            <p className="text-[10px] font-medium text-zinc-500 truncate">
              SMAIT Ihsanul Fikri
            </p>
          </div>
        </div>

        {/* Action Button: Download (if not installed) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenInstall && !isInstalled && (
            <button
              onClick={onOpenInstall}
              className="flex items-center justify-center p-1.5 rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer active:scale-95 shadow-2xs"
              title="Unduh Aplikasi"
              aria-label="Unduh Aplikasi"
            >
              <Download className="w-4 h-4 text-emerald-700" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
