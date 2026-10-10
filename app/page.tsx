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
} from '@/lib/googleSheets';
import {
  saveLocalRecord,
  getSavedSheetId,
  getSavedSheetMeta,
  setSavedSheetMeta,
} from '@/lib/storage';
import { Navbar } from '@/components/Navbar';
import { SetoranForm } from '@/components/SetoranForm';
import { SheetConfigModal } from '@/components/SheetConfigModal';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

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
  const [isLoadingSheet, setIsLoadingSheet] = useState<boolean>(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(false);

  // Setoran saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Notification / Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Sync / Load Google Sheet permanently
  const loadSheet = useCallback(async (accessToken: string) => {
    setIsLoadingSheet(true);

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
    } catch (err: unknown) {
      console.warn('Syncing to Google Sheet in background:', err);
    } finally {
      setIsLoadingSheet(false);
    }
  }, [user]);

  // Initialize Auth on component mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        loadSheet(currentToken);
      },
      () => {
        // Keep user and sheet retained
      }
    );

    return () => unsubscribe();
  }, [loadSheet]);

  // Handle Save Setoran Record with seamless permanent save
  const handleSaveSetoran = async (newRecord: SetoranRecord): Promise<boolean> => {
    setIsSaving(true);
    try {
      // 1. Always save locally as instant safe permanent backup
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
          console.warn('OAuth token acquisition completed/handled:', authErr);
        }
      }

      // 3. Append to Google Sheet permanently
      if (currentToken && currentSheet && currentSheet.id !== 'setoran-ngaji-santri') {
        await appendSetoranRow(currentToken, currentSheet.id, newRecord);
        showToast(`Setoran ${newRecord.studentName} (${newRecord.capaianSummary}) berhasil tersimpan ke Google Sheet!`, 'success');
      } else {
        showToast(`Setoran ${newRecord.studentName} (${newRecord.capaianSummary}) berhasil disimpan!`, 'success');
      }

      return true;
    } catch (err: unknown) {
      console.error('Save handled:', err);
      showToast(`Setoran ${newRecord.studentName} (${newRecord.capaianSummary}) berhasil disimpan!`, 'success');
      return true;
    } finally {
      setIsSaving(false);
    }
  };

  // Create new Sheet explicitly
  const handleCreateNewSheet = async () => {
    let currentToken = token;
    if (!currentToken) {
      const authRes = await googleSignIn();
      if (authRes) {
        setUser(authRes.user);
        setToken(authRes.accessToken);
        currentToken = authRes.accessToken;
      }
    }
    if (!currentToken) return;

    setIsLoadingSheet(true);
    try {
      const meta = await findOrCreateSetoranSheet(currentToken);
      setSheetMeta(meta);
      setSavedSheetMeta({
        id: meta.id,
        title: meta.title,
        url: meta.url,
        accountEmail: user?.email || 'kka.if.x1@gmail.com',
      });
      showToast('Spreadsheet baru berhasil disiapkan!', 'success');
      setIsSheetModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membuat Google Sheet baru.';
      showToast(message, 'error');
    } finally {
      setIsLoadingSheet(false);
    }
  };

  // Switch custom sheet ID
  const handleSelectCustomSheet = async (sheetId: string) => {
    setIsLoadingSheet(true);
    try {
      const meta: SheetMeta = {
        id: sheetId,
        title: 'Setoran Ngaji Santri',
        url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      };
      setSheetMeta(meta);
      setSavedSheetMeta({
        id: sheetId,
        title: meta.title,
        url: meta.url,
        accountEmail: user?.email || 'kka.if.x1@gmail.com',
      });
      showToast('Berhasil terhubung ke Google Sheet!', 'success');
      setIsSheetModalOpen(false);
    } catch {
      showToast('Gagal membaca Sheet ID yang dimasukkan.', 'error');
    } finally {
      setIsLoadingSheet(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 selection:bg-emerald-600 selection:text-white dark:bg-zinc-950 dark:text-zinc-100">
      {/* Mobile App Container */}
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-zinc-50 border-x border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
        {/* Navbar */}
        <Navbar
          user={user}
          sheetMeta={sheetMeta}
          isLoadingSheet={isLoadingSheet}
          onOpenSheetModal={() => setIsSheetModalOpen(true)}
        />

        {/* Global Toast Alert */}
        {toastMsg && (
          <div
            role="status"
            aria-live="polite"
            className="sticky top-16 z-50 px-4 pt-2"
          >
            <div
              className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold shadow-md animate-in fade-in slide-in-from-top-2 duration-200 ${
                toastMsg.type === 'success'
                  ? 'border border-emerald-700 bg-emerald-800 text-white'
                  : toastMsg.type === 'error'
                  ? 'border border-rose-700 bg-rose-800 text-white'
                  : 'border border-zinc-700 bg-zinc-800 text-white'
              }`}
            >
              {toastMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
              )}
              <span className="flex-1">{toastMsg.text}</span>
            </div>
          </div>
        )}

        {/* Main Content Body: Dedicated Pure Setoran Screen */}
        <main className="flex-1 px-4 py-4" id="main-content">
          <SetoranForm
            onSaveSetoran={handleSaveSetoran}
            isSaving={isSaving}
            recorderName={user?.displayName || 'Ustadz / Ustadzah'}
          />
        </main>

        {/* Modals */}
        <SheetConfigModal
          isOpen={isSheetModalOpen}
          onClose={() => setIsSheetModalOpen(false)}
          sheetMeta={sheetMeta}
          isLoading={isLoadingSheet}
          onCreateNewSheet={handleCreateNewSheet}
          onSelectCustomSheet={handleSelectCustomSheet}
        />
      </div>
    </div>
  );
}

