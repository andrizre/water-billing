# 💧 Sandmosquito Water Billing

> **Sistem Informasi Pengelolaan & Pembayaran Rekening Air Minum Desa Modern**  
> Ditenagai oleh **React + TypeScript + Vite** untuk Frontend, opsi **SQLite Local Database (`sandmosquito.db`)** untuk penyimpanan lokal sementara, dan **Google Apps Script (GAS) + Google Spreadsheet** untuk deployment Cloud bebas biaya.

---

## 🌟 Ringkasan Aplikasi

**Sandmosquito Water Billing** adalah aplikasi web fullstack yang dirancang khusus untuk mengelola operasional pengelolaan air bersih tingkat desa / BUMDes (Badan Usaha Milik Desa) / PAMSIMAS. Sistem ini mendukung pencatatan angka meteran bulanan di lapangan, perhitungan tarif pemakaian air bertingkat (*tiered tariff engine*), penerbitan faktur tagihan massal, kasir loket pembayaran (*POS*), hingga portal cek tagihan mandiri bagi warga desa.

Aplikasi ini dibangun tanpa ketergantungan framework CSS pihak ketiga (murni menggunakan **CSS Modern / CSS Variables & Design Tokens**) dengan tema bernuansa biru air laut (*ocean blue*) yang bersih, responsif, ramah mobile, serta siap cetak (*print-ready*).

---

## 💾 3 Mode Penyimpanan Database yang Didukung

Aplikasi ini dilengkapi dengan **3 opsi penyimpanan** yang dapat beralih secara otomatis dan mulus:

```
+-------------------------------------------------------------------------+
|                  Sandmosquito Water Billing Frontend                    |
|                         (React + TypeScript)                            |
+-------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
          v                                                   v
+-------------------------------+                   +--------------------+
|  Opsi 1: SQLite Server        |                   |  Opsi 2: GAS Cloud |
|  - File: sandmosquito.db      |                   |  - Google Sheets   |
|  - Jalankan: bun run server   |                   |  - Web App API     |
|  - Port: http://localhost:3001|                   |  - Cloudflare/Vercel|
+-------------------------------+                   +--------------------+
          |
          +---> Opsi 3: Virtual Local Storage (Offline Browser Simulator)
```

1. **Opsi 1: SQLite Database File (`sandmosquito.db`) [Rekomendasi Lokal]**
   - Menggunakan database SQLite nyata di disk komputer Anda (`sandmosquito.db`).
   - Menyimpan 9 tabel relational: `users`, `customers`, `meters`, `meter_readings`, `tariffs`, `bills`, `payments`, `settings`, `audit_logs`.
   - Cukup jalankan perintah `bun run server` di terminal!

2. **Opsi 2: Google Apps Script + Google Spreadsheet (Cloud Deployment)**
   - Menggunakan Google Spreadsheet sebagai database cloud gratis dan Google Apps Script sebagai REST API.
   - Siap dideploy ke Cloudflare Pages atau Vercel.

3. **Opsi 3: Browser Virtual Storage (Fallback)**
   - Jika kedua server belum aktif, frontend otomatis beralih ke simulasi browser `LocalStorage` sehingga aplikasi tetap dapat berjalan 100% tanpa hambatan.

---

## 🚀 Panduan Cepat Menjalankan SQLite Lokal

### 1. Jalankan Server SQLite Backend
Buka terminal dan jalankan:
```bash
bun run server
```
Server SQLite akan otomatis menginisialisasi database `sandmosquito.db`, membuat tabel, mengisi data awal demo, dan berjalan di `http://localhost:3001`.

### 2. Jalankan Frontend Web
Buka terminal baru di folder yang sama:
```bash
bun run dev
```
Buka browser di **`http://localhost:5173`**. Frontend akan otomatis mendeteksi server SQLite dan menggunakan data dari `sandmosquito.db`!

---

## 👥 Multi-Role Based Access Control (RBAC) & Akun Demo

| Role | Username / ID | Password | Akses & Fitur |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Akses penuh seluruh modul dan pengaturan |
| **Operator** | `operator` | `operator123` | Pencatatan meter, generate tagihan, kasir loket |
| **Customer** | `CUST-2026-0001` | `warga123` | Bpk. Supardi (Warga RT 01 / RW 01) |
| **Customer** | `CUST-2026-0002` | `warga123` | Ibu Siti Aminah (Warga RT 02 / RW 01) |
| **Customer** | `CUST-2026-0004` | `warga123` | Ibu Nurul Hidayah (Ada tagihan tertunggak) |

> 💡 *Pada pojok kanan atas Header aplikasi, terdapat tombol **Quick Role Switcher (Admin / Operator / Customer)** untuk berpindah akun secara instan saat pengujian.*

---

## ☁️ Panduan Integrasi Google Apps Script (Jika Ingin Deploy ke Cloud)

Seluruh kode backend Google Apps Script sudah tersedia di dalam folder `google-apps-script/` dan disatukan dalam file [`google-apps-script/bundle.gs`](file:///C:/Users/Lenovo/sandmosquito-water-billing/google-apps-script/bundle.gs).

1. Buat Spreadsheet baru di [Google Sheets](https://sheets.new).
2. Klik menu **Ekstensi** > **Apps Script**.
3. Salin seluruh isi [`google-apps-script/bundle.gs`](file:///C:/Users/Lenovo/sandmosquito-water-billing/google-apps-script/bundle.gs) ke editor Apps Script dan simpan.
4. Jalankan fungsi `setupDatabase` sekali untuk inisialisasi 9 lembar kerja otomatis.
5. Klik **Deploy** > **New deployment** > Pilih **Web app** (Execute as: `Me`, Who has access: `Anyone`).
6. Salin Web App URL ke file `.env` (`VITE_GAS_API_URL=https://script.google.com/macros/s/.../exec`).

---

## 📜 Lisensi

Didistribusikan di bawah lisensi **MIT License**. Dikembangkan untuk tata kelola digital air minum desa Indonesia.
