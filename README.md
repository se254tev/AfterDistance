# AfterDistance

AfterDistance is a real-time, private two-player romantic game platform.

## Requirements

- Node.js 20 or newer
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

Open `http://localhost:5173`. Create a room, then invite the second player via WhatsApp, by copying the invitation link, or by sharing the room code. The recipient can open `/join/<room-code>` or select **Join a room** and enter the code.

Set `VITE_API_URL` in the frontend environment when the backend is not at `http://localhost:3001`. This same URL is used for the HTTP API and Socket.IO connection.

MongoDB stores room snapshots, guest sessions, game sessions and final results when `MONGODB_URI` is configured. It is optional for local development and mandatory in production. Valid room snapshots are recovered after backend restarts, subject to room expiry. See [DEPLOYMENT.md](./DEPLOYMENT.md) before hosting.

## Privacy and data management

Open **Privacy & Data Management** from the home screen or a room. AfterDistance uses guest sessions, not registered accounts. MongoDB may store a guest token and nickname, room membership and expiry, game configuration and progress, private answers and predictions, scores, and completed-game results. The active collections are `GuestSession`, `GameRoom`, `GameSession`, and `GameResult`; `PrivacyDeletion` and `RoomDeletion` hold hashed/session-free deletion fences so stale writes or recovered room snapshots cannot restore deleted live data.

- **Delete My Data** and **Delete All My Data** require the guest session credential, invalidate its sockets, remove its membership and credentials, and scrub that session's identifiers, answers, predictions, scores, and linked records. If both players share an in-progress game, its progress is reset while the other player's guest identity and room are retained. This guest-only application has no separate preferences or multiple account profiles, so both controls currently perform the same session-wide collection sweep.
- **Leave Current Game** disconnects the player and marks them offline without deleting their guest session or room progress. They may intentionally reconnect while the room remains available.
- **Delete This Game** is available only to the authenticated room creator. It deletes the room, progress, and guest-session records for both players and invalidates both room sessions; both players must start or join a new room.
- Rooms expire after 24 hours. An incomplete staged deletion remains fenced and can be retried; the service applies pending deletion records before recovering rooms on startup.
- Minimal one-way token hashes and room deletion markers remain in `PrivacyDeletion`/`RoomDeletion` to prevent stale writes and reconnection after recovery. They do not contain raw guest tokens; backup copies follow the Atlas retention policy.

Deletion applies to the live database, not necessarily to historical Atlas backups. Atlas backup/point-in-time retention is configured outside this repository and must be checked in the actual Atlas project. See the backup and restore limitations in [DEPLOYMENT.md](./DEPLOYMENT.md). No legal-compliance claim is made.

## Game flow

1. Both players join and mark themselves ready.
2. Both players use the shared room setup to select **The Other Side of Us** or the Kenyan Comedy Experience. The Kenyan experience offers comedy, romance, savage (playful), and mind-reader modes; seven content categories; six Kenyan content packs; English, Kiswahili, Sheng, or Mixed Kenyan Language; and optional 10-, 15-, or 20-second answer timers. Mixed Kenyan Language is its default.
3. Both submit private answers.
4. Both submit private predictions.
5. The server reveals both choices and server-calculated points together.
6. Each player continues; after five rounds the final scores and earned achievements are shown.

The server selects and persists one five-question set for each game, so both players and reconnecting players see the same questions. Replays use previously unused questions where the selected pool has them. Kenyan games may include a surprise round. Timers, answer validation, quiz scoring, achievements, and round progression are server-authoritative; a timed-out answer or prediction is treated as unanswered. Answers and predictions are omitted from player views until the reveal. Content lives in `backend/src/game/content.js`; invalid mode/category/content-pack combinations are excluded from the room setup.

## Verification

```bash
cd backend
npm test

cd ../frontend
npm run build
```

The Socket.IO server authenticates guest membership for every room operation and validates phases and choices server-side. Active gameplay does not poll or fetch entire state from HTTP.
