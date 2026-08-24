# 💧 Sandmosquito Water Billing

> **Sistem Informasi Pengelolaan, Pencatatan Meter, dan Pembayaran Rekening Air Bersih Desa Modern**  
> Ditenagai oleh **React 19 + TypeScript + Vite** untuk Frontend berkinerja tinggi, dengan fleksibilitas **4 Pilihan Database Backend** (Supabase PostgreSQL Cloud, SQLite Lokal, Google Sheets GAS Cloud, dan LocalStorage Simulator).

---

## 🌟 Ringkasan Aplikasi

**Sandmosquito Water Billing** adalah aplikasi web modern all-in-one yang dirancang khusus untuk memenuhi kebutuhan operasional pengelolaan air bersih desa / BUMDes (Badan Usaha Milik Desa) / PAMSIMAS / KPSPAMS.

Aplikasi ini mencakup:
- **Pencatatan Meter Air Lapangan Berbasis RT**: Petugas operator lapangan memiliki akun dan wilayah RT masing-masing yang ditentukan oleh admin.
- **Fitur Warga Subsidi BUMDes**: Dukungan pembebasan tagihan (100% Gratis untuk fasilitas sosial/ibadah) atau batas maksimal plafon tagihan per bulan (misal maksimal bayar Rp 20.000 berapapun pemakaian).
- **Engine Perhitungan Tarif Bertingkat**: Kalkulasi otomatis 3 tier pemakaian, biaya abodemen tetap, denda keterlambatan, dan potongan subsidi.
- **Penerbitan & Generate Tagihan Massal**: Terbitkan tagihan ratusan pelanggan dalam sekali klik per periode bulan.
- **Kasir Loket Pembayaran (POS)**: Pembayaran Tunai, Transfer Bank, dan QRIS dengan pratinjau barcode serta kuitansi struk siap cetak (*print-ready*).
- **Manajemen Biaya Operasional & Pemeliharaan**: Pencatatan belanja pipa, token listrik pompa, obat klorin, dan honor lapangan.
- **Laporan Lengkap & Rekapitulasi**: Laporan pendapatan, tunggakan per RT, neraca laba-rugi, dan ekspor data CSV.
- **Siaran Pengumuman & Broadcast**: Pengumuman pemeliharaan pipa atau peringatan jatuh tempo langsung di layar pengguna.
- **Layanan Pengaduan & Keluhan Warga**: Ticketing laporan pipa bocor, meter rusak, atau air mati dengan pemantauan status real-time.
- **Pengajuan Pindah Golongan Tarif**: Formulir mandiri warga untuk perubahan jenis sambungan pelanggan.
- **Registrasi Pelanggan Baru dengan Token Undangan Admin**: Sistem onboarding aman menggunakan kupon token unik.
- **Pemulihan Kata Sandi Mandiri**: Reset sandi mandiri via 4 digit NIK dan nomor kontak terverifikasi.
- **Portal Cek Tagihan Publik**: Warga dapat mengecek tagihan dan riwayat cukup memasukkan Nomor Pelanggan tanpa harus login.
- **Mode Gelap (Dark Mode)**: Dukungan tema gelap & terang penuh di seluruh antarmuka.

---

## 💾 4 Mode Database Backend yang Didukung

Aplikasi ini mendukung 4 jenis database backend yang dapat diaktifkan melalui file `.env` (`VITE_ACTIVE_BACKEND`):

```
+-------------------------------------------------------------------------------+
|                    Sandmosquito Water Billing Frontend                        |
|                  (React 19 + TypeScript + Vite + WPO + PWA)                   |
+-------------------------------------------------------------------------------+
                                        |
           +----------------------------+----------------------------+
           |                            |                            |
           v                            v                            v
+----------------------+     +----------------------+     +----------------------+
|  1. Supabase Cloud   |     |  2. SQLite Lokal     |     |  3. Google Sheets    |
|  - PostgreSQL 17     |     |  - sandmosquito.db   |     |  - Google Apps Script|
|  - RLS & Auth        |     |  - npm run server    |     |  - Web App REST API  |
|  - Backup Otomatis   |     |  - Port 3001 (WAL)   |     |  - Spreadsheet DB    |
+----------------------+     +----------------------+     +----------------------+
                                        |
                                        v
                             +----------------------+
                             |  4. LocalStorage     |
                             |  - Simulasi Browser  |
                             |  - 100% Offline Demo |
                             +----------------------+
```

### Konfigurasi `.env`

```env
# Pilihan Backend Aktif: supabase | sqlite | gas | mock
VITE_ACTIVE_BACKEND=supabase

# 1. Supabase Cloud Database (Default Rekomendasi)
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# 2. SQLite Backend Server Lokal
VITE_SQLITE_API_URL=http://localhost:3001

# 3. Google Apps Script Cloud
VITE_GAS_API_URL=https://script.google.com/macros/s/.../exec
```

