# Cloudflare Tunnel (Docker) untuk QuizButton

Konfigurasi ini dibuat sama polanya dengan `classmeet`: `cloudflared` berjalan sebagai kontainer Docker (`cloudflare/cloudflared:latest`), membuka sambungan **keluar** ke Cloudflare (tanpa port forwarding / sertifikat CA), dan otomatis menyediakan **HTTPS + WebSocket (`wss://`)** untuk semua perangkat peserta.

## Prasyarat
- Docker + Docker Compose v2
- Koneksi internet
- Domain yang sudah aktif di akun Cloudflare (paket Free sudah cukup)

## 1. Setup sekali di dasbor Cloudflare
1. Buka **Cloudflare Zero Trust > Networks > Tunnels > Create a tunnel > Cloudflared**, beri nama misalnya `quizbutton` (atau pakai tunnel yang sudah ada dan cukup tambahkan Public Hostname baru).
2. Salin **TUNNEL_TOKEN** (rahasia).
3. Di tab **Public Hostname**, tambahkan entri sesuai mode yang dipakai (pilih **HTTP**, bukan HTTPS):

| Mode | Hostname | Service |
| --- | --- | --- |
| **Produksi di laptop (`npm start`)** | `quiz.<domain>` | `http://host.docker.internal:3001` |
| **Development di laptop (`npm run dev`)** | `quiz.<domain>` | `http://host.docker.internal:5173` |
| **Server Docker (`./10-up.sh --server`)** | `quiz.<domain>` | `http://quizbutton-app:3001` |

> Jika kamu menggunakan tunnel yang sama dengan `classmeet` di satu mesin, cukup tambahkan Public Hostname `quiz.<domain>` ke tunnel `classmeet` tanpa perlu menjalankan kontainer `cloudflared` kedua.

## 2. Konfigurasi di laptop / server
```bash
cd deploy/tunnel
./55-tunnel-env.sh quiz.<domain>
```

Lalu isi `TUNNEL_TOKEN` di `deploy/tunnel/.env` (berkas ini diabaikan oleh `.gitignore`):
```env
TUNNEL_TOKEN=<token dari dasbor Cloudflare>
QUIZBUTTON_PUBLIC_HOST=quiz.<domain>
APP_PORT=3001
```

Bila akan mengakses lewat `npm run dev` (port `5173`), tambahkan juga ke `.env.local` di akar repo agar Vite mengizinkan Host header domain publik:
```env
QUIZBUTTON_PUBLIC_HOSTS=quiz.<domain>
```

## 3. Menjalankan

### Mode laptop — produksi (direkomendasikan saat acara)
```bash
npm run build
npm start               # tunnel + server nyala; Ctrl+C mematikan keduanya
```
Opsi lain:
```bash
npm run start:app       # hanya jalankan server Node (tanpa menyentuh tunnel)
KEEP_TUNNEL=1 npm start # Ctrl+C hanya mematikan server; tunnel tetap menyala
```

### Mode laptop — development
```bash
npm run dev             # otomatis mencoba `npm run tunnel:up` lalu menjalankan server + Vite
```

### Mode kontainer penuh (server)
```bash
cd deploy/tunnel
./10-up.sh --server     # build image + jalankan quizbutton-app & quizbutton-cloudflared
./10-up.sh logs         # ikuti log
./10-up.sh down         # hentikan kontainer
```

### Kontrol tunnel manual dari akar repo
```bash
npm run tunnel:up
npm run tunnel:logs
npm run tunnel:down
```
