'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ExternalLink,
  Plus,
  X,
  CheckCircle2,
  FileSpreadsheet,
  Copy,
  Info,
} from 'lucide-react';
import { SheetMeta } from '@/lib/googleSheets';

interface SheetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetMeta: SheetMeta | null;
  isLoading: boolean;
  onCreateNewSheet: () => void;
  onSelectCustomSheet: (sheetId: string) => void;
}

export function SheetConfigModal({
  isOpen,
  onClose,
  sheetMeta,
  isLoading,
  onCreateNewSheet,
  onSelectCustomSheet,
}: SheetConfigModalProps) {
  const [customInput, setCustomInput] = useState<string>('');
  const [copiedId, setCopiedId] = useState<boolean>(false);

  const handleCopyId = () => {
    if (!sheetMeta) return;
    navigator.clipboard.writeText(sheetMeta.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleApplyCustomId = () => {
    if (!customInput.trim()) return;
    let cleanId = customInput.trim();
    // Support pasting full Google sheet URL
    const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      cleanId = match[1];
    }
    onSelectCustomSheet(cleanId);
    setCustomInput('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="modal-title" className="text-sm font-bold text-zinc-900">
                    Google Sheets Tersimpan
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Akun: kka.if.x1@gmail.com
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                aria-label="Tutup jendela pengaturan"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Current Connected Sheet Info */}
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  Status Penyimpanan
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Aktif &amp; Terhubung
                </span>
              </div>

              {sheetMeta ? (
                <div className="mt-2 space-y-2">
                  <div className="text-sm font-bold text-zinc-900">
                    {sheetMeta.title}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <span className="truncate font-mono">ID: {sheetMeta.id}</span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                    >
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      <span>{copiedId ? 'Tersalin' : 'Salin ID'}</span>
                    </button>
                  </div>

                  <div className="pt-1">
                    <a
                      href={sheetMeta.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Buka Google Sheets di Tab Baru</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  <div className="text-sm font-bold text-zinc-900">
                    Setoran Ngaji Santri
                  </div>
                  <p className="text-xs text-zinc-500">
                    Spreadsheet akan otomatis terhubung saat Anda mencatat setoran santri.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={onCreateNewSheet}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2 text-xs font-semibold text-zinc-800 shadow-xs transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>Buat Google Sheet Baru</span>
              </button>

              {/* Or link existing sheet ID */}
              <div className="pt-1">
                <label htmlFor="custom-sheet-input" className="block text-xs font-medium text-zinc-700">
                  Tautkan Google Sheet lain (ID atau URL):
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    id="custom-sheet-input"
                    type="text"
                    placeholder="Tempel Spreadsheet ID atau URL..."
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 transition focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomId}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 active:scale-95"
                  >
                    Pakai
                  </button>
                </div>
              </div>
            </div>

            {/* Sheet Info tip */}
            <div className="mt-3.5 flex items-start gap-2 rounded-lg bg-zinc-100 p-2.5 text-[11px] text-zinc-600">
              <Info className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
              <span>
                Setiap setoran otomatis ditambahkan sebagai baris baru dengan kolom ID, Waktu Input, Nama Santri, Capaian, Ayat/Halaman, dan Pengampu.
              </span>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
