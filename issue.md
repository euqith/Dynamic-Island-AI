# [Epic] Dynamic Island Desktop Application for Windows & macOS

## 📌 Ringkasan Proyek (Overview)

Membangun aplikasi desktop **Dynamic Island (Notch)** berbasis **Node.js (Electron)** yang kompatibel secara cross-platform untuk **macOS** dan **Windows**. Aplikasi ini menempel secara estetis dan responsif di bagian atas layar (menyerupai notch / dynamic island), memberikan visual interaktif, pembacaan media player aktif (Spotify, YouTube, browser, dll.), lirik berjalan (live lyrics), sinkronisasi notifikasi sistem (WhatsApp, Telegram, Discord, Outlook, GitHub, dll.), serta modul produktivitas terintegrasi (Water Reminder, Pomodoro Timer, Todo List).

---

## 📸 Referensi Desain & Fitur (Attachments)

Desain dan modul mengacu pada referensi visual di folder [`attachments/`](attachments/):

| No | Modul / Tampilan | File Gambar | Deskripsi Fitur |
|---|---|---|---|
| 1 | **Collapsed / Idle State** | [`attachments/03-collapsed-notch.png`](attachments/03-collapsed-notch.png) | Notch ringkas di atas layar, indikator status/baterai, dan jam digital. Membesar saat di-hover. |
| 2 | **Music Player (Active)** | [`attachments/02-music-player.png`](attachments/02-music-player.png) | Cover art, judul lagu, artist/channel, seekbar progres, kontrol playback, tombol lirik. |
| 3 | **Music Player (Idle)** | [`attachments/05-music-idle.png`](attachments/05-music-idle.png) | Status "Tidak ada media" saat tidak ada media player yang memutar audio/video di sistem. |
| 4 | **Live Lyrics (Synced)** | [`attachments/07-live-lyrics.png`](attachments/07-live-lyrics.png) | Panel lirik otomatis yang tersinkronisasi per baris/detik dengan musik yang sedang diputar. |
| 5 | **Water / Drink Reminder** | [`attachments/01-water-reminder.png`](attachments/01-water-reminder.png) | Tracker konsumsi air harian (target liter, persentase), grafik asupan berkala, dan tombol log minum. |
| 6 | **Pomodoro Timer** | [`attachments/04-pomodoro-timer.png`](attachments/04-pomodoro-timer.png) | Timer fokus 25:00, opsi Short Break / Long Break, tombol Play/Pause/Reset. |
| 7 | **TodoList / Notes** | [`attachments/06-todolist-notes.png`](attachments/06-todolist-notes.png) | Checklist task harian (0/3 Task Done), jadwal jam, tombol Add Task & Edit Task. |

---

## 🎯 Spesifikasi Kebutuhan (Requirements)

### 1. Platform & Runtime
- **Runtime**: Node.js v20+ LTS dengan framework desktop **Electron**.
- **UI Framework**: Vite + Preact / React (ringan, bundle size kecil) + TailwindCSS / Vanilla CSS untuk performa animasi maksimal.
- **Cross-Platform Compatibility**:
  - **macOS**: Mendukung macOS 12+ (Monterey, Ventura, Sonoma, Sequoia). Kompatibel dengan layar ber-notch fisik (MacBook M1/M2/M3) maupun tanpa notch / monitor eksternal.
  - **Windows**: Mendukung Windows 10 & Windows 11 (64-bit).

### 2. Window & Notch Behavior
- **Frameless & Transparent Window**: Window tanpa border OS, latar transparan (`transparent: true`), `alwaysOnTop: true` (`level: 'screen-saver'` di macOS / `HWND_TOPMOST` di Windows).
- **Click-Through (Mouse Passthrough)**:
  - Saat dalam keadaan *idle / collapsed*, area di luar bentuk pill/island menggunakan `setIgnoreMouseEvents(true, { forward: true })` agar tidak menghalangi klik mouse user ke aplikasi lain atau menu bar OS.
  - Saat kursor mendekati / menyentuh area island (*hitbox*), `setIgnoreMouseEvents(false)` diaktifkan agar user bisa berinteraksi secara penuh.
- **Dynamic Physics & Morphing**:
  - Animasi transisi halus (fluid spring animation) saat berubah bentuk (Idle ➔ Hover ➔ Expanded ➔ Notification Banner ➔ Lyrics Mode).
