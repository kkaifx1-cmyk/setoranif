'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => Promise<boolean>;
  isInstallable: boolean;
  isInstalled: boolean;
}

export function AndroidInstallModal({
  isOpen,
  onClose,
  onInstall,
  isInstallable,
  isInstalled,
}: AndroidInstallModalProps) {
  const [showFallbackHint, setShowFallbackHint] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await onInstall();
      if (success) {
        onClose();
        return;
      }
    }
    // If browser didn't open prompt or in manual mode, show brief guidance
    setShowFallbackHint(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-900/60 backdrop-blur-xs">
        {/* Backdrop click */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-white border border-zinc-200 shadow-xs flex items-center justify-center overflow-hidden p-1 shrink-0">
                <Image
                  src="https://infosmait.ihsanulfikri.sch.id/wp-content/uploads/2026/10/Untitled-design-768x431.png"
                  alt="SMAIT Ihsanul Fikri"
                  width={40}
                  height={22}
                  className="object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm leading-tight">
                  Unduh Aplikasi
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  One Day One Juz
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="px-5 py-4">
            {isInstalled ? (
              <div className="py-2 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-900 text-sm">
                    Aplikasi Sudah Terpasang
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Aplikasi One Day One Juz sudah tersedia di layar utama perangkat Anda.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Single direct button */}
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-semibold text-sm shadow-sm transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Aplikasi</span>
                </button>

                {showFallbackHint && (
                  <p className="text-center text-[11px] text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 leading-snug">
                    Ketuk menu peramban (<strong className="text-zinc-900">⋮</strong>) lalu pilih <strong className="text-zinc-900">&quot;Tambahkan ke Layar Utama&quot;</strong>.
                  </p>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
                >
                  Tetap di Website
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
