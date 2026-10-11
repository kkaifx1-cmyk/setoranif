import { SetoranRecord } from './googleSheets';
import { DEFAULT_DB_CONFIG } from './dbConfig';

const LOCAL_STORAGE_KEY = 'setoran_ngaji_local_records_v1';
const RECENT_STUDENTS_KEY = 'setoran_ngaji_recent_students_v1';
const SAVED_SHEET_KEY = 'setoran_ngaji_active_sheet_v1';

export function getLocalRecords(): SetoranRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load local records', e);
    return [];
  }
}

export function saveLocalRecord(record: SetoranRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalRecords();
    const updated = [record, ...list.filter((r) => r.id !== record.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated.slice(0, 100)));
    addRecentStudent(record.studentName);
  } catch (e) {
    console.error('Failed to save local record', e);
  }
}

export function removeLocalRecord(recordId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalRecords();
    const updated = list.filter((r) => r.id !== recordId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to remove local record', e);
  }
}

export function getRecentStudents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_STUDENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentStudent(name: string): void {
  if (typeof window === 'undefined' || !name.trim()) return;
  try {
    const current = getRecentStudents();
    const cleanName = name.trim();
    const filtered = current.filter((n) => n.toLowerCase() !== cleanName.toLowerCase());
    const updated = [cleanName, ...filtered].slice(0, 50);
    localStorage.setItem(RECENT_STUDENTS_KEY, JSON.stringify(updated));

    // Also persist in cached sheet names
    const cached = getCachedSheetNames();
    if (!cached.some((n) => n.toLowerCase() === cleanName.toLowerCase())) {
      saveCachedSheetNames([...cached, cleanName].sort((a, b) => a.localeCompare(b, 'id')));
    }
  } catch (e) {
    console.error('Failed to save recent student', e);
  }
}

export function getSavedSheetId(): string | null {
  if (typeof window === 'undefined') {
    return DEFAULT_DB_CONFIG.spreadsheetId || null;
  }
  try {
    const fromLocal = localStorage.getItem(SAVED_SHEET_KEY);
    if (
      fromLocal &&
      fromLocal !== 'setoran-ngaji-guru' &&
      fromLocal !== 'setoran-ngaji-santri'
    ) {
      return fromLocal;
    }
  } catch (e) {
    console.warn('Failed to read saved sheet ID from localStorage:', e);
  }
  return DEFAULT_DB_CONFIG.spreadsheetId || null;
}

export function setSavedSheetId(sheetId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (sheetId) {
      localStorage.setItem(SAVED_SHEET_KEY, sheetId);
    } else {
      localStorage.removeItem(SAVED_SHEET_KEY);
    }
  } catch (e) {
    console.warn('Failed to set saved sheet ID in localStorage:', e);
  }
}

const SAVED_SHEET_META_KEY = 'setoran_ngaji_active_sheet_meta_v1';

export interface PersistedSheetMeta {
  id: string;
  title: string;
  url: string;
  accountEmail?: string;
}

export function getSavedSheetMeta(): PersistedSheetMeta | null {
  if (typeof window === 'undefined') {
    if (DEFAULT_DB_CONFIG.spreadsheetId) {
      return {
        id: DEFAULT_DB_CONFIG.spreadsheetId,
        title: DEFAULT_DB_CONFIG.spreadsheetTitle,
        url:
          DEFAULT_DB_CONFIG.spreadsheetUrl ||
          `https://docs.google.com/spreadsheets/d/${DEFAULT_DB_CONFIG.spreadsheetId}/edit`,
      };
    }
    return null;
  }
  try {
    const raw = localStorage.getItem(SAVED_SHEET_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed?.id &&
        parsed.id !== 'setoran-ngaji-guru' &&
        parsed.id !== 'setoran-ngaji-santri'
      ) {
        return parsed;
      }
    }
  } catch {
    // continue to fallback
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

  return null;
}

export function setSavedSheetMeta(meta: PersistedSheetMeta | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (meta) {
      localStorage.setItem(SAVED_SHEET_META_KEY, JSON.stringify(meta));
      setSavedSheetId(meta.id);
    } else {
      localStorage.removeItem(SAVED_SHEET_META_KEY);
      setSavedSheetId(null);
    }
  } catch (e) {
    console.error('Failed to save sheet meta', e);
  }
}

const CACHED_SHEET_NAMES_KEY = 'setoran_ngaji_cached_sheet_names_v1';

export function getCachedSheetNames(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHED_SHEET_NAMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedSheetNames(names: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHED_SHEET_NAMES_KEY, JSON.stringify(names));
    // Clean up recent students so names deleted from Google Sheet do not linger
    const validSet = new Set(names.map((n) => n.toLowerCase().trim()));
    const recent = getRecentStudents();
    const cleanedRecent = recent.filter((r) => validSet.has(r.toLowerCase().trim()));
    localStorage.setItem(RECENT_STUDENTS_KEY, JSON.stringify(cleanedRecent));
  } catch (e) {
    console.error('Failed to cache sheet names', e);
  }
}

/**
 * Returns student names currently active and cached from Google Sheets.
 * Does not revive old deleted names from past local setoran records.
 */
export function getAllKnownStudentNames(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const fromCache = getCachedSheetNames();
    const seen = new Set<string>();
    const list: string[] = [];

    for (const raw of fromCache) {
      const clean = (raw || '').trim();
      if (!clean) continue;
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        list.push(clean);
      }
    }

    return list.sort((a, b) => a.localeCompare(b, 'id'));
  } catch (err) {
    console.error('Failed to retrieve active student names', err);
    return [];
  }
}