- **Multi-Monitor Awareness**:
  - Secara default menempel di layar primer (Primary Display). Dapat dikonfigurasi untuk pindah monitor melalui Settings.

### 3. Modul Widget & Navigasi
- **Carousel Pagination**: Terdapat panah navigasi kiri/kanan (`<` dan `>`) serta *pagination dots* di bagian bawah untuk berpindah antar widget dengan transisi geser mulus.
- **Widget 1: Media Player Controller**:
  - Membaca metadata lagu: Album Art, Judul, Artis/Kanal, Durasi, Elapsed Time.
  - Kontrol dua arah: Previous, Play/Pause, Next.
  - Deteksi status aktif/idle otomatis.
- **Widget 2: Live Scrolling Lyrics**:
  - Integrasi API Lirik tersinkronisasi (LRCLIB API / Spotify synced lyrics / Apple Music JXA).
  - Tampilan lirik dinamis dengan penanda baris aktif sesuai timestamp detik playback.
- **Widget 3: Drink / Water Reminder**:
  - Target harian (misal 2.0 L), progress bar persentase.
  - Grafik batang konsumsi per jam.
  - Tombol cepat `+ Drink` (+200ml / +250ml).
  - Notifikasi berkala cerdas (dapat diset interval 30m, 1h, 2h).
- **Widget 4: Pomodoro Focus Timer**:
  - Mode: Focus (25m), Short Break (5m), Long Break (15m).
  - Tampilan countdown sisa waktu, tombol start/pause dan reset.
  - Bunyi lonceng / alert audio halus saat sesi selesai.
- **Widget 5: TodoList & Quick Notes**:
  - Rekap tugas hari ini (e.g. `0/3 Task Done Today`).
  - Checkbox interaktif untuk menandai selesai.
  - Quick modal untuk menambah tugas baru dan mengatur jam kegiatan.

### 4. Integrasi Notifikasi Sistem (System-wide Notification Listener)
- **Cakupan Aplikasi**: Mendeteksi notifikasi yang masuk dari WhatsApp, Telegram, Discord, Microsoft Outlook, GitHub, Slack, Browser, atau notifikasi aplikasi OS lainnya.
- **Mekanisme Integrasi**:
  - **Windows**: Menggunakan API WinRT `Windows.UI.Notifications.Management.UserNotificationListener` via modul C++/Node-API native addon (`node-calls-winrt` / custom binding) untuk membaca notifikasi banner Windows 10/11 secara real-time.
  - **macOS**: Menggunakan macOS Accessibility API / AppleScript / database `usernoted` listener, atau integrasi webhook lokal (WebSocket/HTTP bridge) untuk menerima payload notifikasi.
- **Perilaku Notifikasi pada Island**:
  - Island membesar secara dinamis (spring bounce animation).
  - Menampilkan icon aplikasi, nama pengirim, subjek/isi ringkas pesan.
  - Opsi auto-dismiss setelah 4-6 detik atau dismiss manual via swipe/klik.

### 5. Integrasi Media Player (System-wide Media Session)
- **Cakupan Player**: YouTube (melalui Chrome, Edge, Brave, Firefox), Spotify Desktop/Web, Apple Music, VLC, Tidal, SoundCloud, dll.
- **Mekanisme Integrasi**:
  - **Windows**: Mengintegrasikan `Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager` (SMTC) via Node-API untuk mendapatkan metadata lagu, thumbnail, timeline position, dan event `playbackInfoChanged`.
  - **macOS**: Mengintegrasikan framework `MediaRemote` / `AppleScript` / bridge CLI `nowplaying-cli` untuk mengambil status now-playing dan mengontrol playback.

---

## 🔒 Keamanan (Security by Design)

Mengingat aplikasi desktop ini beroperasi dengan hak akses sistem (notifikasi & media), standar keamanan ketat wajib diterapkan:
1. **Isolasi Arsitektur Electron**:
   - `contextIsolation: true` wajib aktif pada BrowserWindow.
   - `nodeIntegration: false` wajib untuk seluruh renderer process.
   - `sandbox: true` diaktifkan untuk mencegah akses filesystem langsung dari frontend.
2. **IPC Communication Safety**:
   - Komunikasi antara Main Process dan Renderer Process hanya melalui `ipcRenderer.invoke` dan `ipcMain.handle` yang divalidasi dengan schema ketat (menggunakan Zod / TypeScript types).
   - Menolak eksekusi `eval()` atau pembuatan fungsi dinamis dari data eksternal.
