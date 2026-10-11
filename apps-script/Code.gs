/**
 * One Day One Juz — jembatan Google Apps Script
 * =============================================
 * Skrip ini membuat aplikasi bisa membaca & menulis spreadsheet TANPA login Google:
 * tidak perlu Google Cloud, tidak perlu mengaktifkan Sheets/Drive API, tidak ada popup.
 *
 * CARA PASANG (lihat juga apps-script/README.md):
 *  1. Buka spreadsheet "Setoran Ngaji Guru" di Google Sheets.
 *  2. Menu Extensions (Ekstensi) -> Apps Script.
 *  3. Hapus isi editor, tempel SELURUH isi file ini.
 *  4. Ganti nilai SECRET di bawah dengan kata rahasia pilihanmu (bebas, minimal 12 karakter).
 *  5. Deploy -> New deployment -> pilih "Web app".
 *     - Execute as       : Me (akun kamu)
 *     - Who has access   : Anyone
 *     -> Deploy -> Authorize access -> pilih akun -> Advanced -> Go to ... (unsafe) -> Allow.
 *  6. Salin URL yang berakhiran "/exec".
 *  7. Cek di browser: <URL>/exec?action=ping&token=<SECRET>
 *     Harus muncul JSON {"ok":true,...}. Kalau ya, sambungkan ke aplikasi:
 *       NEXT_PUBLIC_APPS_SCRIPT_URL="<URL /exec>"
 *       NEXT_PUBLIC_APPS_SCRIPT_TOKEN="<SECRET>"
 *     (lihat .env.example)
 *
 * CATATAN KEAMANAN: siapa pun yang tahu URL + SECRET bisa menambah/membaca baris di
 * spreadsheet ini. Karena itu SECRET wajib diganti, dan jangan dibagikan ke luar.
 */

// ====== WAJIB DIUBAH ======
var SECRET = 'smaitif2009';
// ==========================

var TAB_SETORAN = 'Data Setoran';
var TAB_GURU = 'Daftar Guru';
var HEADERS_SETORAN = [
  'ID Setoran',
  'Tanggal & Waktu',
  'Nama Guru',
  'Capaian Juz',
  'Capaian Halaman',
  'Ringkasan Capaian',
  'Dicatat Oleh',
  'Timestamp ISO',
];

function json_(obj) {
  var out = ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
  // Header CORS supaya browser boleh membaca balasan dari domain aplikasi.
  // Dibungkus try/catch agar tetap jalan di runtime Apps Script yang lebih lama.
  try {
    out.setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
  } catch (err) {
    // abaikan: header CORS opsional
  }
  return out;
}

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (headers && sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function doGet(e) {
  return handle_({
    action: (e && e.parameter && e.parameter.action) || 'ping',
    token: e && e.parameter && e.parameter.token,
  });
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Body bukan JSON yang valid.' });
  }
  return handle_(body);
}

function handle_(body) {
  if (String(body.token || '') !== String(SECRET)) {
    return json_({ ok: false, error: 'Token salah.' });
  }
  try {
    var payload = body.payload || {};
    switch (body.action) {
      case 'ping':
        return json_({
          ok: true,
          title: SpreadsheetApp.getActiveSpreadsheet().getName(),
          tabs: SpreadsheetApp.getActiveSpreadsheet()
            .getSheets()
            .map(function (s) {
              return s.getName();
            }),
        });
      case 'listNames':
        return json_(listNames_());
      case 'appendSetoran':
        return json_(appendSetoran_(payload));
      case 'listSetoran':
        return json_(listSetoran_());
      case 'deleteSetoran':
        return json_(deleteSetoran_(payload));
      default:
        return json_({ ok: false, error: 'Aksi tidak dikenal: ' + body.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/** Nama guru: dari tab "Daftar Guru" (kolom A), jika kosong fallback ke kolom "Nama Guru" di Data Setoran. */
function listNames_() {
  var names = [];
  var seen = {};
  var shGuru = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_GURU);
  if (shGuru && shGuru.getLastRow() > 1) {
    var values = shGuru.getRange(2, 1, shGuru.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      var v = String(values[i][0] || '').trim();
      if (v && !seen[v.toLowerCase()]) {
        seen[v.toLowerCase()] = true;
        names.push(v);
      }
    }
  }
  if (names.length === 0) {
    var shSetoran = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_SETORAN);
    if (shSetoran && shSetoran.getLastRow() > 1) {
      var rows = shSetoran.getRange(2, 1, shSetoran.getLastRow() - 1, 3).getValues();
      for (var r = 0; r < rows.length; r++) {
        var n = String(rows[r][2] || '').trim();
        if (n && !seen[n.toLowerCase()]) {
          seen[n.toLowerCase()] = true;
          names.push(n);
        }
      }
    }
  }
  names.sort(function (a, b) {
    return a.localeCompare(b, 'id');
  });
  return { ok: true, names: names };
}

function appendSetoran_(p) {
  var sh = sheet_(TAB_SETORAN, HEADERS_SETORAN);
  var juz = Number(p.juzCount || 0);
  var hal = Number(p.halamanCount || 0);
  sh.appendRow([
    String(p.id || ''),
    String(p.datetimeFormatted || ''),
    String(p.studentName || ''),
    juz ? juz + ' Juz' : '0 Juz',
    hal ? hal + ' Halaman' : '0 Halaman',
    String(p.capaianSummary || ''),
    String(p.recorderName || ''),
    String(p.timestamp || new Date().toISOString()),
  ]);
  return { ok: true, rowIndex: sh.getLastRow() };
}

function listSetoran_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_SETORAN);
  if (!sh || sh.getLastRow() < 2) return { ok: true, rows: [] };
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
  var rows = values.map(function (r, idx) {
    return {
      id: String(r[0] || ''),
      datetimeFormatted: String(r[1] || ''),
      studentName: String(r[2] || ''),
      juzCount: parseInt(String(r[3]).replace(/\D/g, ''), 10) || 0,
      halamanCount: parseInt(String(r[4]).replace(/\D/g, ''), 10) || 0,
      capaianSummary: String(r[5] || ''),
      recorderName: String(r[6] || ''),
      timestamp: String(r[7] || ''),
      rowIndex: idx + 2,
    };
  });
  rows.reverse(); // terbaru dulu
  return { ok: true, rows: rows };
}

function deleteSetoran_(p) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_SETORAN);
  var rowIndex = Number(p.rowIndex || 0);
  if (!sh || rowIndex < 2 || rowIndex > sh.getLastRow()) {
    return { ok: false, error: 'rowIndex tidak valid.' };
  }
  sh.deleteRow(rowIndex);
  return { ok: true };
}
