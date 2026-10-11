/**
 * Central Database & Google Sheets Configuration
 * Reads default values from environment variables (process.env.NEXT_PUBLIC_SPREADSHEET_ID)
 * or falls back to permanent application defaults.
 */

export interface DatabaseConfig {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  tabName: string;
}

export const DEFAULT_DB_CONFIG: DatabaseConfig = {
  // Can be configured via NEXT_PUBLIC_SPREADSHEET_ID in .env
  spreadsheetId: process.env.NEXT_PUBLIC_SPREADSHEET_ID || '',
  spreadsheetTitle: process.env.NEXT_PUBLIC_SPREADSHEET_TITLE || 'One Day One Juz - SMAIT Ihsanul Fikri',
  spreadsheetUrl: process.env.NEXT_PUBLIC_SPREADSHEET_URL || '',
  tabName: 'Data Setoran',
};

/**
 * Returns formatted .env string snippet for the currently active spreadsheet
 */
export function formatEnvSnippet(sheetId: string, sheetTitle?: string): string {
  return [
    `# Konfigurasi Database Spreadsheet Utama`,
    `NEXT_PUBLIC_SPREADSHEET_ID="${sheetId}"`,
    `NEXT_PUBLIC_SPREADSHEET_TITLE="${sheetTitle || DEFAULT_DB_CONFIG.spreadsheetTitle}"`,
    `NEXT_PUBLIC_SPREADSHEET_URL="https://docs.google.com/spreadsheets/d/${sheetId}/edit"`,
  ].join('\n');
}
