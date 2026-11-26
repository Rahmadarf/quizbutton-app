#!/usr/bin/env bash
# `npm start`: jalankan Cloudflare Tunnel (deploy/tunnel/10-up.sh --tunnel), lalu server produksi QuizButton
# di terminal yang sama. Saat dihentikan dengan Ctrl+C (atau proses ditutup), tunnel ikut dimatikan,
# jadi tidak perlu terminal kedua.
#   npm start                tunnel nyala, server jalan; Ctrl+C mematikan keduanya
#   npm run start:app        hanya server produksi (tunnel dibiarkan seperti keadaannya)
#   KEEP_TUNNEL=1 npm start  Ctrl+C hanya mematikan server; tunnel tetap menyala
# Butuh `npm run build` lebih dulu.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

TUNNEL_SCRIPT="${TUNNEL_SCRIPT:-deploy/tunnel/10-up.sh}"

say() { printf '[start] %s\n' "$*"; }

tunnel_started=0
cleanup() {
  trap - EXIT INT TERM
  if [ "$tunnel_started" = 1 ] && [ "${KEEP_TUNNEL:-0}" != 1 ]; then
    echo
    say "Mematikan Cloudflare Tunnel ..."
    bash "$TUNNEL_SCRIPT" down || say "Gagal mematikan tunnel; matikan manual: npm run tunnel:down"
  elif [ "$tunnel_started" = 1 ]; then
    echo
    say "KEEP_TUNNEL=1: tunnel dibiarkan menyala (matikan dengan: npm run tunnel:down)."
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

say "Menjalankan Cloudflare Tunnel ..."
if bash "$TUNNEL_SCRIPT" --tunnel; then
  tunnel_started=1
else
  say "Tunnel gagal jalan (lihat galat di atas); server QuizButton tetap dilanjutkan."
fi

NODE_ENV=production node dist-server/index.js "$@"
status=$?
exit "$status"
