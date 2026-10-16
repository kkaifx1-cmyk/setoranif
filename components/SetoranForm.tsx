'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Clock,
  BookOpen,
  User as UserIcon,
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
import { getRecentStudents, addRecentStudent, getAllKnownStudentNames } from '@/lib/storage';

interface SetoranFormProps {
  onSaveSetoran: (record: SetoranRecord) => Promise<boolean>;
  isSaving: boolean;
  sheetStudentNames?: string[];
  onRefreshSheetStudents?: () => Promise<void>;
  isRefreshingStudents?: boolean;
}

export function SetoranForm({
  onSaveSetoran,
  isSaving,
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

  // 3. Capaian Ngaji: Juz (0-30) + Opsi Halaman (bila tidak bulat) vs Halaman Saja (< 1 Juz: 1-19) vs Sedang Halangan
  const [capaianType, setCapaianType] = useState<'juz' | 'halaman'>('juz');
  const [juzCount, setJuzCount] = useState<number>(1);
  const [halamanCount, setHalamanCount] = useState<number>(1);
  const [hasExtraHalaman, setHasExtraHalaman] = useState<boolean>(false);
  const [extraHalamanCount, setExtraHalamanCount] = useState<number>(1);
  const [isHalangan, setIsHalangan] = useState<boolean>(false);

  // Active student list strictly reflects Google Sheets
  const availableStudents = useMemo(() => {
    const list = sheetStudentNames.length > 0 ? sheetStudentNames : getAllKnownStudentNames();
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const name of list) {
      const clean = (name || '').trim();
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

  const handleOpenDropdown = () => {
    setIsComboboxOpen(true);
    if (availableStudents.length === 0 && onRefreshSheetStudents) {
      onRefreshSheetStudents();
    }
  };

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

  // Direct input refs to allow entire area click to trigger native picker
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  const triggerDatePicker = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        try {
          dateInputRef.current.showPicker();
          return;
        } catch {
          // ignore error
        }
      }
      dateInputRef.current.focus();
    }
  };

  const triggerTimePicker = () => {
    if (timeInputRef.current) {
      if (typeof timeInputRef.current.showPicker === 'function') {
        try {
          timeInputRef.current.showPicker();
          return;
        } catch {
          // ignore error
        }
      }
      timeInputRef.current.focus();
    }
  };

  // Filtered students for combobox
  const filteredStudents = useMemo(() => {
    if (!studentName.trim()) return availableStudents;
    const query = studentName.toLowerCase().trim();
    return availableStudents.filter((name) => name.toLowerCase().includes(query));
  }, [availableStudents, studentName]);

  // Capaian summary label
  const capaianSummary = useMemo(() => {
    if (isHalangan || (capaianType === 'juz' && juzCount === 0)) {
      return 'Sedang Halangan';
    }
    if (capaianType === 'juz') {
      if (hasExtraHalaman && extraHalamanCount > 0) {
        return `${juzCount} Juz ${extraHalamanCount} Halaman`;
      }
      return `${juzCount} Juz`;
    }
    return `${halamanCount} Halaman`;
  }, [isHalangan, capaianType, juzCount, hasExtraHalaman, extraHalamanCount, halamanCount]);

  // Toggle checklist sedang halangan (0 Juz)
  const handleToggleHalangan = (checked: boolean) => {
    setIsHalangan(checked);
    if (checked) {
      setCapaianType('juz');
      setJuzCount(0);
      setHasExtraHalaman(false);
    } else {
      setJuzCount(1);
    }
  };

  // Decrement Juz (dapat turun hingga 0 Juz / Halangan)
  const handleDecrementJuz = () => {
    if (juzCount === 1) {
      setJuzCount(0);
      setIsHalangan(true);
      setHasExtraHalaman(false);
    } else if (juzCount > 1) {
      setJuzCount(juzCount - 1);
    }
  };

  // Increment Juz (dari 0 otomatis membatalkan status halangan)
  const handleIncrementJuz = () => {
    if (juzCount === 0) {
      setJuzCount(1);
      setIsHalangan(false);
    } else if (juzCount < 30) {
      setJuzCount(juzCount + 1);
    }
  };

  // Submit setoran
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = studentName.trim();
    if (!cleanName) {
      return;
    }

    const isRecordHalangan = isHalangan || (capaianType === 'juz' && juzCount === 0);
    const finalJuz = isRecordHalangan ? 0 : capaianType === 'juz' ? Math.max(0, juzCount) : 0;
    const finalHalaman = isRecordHalangan
      ? 0
      : capaianType === 'juz'
      ? hasExtraHalaman
        ? Math.max(1, extraHalamanCount)
        : 0
      : Math.max(1, halamanCount);

    const detailText = isRecordHalangan
      ? 'Sedang Halangan (0 Juz)'
      : capaianType === 'halaman'
      ? `${finalHalaman} Halaman`
      : finalHalaman > 0
      ? `${finalJuz} Juz ${finalHalaman} Halaman`
      : `${finalJuz} Juz`;

    const newRecord: SetoranRecord = {
      id: `ODOJ-${Date.now().toString(36).toUpperCase()}`,
      datetimeFormatted: formattedDateTime,
      studentName: cleanName,
      juzCount: finalJuz,
      halamanCount: finalHalaman,
      capaianSummary: capaianSummary,
      recorderName: cleanName,
      timestamp: currentDate.toISOString(),
      category: "Al-Qur'an",
      capaian: capaianSummary,
      detailHalamanAyat: detailText,
      status: isRecordHalangan ? 'Halangan' : 'Lancar',
      notes: isRecordHalangan ? 'Sedang halangan / uzur syar\'i' : '',
    };

    const success = await onSaveSetoran(newRecord);
    if (success) {
      addRecentStudent(cleanName);
      if (isRecordHalangan) {
        setIsHalangan(false);
        setJuzCount(1);
      }
      setHasExtraHalaman(false);
      setExtraHalamanCount(1);
      try {
        confetti({
          particleCount: 50,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#047857', '#059669', '#10b981', '#34d399'],
        });
      } catch {
        // Safe fallback
      }
    }
  };

  return (
    <div className="flex flex-col space-y-2.5">
      {/* 1. Area Waktu Setoran: Entire Area is Clickable to open Date & Time Picker */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-zinc-900">
            Waktu
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              isManualDate
                ? 'bg-amber-100 text-amber-900'
                : 'bg-emerald-100 text-emerald-900'
            }`}
          >
            <Clock className="h-2.5 w-2.5" aria-hidden="true" />
            <span>{isManualDate ? 'Manual' : 'Realtime'}</span>
          </span>
        </div>

        {/* Clickable Card to trigger datepicker */}
        <button
          type="button"
          onClick={openDatePicker}
          className="group mt-1.5 flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/70 p-2 text-left transition hover:border-emerald-600 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-[0.99]"
          title="Klik di mana saja untuk mengubah tanggal & jam"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 transition group-hover:bg-emerald-700 group-hover:text-white">
              <Calendar className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                {/* Live clock: server-render and hydration happen seconds apart, so the
                    minute can differ. The value is intentionally client-driven. */}
                <span className="text-xs font-bold text-zinc-900" suppressHydrationWarning>
                  {formattedDateTime}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Klik area ini untuk mengubah tanggal &amp; jam
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 group-hover:translate-x-0.5 transition">
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
        </button>
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
              className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
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

              {/* Manual Date & Time Inputs (Full Box is Clickable) */}
              <div className="mt-3 space-y-3">
                {/* Tanggal: Seluruh area form dapat diklik */}
                <div>
                  <label
                    onClick={triggerDatePicker}
                    htmlFor="custom-date-field"
                    className="block text-xs font-semibold text-zinc-700 cursor-pointer select-none"
                  >
                    Tanggal
                  </label>
                  <div
                    onClick={triggerDatePicker}
                    className="group mt-1 flex w-full cursor-pointer items-center justify-between rounded-xl border border-zinc-300 bg-zinc-50/70 px-3 py-2 transition hover:border-emerald-600 hover:bg-emerald-50/30 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20 active:scale-[0.99]"
                    title="Klik di mana saja untuk memilih tanggal"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Calendar className="h-4 w-4 text-emerald-700 shrink-0 pointer-events-none" aria-hidden="true" />
                      <input
                        ref={dateInputRef}
                        id="custom-date-field"
                        type="date"
                        value={pickerDate}
                        onChange={(e) => setPickerDate(e.target.value)}
                        className="w-full bg-transparent cursor-pointer text-xs font-semibold text-zinc-900 focus:outline-none"
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 shrink-0 pointer-events-none ml-1">
                      Pilih Tanggal
                    </span>
                  </div>
                </div>

                {/* Jam & Menit: Seluruh area form dapat diklik */}
                <div>
                  <label
                    onClick={triggerTimePicker}
                    htmlFor="custom-time-field"
                    className="block text-xs font-semibold text-zinc-700 cursor-pointer select-none"
                  >
                    Jam &amp; Menit
                  </label>
                  <div
                    onClick={triggerTimePicker}
                    className="group mt-1 flex w-full cursor-pointer items-center justify-between rounded-xl border border-zinc-300 bg-zinc-50/70 px-3 py-2 transition hover:border-emerald-600 hover:bg-emerald-50/30 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20 active:scale-[0.99]"
                    title="Klik di mana saja untuk memilih jam dan menit"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Clock className="h-4 w-4 text-emerald-700 shrink-0 pointer-events-none" aria-hidden="true" />
                      <input
                        ref={timeInputRef}
                        id="custom-time-field"
                        type="time"
                        value={pickerTime}
                        onChange={(e) => setPickerTime(e.target.value)}
                        className="w-full bg-transparent cursor-pointer text-xs font-semibold text-zinc-900 focus:outline-none"
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 shrink-0 pointer-events-none ml-1">
                      Pilih Jam
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
                <button
                  type="button"
                  onClick={handleResetToAutoTime}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100"
                >
                  Gunakan Realtime
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(false)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustomDate}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
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
      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Card: Nama with Automatic Google Sheet dropdown */}
          <div
            ref={comboboxRef}
            className="relative rounded-2xl border border-zinc-200 bg-white p-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <label
                htmlFor="student-name-input"
                className="flex items-center gap-1.5 text-xs font-bold tracking-tight text-zinc-800"
              >
                <UserIcon className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                <span>Nama Guru *</span>
              </label>

              {isRefreshingStudents && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                  <span>Sinkron otomatis...</span>
                </span>
              )}
            </div>

            <div className="relative mt-1.5">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                <input
                  id="student-name-input"
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Ketik atau pilih nama guru..."
                  value={studentName}
                  onFocus={handleOpenDropdown}
                  onClick={handleOpenDropdown}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    setIsComboboxOpen(true);
                  }}
                  className="w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-8 py-2 text-xs font-medium text-zinc-900 placeholder-zinc-400 transition focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />

                {studentName && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentName('');
                      setIsComboboxOpen(true);
                    }}
                    className="absolute right-2 rounded-md p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                    aria-label="Kosongkan nama guru"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Dropdown Menu - Lists names directly from Google Sheets tab Daftar Guru */}
              {isComboboxOpen && (
                <div
                  role="listbox"
                  aria-label="Daftar nama guru"
                  className="absolute left-0 right-0 top-full z-40 mt-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg"
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
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                              isSelected
                                ? 'bg-emerald-50 font-bold text-emerald-950'
                                : 'text-zinc-800 hover:bg-zinc-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-[10px] font-bold text-emerald-800">
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <span>{name}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isSelected && (
                                <Check className="h-3 w-3 text-emerald-700" aria-hidden="true" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2.5 text-center text-xs text-zinc-500">
                      Tidak ada nama guru yang cocok
                    </div>
                  )}

                  {/* Option to enter new custom name */}
                  {studentName.trim() &&
                    !availableStudents.some(
                      (n) => n.toLowerCase() === studentName.trim().toLowerCase()
                    ) && (
                      <div className="mt-1 border-t border-zinc-100 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsComboboxOpen(false)}
                          className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          <span>Gunakan &quot;{studentName.trim()}&quot;</span>
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>

          {/* Card: Capaian Ngaji (Juz vs Halaman vs Sedang Halangan) */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold tracking-tight text-zinc-800">
                <BookOpen className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                <span>Capaian *</span>
              </label>
              <span className="text-xs font-bold text-emerald-800">
                {isHalangan || (capaianType === 'juz' && juzCount === 0)
                  ? 'Sedang Halangan (0 Juz)'
                  : capaianSummary}
              </span>
            </div>

            {/* Segmented Control */}
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => setCapaianType('juz')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
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
                onClick={() => {
                  setCapaianType('halaman');
                  if (isHalangan) {
                    setIsHalangan(false);
                    setJuzCount(1);
                  }
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  capaianType === 'halaman'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 font-medium'
                }`}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Halaman Saja (&lt; 1 Juz)</span>
              </button>
            </div>

            <div className="mt-2.5">
              {/* Opsi 1: Juz (Bisa ditambah lembar/halaman jika tidak bulat) */}
              {capaianType === 'juz' && (
                <div className="space-y-2.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-zinc-800">
                        Jumlah Juz
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        0 – 30 Juz (0 = Halangan)
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-1.5">
                      <button
                        type="button"
                        onClick={handleDecrementJuz}
                        disabled={juzCount <= 0}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-xs transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Kurangi 1 Juz"
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <div className="flex flex-1 items-center justify-center gap-1.5 select-none py-0.5">
                        <span className="text-2xl font-black text-zinc-900">
                          {juzCount}
                        </span>
                        <span className="text-xs font-semibold text-zinc-500">
                          Juz
                        </span>
                        {(juzCount === 0 || isHalangan) && (
                          <span className="ml-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                            Halangan
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleIncrementJuz}
                        disabled={juzCount >= 30}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-xs transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Tambah 1 Juz"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Opsi Tambahan Halaman (Bila tilawah melebihi juz genap / tidak bulat) */}
                  {juzCount > 0 && !isHalangan && (
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-2.5 transition">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="toggle-extra-halaman"
                          className="flex items-center gap-2.5 cursor-pointer select-none"
                        >
                          <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                              hasExtraHalaman
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-zinc-300 bg-white hover:border-zinc-400'
                            }`}
                          >
                            {hasExtraHalaman && (
                              <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                            )}
                          </div>
                          <input
                            id="toggle-extra-halaman"
                            type="checkbox"
                            checked={hasExtraHalaman}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setHasExtraHalaman(checked);
                              if (checked && extraHalamanCount === 0) {
                                setExtraHalamanCount(1);
                              }
                            }}
                            className="sr-only"
                          />
                          <div>
                            <span className="text-xs font-bold text-zinc-800">
                              Tambah Halaman (Tidak Bulat)
                            </span>
                            <p className="text-[10px] text-zinc-500 leading-tight">
                              Misal: {juzCount} Juz lebih {hasExtraHalaman ? extraHalamanCount : 5} halaman
                            </p>
                          </div>
                        </label>
                      </div>

                      {hasExtraHalaman && (
                        <div className="mt-2.5 pt-2 border-t border-emerald-200/60 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-emerald-950">
                              Lebihan Halaman
                            </span>
                            <span className="text-[10px] text-emerald-800/80">
                              1 – 19 Halaman
                            </span>
                          </div>

                          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white p-1">
                            <button
                              type="button"
                              onClick={() => setExtraHalamanCount((prev) => Math.max(1, prev - 1))}
                              disabled={extraHalamanCount <= 1}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-800 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Kurangi Lebihan Halaman"
                            >
                              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>

                            <div className="flex flex-1 items-center justify-center gap-1 select-none py-0.5">
                              <span className="text-lg font-black text-zinc-900">
                                +{extraHalamanCount}
                              </span>
                              <span className="text-xs font-semibold text-zinc-500">
                                Halaman
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setExtraHalamanCount((prev) => Math.min(19, prev + 1))}
                              disabled={extraHalamanCount >= 19}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-800 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Tambah Lebihan Halaman"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Opsi 2: Halaman Saja (< 1 Juz) */}
              {capaianType === 'halaman' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-zinc-800">
                      Jumlah Halaman
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      1 – 19 Halaman
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-1.5">
                    <button
                      type="button"
                      onClick={() => setHalamanCount(Math.max(1, halamanCount - 1))}
                      disabled={halamanCount <= 1}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-xs transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Kurangi 1 Halaman"
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <div className="flex flex-1 items-center justify-center gap-1.5 select-none py-0.5">
                      <span className="text-2xl font-black text-zinc-900">
                        {halamanCount}
                      </span>
                      <span className="text-xs font-semibold text-zinc-500">
                        Halaman
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setHalamanCount(Math.min(19, halamanCount + 1))}
                      disabled={halamanCount >= 19}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800 shadow-xs transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Tambah 1 Halaman"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Checklist: Sedang Halangan */}
            <div className="mt-2.5 pt-2 border-t border-zinc-100">
              <label
                htmlFor="checklist-sedang-halangan"
                className={`group flex items-center justify-between rounded-xl border px-3 py-2 cursor-pointer transition select-none ${
                  isHalangan || (capaianType === 'juz' && juzCount === 0)
                    ? 'border-rose-300 bg-rose-50/70 text-rose-950 shadow-2xs'
                    : 'border-zinc-200 bg-zinc-50/60 hover:bg-zinc-100/70 text-zinc-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      isHalangan || (capaianType === 'juz' && juzCount === 0)
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-zinc-300 bg-white group-hover:border-zinc-400'
                    }`}
                  >
                    {(isHalangan || (capaianType === 'juz' && juzCount === 0)) && (
                      <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                    )}
                  </div>
                  <input
                    id="checklist-sedang-halangan"
                    type="checkbox"
                    checked={isHalangan || (capaianType === 'juz' && juzCount === 0)}
                    onChange={(e) => handleToggleHalangan(e.target.checked)}
                    className="sr-only"
                  />
                  <div>
                    <span className="text-xs font-bold leading-tight">
                      Sedang Halangan
                    </span>
                    <p className="text-[10px] text-zinc-500">
                      Uzur syar&apos;i (otomatis tercatat 0 Juz)
                    </p>
                  </div>
                </div>

                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    isHalangan || (capaianType === 'juz' && juzCount === 0)
                      ? 'bg-rose-200/80 text-rose-900'
                      : 'bg-zinc-200/70 text-zinc-600'
                  }`}
                >
                  0 Juz
                </span>
              </label>
            </div>
          </div>

        {/* Action Button: Simpan Setoran (Tepat di bawah section capaian) */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={isSaving}
            className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3.5 text-sm font-bold tracking-wide text-white shadow-md shadow-emerald-800/20 transition-all duration-150 hover:bg-emerald-800 hover:shadow-lg hover:shadow-emerald-800/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-200" aria-hidden="true" />
                <span>Menyimpan Setoran...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 stroke-[2.5] text-emerald-100 transition-transform group-hover:scale-110" aria-hidden="true" />
                <span>
                  {isHalangan || (capaianType === 'juz' && juzCount === 0)
                    ? 'Simpan Setoran (Sedang Halangan)'
                    : 'Simpan Setoran'}
                </span>
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
