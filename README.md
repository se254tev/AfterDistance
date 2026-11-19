# AfterDistance

AfterDistance is a real-time, private two-player romantic game platform.

## Requirements

- Node.js 20 or newer
- MongoDB optional for local setup; set `MONGODB_URI` for persistence
- Two modern browsers or devices

## Setup

```bash
cd backend
npm install
copy ..\.env.example .env
npm run dev
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Create a room in one browser, copy the invitation link or code, and join from a second browser/device.

Set `VITE_API_URL` in the frontend environment when the backend is not at `http://localhost:3001`.

## Game flow

1. Both players join and mark themselves ready.
2. Either player starts **The Other Side of Us**.
3. Both submit private answers.
4. Both submit private predictions.
5. The server reveals both choices and server-calculated points together.
6. Each player continues; after five rounds the final scores are shown.

## Verification

```bash
cd backend
npm test

cd ../frontend
npm run build
```

The Socket.IO server authenticates guest membership for every room operation and validates phases and choices server-side. Active gameplay does not poll or fetch entire state from HTTP.
