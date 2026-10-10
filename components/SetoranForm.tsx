'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Clock,
  BookOpen,
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
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { SetoranRecord } from '@/lib/googleSheets';
import { getRecentStudents, addRecentStudent } from '@/lib/storage';

interface SetoranFormProps {
  onSaveSetoran: (record: SetoranRecord) => Promise<boolean>;
  isSaving: boolean;
  recorderName: string;
  sheetStudentNames?: string[];
  onRefreshSheetStudents?: () => Promise<void>;
  isRefreshingStudents?: boolean;
}

export function SetoranForm({
  onSaveSetoran,
  isSaving,
  recorderName,
  sheetStudentNames = [],
  onRefreshSheetStudents,
  isRefreshingStudents = false,
}: SetoranFormProps) {
  // 1. Live automatic datetime vs manual selection
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isManualDate, setIsManualDate] = useState<boolean>(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

  // Temporary picker state when editing manual date
  const [pickerDate, setPickerDate] = useState<string>(''); // YYYY-MM-DD
  const [pickerTime, setPickerTime] = useState<string>(''); // HH:mm

  // 2. Student Name state & combobox
  const [studentName, setStudentName] = useState<string>('');
  const [isComboboxOpen, setIsComboboxOpen] = useState<boolean>(false);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const datePickerModalRef = useRef<HTMLDivElement>(null);

  // 3. Capaian Ngaji: Juz (1-30) vs Halaman (< 1 Juz: 1-19)
  const [capaianType, setCapaianType] = useState<'juz' | 'halaman'>('juz');
  const [juzCount, setJuzCount] = useState<number>(1);
  const [halamanCount, setHalamanCount] = useState<number>(1);

  // 4. Success state & WhatsApp share
  const [lastSavedRecord, setLastSavedRecord] = useState<SetoranRecord | null>(null);
  const [copiedWA, setCopiedWA] = useState<boolean>(false);

  // Combine Google Sheets students with local recent students
  const availableStudents = useMemo(() => {
    const local = getRecentStudents();
    const combined = [...sheetStudentNames, ...local];
    // Deduplicate case-insensitively
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const name of combined) {
      const clean = name.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(clean);
      }
    }
    return unique.sort((a, b) => a.localeCompare(b, 'id'));
  }, [sheetStudentNames]);

  // Live ticking clock (only if not set to manual date)
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

  // Format current active date into Indonesian string
  const formattedDateTime = useMemo(() => {
    return (
      currentDate.toLocaleString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB'
    );
  }, [currentDate]);

  // Helper to open custom datepicker initialized to current date
  const openDatePicker = useCallback(() => {
    const d = currentDate;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    setPickerDate(`${year}-${month}-${day}`);
    setPickerTime(`${hours}:${minutes}`);
    setIsDatePickerOpen(true);
  }, [currentDate]);

  // Apply manual date from custom datepicker
  const handleApplyCustomDate = () => {
    if (!pickerDate || !pickerTime) return;
    const [year, month, day] = pickerDate.split('-').map(Number);
    const [hours, minutes] = pickerTime.split(':').map(Number);
    const selected = new Date(year, month - 1, day, hours, minutes, 0);
    setCurrentDate(selected);
    setIsManualDate(true);
    setIsDatePickerOpen(false);
  };

  // Reset to live automatic time
  const handleResetToAutoTime = () => {
    setIsManualDate(false);
    setCurrentDate(new Date());
    setIsDatePickerOpen(false);
  };

  // Quick preset helper
  const handleApplyPreset = (preset: 'now' | 'today-morning' | 'today-afternoon' | 'yesterday') => {
    const now = new Date();
    if (preset === 'now') {
      handleResetToAutoTime();
      return;
    }

    const target = new Date();
    if (preset === 'yesterday') {
      target.setDate(now.getDate() - 1);
    } else if (preset === 'today-morning') {
      target.setHours(7, 30, 0, 0);
    } else if (preset === 'today-afternoon') {
      target.setHours(16, 0, 0, 0);
    }

    setCurrentDate(target);
    setIsManualDate(true);
    setIsDatePickerOpen(false);
  };

  // Filtered students for combobox
  const filteredStudents = useMemo(() => {
    if (!studentName.trim()) return availableStudents;
    const query = studentName.toLowerCase().trim();
    return availableStudents.filter((name) => name.toLowerCase().includes(query));
  }, [availableStudents, studentName]);

  // Capaian summary label
  const capaianSummary = useMemo(() => {
    if (capaianType === 'juz') {
      return `${juzCount} Juz`;
    }
    return `${halamanCount} Halaman`;
  }, [capaianType, juzCount, halamanCount]);

  // Submit setoran
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = studentName.trim();
    if (!cleanName) {
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

      try {
        confetti({
          particleCount: 60,
          spread: 55,
          origin: { y: 0.7 },
          colors: ['#047857', '#059669', '#10b981', '#34d399'],
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
      `SMAIT IHSANUL FIKRI\n` +
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
    <div className="space-y-3.5 pb-8">
      {/* 1. Area Waktu Setoran: Entire Area is Clickable to open Date & Time Picker */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-900">
            Waktu Setoran
          </span>
          <span className="text-[11px] font-medium text-zinc-500">
            {isManualDate ? 'Waktu Diubah Manual' : 'Otomatis Realtime'}
          </span>
        </div>

        {/* CLICKABLE BOX (Whole card area triggers the picker) */}
        <button
          type="button"
          onClick={openDatePicker}
          className="group mt-2.5 flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-left transition hover:border-emerald-600 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-[0.99]"
          aria-label="Pilih tanggal dan waktu setoran"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 transition group-hover:bg-emerald-700 group-hover:text-white">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900">
                  {formattedDateTime}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Klik area ini untuk mengubah tanggal &amp; jam
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 group-hover:translate-x-0.5 transition">
            <span className="hidden sm:inline">Ubah</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </div>
        </button>

        <p className="mt-2 text-[11px] text-zinc-500">
          Waktu akan otomatis tercatat ke baris Google Sheets.
        </p>
      </div>

      {/* Date & Time Picker Modal */}
      <AnimatePresence>
        {isDatePickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              ref={datePickerModalRef}
              className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-zinc-900">
                    Pilih Tanggal &amp; Waktu
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(false)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  aria-label="Tutup"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="mt-3.5">
                <span className="text-[11px] font-semibold text-zinc-500">
                  Pilihan Cepat
                </span>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('now')}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-emerald-50 hover:border-emerald-600"
                  >
                    Waktu Sekarang
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('today-morning')}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-emerald-50 hover:border-emerald-600"
                  >
                    Pagi Ini (07:30)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('today-afternoon')}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-emerald-50 hover:border-emerald-600"
                  >
                    Sore Ini (16:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('yesterday')}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-emerald-50 hover:border-emerald-600"
                  >
                    Kemarin
                  </button>
                </div>
              </div>

              {/* Manual Date & Time Inputs */}
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="custom-date-field" className="block text-xs font-medium text-zinc-700">
                    Tanggal
                  </label>
                  <input
                    id="custom-date-field"
                    type="date"
                    value={pickerDate}
                    onChange={(e) => setPickerDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>

                <div>
                  <label htmlFor="custom-time-field" className="block text-xs font-medium text-zinc-700">
                    Jam &amp; Menit
                  </label>
                  <input
                    id="custom-time-field"
                    type="time"
                    value={pickerTime}
                    onChange={(e) => setPickerTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={handleResetToAutoTime}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100"
                >
                  Gunakan Realtime
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(false)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustomDate}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    Terapkan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Setoran Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Card: Nama Santri with Automatic Google Sheet dropdown */}
        <div
          ref={comboboxRef}
          className="relative rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <label
              htmlFor="student-name-input"
              className="flex items-center gap-1.5 text-xs font-bold tracking-tight text-zinc-800"
            >
              <UserIcon className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>Nama Santri *</span>
            </label>

            {onRefreshSheetStudents && (
              <button
                type="button"
                onClick={onRefreshSheetStudents}
                disabled={isRefreshingStudents}
                className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
                title="Perbarui daftar nama dari Google Sheets"
              >
                <RefreshCw
                  className={`h-3 w-3 ${isRefreshingStudents ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isRefreshingStudents ? 'Menyinkronkan...' : 'Muat Nama Sheets'}</span>
              </button>
            )}
          </div>

          <div className="relative mt-2">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-zinc-400" aria-hidden="true" />
              <input
                id="student-name-input"
                type="text"
                required
                autoComplete="off"
                placeholder="Pilih atau ketik nama santri..."
                value={studentName}
                onFocus={() => setIsComboboxOpen(true)}
                onClick={() => setIsComboboxOpen(true)}
                onChange={(e) => {
                  setStudentName(e.target.value);
                  setIsComboboxOpen(true);
                }}
                className="w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-9 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-400 transition focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />

              {studentName && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentName('');
                    setIsComboboxOpen(true);
                  }}
                  className="absolute right-2.5 rounded-md p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  aria-label="Kosongkan nama"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Dropdown Menu - Lists names directly from Google Sheets column Nama */}
            {isComboboxOpen && (
              <div
                role="listbox"
                aria-label="Daftar nama santri"
                className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg"
              >
                {filteredStudents.length > 0 ? (
                  <div className="space-y-0.5">
                    {filteredStudents.map((name) => {
                      const isSelected =
                        studentName.trim().toLowerCase() === name.toLowerCase();
                      const isFromSheet = sheetStudentNames.includes(name);

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
                              ? 'bg-emerald-50 font-bold text-emerald-950'
                              : 'text-zinc-800 hover:bg-zinc-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-100 text-[11px] font-bold text-emerald-800">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span>{name}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isFromSheet && (
                              <span className="text-[10px] text-zinc-500 font-medium">
                                Sheet
                              </span>
                            )}
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-zinc-500">
                    Tidak ada nama yang cocok
                  </div>
                )}

                {/* Option to enter new custom student name */}
                {studentName.trim() &&
                  !availableStudents.some(
                    (n) => n.toLowerCase() === studentName.trim().toLowerCase()
                  ) && (
                    <div className="mt-1 border-t border-zinc-100 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsComboboxOpen(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
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

        {/* Card: Capaian Ngaji (Juz vs Halaman) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-bold tracking-tight text-zinc-800">
              <BookOpen className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>Capaian Ngaji *</span>
            </label>
            <span className="text-xs font-bold text-emerald-800">
              {capaianType === 'juz' ? `${juzCount} Juz` : `${halamanCount} Halaman`}
            </span>
          </div>

          {/* Segmented Control */}
          <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setCapaianType('juz')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                capaianType === 'juz'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 font-medium'
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
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 font-medium'
              }`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Halaman (&lt; 1 Juz)</span>
            </button>
          </div>

          <div className="mt-3">
            {/* Opsi 1: Juz */}
            {capaianType === 'juz' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800">
                    Jumlah Juz
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    1 – 30 Juz
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-2">
                  <button
                    type="button"
                    onClick={() => setJuzCount(Math.max(1, juzCount - 1))}
                    disabled={juzCount <= 1}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-xs transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Kurangi 1 Juz"
                  >
                    <Minus className="h-5 w-5" aria-hidden="true" />
                  </button>

                  <div className="flex flex-1 items-center justify-center gap-2 select-none py-1">
                    <span className="text-3xl font-black text-zinc-900">
                      {juzCount}
                    </span>
                    <span className="text-sm font-semibold text-zinc-500">
                      Juz
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setJuzCount(Math.min(30, juzCount + 1))}
                    disabled={juzCount >= 30}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-xs transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Tambah 1 Juz"
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Opsi 2: Halaman */}
            {capaianType === 'halaman' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-800">
                    Jumlah Halaman
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    1 – 19 Halaman
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-2">
                  <button
                    type="button"
                    onClick={() => setHalamanCount(Math.max(1, halamanCount - 1))}
                    disabled={halamanCount <= 1}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-xs transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Kurangi 1 Halaman"
                  >
                    <Minus className="h-5 w-5" aria-hidden="true" />
                  </button>

                  <div className="flex flex-1 items-center justify-center gap-2 select-none py-1">
                    <span className="text-3xl font-black text-zinc-900">
                      {halamanCount}
                    </span>
                    <span className="text-sm font-semibold text-zinc-500">
                      Halaman
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHalamanCount(Math.min(19, halamanCount + 1))}
                    disabled={halamanCount >= 19}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-xs transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Tambah 1 Halaman"
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button: Simpan Setoran */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center rounded-xl bg-emerald-700 py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60"
          >
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Menyimpan ke Google Sheets...</span>
              </span>
            ) : (
              <span>Simpan Setoran</span>
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
            className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs">
                <CheckCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-emerald-950">
                    Alhamdulillah, Setoran Tersimpan
                  </h3>
                  <span className="font-mono text-[10px] text-emerald-800">
                    {lastSavedRecord.id}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-800">
                  <strong className="font-semibold">{lastSavedRecord.studentName}</strong> • {lastSavedRecord.capaianSummary}
                </p>

                {/* Quick Share Buttons */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyWhatsApp}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-xs transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copiedWA ? 'Tersalin' : 'Salin Teks'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectWhatsApp}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95"
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
