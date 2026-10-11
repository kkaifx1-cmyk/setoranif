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
  fetchStudentNamesSmart,
} from '@/lib/googleSheets';
import {
  saveLocalRecord,
  getSavedSheetId,
  getSavedSheetMeta,
  setSavedSheetMeta,
  getCachedSheetNames,
  saveCachedSheetNames,
  getAllKnownStudentNames,
  addRecentStudent,
} from '@/lib/storage';
import { DEFAULT_DB_CONFIG } from '@/lib/dbConfig';
import { isAppsScriptConfigured, scriptAppendSetoran, scriptListNames } from '@/lib/appsScript';
import { Navbar } from '@/components/Navbar';
import { SetoranForm } from '@/components/SetoranForm';
import { SheetConfigModal } from '@/components/SheetConfigModal';
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

  // Automatically show install popup once if not installed yet (with safe storage check for mobile/safari)
  useEffect(() => {
    if (!isInstalled) {
      try {
        const alreadyShown = sessionStorage.getItem('odoj_install_modal_shown');
        if (!alreadyShown) {
          const timer = setTimeout(() => {
            setShowInstallModal(true);
            try {
              sessionStorage.setItem('odoj_install_modal_shown', 'true');
            } catch {
              // Ignore storage write error (e.g. Safari private browsing or storage quota)
            }
          }, 1000);
          return () => clearTimeout(timer);
        }
      } catch {
        // Ignore storage read error
      }
    }
  }, [isInstalled]);

  // Sheet state: permanently remembered from ENV default or local storage
  const [sheetMeta, setSheetMeta] = useState<SheetMeta | null>(() => {
    const saved = getSavedSheetMeta();
    if (saved && saved.id) {
      return { id: saved.id, title: saved.title, url: saved.url };
    }
    if (DEFAULT_DB_CONFIG.spreadsheetId) {
      return {
        id: DEFAULT_DB_CONFIG.spreadsheetId,
        title: DEFAULT_DB_CONFIG.spreadsheetTitle,
        url:
          DEFAULT_DB_CONFIG.spreadsheetUrl ||
          `https://docs.google.com/spreadsheets/d/${DEFAULT_DB_CONFIG.spreadsheetId}/edit`,
      };
    }
    return {
      id: 'setoran-ngaji-guru',
      title: DEFAULT_DB_CONFIG.spreadsheetTitle,
      url: 'https://docs.google.com/spreadsheets',
    };
  });

  // Database / Google Sheet modal state
  const [showSheetModal, setShowSheetModal] = useState<boolean>(false);
  const [isConnectingSheet, setIsConnectingSheet] = useState<boolean>(false);

  // Dynamic student names loaded from Google Sheet Column "Nama" & local records
  const [sheetStudentNames, setSheetStudentNames] = useState<string[]>(() => {
    return getAllKnownStudentNames();
  });
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
    const isHalangan =
      rec.status === 'Halangan' ||
      rec.capaianSummary.toLowerCase().includes('halangan') ||
      (rec.juzCount === 0 && rec.halamanCount === 0);

    if (isHalangan) {
      return (
        `ONE DAY ONE JUZ\n` +
        `SMAIT IHSANUL FIKRI\n` +
        `Konfirmasi tilawah: Sedang Halangan (0 Juz). Ayo Bapak/Ibu yang lainnya tetap semangat, mari kita tuntaskan bersama! ✨`
      );
    }

    return (
      `ONE DAY ONE JUZ\n` +
      `SMAIT IHSANUL FIKRI\n` +
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

      // Load existing student names from Google Sheet column 'Nama' or dedicated master tab
      if (
        meta.id &&
        meta.id !== 'setoran-ngaji-guru' &&
        meta.id !== 'setoran-ngaji-santri'
      ) {
        const names = await fetchStudentNamesFromSheet(accessToken, meta.id);
        if (names.length > 0) {
          setSheetStudentNames(names);
          saveCachedSheetNames(names);
        }
      }
    } catch (err: unknown) {
      console.warn('Syncing to Google Sheet in background:', err);
    }
  }, [user]);

  // Refresh student names from Google Sheets manually
  const handleRefreshStudentNames = async () => {
    // 0. Jembatan Apps Script (tanpa login): pakai ini kalau dikonfigurasi, jangan buka popup OAuth.
    if (isAppsScriptConfigured()) {
      setIsRefreshingStudents(true);
      try {
        const names = await scriptListNames();
        if (names.length > 0) {
          setSheetStudentNames(names);
          saveCachedSheetNames(names);
          showToast(`Memuat ${names.length} nama dari Google Sheets.`, 'success');
        } else {
          showToast('Tab "Daftar Guru" di spreadsheet belum memiliki nama.', 'info');
        }
      } catch (err: unknown) {
        showToast(
          (err as Error)?.message || 'Gagal memuat nama dari spreadsheet.',
          'error'
        );
      } finally {
        setIsRefreshingStudents(false);
      }
      return;
    }

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

    if (
      !currentToken ||
      !currentSheetId ||
      currentSheetId === 'setoran-ngaji-guru' ||
      currentSheetId === 'setoran-ngaji-santri'
    ) {
      showToast('Belum terhubung ke spreadsheet.', 'info');
      return;
    }

    setIsRefreshingStudents(true);
    try {
      const names = await fetchStudentNamesFromSheet(currentToken, currentSheetId);
      if (names.length > 0) {
        setSheetStudentNames(names);
        saveCachedSheetNames(names);
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

  // Handle switching to a custom Sheet ID
  const handleSelectCustomSheet = async (customId: string) => {
    setIsConnectingSheet(true);
    try {
      let currentToken = token;
      if (!currentToken) {
        const authRes = await googleSignIn();
        if (authRes) {
          setUser(authRes.user);
          setToken(authRes.accessToken);
          currentToken = authRes.accessToken;
        }
      }

      if (!currentToken) {
        showToast('Silakan login terlebih dahulu untuk menghubungkan sheet.', 'error');
        return;
      }

      const meta = await findOrCreateSetoranSheet(currentToken, customId);
      setSheetMeta(meta);
      setSavedSheetMeta({
        id: meta.id,
        title: meta.title,
        url: meta.url,
        accountEmail: user?.email || 'kka.if.x1@gmail.com',
      });
      showToast('Berhasil terhubung ke spreadsheet.', 'success');
      setShowSheetModal(false);

      // Load students
      const names = await fetchStudentNamesFromSheet(currentToken, meta.id);
      if (names.length > 0) {
        setSheetStudentNames(names);
        saveCachedSheetNames(names);
      }
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Gagal menghubungkan spreadsheet.', 'error');
    } finally {
      setIsConnectingSheet(false);
    }
  };

  // Handle creating a new sheet on demand
  const handleCreateNewSheet = async () => {
    setIsConnectingSheet(true);
    try {
      let currentToken = token;
      if (!currentToken) {
        const authRes = await googleSignIn();
        if (authRes) {
          setUser(authRes.user);
          setToken(authRes.accessToken);
          currentToken = authRes.accessToken;
        }
      }

      if (!currentToken) {
        showToast('Silakan login terlebih dahulu.', 'error');
        return;
      }

      const meta = await findOrCreateSetoranSheet(currentToken);
      setSheetMeta(meta);
      setSavedSheetMeta({
        id: meta.id,
        title: meta.title,
        url: meta.url,
        accountEmail: user?.email || 'kka.if.x1@gmail.com',
      });
      showToast('Google Sheet baru berhasil dibuat & terhubung.', 'success');
      setShowSheetModal(false);
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Gagal membuat Google Sheet baru.', 'error');
    } finally {
      setIsConnectingSheet(false);
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

  // Automatically fetch student names directly from the active spreadsheet on mount
  useEffect(() => {
    const activeSheetId = getSavedSheetId();
    if (
      activeSheetId &&
      activeSheetId !== 'setoran-ngaji-guru' &&
      activeSheetId !== 'setoran-ngaji-santri'
    ) {
      fetchStudentNamesSmart(activeSheetId, token).then((names) => {
        if (names && names.length > 0) {
          setSheetStudentNames(names);
          saveCachedSheetNames(names);
        }
      });
    }
  }, [token]);

  // Handle Save Record
  const handleSaveSetoran = async (newRecord: SetoranRecord): Promise<boolean> => {
    setIsSaving(true);
    try {
      // 1. Always save locally as instant permanent backup
      saveLocalRecord(newRecord);

      let currentToken = token;
      let currentSheet = sheetMeta;

      // 2a. Jembatan Apps Script: kirim baris langsung ke sheet, tanpa login/OAuth popup.
      if (isAppsScriptConfigured()) {
        try {
          await scriptAppendSetoran(newRecord);
          showToast('Berhasil tersimpan', 'success', newRecord);
        } catch (sheetErr: unknown) {
          console.error('Gagal mengirim ke Sheet via Apps Script:', sheetErr);
          showToast(
            `Tersimpan di perangkat, gagal kirim ke Sheet: ${
              (sheetErr as Error)?.message || 'kesalahan tidak diketahui'
            }`,
            'error',
            newRecord
          );
        }
      } else {
        // 2b. Jika token expired atau belum ada di memori, sambungkan secara halus
        if (!currentToken) {
          try {
            const authRes = await googleSignIn();
            if (authRes) {
              setUser(authRes.user);
              setToken(authRes.accessToken);
              currentToken = authRes.accessToken;
              if (
                !currentSheet ||
                currentSheet.id === 'setoran-ngaji-guru' ||
                currentSheet.id === 'setoran-ngaji-santri'
              ) {
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

        // 3. Append ke Google Sheet dengan timestamp persis
        if (
          currentToken &&
          currentSheet &&
          currentSheet.id !== 'setoran-ngaji-guru' &&
          currentSheet.id !== 'setoran-ngaji-santri'
        ) {
          await appendSetoranRow(currentToken, currentSheet.id, newRecord);
          showToast('Berhasil tersimpan', 'success', newRecord);
        } else {
          showToast('Berhasil tersimpan', 'success', newRecord);
        }
      }

      // Automatically add newly saved name to active list, cache, and recent storage
      const merged = Array.from(
        new Set([...sheetStudentNames, newRecord.studentName, ...getAllKnownStudentNames()])
      ).sort((a, b) => a.localeCompare(b, 'id'));
      setSheetStudentNames(merged);
      saveCachedSheetNames(merged);
      addRecentStudent(newRecord.studentName);

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
                      {toastMsg.record.capaianSummary === 'Sedang Halangan' ? ' (0 Juz)' : ''}
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

        {/* Main Content: Fitted inside viewport, scrolls gracefully on smaller mobile displays */}
        <main className="flex-1 overflow-y-auto px-4 py-3 flex flex-col" id="main-content">
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

        {/* Google Sheets / Database Configuration Modal */}
        <SheetConfigModal
          isOpen={showSheetModal}
          onClose={() => setShowSheetModal(false)}
          sheetMeta={sheetMeta}
          isLoading={isConnectingSheet}
          onCreateNewSheet={handleCreateNewSheet}
          onSelectCustomSheet={handleSelectCustomSheet}
        />
      </div>
    </div>
  );
}
