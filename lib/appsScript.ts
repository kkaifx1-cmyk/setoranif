/**
 * Klien untuk jembatan Google Apps Script (lihat apps-script/Code.gs).
 *
 * Dipakai kalau NEXT_PUBLIC_APPS_SCRIPT_URL (+ TOKEN) diisi, supaya aplikasi bisa
 * membaca daftar nama dan menyimpan setoran TANPA login Google / OAuth popup.
 *
 * Catatan: body dikirim sebagai `text/plain;charset=utf-8` (konvensi Apps Script) agar
 * browser tidak mengirim preflight OPTIONS — Apps Script tidak melayani preflight.
 */

const SCRIPT_URL = (process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '').trim();
const SCRIPT_TOKEN = (process.env.NEXT_PUBLIC_APPS_SCRIPT_TOKEN || '').trim();

export interface AppsScriptSetoran {
  id: string;
  datetimeFormatted: string;
  studentName: string;
  juzCount: number;
  halamanCount: number;
  capaianSummary: string;
  recorderName: string;
  timestamp: string;
}

interface ScriptResponse {
  ok?: boolean;
  error?: string;
  names?: string[];
  rowIndex?: number;
  title?: string;
  tabs?: string[];
}

/** True kalau kedua env var diisi, sehingga jalur tanpa-login bisa dipakai. */
export function isAppsScriptConfigured(): boolean {
  return SCRIPT_URL.length > 0 && SCRIPT_TOKEN.length > 0;
}

async function scriptCall(
  action: string,
  payload?: Record<string, unknown>
): Promise<ScriptResponse> {
  if (!isAppsScriptConfigured()) {
    throw new Error('Jembatan Apps Script belum dikonfigurasi.');
  }

  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    // text/plain menghindari preflight OPTIONS yang tidak dilayani Apps Script.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: SCRIPT_TOKEN, payload }),
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Jembatan Apps Script membalas HTTP ${res.status}.`);
  }

  const text = await res.text();
  let data: ScriptResponse;
  try {
    data = JSON.parse(text) as ScriptResponse;
  } catch {
    throw new Error('Balasan Apps Script bukan JSON (deployment mungkin belum "Anyone").');
  }

  if (data.ok !== true) {
    throw new Error(data.error || 'Apps Script menolak permintaan.');
  }
  return data;
}

/** Cek koneksi + lihat nama & daftar tab spreadsheet. */
export async function scriptPing(): Promise<{ title?: string; tabs?: string[] }> {
  const data = await scriptCall('ping');
  return { title: data.title, tabs: data.tabs };
}

/** Daftar nama guru dari tab "Daftar Guru" (fallback: kolom Nama Guru di Data Setoran). */
export async function scriptListNames(): Promise<string[]> {
  const data = await scriptCall('listNames');
  return Array.isArray(data.names) ? data.names : [];
}

/** Menambah satu baris setoran ke tab "Data Setoran". */
export async function scriptAppendSetoran(record: AppsScriptSetoran): Promise<number | undefined> {
  const data = await scriptCall('appendSetoran', { ...record });
  return data.rowIndex;
}
