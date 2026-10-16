import { DEFAULT_DB_CONFIG } from './dbConfig';
import { isAppsScriptConfigured, scriptListNames } from './appsScript';

export interface SetoranRecord {
  id: string;
  datetimeFormatted: string; // e.g. "Sabtu, 10 Okt 2026 14:35 WIB"
  studentName: string; // "Nama"
  juzCount: number; // e.g. 0, 1, 2, 3...
  halamanCount: number; // e.g. 0, 5, 10, 15...
  capaianSummary: string; // e.g. "2 Juz", "15 Halaman", "1 Juz 5 Halaman"
  recorderName: string; // e.g. "Ustadz / Ustadzah" or user.displayName
  timestamp: string; // ISO string
  rowIndex?: number; // 1-based index in sheet
  // Backwards compatibility optional fields
  category?: string;
  status?: string;
  notes?: string;
  detailHalamanAyat?: string;
  capaian?: string;
}

export interface SheetMeta {
  id: string;
  title: string;
  url: string;
  created?: boolean;
  accountEmail?: string;
}

const DEFAULT_SHEET_TITLE = DEFAULT_DB_CONFIG.spreadsheetTitle || 'One Day One Juz - SMAIT Ihsanul Fikri';
const SHEET_TAB_NAME = DEFAULT_DB_CONFIG.tabName || 'Data Setoran';

/**
 * Searches user's Google Drive for existing Setoran sheet, or creates a new one
 */
