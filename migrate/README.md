# Panduan Migrasi Database Sandmosquito Water Billing

Aplikasi ini mendukung **4 backend database** berbeda. Anda dapat berganti backend kapan saja cukup dengan mengubah `VITE_ACTIVE_BACKEND` di file `.env`.

---

## Pilihan Database & Cara Migrasinya

| No | Database Backend | Skrip Migrasi | Cara Aktivasi di `.env` |
|---|---|---|---|
| **1** | **Supabase (PostgreSQL Cloud)** *(Default Rekomendasi)* | `1_supabase.sql` | `VITE_ACTIVE_BACKEND=supabase` |
| **2** | **SQLite Lokal (sandmosquito.db)** | `2_sqlite.sql` | `VITE_ACTIVE_BACKEND=sqlite` |
| **3** | **Google Sheets (Google Apps Script)** | `3_gas_bundle.gs` | `VITE_ACTIVE_BACKEND=gas` |
| **4** | **LocalStorage Mock (Browser Simulator)** | `4_localstorage_mock.json` | `VITE_ACTIVE_BACKEND=mock` |

---

### 1. Migrasi ke Supabase Cloud
1. Buka [Dashboard Supabase](https://supabase.com/dashboard)
2. Buat project baru (pilih region Singapore / `ap-southeast-1`)
3. Buka menu **SQL Editor**
4. Buka file `migrate/1_supabase.sql`, salin seluruh kodenya, lalu tempel di SQL Editor dan klik **Run**
5. Ambil Project URL dan `anon` API Key dari **Project Settings -> API**
6. Masukkan ke `.env`:
   ```env
   VITE_ACTIVE_BACKEND=supabase
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

---

### 2. Migrasi ke SQLite Lokal
1. Pastikan runtime Bun atau Node.js terpasang di komputer/server desa
2. Jalankan server SQLite backend lokal:
   ```bash
   npm run server
   ```
3. Server akan berjalan di port `http://localhost:3001` dan otomatis membuat file `sandmosquito.db` dengan skrip `migrate/2_sqlite.sql`
4. Masukkan ke `.env`:
   ```env
   VITE_ACTIVE_BACKEND=sqlite
   VITE_SQLITE_API_URL=http://localhost:3001
   ```

---

### 3. Migrasi ke Google Sheets (GAS)
1. Buat Google Spreadsheet baru di [sheets.new](https://sheets.new)
2. Klik **Extensions -> Apps Script**
3. Hapus kode default, lalu salin seluruh isi file `migrate/3_gas_bundle.gs`
4. Jalankan fungsi `setupDatabase` sekali untuk membuat tab lembar kerja otomatis
5. Klik **Deploy -> New deployment -> Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Salin Web App URL yang dihasilkan ke `.env`:
   ```env
   VITE_ACTIVE_BACKEND=gas
   VITE_GAS_API_URL=https://script.google.com/macros/s/.../exec
   ```

---

### 4. Mode Mock LocalStorage (Simulasi Browser Offline)
1. Cukup ubah `.env`:
   ```env
   VITE_ACTIVE_BACKEND=mock
   ```
2. Aplikasi akan langsung berjalan 100% di dalam browser tanpa memerlukan koneksi internet ataupun server eksternal.
