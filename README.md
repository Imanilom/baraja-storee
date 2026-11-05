# Purchasing Management System (Baraja Store)

Sistem purchasing terintegrasi yang terdiri dari **Web Dashboard (Next.js)** dan **Mobile Application (React Native / Expo)** yang saling terintegrasi melalui satu backend **Modular Monolith (Node.js + Express + MongoDB)**.

---

## 3 Aturan Pokok Arsitektur

1. **Mobile Hanya untuk Penerimaan (Receiving):**
   - Mobile berfungsi murni sebagai **Surat Jalan Digital** untuk memverifikasi kedatangan fisik barang berdasarkan Marketlist.
   - Tidak ada checklist pembelian di mobile.
2. **Invoice Berdasarkan Snapshot Marketlist yang Disetujui (Approved):**
   - Nilai invoice menggunakan harga dan kuantitas yang tercatat pada Marketlist, bukan hasil checklist fisik penerimaan.
   - Satu Marketlist dengan beberapa supplier menghasilkan **invoice terpisah per supplier**.
3. **Single Approval Gate oleh Admin:**
   - Admin menjadi satu-satunya pihak yang menyetujui Marketlist.
   - Marketlist yang belum disetujui tidak dapat digunakan untuk proses receiving maupun generate invoice.

---

## Struktur Monorepo

```text
purchasing-management/
├── apps/
│   ├── api/                     # Node.js + Express Backend (Modular Monolith)
│   │   ├── src/
│   │   │   ├── config/          # DB connection & Environment
│   │   │   ├── middleware/      # JWT Auth, RBAC, Validation, Error Handling
│   │   │   ├── modules/         # Modular domain modules
│   │   │   │   ├── auth/        # Login, refresh token, me
│   │   │   │   ├── users/       # User management & roles
│   │   │   │   ├── products/    # Master items, categories, units
│   │   │   │   ├── suppliers/   # Master suppliers
│   │   │   │   ├── marketlists/ # Marketlist CRUD, submit, versioning
│   │   │   │   ├── approvals/   # Admin approval & rejection
│   │   │   │   ├── receiving/   # Mobile Surat Jalan Digital & Receiving
│   │   │   │   ├── notes/       # Single note per Marketlist
│   │   │   │   ├── invoices/    # Invoice generator (snapshot) & PDF
│   │   │   │   ├── prices/      # Price monitoring & history
│   │   │   │   ├── purchases/   # Purchase records
│   │   │   │   ├── kpi/         # KPI calculation & admin evaluation
│   │   │   │   ├── dashboard/   # Executive summary & metrics
│   │   │   │   └── audit/       # Immutable Activity Logs
│   │   │   ├── utils/           # Number generators & standard responses
│   │   │   └── server.js
│   │   └── test/                # Automated 16 Acceptance Criteria suite
│   ├── web/                     # Next.js Web Dashboard
│   └── mobile/                  # React Native / Expo Mobile Receiving
├── packages/
│   ├── constants/               # Status enums, roles, and conditions
│   ├── validation/              # Zod schemas for input validation
│   └── shared-types/            # Shared TypeScript types
├── docker-compose.yml           # MongoDB Replica Set (rs0) for transactions
└── package.json                 # Monorepo workspace configuration
```

---

## Panduan Menjalankan Sistem

### 1. Prasyarat
- Node.js >= 18
- Docker & Docker Compose (atau MongoDB Server lokal dengan replica set)

### 2. Menjalankan MongoDB Replica Set
```bash
docker compose up -d
```

### 3. Setup Dependencies
```bash
npm install
```

### 4. Seed Master Data & Akun Testing
```bash
npm run seed --workspace=apps/api
```

Akun bawaan hasil seed:
- **Admin**: `admin@baraja.com` / `admin123`
- **Purchasing**: `purchasing@baraja.com` / `purchasing123`
- **Receiver**: `receiver@baraja.com` / `receiver123`
- **Accounting**: `accounting@baraja.com` / `accounting123`
- **Management**: `management@baraja.com` / `management123`

### 5. Menjalankan API Server
```bash
npm run dev:api
```
Health check: `http://localhost:5000/health`  
Base API: `http://localhost:5000/api/v1`

### 6. Menjalankan Automated Acceptance Test (16/16 Skenario)
```bash
npm run test:api
```

---

## Checklist Acceptance Testing (16/16 Lolos)

- [x] Purchasing dapat membuat Marketlist dengan beberapa item.
- [x] Purchasing dapat submit Marketlist kepada Admin.
- [x] Hanya Admin yang dapat menyetujui Marketlist.
- [x] Marketlist yang ditolak dapat direvisi (versioning).
- [x] Marketlist yang belum approved tidak dapat menghasilkan invoice.
- [x] Invoice menggunakan harga dan kuantitas snapshot Marketlist.
- [x] Satu Marketlist dengan beberapa supplier menghasilkan invoice terpisah.
- [x] Mobile hanya menampilkan Marketlist yang sudah disetujui dan ditugaskan.
- [x] Receiver dapat memeriksa barang dan menginput kuantitas aktual.
- [x] Satu Marketlist dapat memiliki beberapa penerimaan bertahap.
- [x] Sistem dapat mendeteksi barang kurang, lebih, dan rusak (`complete`, `partial`, `over_received`, `rejected`).
- [x] Satu Marketlist hanya memiliki satu notes aktif.
- [x] Perubahan notes dan approval tercatat di audit log (`ActivityLog`).
- [x] Invoice tidak berubah ketika master harga atau Marketlist berubah (`immutable snapshot`).
- [x] Marketlist tidak dapat ditutup jika masih ada penerimaan yang belum selesai.
- [x] Sinkronisasi offline tidak membuat penerimaan ganda (`client_request_id` idempotency).