export async function findOrCreateSetoranSheet(
  accessToken: string,
  preferredSheetId?: string
): Promise<SheetMeta> {
  const activeTargetId =
    preferredSheetId && preferredSheetId !== 'setoran-ngaji-santri'
      ? preferredSheetId
      : DEFAULT_DB_CONFIG.spreadsheetId;

  // 0. If user or .env has a saved / verified sheet ID, prioritize and use it!
  if (activeTargetId) {
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${activeTargetId}?fields=properties(title)`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (checkRes.ok) {
        const sheetData = await checkRes.json();
        return {
          id: activeTargetId,
          title: sheetData.properties?.title || DEFAULT_SHEET_TITLE,
          url: `https://docs.google.com/spreadsheets/d/${activeTargetId}/edit`,
          created: false,
        };
      }
    } catch (err) {
      console.warn('Preferred sheet lookup error, continuing with fallback:', err);
    }
  }

  try {
    // 1. Search existing file in Drive
    const query = encodeURIComponent(
      `name = '${DEFAULT_SHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const file = searchData.files[0];
        return {
          id: file.id,
          title: file.name,
          url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
          created: false,
        };
      }
    }
  } catch (err) {
    console.warn('Drive search fallback to direct create or check:', err);
  }

  // 2. Create new spreadsheet with 2 tabs: 'Data Setoran' (riwayat) & 'Daftar Guru' (master database nama)
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: DEFAULT_SHEET_TITLE,
      },
      sheets: [
        {
          properties: {
            title: SHEET_TAB_NAME,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: 'Daftar Guru',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errorJson = await createRes.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || 'Gagal membuat Google Sheet baru.');
  }

  const createdSheet = await createRes.json();
  const spreadsheetId = createdSheet.spreadsheetId;

  // 3. Populate header row in 'Data Setoran'
  const headerValues = [
    [
      'ID Setoran',
      'Tanggal & Waktu',
      'Nama Guru',
      'Capaian Juz',
      'Capaian Halaman',
      'Ringkasan Capaian',
      'Dicatat Oleh',
      'Timestamp ISO',
    ],
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      SHEET_TAB_NAME
    )}!A1:H1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: headerValues,
      }),
    }
  );

  // 4. Populate header row in 'Daftar Guru'
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      'Daftar Guru'
    )}!A1:A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [['Nama Guru']],
      }),
    }
  );

  return {
    id: spreadsheetId,
    title: DEFAULT_SHEET_TITLE,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    created: true,
  };
}

/**
 * Helper to fetch all tabs in the spreadsheet to avoid failing when tab name is not default
 */
export interface SheetTabInfo {
  sheetId: number;
  title: string;
}

export async function getSpreadsheetTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<SheetTabInfo[]> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.sheets || []).map((s: { properties?: { sheetId?: number; title?: string } }) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title || 'Sheet1',
    }));
  } catch (err) {
    console.warn('Failed to get spreadsheet tabs:', err);
    return [];
  }
}

/**
 * Appends a new setoran row to Google Sheets
 */
export async function appendSetoranRow(
  accessToken: string,
  spreadsheetId: string,
  record: SetoranRecord
): Promise<boolean> {
  // Dynamically resolve sheet tab
  const tabs = await getSpreadsheetTabs(accessToken, spreadsheetId);
  let targetTab = SHEET_TAB_NAME;
  if (tabs.length > 0) {
    const match =
      tabs.find((t) => t.title.toLowerCase() === SHEET_TAB_NAME.toLowerCase()) ||
      tabs.find((t) => /setoran|data/i.test(t.title)) ||
      tabs[0];
    if (match) targetTab = match.title;
  }

  const row = [
    record.id,
    record.datetimeFormatted,
    record.studentName,
    record.juzCount ? `${record.juzCount} Juz` : '0 Juz',
    record.halamanCount ? `${record.halamanCount} Halaman` : '0 Halaman',
    record.capaianSummary,
    record.recorderName,
    record.timestamp,
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      targetTab
    )}!A:H:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || 'Gagal menyimpan baris ke Google Sheet.');
  }

  return true;
}

/**
 * Fetches all setoran entries from Google Sheets
 */
export async function fetchSetoranRows(
  accessToken: string,
  spreadsheetId: string
): Promise<SetoranRecord[]> {
  const tabs = await getSpreadsheetTabs(accessToken, spreadsheetId);
  let targetTab = SHEET_TAB_NAME;
  if (tabs.length > 0) {
    const match =
      tabs.find((t) => t.title.toLowerCase() === SHEET_TAB_NAME.toLowerCase()) ||
      tabs.find((t) => /setoran|data/i.test(t.title)) ||
      tabs[0];
    if (match) targetTab = match.title;
  }

  const range = `${encodeURIComponent(targetTab)}!A2:J1000`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || 'Gagal membaca data dari Google Sheet.');
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  return rows
    .map((row, idx) => {
      if (!row || row.length < 3) return null;

      // Extract juz and halaman
      let juz = 0;
      let hal = 0;
      let summary = '';

      if (row.length >= 6 && (row[3]?.includes('Juz') || row[4]?.includes('Halaman'))) {
        // New format: [ID, Waktu, Nama, Juz, Halaman, Summary, Recorder, Timestamp]
        juz = parseInt(row[3]?.replace(/\D/g, '') || '0') || 0;
        hal = parseInt(row[4]?.replace(/\D/g, '') || '0') || 0;
        summary =
          row[5] ||
          (juz && hal
            ? `${juz} Juz ${hal} Halaman`
            : juz
            ? `${juz} Juz`
            : hal
            ? `${hal} Halaman`
            : '0 Juz');
      } else {
        // Old format: [ID, Waktu, Nama, Kategori, Capaian, Detail, Status, Notes, Recorder, Timestamp]
        summary = row[4] ? `${row[4]} ${row[5] || ''}`.trim() : (row[3] || '');
      }

      return {
        id: row[0] || `REC-${idx + 1}`,
        datetimeFormatted: row[1] || '',
        studentName: row[2] || '',
        juzCount: juz,
        halamanCount: hal,
        capaianSummary: summary || 'Setoran Ngaji',
        recorderName: row[6] || row[8] || '',
        timestamp: row[7] || row[9] || new Date().toISOString(),
        rowIndex: idx + 2,
      } as SetoranRecord;
    })
    .filter((item): item is SetoranRecord => item !== null)
    .reverse(); // Newest first
}

/**
 * Validates if string looks like an actual student name
 */
function isValidStudentName(val: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  if (lower.length < 2) return false;
  // Ignore common column headers
  const ignoredHeaders = [
    'nama',
    'nama guru',
    'guru',
    'nama santri',
    'nama siswa',
    'nama ustadz',
    'nama ustadzah',
    'nama lengkap',
    'name',
    'id setoran',
    'tanggal & waktu',
    'tanggal',
    'waktu',
    'capaian juz',
    'capaian halaman',
    'ringkasan capaian',
    'dicatat oleh',
    'timestamp iso',
    'status',
    'kategori',
    'catatan',
    'no',
    'nomor',
  ];
  if (ignoredHeaders.includes(lower)) return false;
  // Ignore system identifiers or ISO timestamps
  if (/^(odoj-|rec-|\d{4}-\d{2}-\d{2})/i.test(lower)) return false;
  // Ignore capaian phrases like "1 Juz", "5 Halaman" or "Sedang Halangan"
  if (/^\d+\s*(juz|halaman|hal)/i.test(lower)) return false;
  if (lower.includes('halangan')) return false;
  // Ignore pure numeric values or times
  if (/^\d+$/.test(lower) || /^\d{2}:\d{2}/.test(lower)) return false;
  return true;
}

/**
 * Fetches unique student names from Google Sheets
 * Searches dynamically for the 'Nama' column across sheet tabs and falls back intelligently
 */
export async function fetchStudentNamesFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<string[]> {
  try {
    const tabs = await getSpreadsheetTabs(accessToken, spreadsheetId);

    // 1. Check if user created a dedicated master tab for teachers / guru
    // Examples: 'Daftar Guru', 'Guru', 'Data Guru', 'Master Guru', 'Ustadz', 'Daftar Ustadz', 'Daftar Nama', 'Nama'
    const dedicatedNamesTab = tabs.find(
      (t) =>
        /daftar.*guru|data.*guru|master.*guru|^guru$|ustadz|ustadzah|pegawai|daftar.*nama|database.*nama|^nama$/i.test(
          t.title
        ) && !/setoran/i.test(t.title)
    );

    // Prioritize sheet tabs
    let primaryTabTitle = SHEET_TAB_NAME;
    if (tabs.length > 0) {
      const match =
        tabs.find((t) => t.title.toLowerCase() === SHEET_TAB_NAME.toLowerCase()) ||
        tabs.find((t) => /setoran|data/i.test(t.title)) ||
        tabs[0];
      if (match) {
        primaryTabTitle = match.title;
      }
    }

    const nameSet = new Set<string>();

    // Helper to scan a sheet tab and extract names
    const scanTab = async (tabTitle: string) => {
      try {
        const range = `${encodeURIComponent(tabTitle)}!A1:Z500`;
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!res.ok) return;

        const data = await res.json();
        const rows: string[][] = data.values || [];
        if (rows.length === 0) return;

        // Check header row (row 0) to find column with 'Nama Guru' or 'Nama'
        const headerRow = rows[0] || [];
        const nameColIndex = headerRow.findIndex((col) => {
          const c = (col || '').toString().toLowerCase().trim();
          return (
            c === 'nama guru' ||
            c === 'nama' ||
            c === 'guru' ||
            c === 'nama ustadz' ||
            c === 'nama ustadzah' ||
            c === 'nama lengkap' ||
            c === 'name' ||
            c.includes('guru') ||
            c.includes('nama')
          );
        });

        const startIdx = nameColIndex >= 0 ? 1 : 0;
        // In a dedicated tab, Column A (index 0) is usually the name list!
        const candidateCols =
          nameColIndex >= 0
            ? [nameColIndex]
            : dedicatedNamesTab && dedicatedNamesTab.title === tabTitle
            ? [0, 1]
            : [2, 1, 0];

        for (let r = startIdx; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;

          for (const colIdx of candidateCols) {
            const cellVal = (row[colIdx] || '').toString().trim();
            if (isValidStudentName(cellVal)) {
              nameSet.add(cellVal);
              break;
            }
          }
        }
      } catch (err) {
        console.warn(`Error scanning tab ${tabTitle}:`, err);
      }
    };

    // If user has a dedicated master tab for names, ONLY scan this master tab!
    // This ensures deleted names in the master table do not resurrect from old setoran history.
    if (dedicatedNamesTab) {
      await scanTab(dedicatedNamesTab.title);
      return Array.from(nameSet).sort((a, b) => a.localeCompare(b, 'id'));
    }

    // Otherwise scan the primary setoran tab
    await scanTab(primaryTabTitle);

    return Array.from(nameSet).sort((a, b) => a.localeCompare(b, 'id'));
  } catch (err) {
    console.warn('Gagal mengambil daftar nama dari Google Sheet:', err);
    return [];
  }
}

/**
 * Reads student names directly from public / shared Google Sheet
 * Works immediately on page load without requiring OAuth or sign-in popup
 */
export async function fetchStudentNamesPublicly(spreadsheetId: string): Promise<string[]> {
  if (
    !spreadsheetId ||
    spreadsheetId === 'setoran-ngaji-guru' ||
    spreadsheetId === 'setoran-ngaji-santri'
  )
    return [];

  // Check dedicated master tabs first, then default tab
  const candidateTabs = [
    'Daftar Guru',
    'Guru',
    'Data Guru',
    'Master Guru',
    'Daftar Nama',
    'Data Setoran',
    '',
  ];

  for (const tabName of candidateTabs) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json${
        tabName ? `&sheet=${encodeURIComponent(tabName)}` : ''
      }`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
      if (!jsonMatch || !jsonMatch[1]) continue;
      const data = JSON.parse(jsonMatch[1]);
      if (data.status !== 'ok' || !data.table) continue;

      const cols: { label?: string; id?: string }[] = data.table.cols || [];
      const rows: { c?: ({ v?: unknown; f?: string } | null)[] }[] = data.table.rows || [];
      if (rows.length === 0) continue;

      // Find column with "Nama"
      let nameColIdx = cols.findIndex((col) => {
        const label = (col.label || '').toLowerCase();
        return label.includes('nama');
      });

      // If not in cols header, check first row
      if (nameColIdx === -1 && rows.length > 0) {
        const firstRow = rows[0]?.c || [];
        nameColIdx = firstRow.findIndex((cell) => {
          const val = (cell?.v ?? cell?.f ?? '').toString().toLowerCase();
          return val.includes('nama');
        });
      }

      // If dedicated tab, prefer column 0 or detected column
      const targetCols =
        nameColIdx >= 0 ? [nameColIdx] : tabName ? [0, 1] : [2, 1, 0];
      const nameSet = new Set<string>();

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]?.c || [];
        for (const colIdx of targetCols) {
          const cell = row[colIdx];
          const val = (cell?.v ?? cell?.f ?? '').toString().trim();
          if (isValidStudentName(val)) {
            nameSet.add(val);
            break;
          }
        }
      }

      const results = Array.from(nameSet).sort((a, b) => a.localeCompare(b, 'id'));
      if (results.length > 0) {
        return results;
      }
    } catch {
      // try next tab
    }
  }

  return [];
}

