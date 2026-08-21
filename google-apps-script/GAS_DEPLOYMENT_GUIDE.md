# Panduan Deployment Google Apps Script & Google Spreadsheet

Panduan lengkap menghubungkan **Sandmosquito Water Billing** ke backend Google Apps Script dan database Google Spreadsheet.

---

## Langkah 1: Buat Google Spreadsheet Baru

1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Beri nama spreadsheet, contoh: `Database Sandmosquito Water Billing`.
3. Salin Spreadsheet ID dari URL browser:
   - Format URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

---

## Langkah 2: Buka Google Apps Script Editor

1. Di dalam Google Spreadsheet tersebut, klik menu **Ekstensi (Extensions)** > **Apps Script**.
2. Beri nama project Apps Script, misalnya `Sandmosquito Water Billing API`.

---

## Langkah 3: Salin Kode Backend

Pilih salah satu cara berikut:

### Opsi A: Cara Cepat (1 File Bundle)
1. Hapus seluruh isi default pada file `Code.gs`.
2. Buka file `google-apps-script/bundle.gs` pada project ini.
3. Salin semua teks dan tempelkan ke editor Apps Script.
4. Tekan ikon **Simpan (Save)** (Ctrl+S).

### Opsi B: Cara Modular (Multiple Files)
1. Buat file script baru di Apps Script untuk masing-masing modul:
   - `Utils.gs`
   - `Auth.gs`
   - `Users.gs`
   - `Customers.gs`
   - `Meters.gs`
   - `Readings.gs`
   - `Tariffs.gs`
   - `Bills.gs`
   - `Payments.gs`
   - `Reports.gs`
   - `Settings.gs`
   - `AuditLogs.gs`
   - `DatabaseSetup.gs`
   - `Code.gs`
2. Salin isi masing-masing file dari folder `google-apps-script/`.
3. Tekan **Simpan Semua**.

---

## Langkah 4: Inisialisasi Database Otomatis

1. Di bagian atas editor Apps Script, pada dropdown fungsi yang akan dijalankan, pilih fungsi **`setupDatabase`** atau **`seedDemoData`**.
2. Klik tombol **Jalankan (Run)**.
3. Google akan meminta izin akses (Authorization Required):
   - Klik **Tinjau Izin (Review Permissions)**.
   - Pilih akun Google Anda.
   - Klik **Lanjutan (Advanced)** > Klik **Buka Sandmosquito Water Billing API (tidak aman)**.
   - Klik **Izinkan (Allow)**.
4. Periksa Google Spreadsheet Anda: seluruh 9 sheet (`Users`, `Customers`, `Meters`, `MeterReadings`, `Tariffs`, `Bills`, `Payments`, `Settings`, `AuditLogs`) dengan header warna biru dan data awal akan otomatis terbuat!

---

## Langkah 5: Deploy Sebagai Web App

1. Klik tombol biru **Terapkan (Deploy)** di kanan atas > Pilih **Penerapan Baru (New Deployment)**.
2. Klik ikon gerigi di sebelah *Select type* > Pilih **Aplikasi Web (Web app)**.
3. Isi konfigurasi:
   - **Deskripsi**: `Sandmosquito Water Billing API v1`
   - **Jalankan sebagai (Execute as)**: **Saya (Me)** (*email@gmail.com*)
   - **Yang memiliki akses (Who has access)**: **Siapa saja (Anyone)** *(Penting agar frontend React dapat mengakses API tanpa pop-up login Google)*
4. Klik **Terapkan (Deploy)**.
5. Salin **URL Aplikasi Web (Web App URL)** yang berformat:
   `https://script.google.com/macros/s/AKfycb.../exec`

---

## Langkah 6: Hubungkan ke Frontend React

1. Buka folder frontend project `sandmosquito-water-billing/`.
2. Buat file `.env` (atau salin dari `.env.example`).
3. Masukkan URL Web App yang telah Anda salin tadi:
   ```env
   VITE_GAS_API_URL=https://script.google.com/macros/s/AKfycb.../exec
   VITE_ENABLE_MOCK_MODE=false
   ```
4. Jalankan frontend:
   ```bash
   npm run dev
   # atau
   bun dev
   ```

---

## Default Akun Login Awal

Setelah menjalankan `setupDatabase` atau `seedDemoData`, akun berikut siap digunakan:

| Role | Username / No. Pelanggan | Password | Keterangan |
|------|--------------------------|----------|------------|
| **Admin** | `admin` | `admin123` | Hak akses penuh admin |
| **Operator** | `operator` | `operator123` | Petugas loket & pencatat meter |
| **Customer** | `CUST-2026-0001` (atau `cust-2026-0001`) | `warga123` | Akun pelanggan 1 |
| **Customer** | `CUST-2026-0002` | `warga123` | Akun pelanggan 2 |

*(Pelanggan baru yang didaftarkan otomatis dibuatkan akun login dengan username = Nomor Pelanggan dan password default = nomor pelanggan huruf kecil)*.
