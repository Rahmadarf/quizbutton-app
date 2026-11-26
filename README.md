# QuizButton App (Self-Hosted Realtime Quiz Buzzer)

Self-hosted, minimalist replica of QuizButton built with **React + Vite + TanStack Query + Tailwind CSS v4 + Node.js WebSocket**, featuring:

- **Server-authoritative 5-second buzzer lock** (atomic first-press detection on the server so all devices agree on who buzzed first).
- **Screen Wake Lock** on the room page so mobile devices stay awake during a quiz.
- **Embeddable `<iframe>` + `postMessage` Bridge** so any external website can wrap the buzzer and immediately capture who pressed first.
- **Live Event API** (WebSocket, Server-Sent Events, and REST) for external integrations.

## Quick Start

```bash
npm install
npm run dev
```

- Frontend (Vite): `http://localhost:5173`
- Backend API & WebSocket: `http://localhost:3001` (proxied automatically by Vite)
- Embed & Event API Demo: `http://localhost:5173/embed-demo`

### Production Build & Run

```bash
npm run build
npm start          # runs Cloudflare Tunnel + production server (Ctrl+C stops both)
# or without touching tunnel:
npm run start:app
```

## Cloudflare Tunnel (Docker)

Konfigurasi Cloudflare Tunnel mengikuti pola `classmeet` (`cloudflare/cloudflared:latest` + `TUNNEL_TOKEN`). Panduan lengkap ada di `deploy/tunnel/README.md`.

Ringkasannya:

```bash
cd deploy/tunnel
./55-tunnel-env.sh quiz.<domain>
# lalu isi TUNNEL_TOKEN di deploy/tunnel/.env
npm run tunnel:up
```

Untuk mode kontainer penuh (app + cloudflared): `npm run tunnel:server`.

## Capturing Who Buzzed First (Integration Options)

### 1. Embed via `<iframe>` + `postMessage`

```html
<iframe
  src="http://localhost:5173/join/ABC123?embed=1"
  allow="clipboard-write; web-share; screen-wake-lock"
  style="width: 100%; height: 600px; border: 0;"
></iframe>

<script>
  window.addEventListener('message', (event) => {
    if (event.data?.source !== 'quizbutton') return;

    if (event.data.type === 'quizbutton:buzz') {
      const { roomId, winner, serverTimestamp, buzzId } = event.data.payload;
      console.log('First buzzer:', winner.name, winner.color, serverTimestamp);
    }

    if (event.data.type === 'quizbutton:reset') {
      console.log('Buzzer unlocked for room:', event.data.payload.roomId);
    }
  });
</script>
```

Optional URL parameters:
- `?embed=1` — hides global footer for clean full-height iframe embedding.
- `?name=Budi&color=%234ECDC4` — pre-fills player name and color on `/join/:roomId`.
- `?autojoin=1` — skips the join form if `name` is provided or saved in `localStorage`.

### 2. Live Server-Sent Events (SSE)

```js
const events = new EventSource('http://localhost:3001/api/rooms/ABC123/events');
events.addEventListener('buzz', (e) => {
  const winner = JSON.parse(e.data);
  console.log('Winner:', winner.playerName, winner.color, winner.serverTimestamp);
});
events.addEventListener('reset', () => {
  console.log('Round reset');
});
```

### 3. WebSocket & REST API

- `WS /ws?room=ABC123` — realtime bidirectional connection (`{ type: "buzz", playerName, color }`).
- `GET /api/rooms/ABC123` — current room state, lock status, participant count, and buzz history.
- `POST /api/rooms/ABC123/buzz` — body `{ "playerName": "Budi", "color": "#4ECDC4" }`.