3. **Strict Content Security Policy (CSP)**:
   ```http
   default-src 'self';
   script-src 'self';
   style-src 'self' 'unsafe-inline';
   img-src 'self' data: https:;
   media-src 'self' data:;
   connect-src 'self' https://lrclib.net;
   ```
4. **Sanitisasi Konten Notifikasi**:
   - Teks notifikasi dari luar (pengirim, pesan WA/Discord/Telegram) disanitasi menggunakan DOM text encoding atau DOMPurify guna mencegah serangan XSS / HTML Injection.
5. **Proteksi Navigasi Eksternal**:
   - Memblokir event `will-navigate` dan `setWindowOpenHandler` agar renderer tidak dapat diarahkan ke situs berbahaya di luar aplikasi. Link eksternal selalu dibuka di default browser sistem via `shell.openExternal()`.

---

## ⚡ Optimalisasi Kinerja & Performa (Lightweight & Zero-Lag)

Aplikasi harus berjalan di latar belakang tanpa memberatkan CPU atau memakan RAM berlebih:
1. **Target Metrik Resource**:
   - **RAM Usage**: ≤ 60MB - 90MB saat aktif, ≤ 40MB saat idle / collapsed.
   - **CPU Usage**: ~0% saat idle / background, ≤ 2% saat memutar animasi transisi.
2. **Throttling Frame & Animasi**:
   - Saat state *collapsed* dan tidak ada pembaruan media/notifikasi, matikan loop animasi dan turunkan framerate render window (`webContents.setFrameRate(15)` atau pause requestAnimationFrame).
   - Gunakan CSS hardware-accelerated transforms (`transform: translate3d`, `opacity`, `will-change`) daripada memodifikasi layout properties (`top`, `left`, `width`, `height`).
3. **Event-Driven Architecture (Bukan Tight Polling)**:
   - Gunakan event listener OS (event trigger dari Windows SMTC / macOS MediaRemote) alih-alih polling loop berkecepatan tinggi.
   - Polling fallback dibatasi maksimal interval 1000ms - 2000ms dan di-pause jika layar mati / sistem terkunci.
4. **Minimal Runtime Dependency**:
   - Menghindari framework raksasa di renderer. Gunakan Vite + Preact atau React ringan dengan tree-shaking optimal untuk memastikan binary output efisien.

---

## 🏗️ Struktur Arsitektur Kode (Proposed Project Structure)

```text
DynamicIslandAI/
├── attachments/                   # Folder aset visual referensi (PNG & HEIC)
│   ├── 01-water-reminder.png
│   ├── 02-music-player.png
│   ├── 03-collapsed-notch.png
│   ├── 04-pomodoro-timer.png
│   ├── 05-music-idle.png
│   ├── 06-todolist-notes.png
│   └── 07-live-lyrics.png
├── src/
│   ├── main/                      # Electron Main Process (Node.js)
│   │   ├── index.ts               # Entry point aplikasi
│   │   ├── windowManager.ts       # Manajemen notch window, transparansi, click-through
│   │   ├── ipcHandlers.ts         # Komunikasi aman Main-Renderer
│   │   ├── services/
│   │   │   ├── media/             # Media player provider (macOS MediaRemote & Windows SMTC)
│   │   │   │   ├── mediaProvider.ts
│   │   │   │   ├── macMedia.ts
│   │   │   │   └── winMedia.ts
│   │   │   ├── notification/      # Notification listener provider
│   │   │   │   ├── notificationProvider.ts
│   │   │   │   ├── winNotification.ts
│   │   │   │   └── macNotification.ts
│   │   │   └── lyrics/            # Service fetcher lirik real-time (LRCLIB)
│   │   │       └── lyricsService.ts
│   │   └── storage/               # Penyimpanan lokal (Todo & Water logs via SQLite / electron-store)
│   ├── preload/                   # Preload contextBridge yang aman
│   │   ├── index.ts
│   │   └── api.d.ts
│   └── renderer/                  # Frontend UI (Preact / React + Vite)
│       ├── index.html
│       ├── src/
│       │   ├── App.tsx            # Main Island Container & State Morphing
│       │   ├── components/
│       │   │   ├── island/        # Notch header, clock, status indicator
│       │   │   ├── widgets/
│       │   │   │   ├── MusicWidget.tsx
│       │   │   │   ├── LyricsPanel.tsx
│       │   │   │   ├── WaterWidget.tsx
│       │   │   │   ├── PomodoroWidget.tsx
│       │   │   │   └── TodoWidget.tsx
│       │   │   └── notification/  # Notification Banner Pop-down
│       │   ├── hooks/             # Custom hooks (useMedia, useNotification, useTimer)
│       │   └── styles/            # CSS Glassmorphism & Spring Animations
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml           # Konfigurasi packaging (DMG/PKG untuk Mac, NSIS untuk Windows)
└── issue.md                       # Dokumentasi issue & roadmap pengembangan
```

