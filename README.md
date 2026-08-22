# 💧 Sandmosquito Water Billing

> **Sistem Informasi Pengelolaan & Pembayaran Rekening Air Minum Desa Modern**  
> Ditenagai oleh **React 19 + TypeScript + Vite** untuk Frontend, dengan fleksibilitas **4 Pilihan Database Backend** (Supabase PostgreSQL Cloud, SQLite Lokal, Google Sheets GAS Cloud, dan LocalStorage Simulator).

---

## 🌟 Ringkasan Aplikasi

**Sandmosquito Water Billing** adalah aplikasi web modern yang dirancang untuk kebutuhan pengelolaan air minum desa / BUMDes (Badan Usaha Milik Desa) / PAMSIMAS. 

Aplikasi ini mencakup:
- **Pencatatan Meter Air Lapangan** secara bulanan.
- **Engine Perhitungan Tarif Bertingkat** (*Tiered Tariff Calculator*).
- **Penerbitan & Generate Tagihan Massal** (*Batch Bill Invoicing*).
- **Kasir Loket Pembayaran (POS)** dengan cetak kuitansi struk siap cetak (*print-ready*).
- **Siaran Pengumuman & Broadcast Informasi** (*Announcements Banner*).
- **Layanan Keluhan & Pengaduan Warga** (*Customer Complaints & Ticketing*).
- **Pengajuan Pindah Golongan Tarif** (*Subscription Change Requests*).
- **Registrasi Pelanggan Baru dengan Token Undangan Admin** (*Token-based Onboarding*).
- **Pemulihan Kata Sandi Mandiri** via pertanyaan verifikasi keamanan pribadi (*Self-Service Password Recovery*).
- **Portal Cek Tagihan Publik** tanpa perlu login.

---

## 💾 4 Mode Database Backend yang Didukung

Aplikasi ini mendukung 4 jenis database backend yang dapat diatur langsung di file `.env` melalui variabel `VITE_ACTIVE_BACKEND`:

```
+-------------------------------------------------------------------------------+
|                    Sandmosquito Water Billing Frontend                        |
|                     (React 19 + TypeScript + Vite + WPO)                      |
+-------------------------------------------------------------------------------+
                                        |
           +----------------------------+----------------------------+
           |                            |                            |
           v                            v                            v
+----------------------+     +----------------------+     +----------------------+
|  1. Supabase Cloud   |     |  2. SQLite Lokal     |     |  3. Google Sheets    |
|  - PostgreSQL 17     |     |  - sandmosquito.db   |     |  - Google Apps Script|
|  - RLS & Auth        |     |  - npm run server    |     |  - Web App REST API  |
|  - Backup Otomatis   |     |  - Port 3001         |     |  - Spreadsheet DB    |
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

Ubah nilai `VITE_ACTIVE_BACKEND` pada file `.env`:

```env
# Pilihan: supabase | sqlite | gas | mock
VITE_ACTIVE_BACKEND=supabase

# 1. Supabase Cloud Database (Default Rekomendasi)
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# 2. SQLite Backend Server
VITE_SQLITE_API_URL=http://localhost:3001

# 3. Google Apps Script Cloud
VITE_GAS_API_URL=https://script.google.com/macros/s/.../exec
```

---

## 📁 Skrip Migrasi Database Siap Pakai (`migrate/`)

Seluruh skrip migrasi database telah disediakan di dalam folder `migrate/`:

| File | Keterangan |
|---|---|
| [`migrate/1_supabase.sql`](migrate/1_supabase.sql) | Skrip SQL lengkap untuk Supabase (13 tabel + RLS + Index + Seed Data). Cukup copas ke SQL Editor Supabase. |
| [`migrate/2_sqlite.sql`](migrate/2_sqlite.sql) | Skrip DDL schema untuk SQLite (`sandmosquito.db`). |
| [`migrate/3_gas_bundle.gs`](migrate/3_gas_bundle.gs) | Skrip Google Apps Script untuk deploy API Google Sheets. |
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

### 3. Menjalankan Backend SQLite Lokal (Jika Memilih SQLite)
```bash
npm run server
```
Server backend berjalan di `http://localhost:3001`.

### 4. Build untuk Production
```bash
npm run build
```
Hasil build berada di folder `dist/` dengan optimasi code-splitting dan WPO.

---

## 👥 Akun Demo untuk Pengujian Cepat

| Role | Username | Kata Sandi | Keterangan |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | Akses penuh: manajemen tarif, pelanggan, meter, tagihan, token, keluhan, dan pengaturan sistem. |
| **Operator** | `operator` | `operator123` | Akses operasional: pencatatan angka meter, buka kasir loket, tindak lanjut keluhan warga. |
| **Customer** | `CUST-2026-0001` | `warga123` | Akses warga: cek tagihan, riwayat pemakaian air, lapor keluhan, ajukan pindah golongan tarif. |

---

## 🔑 Fitur Unggulan Terbaru

1. **Registrasi Pelanggan dengan Token Undangan Admin** (`/register`):
   - Admin membuat token undangan di `/admin/tokens` (contoh: `DESA-AIR-2026`).
   - Calon warga memvalidasi token terlebih dahulu sebelum mendaftar akun.
2. **Pemulihan Kata Sandi Mandiri** (`/forgot-password`):
   - Warga yang lupa sandi dapat menjawab pertanyaan verifikasi keamanan pribadi (4 digit NIK dan RT/RW terdaftar) untuk mereset kata sandinya secara mandiri.
3. **Siaran Pengumuman & Broadcast** (`/admin/announcements`):
   - Kirim pengumuman darurat (pipa bocor/pemeliharaan) atau pengingat jatuh tempo yang otomatis muncul di atas dashboard operator dan warga.
4. **Pengaduan & Keluhan Warga** (`/customer/complaints`):
   - Warga dapat melaporkan kendala pasokan air, pipa bocor, atau meteran rusak dan memantau status penyelesaiannya secara real-time.
5. **Pengajuan Perubahan Golongan Langganan** (`/customer/subscription-request`):
   - Permohonan pindah golongan tarif (misal dari Rumah Tangga ke Niaga) yang dapat disetujui admin untuk memperbarui tarif pelanggan secara otomatis.
6. **Mobile Responsive & Interaktif**:
   - Optimal di semua ukuran layar smartphone dan tablet, dilengkapi auto-sync data, indikator backend, dan animasi modern.
7. **SEO & Web Performance Optimization (WPO)**:
   - Dynamic Code Splitting via React.lazy, Open Graph meta tags, Schema.org JSON-LD, sitemap.xml, dan robots.txt.

---

## 📄 Lisensi
Hak Cipta © 2026 BUMDes Tirta Sandmosquito. Bebas dikembangkan untuk kemajuan pengelolaan air desa di Indonesia.
