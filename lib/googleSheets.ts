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

const DEFAULT_SHEET_TITLE = 'Setoran Ngaji Santri';
const SHEET_TAB_NAME = 'Data Setoran';

/**
 * Searches user's Google Drive for existing Setoran sheet, or creates a new one
 */
export async function findOrCreateSetoranSheet(
  accessToken: string,
  preferredSheetId?: string
): Promise<SheetMeta> {
  // 0. If user has a saved / verified sheet ID, prioritize and use it!
  if (preferredSheetId) {
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${preferredSheetId}?fields=properties(title)`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (checkRes.ok) {
        const sheetData = await checkRes.json();
        return {
          id: preferredSheetId,
          title: sheetData.properties?.title || DEFAULT_SHEET_TITLE,
          url: `https://docs.google.com/spreadsheets/d/${preferredSheetId}/edit`,
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

  // 2. Create new spreadsheet if not found
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
      ],
    }),
  });

  if (!createRes.ok) {
    const errorJson = await createRes.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || 'Gagal membuat Google Sheet baru.');
  }

  const createdSheet = await createRes.json();
  const spreadsheetId = createdSheet.spreadsheetId;

  // 3. Populate header row with simplified columns
  const headerValues = [
    [
      'ID Setoran',
      'Tanggal & Waktu',
      'Nama',
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

  return {
    id: spreadsheetId,
    title: DEFAULT_SHEET_TITLE,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    created: true,
  };
}

/**
 * Appends a new setoran row to Google Sheets
 */
export async function appendSetoranRow(
  accessToken: string,
  spreadsheetId: string,
  record: SetoranRecord
): Promise<boolean> {
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
      SHEET_TAB_NAME
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
  const range = `${encodeURIComponent(SHEET_TAB_NAME)}!A2:J1000`;
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
        summary = row[5] || (juz ? `${juz} Juz` : `${hal} Halaman`);
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
 * Fetches unique student names from the 'Nama' column (Column C) in Google Sheets
 */
export async function fetchStudentNamesFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<string[]> {
  try {
    const range = `${encodeURIComponent(SHEET_TAB_NAME)}!C2:C500`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const rows: string[][] = data.values || [];

    const nameSet = new Set<string>();
    for (const row of rows) {
      const val = row[0]?.trim();
      if (val && val.toLowerCase() !== 'nama' && val.length > 1) {
        nameSet.add(val);
      }
    }

    return Array.from(nameSet).sort((a, b) => a.localeCompare(b, 'id'));
  } catch (err) {
    console.warn('Gagal mengambil daftar nama dari Google Sheet:', err);
    return [];
  }
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
