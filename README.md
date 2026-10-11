# GIBRAN PANEL HOSTING

Portal full-stack untuk permintaan pembuatan server Pterodactyl dengan persetujuan owner melalui Telegram.

## Stack
- Node.js 20+
- Express
- PostgreSQL
- Session berbasis PostgreSQL
- Telegram Bot API webhook
- Pterodactyl Application API

## Persyaratan penting sebelum produksi
Ini adalah implementasi awal yang menjalankan alur backend nyata, tetapi wajib diuji pada staging Pterodactyl milik sendiri sebelum dipakai publik. Konfigurasi node, location, nest, egg, allocation, environment egg, dan startup berbeda antar instalasi. Pastikan nilai `.env` sesuai panel Anda. Proses membuat akun lalu server bukan transaksi atomik lintas API; bila pembuatan server gagal setelah user berhasil dibuat, owner perlu membersihkan akun tersebut secara manual sebelum percobaan ulang. Jangan aktifkan endpoint untuk publik sebelum uji pemulihan ini dilakukan.

## Instalasi lokal
1. Instal Node.js 20 atau lebih baru dan PostgreSQL.
2. Buat database, misalnya `createdb gibran_panel`.
3. Salin `.env.example` menjadi `.env`, lalu isi nilai yang benar.
4. `npm install`
5. `npm run dev`
6. Buka `http://localhost:3000`.

`backend/app.js` membuat tabel dari `backend/database/schema.sql` saat startup. Database harus dapat diakses oleh `DATABASE_URL`.

## Konfigurasi API Pterodactyl
- `PANEL_URL`: URL panel tanpa garis miring terakhir.
- `PLTA`: Application API key yang dibuat pada panel milik Anda dengan izin administratif minimum yang dibutuhkan. Simpan hanya di environment backend/secret manager.
- `PLTC`: Client API key tidak digunakan oleh proses provisioning administratif ini. Disediakan untuk kebutuhan fitur client API mendatang; jangan pernah menggunakannya sebagai pengganti PLTA.
- `PTERO_LOCATION_ID`, `PTERO_NEST_ID`, `PTERO_EGG_ID`: ID yang ada pada instalasi Anda.
- `PTERO_ALLOWED_LOCATIONS`, `PTERO_ALLOWED_EGGS`: allowlist konfigurasi. Pastikan egg benar-benar termasuk allowlist.
- `PTERO_DOCKER_IMAGE`, `PTERO_STARTUP`: sesuaikan dengan egg.
- Allocation: payload memakai `deploy.locations` sehingga Pterodactyl memilih allocation tersedia di lokasi tersebut. Pterodactyl Application API memilih allocation yang tersedia dari location yang dikonfigurasi; daftar allocation ID eksplisit tidak dipakai oleh endpoint provisioning ini. Pastikan node-node yang boleh dipakai di panel Pterodactyl berada pada location yang diizinkan. Jika wajib mengunci ke node/allocation tertentu, tambahkan strategi deployment khusus yang sudah diverifikasi terhadap versi API panel Anda sebelum produksi.
- `RAM_OPTIONS_GB`, `CPU_OPTIONS`, `DISK_OPTIONS_GB` adalah opsi yang ditampilkan. Batas server-side selalu diperiksa terhadap `MAX_RAM_MB`, `MAX_CPU_PERCENT`, dan `MAX_DISK_MB`.
- `ALLOW_UNLIMITED=true` hanya membuat opsi tersedia; batas efektif tetap mengikuti `MAX_RAM_MB` dan `MAX_DISK_MB`. Ini berarti “unlimited” adalah label untuk batas maksimum yang dikonfigurasi, bukan resource tanpa batas fisik.

