'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Clock,
  Sparkles,
  BookOpen,
  Send,
  User as UserIcon,
  CheckCircle,
  Copy,
  Share2,
  Plus,
  Minus,
  Search,
  X,
  Check,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { SetoranRecord } from '@/lib/googleSheets';
import { getRecentStudents, addRecentStudent } from '@/lib/storage';

interface SetoranFormProps {
  onSaveSetoran: (record: SetoranRecord) => Promise<boolean>;
  isSaving: boolean;
  recorderName: string;
}

export function SetoranForm({
  onSaveSetoran,
  isSaving,
  recorderName,
}: SetoranFormProps) {
  // 1. Current live automatic datetime
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isManualDate, setIsManualDate] = useState<boolean>(false);
  const [manualDateInput, setManualDateInput] = useState<string>('');

  // 2. Nama with Combobox
  const [studentName, setStudentName] = useState<string>('');
  const [isComboboxOpen, setIsComboboxOpen] = useState<boolean>(false);
  const [availableStudents, setAvailableStudents] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    return getRecentStudents();
  });
  const comboboxRef = useRef<HTMLDivElement>(null);

  // 3. Capaian Ngaji: Juz (>=1 Juz) vs Di Bawah 1 Juz (Halaman)
  const [capaianType, setCapaianType] = useState<'juz' | 'halaman'>('juz');
  const [juzCount, setJuzCount] = useState<number>(1);
  const [halamanCount, setHalamanCount] = useState<number>(1);

  // 4. Success state & WhatsApp share
  const [lastSavedRecord, setLastSavedRecord] = useState<SetoranRecord | null>(null);
  const [copiedWA, setCopiedWA] = useState<boolean>(false);

  // Live clock interval
  useEffect(() => {
    if (isManualDate) return;
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isManualDate]);

  // Click outside listener for combobox dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsComboboxOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format current date in Indonesian
  const formattedDateTime = useMemo(() => {
    return (
      currentDate.toLocaleString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' WIB'
    );
  }, [currentDate]);

  // Filtered students for combobox
  const filteredStudents = useMemo(() => {
    if (!studentName.trim()) return availableStudents;
    const query = studentName.toLowerCase().trim();
    return availableStudents.filter((name) => name.toLowerCase().includes(query));
  }, [availableStudents, studentName]);

  // Capaian summary label: "X Juz" jika >= 1 juz, atau "X Halaman" jika di bawah 1 juz
  const capaianSummary = useMemo(() => {
    if (capaianType === 'juz') {
      return `${juzCount} Juz`;
    }
    return `${halamanCount} Halaman`;
  }, [capaianType, juzCount, halamanCount]);

  // Handle submit setoran
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = studentName.trim();
    if (!cleanName) {
      alert('Mohon masukkan nama terlebih dahulu.');
      return;
    }

    const finalJuz = capaianType === 'juz' ? Math.max(1, juzCount) : 0;
    const finalHalaman = capaianType === 'halaman' ? Math.max(1, halamanCount) : 0;

    const newRecord: SetoranRecord = {
      id: `NGJ-${Date.now().toString(36).toUpperCase()}`,
      datetimeFormatted: formattedDateTime,
      studentName: cleanName,
      juzCount: finalJuz,
      halamanCount: finalHalaman,
      capaianSummary: capaianSummary,
      recorderName: recorderName || 'Ustadz / Ustadzah',
      timestamp: currentDate.toISOString(),
      // Legacy fallbacks for compatibility
      category: 'Al-Qur\'an',
      capaian: capaianSummary,
      detailHalamanAyat: capaianType === 'halaman' ? `${finalHalaman} Halaman` : `${finalJuz} Juz`,
      status: 'Lancar',
      notes: '',
    };

    const success = await onSaveSetoran(newRecord);
    if (success) {
      setLastSavedRecord(newRecord);
      addRecentStudent(cleanName);
      setAvailableStudents(getRecentStudents());

      // Trigger celebratory confetti
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#10b981', '#06b6d4', '#fbbf24', '#3b82f6'],
        });
      } catch {
        // Safe fallback
      }
    }
  };

  // WhatsApp text template for parents
  const generateWhatsAppText = (rec: SetoranRecord) => {
    return (
      `*LAPORAN SETORAN NGAJI*\n` +
      `-----------------------------------------\n` +
      `👤 *Nama:* ${rec.studentName}\n` +
      `📅 *Waktu:* ${rec.datetimeFormatted}\n` +
      `📖 *Capaian:* ${rec.capaianSummary}\n` +
      `✍️ *Pengampu:* ${rec.recorderName}\n` +
      `-----------------------------------------\n` +
      `_Barakallahu fiik, semoga senantiasa istiqomah membaca Al-Qur'an._`
    );
  };

  const handleCopyWhatsApp = () => {
    if (!lastSavedRecord) return;
    const text = generateWhatsAppText(lastSavedRecord);
    navigator.clipboard.writeText(text);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2500);
  };

  const handleDirectWhatsApp = () => {
    if (!lastSavedRecord) return;
    const text = encodeURIComponent(generateWhatsAppText(lastSavedRecord));
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Header Info Panel */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Formulir Setoran Ngaji</span>
          </div>

          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
            Terkoneksi
          </span>
        </div>

        <h2 className="mt-2 text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Catatan Harian Santri
        </h2>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          Tanggal dan waktu otomatis terekam ke Google Sheets.
        </p>

        {/* Live DateTime Bar */}
        <div className="mt-3.5 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {isManualDate ? 'Waktu Manual' : 'Waktu Saat Ini'}
              </span>
              <time className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {formattedDateTime}
              </time>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isManualDate) {
                setIsManualDate(false);
                setCurrentDate(new Date());
              } else {
                setIsManualDate(true);
                const now = new Date();
                const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16);
                setManualDateInput(isoLocal);
              }
            }}
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            aria-label={isManualDate ? 'Kembali ke waktu otomatis' : 'Ubah waktu manual'}
          >
            {isManualDate ? 'Reset Otomatis' : 'Ubah Waktu'}
          </button>
        </div>

        {/* Manual date input expanded */}
        {isManualDate && (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-800/50">
            <label htmlFor="manual-datetime-input" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Pilih Waktu:
            </label>
            <input
              id="manual-datetime-input"
              type="datetime-local"
              value={manualDateInput}
              onChange={(e) => {
                setManualDateInput(e.target.value);
                if (e.target.value) {
                  setCurrentDate(new Date(e.target.value));
                }
              }}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        )}
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card 1: Nama with Combobox (Search Dropdown) */}
        <div
          ref={comboboxRef}
          className="relative rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <label
              htmlFor="student-name-input"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200"
            >
              <UserIcon className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <span>Nama *</span>
            </label>
            <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Ketik untuk mencari</span>
          </div>

          <div className="relative mt-2">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
              <input
                id="student-name-input"
                type="text"
                required
                placeholder="Ketik atau cari nama santri..."
                value={studentName}
                onFocus={() => setIsComboboxOpen(true)}
                onChange={(e) => {
                  setStudentName(e.target.value);
                  setIsComboboxOpen(true);
                }}
                className="w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-9 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-500 transition focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
              />

              {studentName && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentName('');
                    setIsComboboxOpen(true);
                  }}
                  className="absolute right-2.5 rounded-md p-1 text-zinc-500 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  aria-label="Hapus nama"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Combobox Search Dropdown Menu */}
            {isComboboxOpen && (
              <div
                role="listbox"
                aria-label="Daftar nama santri"
                className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              >
                {filteredStudents.length > 0 ? (
                  <div className="space-y-0.5">
                    {filteredStudents.map((name) => {
                      const isSelected =
                        studentName.trim().toLowerCase() === name.toLowerCase();
                      return (
                        <button
                          key={name}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setStudentName(name);
                            setIsComboboxOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                            isSelected
                              ? 'bg-emerald-50 font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                              : 'text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-100 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span>{name}</span>
                          </div>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-zinc-600 dark:text-zinc-400">
                    Tidak ada nama tersimpan yang cocok
                  </div>
                )}

                {/* Option to use newly typed name if not in list */}
                {studentName.trim() &&
                  !availableStudents.some(
                    (n) => n.toLowerCase() === studentName.trim().toLowerCase()
                  ) && (
                    <div className="mt-1 border-t border-zinc-200 pt-1 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setIsComboboxOpen(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Gunakan nama baru: &quot;{studentName.trim()}&quot;</span>
                      </button>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Capaian Ngaji (Juz vs Halaman di bawah 1 juz) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              <BookOpen className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <span>Capaian Ngaji *</span>
            </label>
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {capaianType === 'juz' ? `${juzCount} Juz` : `${halamanCount} Halaman`}
            </span>
          </div>

          {/* Segmented Control: Juz vs Halaman */}
          <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setCapaianType('juz')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                capaianType === 'juz'
                  ? 'bg-white text-emerald-800 shadow-sm dark:bg-zinc-900 dark:text-emerald-300'
                  : 'text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Juz</span>
            </button>

            <button
              type="button"
              onClick={() => setCapaianType('halaman')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                capaianType === 'halaman'
                  ? 'bg-white text-emerald-800 shadow-sm dark:bg-zinc-900 dark:text-emerald-300'
                  : 'text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100'
              }`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Halaman (&lt; 1 Juz)</span>
            </button>
          </div>

          <div className="mt-3">
            {/* OPSI 1: JUZ */}
            {capaianType === 'juz' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Jumlah Juz
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    1 – 30 Juz
                  </span>
                </div>

                {/* Stepper Jumlah Juz */}
                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <button
                    type="button"
                    onClick={() => setJuzCount(Math.max(1, juzCount - 1))}
                    disabled={juzCount <= 1}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    aria-label="Kurangi 1 Juz"
                  >
                    <Minus className="h-5 w-5" aria-hidden="true" />
                  </button>

                  <div className="flex flex-1 items-center justify-center gap-2 select-none py-1">
                    <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">
                      {juzCount}
                    </span>
                    <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                      Juz
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setJuzCount(Math.min(30, juzCount + 1))}
                    disabled={juzCount >= 30}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    aria-label="Tambah 1 Juz"
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* OPSI 2: HALAMAN (DI BAWAH 1 JUZ) */}
            {capaianType === 'halaman' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Jumlah Halaman
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    1 – 19 Halaman
                  </span>
                </div>

                {/* Stepper Jumlah Halaman */}
                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <button
                    type="button"
                    onClick={() => setHalamanCount(Math.max(1, halamanCount - 1))}
                    disabled={halamanCount <= 1}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    aria-label="Kurangi 1 Halaman"
                  >
                    <Minus className="h-5 w-5" aria-hidden="true" />
                  </button>

                  <div className="flex flex-1 items-center justify-center gap-2 select-none py-1">
                    <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">
                      {halamanCount}
                    </span>
                    <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                      Halaman
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHalamanCount(Math.min(19, halamanCount + 1))}
                    disabled={halamanCount >= 19}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    aria-label="Tambah 1 Halaman"
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button: Laporkan Setoran */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3.5 text-sm font-bold text-white shadow transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60 dark:bg-emerald-700 dark:hover:bg-emerald-800"
          >
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Menyimpan ke Google Sheets...</span>
              </span>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" />
                <span>Laporkan Setoran</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Success Notification & WhatsApp Quick Share */}
      <AnimatePresence>
        {lastSavedRecord && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm">
                <CheckCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    Alhamdulillah, Setoran Tersimpan
                  </h3>
                  <span className="font-mono text-[10px] text-emerald-800 dark:text-emerald-400">
                    {lastSavedRecord.id}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-800 dark:text-zinc-200">
                  <strong className="font-semibold">{lastSavedRecord.studentName}</strong> • {lastSavedRecord.capaianSummary}
                </p>

                {/* Quick Share Buttons */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyWhatsApp}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copiedWA ? 'Tersalin' : 'Salin Teks WA'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectWhatsApp}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95"
                  >
                    <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Kirim ke WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
