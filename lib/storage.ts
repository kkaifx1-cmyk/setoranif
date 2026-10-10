import { SetoranRecord } from './googleSheets';

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
  if (typeof window === 'undefined') return ['Ahmad', 'Fatimah', 'Muhammad', 'Aisyah', 'Zaid'];
  try {
    const raw = localStorage.getItem(RECENT_STUDENTS_KEY);
    return raw ? JSON.parse(raw) : ['Ahmad', 'Fatimah', 'Muhammad', 'Aisyah', 'Zaid'];
  } catch {
    return ['Ahmad', 'Fatimah', 'Muhammad', 'Aisyah', 'Zaid'];
  }
}

export function addRecentStudent(name: string): void {
  if (typeof window === 'undefined' || !name.trim()) return;
  try {
    const current = getRecentStudents();
    const cleanName = name.trim();
    const filtered = current.filter((n) => n.toLowerCase() !== cleanName.toLowerCase());
    const updated = [cleanName, ...filtered].slice(0, 12);
    localStorage.setItem(RECENT_STUDENTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save recent student', e);
  }
}

export function getSavedSheetId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SAVED_SHEET_KEY);
}

export function setSavedSheetId(sheetId: string | null): void {
  if (typeof window === 'undefined') return;
  if (sheetId) {
    localStorage.setItem(SAVED_SHEET_KEY, sheetId);
  } else {
    localStorage.removeItem(SAVED_SHEET_KEY);
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
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SAVED_SHEET_META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
