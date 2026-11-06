# Finding Tracker HR Tools — AIESEC in UMM

Aplikasi audit dan validasi kepatuhan internal untuk **HR Tools (Membership Experience / MX Implementation Tracks)** AIESEC in UMM.

Aplikasi ini menginspeksi keterisian checklist kepatuhan (wajib, bulanan, mingguan, end of the month, dan aturan khusus Februari) serta kepatuhan pengisian Net Promoter Score (NPS) pada Google Spreadsheet master, lalu menyusun laporan audit yang terstruktur secara otomatis per departemen langsung ke Google Spreadsheet online via Google Apps Script Webhook atau ekspor Excel (.xlsx).

---

## 🌟 Fitur Utama

- **Audit Multi-Departemen & Multi-Sheet:**
  Mendukung evaluasi otomatis 31 sheet departemen (`EB-Archipelago`, `TM-MB`, `TM-TAX`, `TM-TA`, `TM-TD`, `FGL-MB`, `ER-MB`, `ER-OR`, `ER-PR`, `ER-NM`, `BD-MB`, `BD-SGD`, `BD-SYD`, `BD-SBD`, `MKT-MB`, `MKT-BM`, `MKT-EWA`, `MKT-ELD`, `EWABA-MB`, `EWABA-PQD`, `EWABA-CX`, `EWABA-LV`, `iGV-MB`, `iGV-Project`, `iGV-QAPD`, `iGV-IRCX`, `oGX-MB`, `oGX-oGTae`, `oGX-oGV`, `oGX-IR`).
- **Aturan Akuntabilitas Bertingkat (Team Leader vs Member):**
  - **Checklist Member $\rightarrow$ Tanggung Jawab Team Leader:**
    Semua temuan checklist (belum diisi maupun checklist yang seharusnya tidak diisi pada periode Februari) dicatat khusus pada baris laporan **Team Leader**, bukan pada baris member.
    *Contoh:* `• TM-TA: Checklist Afri belum diisi pada cell BW58 (Weekly).`
  - **NPS $\rightarrow$ Tanggung Jawab Mandiri Member:**
    Baris member hanya menampilkan temuan NPS masing-masing (atau `• Tidak ada finding` / `Lolos` jika lengkap).
  - **Akuntabilitas MB & EB:**
    Temuan di sheet Management Board (`-MB`) dilaporkan ke LCVP masing-masing departemen, dan temuan di `EB-Archipelago` dilaporkan ke Local Committee President (LCP).
- **Aturan Time-Bound Februari & Adjustable:**
  - **Februari:** Aktivitas dengan time bound Februari wajib kosong (tidak boleh dicentang).
  - **Adjustable:** Bersifat fleksibel (*sunnah*), tidak memicu error bila tidak dicentang.
- **Pengelompokan Rapi per Departemen:**
  Baris laporan diurutkan per departemen secara terstruktur: `EB` $\rightarrow$ `TM` $\rightarrow$ `FGL` $\rightarrow$ `ER` $\rightarrow$ `BD` $\rightarrow$ `MKT` $\rightarrow$ `EWABA` $\rightarrow$ `iGV` $\rightarrow$ `oGX`.
- **Integrasi Google Spreadsheet Online Otomatis:**
  Satu klik "Mulai finding" langsung membuat tab baru di spreadsheet online target lengkap dengan header biru, ringkasan statistik gold, dan format badge status.
- **Ekspor Excel (.xlsx) Resmi:**
  Dapat diunduh secara offline dengan styling persis Google Sheets (menggunakan `exceljs`).

---

## 🚀 Cara Menjalankan Proyek

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 16 atau lebih baru)

### Instalasi
```bash
git clone https://github.com/R45FIQ/Finding-Tracker-HR-TOOLS-MX-AIESEC-IN-UMM-.git
cd Finding-Tracker-HR-TOOLS-MX-AIESEC-IN-UMM-
npm install
```

### Menjalankan Server
```bash
node server.js
```
Aplikasi akan berjalan di:
👉 **`http://localhost:3000`**

---

## ⚙️ Pemasangan Google Apps Script Webhook

Agar hasil finding otomatis tersimpan ke spreadsheet online:
1. Buka Google Spreadsheet target laporan Anda.
2. Buka menu **Ekstensi (Extensions)** > **Apps Script**.
3. Salin seluruh isi file [`google-apps-script.js`](./google-apps-script.js) dan tempel ke editor Apps Script.
4. Klik **Simpan (Save)** (Ctrl+S).
5. Klik **Terapkan (Deploy)** > **Penerapan baru (New deployment)**.
6. Pilih jenis: **Aplikasi web (Web app)**.
   - **Jalankan sebagai (Execute as):** Saya (Me)
   - **Siapa yang memiliki akses (Who has access):** Siapa saja (Anyone) *(Penting!)*
7. Klik **Terapkan**, lalu izinkan akses Google jika diminta.
8. Salin URL Web App yang berakhiran `/exec`.
9. Buka tab **Konfigurasi** di aplikasi Finding Tracker, masukkan URL tersebut, dan klik **Simpan Konfigurasi**.

---

## 📁 Struktur Direktori

```
├── google-apps-script.js     # Kode Apps Script untuk webhook otomatis Google Sheets
├── package.json              # Dependensi server Node.js & metadata
├── server.js                 # Backend Express (parser xlsx, sync webhook proxy, export excel)
├── public/
│   ├── index.html            # Halaman antarmuka pengguna
│   ├── css/
│   │   ├── styles.css        # Tema, sidebar, topbar, konfigurasi
│   │   └── ref-styles.css    # Styling tabel laporan, badge, dan kartu proses
│   └── js/
│       ├── app.js            # Router aplikasi, state manager, payload builder
│       └── audit-engine.js   # Logika inti audit, deteksi baris/kolom, rule engine
└── README.md
```

---

## 👥 Tim & Akuntabilitas

Dikembangkan untuk kebutuhan audit internal **Talent Management AIESEC in UMM**.
All rights reserved © 2026 AIESEC in UMM.
