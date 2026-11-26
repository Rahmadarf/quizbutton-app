#!/usr/bin/env bash
# Jalankan Cloudflare Tunnel (Docker) untuk QuizButton.
#   ./10-up.sh            jalankan cloudflared saja (sama dengan --tunnel)
#   ./10-up.sh --tunnel   jalankan cloudflared (untuk `npm start` atau `npm run dev` di laptop)
#   ./10-up.sh --server   jalankan cloudflared + aplikasi QuizButton sebagai kontainer (port 3001)
#   ./10-up.sh down       hentikan kontainer
#   ./10-up.sh logs       ikuti log
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HERE/.env"

die() { echo "Galat: $*" >&2; exit 1; }
info() { echo "==> $*"; }

command -v docker >/dev/null 2>&1 || die "perintah 'docker' tidak ditemukan"

get_env() {
  [ -f "$ENV_FILE" ] || return 0
  grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'
}

dc_tunnel() {
  (cd "$HERE" && docker compose --env-file "$ENV_FILE" -f docker-compose.tunnel.yml "$@")
}

dc_server() {
  (cd "$HERE" && docker compose --env-file "$ENV_FILE" -f docker-compose.tunnel.yml -f docker-compose.app.yml "$@")
}

MODE="${1:---tunnel}"
case "$MODE" in
  down)
    if [ -f "$ENV_FILE" ]; then
      dc_server down --remove-orphans
    else
      (cd "$HERE" && TUNNEL_TOKEN=dummy docker compose -f docker-compose.tunnel.yml -f docker-compose.app.yml down --remove-orphans)
    fi
    exit 0
    ;;
  logs)
    [ -f "$ENV_FILE" ] || die "$ENV_FILE belum ada. Salin dari .env.example atau jalankan ./55-tunnel-env.sh <domain>."
    dc_server logs -f --tail 100
    exit 0
    ;;
  up|--tunnel|--server)
    ;;
  *)
    die "pilihan: up | --tunnel | --server | down | logs"
    ;;
esac

[ -f "$ENV_FILE" ] || die "$ENV_FILE belum ada. Salin dari deploy/tunnel/.env.example lalu isi TUNNEL_TOKEN."
[ -n "$(get_env TUNNEL_TOKEN)" ] || die "TUNNEL_TOKEN belum diisi di deploy/tunnel/.env (lihat deploy/tunnel/README.md)."

if [ "$MODE" = "--server" ]; then
  info "Membangun & menjalankan QuizButton + Cloudflare Tunnel (mode server) ..."
  dc_server up -d --build
  dc_server ps
else
  info "Menjalankan Cloudflare Tunnel (quizbutton-cloudflared) ..."
  dc_tunnel up -d
  dc_tunnel ps
fi
