#!/usr/bin/env bash
# Setel hostname publik Cloudflare Tunnel di deploy/tunnel/.env lalu cetak baris .env.local untuk Vite dev.
#   ./55-tunnel-env.sh quiz.contoh.com
# Tidak mencetak rahasia apa pun (TUNNEL_TOKEN diisi manual di deploy/tunnel/.env).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HERE/.env"

die() { echo "Galat: $*" >&2; exit 1; }
info() { echo "==> $*"; }

APP="${1:-}"
[[ "$APP" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] \
  || die "pemakaian: ./55-tunnel-env.sh quiz.<domain> (hanya nama host, tanpa https://)"

if [ ! -f "$ENV_FILE" ]; then
  cp "$HERE/.env.example" "$ENV_FILE"
fi

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s#^${key}=.*#${key}=${value}#" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

set_env QUIZBUTTON_PUBLIC_HOST "$APP"

info "deploy/tunnel/.env diperbarui. Bila memakai 'npm run dev', salin ke .env.local di akar repo:"
echo "QUIZBUTTON_PUBLIC_HOSTS=$APP"
echo
echo "Berikutnya:"
echo "  1. Isi TUNNEL_TOKEN=<token Cloudflare> di deploy/tunnel/.env"
echo "  2. Jalankan: npm run build && npm start   (route Cloudflare -> http://host.docker.internal:3001)"
echo "     atau:     npm run dev                  (route Cloudflare -> http://host.docker.internal:5173)"