/**
 * Smart fetch: attempts instant public/shared spreadsheet query first,
 * or uses authenticated Google Sheets API if accessToken is provided.
 */
export async function fetchStudentNamesSmart(
  spreadsheetId: string,
  accessToken?: string | null
): Promise<string[]> {
  if (
    !spreadsheetId ||
    spreadsheetId === 'setoran-ngaji-guru' ||
    spreadsheetId === 'setoran-ngaji-santri'
  )
    return [];

  // 0. Jembatan Apps Script (tanpa login) — paling andal, dan bekerja walau sheet privat
  if (isAppsScriptConfigured()) {
    try {
      const scriptNames = await scriptListNames();
      if (scriptNames.length > 0) return scriptNames;
    } catch {
      // lanjut ke jalur lain
    }
  }

  // 1. Try instant public query (works if sheet is shared or viewable)
  try {
    const publicNames = await fetchStudentNamesPublicly(spreadsheetId);
    if (publicNames.length > 0) return publicNames;
  } catch {
    // continue
  }

  // 2. Try authenticated API if token available
  if (accessToken) {
    try {
      const authNames = await fetchStudentNamesFromSheet(accessToken, spreadsheetId);
      if (authNames.length > 0) return authNames;
    } catch {
      // ignore
    }
  }

  return [];
}

/**
 * Destructive operation: Deletes a specific row in the Google Sheet.
 * (MUST be invoked only with user confirmation modal in UI per workspace security rules)
 */
export async function deleteSetoranRow(
  accessToken: string,
  spreadsheetId: string,
  rowIndex: number
): Promise<boolean> {
  // First retrieve sheet tab ID
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    throw new Error('Gagal mengambil metadata sheet untuk menghapus baris.');
  }

  const metaData = await metaRes.json();
  const targetSheet = metaData.sheets?.find(
    (s: { properties?: { title?: string } }) => s.properties?.title === SHEET_TAB_NAME
  ) || metaData.sheets?.[0];

  const sheetId = targetSheet?.properties?.sheetId ?? 0;

  // Delete dimension request (0-indexed)
  const startIndex = rowIndex - 1;
  const endIndex = rowIndex;

  const deleteRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: startIndex,
                endIndex: endIndex,
              },
            },
          },
        ],
      }),
    }
  );

  if (!deleteRes.ok) {
    const errorJson = await deleteRes.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || 'Gagal menghapus baris dari Google Sheet.');
  }

  return true;
}
