'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Smartphone,
  CheckCircle2,
  Sparkles,
  Download,
  Share2,
  MoreVertical,
  Layers,
  ArrowRight,
} from 'lucide-react';
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
  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await onInstall();
      if (success) {
        onClose();
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-900/60 backdrop-blur-xs">
        {/* Backdrop click */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-100 bg-linear-to-r from-emerald-50/60 to-white">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-xl bg-white border border-zinc-200 shadow-xs flex items-center justify-center overflow-hidden p-1">
                <Image
                  src="https://infosmait.ihsanulfikri.sch.id/wp-content/uploads/2026/10/Untitled-design-768x431.png"
                  alt="SMAIT Ihsanul Fikri"
                  width={44}
                  height={24}
                  className="object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 text-base leading-tight">
                  Pasang di Android
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  One Day One Juz - SMAIT Ihsanul Fikri
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
          <div className="p-5 overflow-y-auto space-y-4 text-sm text-zinc-700">
            {isInstalled ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-emerald-900">
                  Aplikasi Sudah Terpasang!
                </h4>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Aplikasi Setoran IF sudah berada di layar utama perangkat Anda. Anda dapat langsung membukanya tanpa browser.
                </p>
              </div>
            ) : (
              <>
                {/* Keunggulan PWA Android */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="font-semibold text-zinc-900 block flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Ringan & Cepat
                    </span>
                    <span className="text-zinc-500 mt-0.5 block">
                      Ukuran kurang dari 1 MB, hemat memori HP.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="font-semibold text-zinc-900 block flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-600" /> Bebas Ribet
                    </span>
                    <span className="text-zinc-500 mt-0.5 block">
                      Otomatis update tanpa perlu unduh file APK baru.
                    </span>
                  </div>
                </div>

                {/* Tombol Aksi Utama */}
                {isInstallable && (
                  <button
                    onClick={handleInstallClick}
                    className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-sm shadow-sm transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Pasang Aplikasi Sekarang
                  </button>
                )}

                {/* Panduan Langkah Pemasangan di Android Chrome */}
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                  <p className="font-medium text-xs text-zinc-900 uppercase tracking-wider">
                    Cara Pasang via Browser Chrome (Android)
                  </p>

                  <div className="space-y-2.5 text-xs text-zinc-600">
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                      <div className="leading-snug">
                        Ketuk tombol <strong className="text-zinc-800">titik tiga ( <MoreVertical className="w-3 h-3 inline text-zinc-700" /> )</strong> di sudut kanan atas peramban Google Chrome.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <div className="leading-snug">
                        Pilih menu <strong className="text-zinc-800">&ldquo;Tambahkan ke Layar Utama&rdquo;</strong> (atau <strong className="text-zinc-800">&ldquo;Instal aplikasi&rdquo;</strong>).
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </div>
                      <div className="leading-snug">
                        Konfirmasi dengan mengetuk <strong className="text-zinc-800">&ldquo;Instal&rdquo;</strong>. Ikon aplikasi langsung hadir di layar utama HP Anda!
                      </div>
                    </div>
                  </div>
                </div>

                {/* Catatan untuk pengguna iOS jika dibuka di iPhone */}
                <div className="text-[11px] text-zinc-500 bg-zinc-100/60 p-2.5 rounded-lg border border-zinc-200">
                  <span className="font-medium text-zinc-700">Untuk Pengguna iPhone:</span> Ketuk ikon Bagikan (<Share2 className="w-3 h-3 inline text-zinc-600" />) di Safari, lalu pilih &ldquo;Tambahkan ke Layar Utama&rdquo;.
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-200/60 transition"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
