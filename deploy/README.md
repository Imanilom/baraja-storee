# 🚀 Panduan Deployment Baraja Purchasing System ke VPS

Spesifikasi Server & Domain:
- **IP VPS**: `43.163.124.222`
- **Domain Web**: `https://barajastore.my.id` (Next.js Dashboard Port 3000)
- **Domain API**: `https://api.barajastore.my.id` (Express Backend Port 5000)
- **Database**: MongoDB Atlas Cluster

---

## ⚠️ Langkah 0: Whitelist IP VPS di MongoDB Atlas (PENTING)
Sebelum deploy, pastikan IP VPS Anda diizinkan mengakses database MongoDB Atlas:
1. Buka [MongoDB Atlas Console](https://cloud.mongodb.com).
2. Masuk ke menu **Network Access** > **IP Access List**.
3. Klik **Add IP Address** > Masukkan IP `43.163.124.222/32` (atau pilih `Allow Access from Anywhere` / `0.0.0.0/0`).
4. Klik **Confirm**.

---

## 📦 Metode 1: Otomatis via PM2 + Nginx (Rekomendasi Tercepat & Ringan)

### Langkah 1: Login ke VPS via SSH
Buka Terminal / PowerShell di komputer Anda:
```bash
ssh root@43.163.124.222
```

### Langkah 2: Upload / Clone Source Code ke VPS
Di dalam VPS, clone repository ke folder `/var/www/baraja-store`:
```bash
sudo mkdir -p /var/www/baraja-store
cd /var/www/baraja-store

# Clone repo (atau git pull jika sudah ada)
git clone <URL_GIT_REPOSITORY_ANDA> .
```
*(Atau jika upload file zip via scp/FileZilla, ekstrak ke `/var/www/baraja-store`)*

### Langkah 3: Jalankan Script Setup Otomatis
Jalankan script setup yang telah disiapkan:
```bash
chmod +x deploy/*.sh
./deploy/setup-vps.sh
```

Script ini akan otomatis melakukan:
1. Menginstall Node.js 20 LTS, Git, Nginx, PM2, dan Certbot.
2. Mengkonfigurasi UFW Firewall (port 22, 80, 443).
3. Memasang reverse proxy Nginx untuk:
   - `barajastore.my.id` -> `http://127.0.0.1:3000`
   - `api.barajastore.my.id` -> `http://127.0.0.1:5000`
4. Membangun aplikasi Next.js Web (`npm run build:web`).
5. Menjalankan Backend API dan Frontend Web via PM2 dengan auto-restart saat VPS reboot.
6. Mengaktifkan sertifikat SSL HTTPS gratis dari Let's Encrypt secara otomatis.

---

## 🐳 Metode 2: Containerized via Docker Compose

Jika ingin menjalankan aplikasi secara terisolasi menggunakan Docker:

### 1. Install Docker & Docker Compose di VPS (jika belum ada)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 2. Jalankan Container Production
```bash
cd /var/www/baraja-store
docker compose -f docker-compose.prod.yml up -d --build
```

Container yang berjalan:
- `baraja_api`: Backend Express di port `127.0.0.1:5000`
- `baraja_web`: Next.js di port `127.0.0.1:3000`

### 3. Konfigurasi Nginx Host & SSL
```bash
sudo cp deploy/nginx/barajastore.conf /etc/nginx/sites-available/barajastore.conf
sudo ln -sf /etc/nginx/sites-available/barajastore.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d barajastore.my.id -d api.barajastore.my.id
```

---

## 🔄 Cara Update Aplikasi di Masa Mendatang
Kapan pun Anda melakukan perubahan kode dan push ke Git, update di VPS cukup 1 perintah:
```bash
cd /var/www/baraja-store
./deploy/update.sh
```

---

## 📱 Konfigurasi Aplikasi Mobile (Flutter)
Aplikasi mobile telah dikonfigurasi secara default mengarah ke API produksi:
```dart
https://api.barajastore.my.id/api/v1
```
Jika ingin build APK Android:
```bash
cd apps/mobile
flutter build apk --release
```
File APK siap didistribusikan ke staf outlet/gudang dan langsung terhubung ke server produksi.