---

## 📁 Skrip Migrasi Database Siap Pakai (`migrate/`)

Seluruh skrip migrasi database (14 tabel relasional) telah disediakan di dalam folder `migrate/`:

| File | Keterangan |
|---|---|
| [`migrate/1_supabase.sql`](migrate/1_supabase.sql) | Skrip SQL lengkap untuk Supabase PostgreSQL (14 tabel + RLS Policies + Performance Index + Demo Seed Data). |
| [`migrate/2_sqlite.sql`](migrate/2_sqlite.sql) | Skrip DDL schema untuk SQLite (`sandmosquito.db`). |
| [`migrate/3_gas_bundle.gs`](migrate/3_gas_bundle.gs) | Skrip Google Apps Script untuk deploy API Google Sheets otomatis. |
| [`migrate/4_localstorage_mock.json`](migrate/4_localstorage_mock.json) | Struktur data JSON untuk mode simulasi LocalStorage di browser. |
| [`migrate/README.md`](migrate/README.md) | Panduan langkah demi langkah cara migrasi & aktivasi masing-masing database. |

---

## 🚀 Panduan Memulai Cepat

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Menjalankan Frontend Development Server
```bash
npm run dev
```
Buka browser di `http://localhost:5173`.

### 3. Menjalankan Backend SQLite Lokal (Jika Memilih Mode SQLite)
```bash
npm run server
```
Server backend berjalan di `http://localhost:3001`.

### 4. Build untuk Production
```bash
npm run build
```
Hasil build berada di folder `dist/` dengan optimasi code-splitting, tree-shaking, dan WPO.

---

## 👥 Akun Demo untuk Pengujian Cepat

| Role | Username | Kata Sandi | Wilayah Tugas / Keterangan |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | Akses penuh: Master tarif, pelanggan, meter, tagihan, token, biaya operasional, dan pengaturan sistem. |
| **Operator RT 01** | `operator` | `operator123` | Petugas Lapangan RT 01 / RW 01: Catat meter & loket kasir wilayah RT 01. |
| **Operator RT 02** | `operator2` | `operator123` | Petugas Lapangan RT 02 / RW 01: Catat meter & loket kasir wilayah RT 02. |
| **Warga Reguler** | `CUST-2026-0001` | `warga123` | Bpk. Budi Santoso (RT 01 / RW 01) - Tarif Rumah Tangga Reguler. |
| **Warga Subsidi Plafon** | `CUST-2026-0002` | `warga123` | Ibu Siti Aminah (RT 01 / RW 01) - Subsidi Plafon Maks. Rp 20.000/bln. |

---

## 🔑 Fitur Unggulan Sistem

1. **Warga Subsidi (Plafon Maksimal & 100% Gratis)**:
   - Pengelola dapat menandai sambungan warga tertentu sebagai penerima subsidi program desa.
   - Pilihan subsidi: **100% Gratis** (misal untuk masjid/posyandu) atau **Plafon Maksimal Bayar** (misal berapapun pemakaian air, warga hanya membayar maksimal Rp 20.000/bulan).
2. **Pencatatan Operator Berbasis RT**:
   - Admin dapat menetapkan wilayah RT khusus untuk masing-masing akun operator.
   - Saat operator login, sistem otomatis memfilter daftar pencatatan meter agar hanya menampilkan warga di RT binaannya.
3. **Kasir Loket & Cetak Struk QRIS**:
   - Dukungan pembayaran Tunai, Transfer Bank, dan QRIS statis/dinamis BUMDes.
   - Dilengkapi cetak kuitansi struk format thermal dan format faktur tagihan resmi.
4. **Biaya Pemeliharaan & Pengeluaran BUMDes**:
   - Catat pengeluaran operasional (perbaikan kebocoran, token PLN pompa, obat penjernih klorin, honor petugas).
   - Terintegrasi langsung dengan Laporan Laba-Rugi dan Keuangan di `/admin/reports`.
5. **Onboarding Token & Pemulihan Kata Sandi Mandiri**:
   - Pendaftaran pelanggan baru aman dengan sistem token undangan.
   - Reset sandi mandiri warga berbasis verifikasi NIK dan kontak.
6. **Desain Responsif & Dark Mode**:
   - Tampilan adaptif di smartphone dan desktop, pop-up modal fixed di tengah layar dengan react portal, serta dukungan mode gelap di seluruh halaman.

---

## 📄 Lisensi
Hak Cipta © 2026 BUMDes Tirta Sandmosquito. Bebas digunakan dan dikembangkan untuk kemajuan pengelolaan air bersih pedesaan di seluruh Indonesia.

