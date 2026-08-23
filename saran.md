# Dokumen Analisis & Rencana Pengembangan Sistem Billing Air Desa (BUMDes)

Dokumen ini memuat hasil audit teknis, analisis fungsionalitas, serta roadmap saran perbaikan dan pengembangan fitur strategis untuk aplikasi **Sistem Pembayaran Air Minum Desa (Sandmosquito Water Billing)**.

---

## 📑 Daftar Isi
1. [Fitur Prioritas Tinggi (High Impact untuk Lapangan & Kasir)](#1-fitur-prioritas-tinggi)
2. [Ketahanan Lapangan & PWA (Progressive Web App)](#2-ketahanan-lapangan--pwa)
3. [Keuangan & Akuntansi BUMDes (Buku Kas & Laba Rugi)](#3-keuangan--akuntansi-bumdes)
4. [Peningkatan Antarmuka & Aksesibilitas (UI/UX)](#4-peningkatan-antarmuka--uiux)
5. [Keamanan & Validasi Data](#5-keamanan--validasi-data)
6. [Roadmap Tahapan Implementasi](#6-roadmap-tahapan-implementasi)

---

## 1. 🚀 Fitur Prioritas Tinggi

### A. Integrasi Notifikasi & Kuitansi WhatsApp Instan (`wa.me`)
* **Kebutuhan Lapangan**: Lebih dari 95% warga desa berkomunikasi melalui WhatsApp. Mengandalkan kertas invoice fisik membutuhkan biaya cetak besar dan sering kali tercecer.
* **Solusi & Rekomendasi**:
  * Tambahkan tombol **"Kirim Tagihan ke WhatsApp"** di halaman tagihan pelanggan dan cetak faktur.
  * Tambahkan tombol **"Kirim Kuitansi ke WA"** di kasir loket setelah transaksi berhasil dicatat.
  * Menghasilkan pesan terformat otomatis dengan URL API `https://wa.me/628xxx?text=...`:
    > *"Yth. Bpk/Ibu [Nama], Tagihan Air [Nama Desa] Periode [Bulan/Tahun] sebesar Rp [Nominal] telah terbit (Pemakaian: [X] m³). Batas jatuh tempo: [Tanggal]. Pembayaran dapat dilakukan via transfer Bank [No. Rek] atau loket kantor desa. Terima kasih."*

### B. Format Cetak Struk Mini Kasir Thermal POS (58mm / 80mm)
* **Kebutuhan Lapangan**: Loket kasir kantor desa atau operator keliling umumnya menggunakan printer thermal mini (Bluetooth/USB) dengan kertas berukuran 58mm atau 80mm, bukan kertas A4 printer besar.
* **Solusi & Rekomendasi**:
  * Tambahkan tombol pilihan **"Cetak Struk Thermal (58mm)"**.
  * Terapkan aturan CSS khusus cetak `@media print { @page { size: 58mm auto; margin: 0; } }` agar struk ringkas, rapi, font terbaca jelas, dan hemat kertas.

### C. Unggah Foto Bukti Fisik Angka Meteran Air (Photo Evidence)
* **Kebutuhan Lapangan**: Sering terjadi perselisihan/komplain dari warga yang merasa tagihannya melonjak karena curiga petugas salah mencatat angka meter.
* **Solusi & Rekomendasi**:
  * Sediakan tombol ambil foto dari kamera HP (`<input type="file" accept="image/*" capture="environment">`) saat petugas menginput angka meter di lapangan.
  * Foto fisik meteran tersimpan dan dapat dilihat oleh Warga serta Admin untuk transparansi mutlak.

### D. Deteksi Anomali Pemakaian & Peringatan Kebocoran Pipa (Smart Warning)
* **Kebutuhan Lapangan**: Mencegah salah ketik angka meter (*human error*) dan mendeteksi kebocoran pipa di instalasi rumah warga sejak dini.
* **Solusi & Rekomendasi**:
  * **Peringatan Nilai Negatif**: Jika `Angka Meter Sekarang < Angka Meter Lalu`, tampilkan konfirmasi khusus pergantian meter fisik.
  * **Peringatan Lonjakan (>200%)**: Jika pemakaian melonjak lebih dari 2x lipat dari rata-rata pemakaian bulanan, munculkan badge peringatan: *"Pemakaian melonjak drastis. Harap periksa apakah ada kran terbuka atau kebocoran pipa bawah tanah pada rumah pelanggan."*

---

## 2. 📱 Ketahanan Lapangan & PWA

### A. Mode Pencatatan Meter Offline & Auto-Sync (Offline First)
* **Kebutuhan Lapangan**: Beberapa dusun atau pelosok desa sering kali berada di area *blank spot* (tanpa sinyal seluler/internet).
* **Solusi & Rekomendasi**:
  * Menggunakan `IndexedDB` / `localStorage` untuk menampung data pencatatan meteran secara lokal di perangkat ponsel operator saat offline.
  * Begitu petugas kembali mendapatkan koneksi internet di kantor desa, sistem secara otomatis menyinkronkan seluruh antrean pencatatan ke database server.

### B. Progressive Web App (PWA) Installable
* **Solusi & Rekomendasi**:
  * Tambahkan `manifest.webmanifest`, ikon aplikasi, dan Service Worker.
  * Aplikasi dapat di-*install* langsung ke layar utama (*Homescreen*) smartphone Android & iPhone tanpa perlu registrasi di Google Play Store atau Apple App Store.

---

## 3. 💼 Keuangan & Akuntansi BUMDes

### A. Modul Pencatatan Pengeluaran Operasional (*Expense Management*)
* **Kondisi Saat Ini**: Aplikasi saat ini hanya mencatat pemasukan kas air (*Cash In*).
* **Solusi & Rekomendasi**:
  * Tambahkan menu **"Buku Kas & Pengeluaran"** untuk mencatat biaya operasional, antara lain:
    1. Pembayaran tagihan listrik PLN untuk pompa air / sumur submersible.
    2. Pembelian obat/kaporit/klorin/filter pasir tandon.
    3. Biaya pemeliharaan pipa, keran, dan suku cadang.
    4. Honor / insentif petugas pencatat meter dan penjaga tandon.

### B. Laporan Laba Rugi Bersih (*Net Profit Report*)
* **Solusi & Rekomendasi**:
  * Di halaman **Laporan Keuangan**, sediakan kalkulasi otomatis:
    $$\text{Pendapatan Air Lunas} - \text{Total Biaya Operasional} = \text{Laba Bersih BUMDes (PADes)}$$
  * Laporan siap dicetak dan diekspor ke Excel/PDF untuk dipertanggungjawabkan pada Musyawarah Desa (Musdes).

---

## 4. 🎨 Peningkatan Antarmuka & Aksesibilitas (UI/UX)

* **Quick Filter Status Tagihan**:
  * Tambahkan tab filter instan pada manajemen tagihan: `[Semua]`, `[Belum Lunas]`, `[Menunggak / Lewat Tempo]`, `[Lunas]`, serta filter per Dusun / RT / RW.
* **Mode Gelap / Dark Mode Toggle**:
  * Menyediakan sakelar tema Gelap/Terang yang tersimpan di `localStorage` demi kenyamanan mata petugas di lapangan saat malam hari.
* **Cetak Massal Faktur / Kuitansi per RT/RW**:
  * Tombol untuk mencetak semua faktur tagihan dalam 1 wilayah RT sekaligus untuk dibagikan secara fisik oleh ketua RT.

---

## 5. 🔒 Keamanan & Validasi Data

* **Audit Log Perubahan Sensitif**: Memastikan setiap pengubahan golongan tarif, penghapusan data, atau koreksi angka meter tercatat nama petugas pelakunya dan waktu perubahan.
* **Proteksi Pembayaran Ganda**: Mencegah klik ganda (*double click*) pada tombol kasir yang dapat menduplikasi kuitansi pembayaran.

---

## 6. 📅 Roadmap Tahapan Implementasi

| Tahap | Fokus Utama | Target Fitur |
| :--- | :--- | :--- |
| **Tahap 1** | *Komunikasi & Kasir* | Notifikasi WhatsApp Tagihan & Kuitansi (`wa.me`), Mode Cetak Thermal POS 58mm. |
| **Tahap 2** | *Akurasi Lapangan* | Upload Foto Fisik Meteran, Deteksi Kebocoran Pipa & Peringatan Anomali. |
| **Tahap 3** | *Operasional Offline* | PWA Web App, Cache Offline, Auto-Sync Pencatatan Dusun Blank Spot. |
| **Tahap 4** | *Akuntansi BUMDes* | Modul Pengeluaran Operasional, Buku Kas Umum, Laporan Laba/Rugi Bersih. |

---
*Dokumen ini dibuat otomatis sebagai panduan pengembangan berkelanjutan aplikasi BUMDes Tirta Sandmosquito Water Billing.*
