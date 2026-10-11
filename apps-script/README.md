# Jembatan Google Apps Script (tanpa login & tanpa Google Cloud)

Tujuan: aplikasi bisa **membaca daftar nama** dan **menyimpan setoran** ke Google Sheet
tanpa popup login, tanpa mengaktifkan Sheets/Drive API, dan tanpa OAuth consent screen.

## Langkah pemasangan (± 3 menit)

1. Buka spreadsheet **"Setoran Ngaji Guru"** di Google Sheets.
2. Menu **Extensions → Apps Script**.
3. Hapus semua isi editor, lalu tempel **seluruh isi** `apps-script/Code.gs`.
4. Ganti baris:

   ```js
   var SECRET = 'GANTI_DENGAN_RAHASIA_KAMU';
   ```

   dengan kata rahasia pilihanmu (bebas, minimal 12 karakter). Simpan (Ctrl+S).
5. Klik **Deploy → New deployment** → ikon gerigi → pilih **Web app**:
   - **Description**: `ODOJ bridge`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
   - Klik **Deploy** → **Authorize access** → pilih akunmu → **Advanced** →
     **Go to … (unsafe)** → **Allow**.
6. Salin **Web app URL** (berakhiran `/exec`).
7. Uji di browser: `<URL>/exec?action=ping&token=<SECRET>`

   Harus muncul JSON seperti:

   ```json
   { "ok": true, "title": "Setoran Ngaji Guru", "tabs": ["Data Setoran", "Daftar Guru"] }
   ```

   Kalau `"Token salah."` → nilai `SECRET` di skrip belum diganti/di-deploy ulang.

8. Sambungkan ke aplikasi lewat `.env.local`:

   ```
   NEXT_PUBLIC_APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfy.../exec"
   NEXT_PUBLIC_APPS_SCRIPT_TOKEN="rahasia-kamu"
   ```

9. Jalankan ulang `npm run dev`. Kolom **Nama Guru** akan langsung terisi dari tab
   `Daftar Guru`, dan tombol simpan menulis baris ke tab `Data Setoran` — tanpa login.

## Setiap mengubah `Code.gs` (mis. ganti SECRET)

Apps Script mewajibkan deploy ulang agar perubahan aktif:

**Deploy → Manage deployments → ikon pensil → Version: New version → Deploy**

## Kontrak API (dipakai `lib/appsScript.ts`)

Semua permintaan mengirim JSON dan wajib menyertakan `token`.

| Aksi | Body | Balasan |
|---|---|---|
| `ping` | `{ "action": "ping", "token": "…" }` | `{ ok, title, tabs }` |
| `listNames` | `{ "action": "listNames", "token": "…" }` | `{ ok, names: string[] }` |
| `appendSetoran` | `{ "action": "appendSetoran", "token": "…", "payload": { id, datetimeFormatted, studentName, juzCount, halamanCount, capaianSummary, recorderName, timestamp } }` | `{ ok, rowIndex }` |
| `listSetoran` | `{ "action": "listSetoran", "token": "…" }` | `{ ok, rows: […] }` |
| `deleteSetoran` | `{ "action": "deleteSetoran", "token": "…", "payload": { "rowIndex": 12 } }` | `{ ok }` |

Catatan teknis: klien mengirim body dengan `Content-Type: text/plain;charset=utf-8`
(konvensi Apps Script) supaya browser **tidak** melakukan preflight `OPTIONS`, yang
tidak dilayani Apps Script.

## Batas & keamanan

- Kuota Apps Script pribadi ± 20.000 permintaan/hari (akun Workspace lebih besar) —
  jauh lebih dari cukup untuk aplikasi sekolah.
- URL + `SECRET` ikut terkirim ke browser (env `NEXT_PUBLIC_*`), jadi anggap keduanya
  sebagai kredensial internal: siapa pun yang memegangnya bisa menambah/membaca baris.
  Jangan dibagikan ke luar sekolah; kalau bocor → ganti `SECRET` + deploy ulang.
- Skrip berjalan sebagai pemilik sheet, sehingga **sheet tidak perlu di-share publik**.