## Telegram
1. Buat bot menggunakan `@BotFather` dan masukkan token ke `TELEGRAM_BOT_TOKEN`.
2. Isi `TELEGRAM_OWNER_ID` dengan ID numerik akun Telegram owner. Jangan menggunakan username sebagai autentikasi.
3. Deploy dengan HTTPS dan domain publik.
4. Daftarkan webhook dengan `secret_token` yang sama dengan `TELEGRAM_WEBHOOK_SECRET`. Contoh menggunakan curl (ganti domain, token, dan secret; jangan menyimpan perintah berisi token ke log atau riwayat shell bersama):
   `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://hosting-contoh.com/api/telegram/webhook" -d "secret_token=<SECRET>"`
5. Uji tombol ACCEPT/REJECT dari akun owner yang benar.

## Menjadikan akun owner
Registrasi publik sengaja tidak menyediakan pilihan role. Buat akun melalui halaman register, lalu jalankan SQL manual dari koneksi database tepercaya:
`UPDATE users SET role='owner' WHERE email='email-owner-anda@example.com';`
Jangan membuat password default yang diketahui publik. Gunakan password unik dan kuat.

## Deployment produksi
- Gunakan HTTPS reverse proxy (misalnya Nginx/Caddy) dan set `NODE_ENV=production`.
- Gunakan secret acak minimal 32 karakter untuk `SESSION_SECRET` dan `TELEGRAM_WEBHOOK_SECRET`.
- Simpan `.env` di luar repository bila memungkinkan. Jangan commit `.env`; `.gitignore` sudah menyertakannya.
- Batasi akses jaringan ke database. Gunakan backup dan patch dependensi rutin.
- Tambahkan monitoring, backup database, serta proses pemulihan server yang gagal.
- Jalankan dengan process manager seperti systemd atau PM2; jangan jalankan sebagai root.
- `PLTA` harus memiliki hak minimum yang cukup, tidak pernah ditampilkan di frontend/Telegram/log.
- Aktifkan email transaksional dan alur reset password resmi sebelum penggunaan publik. Versi ini tidak meminta atau menyimpan password panel. Akun Pterodactyl dibuat tanpa mengirim password di API; konfigurasi email Pterodactyl harus aktif dan alur pengaturan/reset password perlu diuji agar pemohon dapat mengakses akun dengan aman.

## Pengujian
1. Pastikan `GET /api/health` merespons `{"ok":true}`.
2. Daftar dan login.
3. Ajukan panel dengan resource yang diizinkan.
4. Pastikan permintaan muncul di database dan Telegram owner menerima tombol.
5. Tolak permintaan, pastikan status `REJECTED` dan server tidak dibuat.
6. Pada staging, setujui permintaan valid dan cek user/server pada Pterodactyl.
7. Uji email/username duplikat, resource di luar batas, token salah, webhook secret salah, dan API timeout.
8. Pastikan pengguna tidak bisa melihat permintaan pengguna lain dengan mengganti ID endpoint.

## Catatan teknis yang harus dipahami
- `PLTC` sengaja tidak dipakai untuk membuat akun/server karena endpoint tersebut membutuhkan Application API.
- Formulir tidak meminta password panel. Pastikan konfigurasi email/reset password Pterodactyl berfungsi sebelum dipakai publik.
- Jika server API sukses tetapi penyimpanan database gagal, perlu rekonsiliasi manual di Pterodactyl. Uji alur ini sebelum publik.
- Endpoint webhook mengirim HTTP 200 sebelum proses callback agar Telegram tidak retry; kegagalan dilaporkan secara aman ke owner.
- Untuk hardening lebih lanjut, tambahkan CSRF token sinkronisasi penuh, verifikasi email, password reset website, kebijakan privasi, cleanup user yatim setelah kegagalan, dan test otomatis.


## Video pada dashboard
Dashboard memiliki slot video latar yang responsif. Letakkan video MP4 berlisensi atau milik sendiri bernama `dashboard-loop.mp4` di `frontend/media/`. Gunakan video pendek yang bisa di-loop, resolusi 720p atau 1080p, dan ukuran file yang dioptimalkan agar tidak berat di HP. Video diputar muted, loop, autoplay, dan playsinline; `dashboard-poster.svg` menjadi tampilan cadangan jika video belum tersedia.