---

## 📋 Tahapan Pelaksanaan (Phased Implementation Roadmap)

### Phase 1: Setup Proyek & Window Notch Base (Sprint 1)
- [ ] Inisialisasi template Electron + TypeScript + Vite + TailwindCSS.
- [ ] Buat BrowserWindow transparan, frameless, always-on-top, auto-positioning di top-center layar.
- [ ] Implementasikan mekanisme dinamis *click-through passthrough* (`setIgnoreMouseEvents`).
- [ ] Buat container Dynamic Island dengan animasi transisi morphing (Collapsed ➔ Hover ➔ Expanded).

### Phase 2: Modul Media Player & Live Lyrics (Sprint 2)
- [ ] Integrasikan pembacaan media sesi aktif:
  - Windows: SMTC native binding.
  - macOS: MediaRemote / AppleScript bridge.
- [ ] Implementasikan kontrol tombol playback (Prev, Play/Pause, Next) dari UI ke OS.
- [ ] Tampilkan UI Music Player aktif dan tampilan fallback ("Tidak ada media").
- [ ] Integrasikan API Lirik real-time (LRCLIB) dan parser LRC untuk auto-scrolling lyrics.

### Phase 3: Modul Produktivitas (Water, Pomodoro, Todo) (Sprint 3)
- [ ] Bangun widget **Water Tracker**: state penyimpanan lokal, tombol `+ Drink`, dan visual chart asupan harian.
- [ ] Bangun widget **Pomodoro Timer**: timer countdown akurat, switch mode (Focus / Break), notifikasi audio selesai.
- [ ] Bangun widget **TodoList**: checklist interaktif, penyimpanan lokal aman, input modal tugas baru.
- [ ] Implementasikan carousel navigasi (panah kiri/kanan & pagination dots) untuk beralih antar 4 widget.

### Phase 4: Integrasi Notifikasi Sistem (Sprint 4)
- [ ] Implementasikan listener notifikasi OS (Windows UserNotificationListener & macOS bridge).
- [ ] Buat antarmuka pop-down banner saat notifikasi baru tiba (icon, nama pengirim, preview pesan).
- [ ] Implementasikan sanitisasi XSS pada teks notifikasi dan auto-dismiss timer.

### Phase 5: Keamanan, Optimasi Performa & Battery Life (Sprint 5)
- [ ] Audit CSP dan audit IPC channels untuk memastikan sandboxing 100% aman.
- [ ] Optimasi memory lifecycle (unmount inactive widgets, throttle render framerate saat idle).
- [ ] Pengujian performa penggunaan CPU dan RAM di Windows 11 dan macOS Sonoma/Sequoia.

### Phase 6: Packaging, Installer & Rilis (Sprint 6)
- [ ] Konfigurasi `electron-builder`:
  - macOS: Universal binary (Apple Silicon arm64 & Intel x64), support notarization.
  - Windows: Installer NSIS / portable exe x64.
- [ ] Dokumentasi penggunaan dan panduan instalasi.

---

## ✅ Kriteria Penerimaan (Acceptance Criteria)

1. **Desain & Responsivitas**: Tampilan pixel-perfect menyerupai referensi desain pada gambar di folder `attachments/`.
2. **Kesesuaian Media Player**: Musik yang diputar di Spotify Desktop maupun YouTube di browser dapat terbaca judul, durasi, artis, dan dikontrol langsung dari island.
3. **Lirik Tersinkronisasi**: Lirik berjalan otomatis bergulir mengikuti detik lagu yang sedang diputar.
4. **Notifikasi Real-time**: Notifikasi dari aplikasi pengirim pesan (WhatsApp/Discord/Telegram/dll.) memicu animasi pemekaran island secara instan tanpa glitch.
5. **Stabilitas & Ringan**: Konsumsi memori RAM di bawah 90MB dan penggunaan CPU mendekati 0% saat idle; klik mouse tidak terblokir di area transparan.
