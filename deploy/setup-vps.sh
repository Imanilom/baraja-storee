#!/usr/bin/env bash
set -e

# ================================================================
# Baraja Purchasing System - Automated VPS Setup Script
# Target Domains:
#   Web : barajastore.my.id
#   API : api.barajastore.my.id
# Target IP: 43.163.124.222
# ================================================================

echo "========================================================"
echo "🚀 MEMULAI SETUP VPS BARAJA STORE"
echo "========================================================"

# 1. Wait for any background apt process to release lock (unattended-upgrades)
echo "📦 1. Memeriksa ketersediaan apt lock..."
while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || sudo fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
    echo "⏳ Sistem Ubuntu sedang menjalankan background auto-update, menunggu 5 detik..."
    sleep 5
done

echo "📦 Mengupdate paket sistem Ubuntu..."
sudo apt-get update -y
sudo apt-get install -y curl wget git nginx certbot python3-certbot-nginx ufw build-essential

# 2. Install Node.js 20 LTS
if ! command -v node &> /dev/null; then
    echo "📦 2. Menginstall Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js sudah terpasang: $(node -v)"
fi

# 3. Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo "📦 3. Menginstall PM2 process manager..."
    sudo npm install -g pm2
else
    echo "✅ PM2 sudah terpasang: $(pm2 -v)"
fi

# 4. Setup Firewall
echo "🛡️ 4. Mengkonfigurasi UFW Firewall (SSH, HTTP, HTTPS)..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

# 5. Pasang konfigurasi Nginx
echo "🌐 5. Memasang konfigurasi Nginx reverse proxy..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

sudo cp "$SCRIPT_DIR/nginx/barajastore.conf" /etc/nginx/sites-available/barajastore.conf
sudo ln -sf /etc/nginx/sites-available/barajastore.conf /etc/nginx/sites-enabled/barajastore.conf

# Hapus default nginx site jika masih aktif
sudo rm -f /etc/nginx/sites-enabled/default

# Test & reload nginx
sudo nginx -t
sudo systemctl reload nginx

# 6. Install Dependencies & Build Monorepo
echo "⚙️ 6. Menginstall dependensi proyek (npm install)..."
cd "$PROJECT_ROOT"

# Ensure environment file for API exists
if [ ! -f "$PROJECT_ROOT/apps/api/.env" ]; then
    echo "PORT=5000" > "$PROJECT_ROOT/apps/api/.env"
    echo "NODE_ENV=production" >> "$PROJECT_ROOT/apps/api/.env"
    echo "MONGODB_URI=mongodb+srv://rcooker00_db_user:0Mkh0swiymyFu2Ti@baraja-store.d9rjswq.mongodb.net/purchasing_management?retryWrites=true&w=majority" >> "$PROJECT_ROOT/apps/api/.env"
    echo "JWT_SECRET=$(openssl rand -hex 32)" >> "$PROJECT_ROOT/apps/api/.env"
    echo "JWT_EXPIRES_IN=7d" >> "$PROJECT_ROOT/apps/api/.env"
    echo "REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)" >> "$PROJECT_ROOT/apps/api/.env"
    echo "REFRESH_TOKEN_EXPIRES_IN=30d" >> "$PROJECT_ROOT/apps/api/.env"
    echo "BARAJA_STORE_BASE_URL=https://app.barajacoffee.site" >> "$PROJECT_ROOT/apps/api/.env"
    echo "BARAJA_STORE_OAUTH_CLIENT_ID=baraja-store-client-id" >> "$PROJECT_ROOT/apps/api/.env"
    echo "BARAJA_STORE_OAUTH_CLIENT_SECRET=JiLcYhCVxdkHK4V/6gFC7gUhsxi8h7pXkbwXpSD0zCA=" >> "$PROJECT_ROOT/apps/api/.env"
    echo "BARAJA_STORE_OAUTH_TOKEN_SECRET=j9lUz73prZX9bq0L3qNBIojiM/RtR15jkw7ImWMU/Jc=" >> "$PROJECT_ROOT/apps/api/.env"
    echo "✅ File apps/api/.env otomatis dibuat."
fi

# Ensure environment file for Web exists
if [ ! -f "$PROJECT_ROOT/apps/web/.env.production" ]; then
    echo "NEXT_PUBLIC_API_URL=https://api.barajastore.my.id/api/v1" > "$PROJECT_ROOT/apps/web/.env.production"
    echo "✅ File apps/web/.env.production otomatis dibuat."
fi

npm ci || npm install

echo "🏗️ 7. Melakukan build Web Dashboard Next.js..."
NEXT_PUBLIC_API_URL="https://api.barajastore.my.id/api/v1" npm run build:web

# 8. Start with PM2
echo "⚡ 8. Menjalankan aplikasi dengan PM2..."
pm2 start ecosystem.config.js || pm2 restart ecosystem.config.js
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || true

# 9. Let's Encrypt SSL
echo "🔒 9. Mengaktifkan SSL HTTPS gratis (Let's Encrypt Certbot)..."
echo "Menjalankan Certbot untuk barajastore.my.id dan api.barajastore.my.id..."
sudo certbot --nginx -d barajastore.my.id -d api.barajastore.my.id --non-interactive --agree-tos --register-unsafely-without-email || {
    echo "⚠️ Certbot otomatis belum selesai, silakan jalankan manual:"
    echo "sudo certbot --nginx -d barajastore.my.id -d api.barajastore.my.id"
}

echo "========================================================"
echo "🎉 DEPLOYMENT SELESAI!"
echo "Web URL : https://barajastore.my.id"
echo "API URL : https://api.barajastore.my.id/api/v1"
echo "========================================================"
pm2 status

