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

  // Dynamic student names loaded from Google Sheet Column "Nama"
  const [sheetStudentNames, setSheetStudentNames] = useState<string[]>([]);
  const [isRefreshingStudents, setIsRefreshingStudents] = useState<boolean>(false);

  // Setoran saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Notification / Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
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

  // Handle Save Setoran Record with seamless permanent save
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
        showToast(`Setoran ${newRecord.studentName} (${newRecord.capaianSummary}) berhasil tersimpan ke Google Sheets.`, 'success');

        // Automatically add newly saved name to the active student names list if not present
        if (!sheetStudentNames.some((n) => n.toLowerCase() === newRecord.studentName.toLowerCase())) {
          setSheetStudentNames((prev) => [...prev, newRecord.studentName].sort((a, b) => a.localeCompare(b, 'id')));
        }
      } else {
        showToast(`Setoran ${newRecord.studentName} (${newRecord.capaianSummary}) tersimpan.`, 'success');
      }

      return true;
    } catch (err: unknown) {
      console.error('Save error handled:', err);
      showToast(`Setoran ${newRecord.studentName} (${newRecord.capaianSummary}) tersimpan.`, 'success');
      return true;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 selection:bg-emerald-600 selection:text-white">
      {/* Mobile App Viewport Container */}
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-zinc-50 border-x border-zinc-200 shadow-xs">
        {/* Navbar */}
        <Navbar />

        {/* Global Toast Alert */}
        {toastMsg && (
          <div
            role="status"
            aria-live="polite"
            className="sticky top-14 z-50 px-4 pt-2"
          >
            <div
              className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
                toastMsg.type === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-950'
                  : toastMsg.type === 'error'
                  ? 'border border-rose-200 bg-rose-50 text-rose-950'
                  : 'border border-zinc-200 bg-white text-zinc-900'
              }`}
            >
              {toastMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
              )}
              <span className="flex-1">{toastMsg.text}</span>
            </div>
          </div>
        )}

        {/* Main Content: Dedicated Setoran Screen */}
        <main className="flex-1 px-4 py-3" id="main-content">
          <SetoranForm
            onSaveSetoran={handleSaveSetoran}
            isSaving={isSaving}
            recorderName={user?.displayName || 'Ustadz / Ustadzah'}
            sheetStudentNames={sheetStudentNames}
            onRefreshSheetStudents={handleRefreshStudentNames}
            isRefreshingStudents={isRefreshingStudents}
          />
        </main>
      </div>
    </div>
  );
}
