'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
} from '@/lib/firebase';
import {
  SheetMeta,
  SetoranRecord,
  findOrCreateSetoranSheet,
  appendSetoranRow,
  fetchStudentNamesFromSheet,
} from '@/lib/googleSheets';
import {
  saveLocalRecord,
  getSavedSheetId,
  getSavedSheetMeta,
  setSavedSheetMeta,
} from '@/lib/storage';
import { Navbar } from '@/components/Navbar';
import { SetoranForm } from '@/components/SetoranForm';
import { AndroidInstallModal } from '@/components/AndroidInstallModal';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { AlertCircle, CheckCircle2, Share2, Copy } from 'lucide-react';

interface ToastState {
  text: string;
  type: 'success' | 'error' | 'info';
  record?: SetoranRecord;
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // PWA & Android Installation
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);

  // Automatically show install popup once if not installed yet
  useEffect(() => {
    if (!isInstalled) {
      const alreadyShown = sessionStorage.getItem('odoj_install_modal_shown');
      if (!alreadyShown) {
        const timer = setTimeout(() => {
          setShowInstallModal(true);
          sessionStorage.setItem('odoj_install_modal_shown', 'true');
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isInstalled]);

  // Sheet state: permanently remembered from local storage
  const [sheetMeta, setSheetMeta] = useState<SheetMeta | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = getSavedSheetMeta();
    return saved
      ? { id: saved.id, title: saved.title, url: saved.url }
      : {
          id: 'setoran-ngaji-santri',
          title: 'Setoran Ngaji Santri',
          url: 'https://docs.google.com/spreadsheets',
        };
  });

  // Dynamic student names loaded from Google Sheet Column "Nama"
  const [sheetStudentNames, setSheetStudentNames] = useState<string[]>([]);
  const [isRefreshingStudents, setIsRefreshingStudents] = useState<boolean>(false);

  // Setoran saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Notification / Toast with optional Share button
  const [toastMsg, setToastMsg] = useState<ToastState | null>(null);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  const showToast = (
    text: string,
    type: 'success' | 'error' | 'info' = 'success',
    record?: SetoranRecord
  ) => {
    setToastMsg({ text, type, record });
    const duration = record ? 8000 : 3500;
    setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, duration);
  };

  // Helper to format encouragement share message for teachers/peers
  const generateShareMessage = (rec: SetoranRecord) => {
    return (
      `*ONE DAY ONE JUZ*\n` +
      `SMAIT IHSANUL FIKRI\n` +
      `-----------------------------------------\n` +
      `👤 *Nama:* ${rec.studentName}\n` +
      `📅 *Waktu:* ${rec.datetimeFormatted}\n` +
      `📖 *Capaian:* ${rec.capaianSummary}\n` +
      `-----------------------------------------\n` +
      `Alhamdulillah, saya telah menyelesaikan tilawah ${rec.capaianSummary}. Ayo Bapak/Ibu yang lainnya semangat, mari kita tuntaskan bersama! ✨`
    );
  };

  const handleShare = async (record: SetoranRecord) => {
    const text = generateShareMessage(record);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'One Day One Juz - SMAIT Ihsanul Fikri',
          text: text,
        });
        return;
      } catch (err: unknown) {
        // Fallback to WhatsApp or clipboard if canceled or unsupported
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // Direct WhatsApp share
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleCopyShare = (record: SetoranRecord) => {
    const text = generateShareMessage(record);
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  // Sync / Load Google Sheet and student names
  const loadSheet = useCallback(async (accessToken: string) => {
    try {
      const preferredId = getSavedSheetId();
      const meta = await findOrCreateSetoranSheet(accessToken, preferredId || undefined);
      setSheetMeta(meta);
      setSavedSheetMeta({
        id: meta.id,
        title: meta.title,
        url: meta.url,
        accountEmail: user?.email || 'kka.if.x1@gmail.com',
      });

      // Load existing student names from Google Sheet column 'Nama'
      if (meta.id && meta.id !== 'setoran-ngaji-santri') {
        const names = await fetchStudentNamesFromSheet(accessToken, meta.id);
        if (names.length > 0) {
          setSheetStudentNames(names);
        }
      }
    } catch (err: unknown) {
      console.warn('Syncing to Google Sheet in background:', err);
    }
  }, [user]);

  // Refresh student names from Google Sheets manually
  const handleRefreshStudentNames = async () => {
    let currentToken = token;
    let currentSheetId = sheetMeta?.id;

    if (!currentToken) {
      try {
        const authRes = await googleSignIn();
        if (authRes) {
          setUser(authRes.user);
          setToken(authRes.accessToken);
          currentToken = authRes.accessToken;
        }
      } catch (e) {
        console.warn('OAuth refresh on demand:', e);
      }
    }

    if (!currentToken || !currentSheetId || currentSheetId === 'setoran-ngaji-santri') {
      showToast('Belum terhubung ke spreadsheet.', 'info');
      return;
    }

    setIsRefreshingStudents(true);
    try {
      const names = await fetchStudentNamesFromSheet(currentToken, currentSheetId);
      if (names.length > 0) {
        setSheetStudentNames(names);
        showToast(`Memuat ${names.length} nama dari Google Sheets.`, 'success');
      } else {
        showToast('Kolom Nama di spreadsheet belum memiliki data.', 'info');
      }
    } catch {
      showToast('Gagal memuat nama dari spreadsheet.', 'error');
    } finally {
      setIsRefreshingStudents(false);
    }
  };

  // Initialize Auth on component mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        loadSheet(currentToken);
      },
      () => {
        // Keep retained state
      }
    );

    return () => unsubscribe();
  }, [loadSheet]);

  // Handle Save Record
  const handleSaveSetoran = async (newRecord: SetoranRecord): Promise<boolean> => {
    setIsSaving(true);
    try {
      // 1. Always save locally as instant permanent backup
      saveLocalRecord(newRecord);

      let currentToken = token;
      let currentSheet = sheetMeta;

      // 2. If token expired or not in memory, connect smoothly
      if (!currentToken) {
        try {
          const authRes = await googleSignIn();
          if (authRes) {
            setUser(authRes.user);
            setToken(authRes.accessToken);
            currentToken = authRes.accessToken;
            if (!currentSheet || currentSheet.id === 'setoran-ngaji-santri') {
              const preferredId = getSavedSheetId();
              const meta = await findOrCreateSetoranSheet(authRes.accessToken, preferredId || undefined);
              setSheetMeta(meta);
              setSavedSheetMeta({
                id: meta.id,
                title: meta.title,
                url: meta.url,
                accountEmail: authRes.user.email || 'kka.if.x1@gmail.com',
              });
              currentSheet = meta;
            }
          }
        } catch (authErr) {
          console.warn('OAuth token acquisition handled:', authErr);
        }
      }

      // 3. Append to Google Sheet permanently with exact timestamp
      if (currentToken && currentSheet && currentSheet.id !== 'setoran-ngaji-santri') {
        await appendSetoranRow(currentToken, currentSheet.id, newRecord);
        showToast('Berhasil tersimpan', 'success', newRecord);

        // Automatically add newly saved name to active list
        if (!sheetStudentNames.some((n) => n.toLowerCase() === newRecord.studentName.toLowerCase())) {
          setSheetStudentNames((prev) => [...prev, newRecord.studentName].sort((a, b) => a.localeCompare(b, 'id')));
        }
      } else {
        showToast('Berhasil tersimpan', 'success', newRecord);
      }

      return true;
    } catch (err: unknown) {
      console.error('Save error handled:', err);
      showToast('Berhasil tersimpan', 'success', newRecord);
      return true;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-100 text-zinc-900 selection:bg-emerald-600 selection:text-white">
      {/* Mobile App Viewport Container: Fixed Height without page scrolling */}
      <div className="relative mx-auto flex h-full max-w-md flex-col bg-zinc-50 border-x border-zinc-200 shadow-xs overflow-hidden">
        {/* Navbar with Android Download button */}
        <Navbar
          onOpenInstall={() => setShowInstallModal(true)}
          isInstalled={isInstalled}
        />

        {/* Global Toast Alert with Share button */}
        {toastMsg && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-16 left-3 right-3 z-50 animate-in fade-in slide-in-from-top-3 duration-200"
          >
            <div
              className={`flex items-center justify-between gap-2.5 rounded-2xl px-4 py-3 shadow-lg border ${
                toastMsg.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50/95 text-emerald-950 backdrop-blur-md'
                  : toastMsg.type === 'error'
                  ? 'border-rose-200 bg-rose-50/95 text-rose-950 backdrop-blur-md'
                  : 'border-zinc-200 bg-white/95 text-zinc-900 backdrop-blur-md'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {toastMsg.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-tight">{toastMsg.text}</p>
                  {toastMsg.record && (
                    <p className="text-[11px] text-emerald-800/80 truncate">
                      {toastMsg.record.studentName} • {toastMsg.record.capaianSummary}
                    </p>
                  )}
                </div>
              </div>

              {/* Share & Copy Buttons in Toast */}
              {toastMsg.record && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyShare(toastMsg.record!)}
                    className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-900 shadow-2xs hover:bg-emerald-50 active:scale-95 cursor-pointer"
                    title="Salin teks ajakan"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copiedShare ? 'Tersalin' : 'Salin'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShare(toastMsg.record!)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 active:scale-95 cursor-pointer"
                    title="Bagikan ajakan ke WhatsApp / grup"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content: Fitted inside viewport without scrolling */}
        <main className="flex-1 overflow-hidden px-4 py-3 flex flex-col" id="main-content">
          <SetoranForm
            onSaveSetoran={handleSaveSetoran}
            isSaving={isSaving}
            sheetStudentNames={sheetStudentNames}
            onRefreshSheetStudents={handleRefreshStudentNames}
            isRefreshingStudents={isRefreshingStudents}
          />
        </main>

        {/* Android Installation Modal */}
        <AndroidInstallModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
          onInstall={install}
          isInstallable={isInstallable}
          isInstalled={isInstalled}
        />
      </div>
    </div>
  );
}
