# AfterDistance Production Deployment Guide

## 1. Hosting architecture

```text
GitHub
  └─ source and deployment configuration

Netlify
  └─ React/Vite static frontend
       ├─ REST calls
       └─ Socket.IO WebSocket/polling client

Render
  └─ one Node.js Express + Socket.IO service
       └─ MongoDB Atlas
            ├─ guest sessions
            ├─ rooms
            ├─ game sessions
            └─ game results
```

The backend remains server-authoritative. MongoDB stores durable snapshots and results, while the in-memory Maps are the live state cache for the one Render process. A restart reloads valid room snapshots from Atlas.

## 2. Module hosting

| Module | Destination |
| --- | --- |
| `frontend/*` | Netlify |
| `backend/src/server.js` | Render |
| `backend/src/game/otherSide.js` | Render |
| `backend/src/game/content.js` | Render |
| `backend/src/persistence.js` | Render |
| `backend/src/models.js` | Deployed with backend; used by MongoDB/Mongoose |
| `backend/test/*` | GitHub CI/local validation |
| `shared/*` | Not required by the current builds |
| `netlify.toml` | Netlify build configuration |
| `render.yaml` | Render infrastructure configuration |

## 3. Environment variables

| Variable | Service | Purpose | Secret |
| --- | --- | --- | --- |
| `NODE_ENV` | Render | Set to `production` | No |
| `PORT` | Render | Render assigns this automatically | No |
| `CLIENT_ORIGIN` | Render | Exact HTTPS Netlify/custom origin(s), comma-separated | No |
| `MONGODB_URI` | Render | MongoDB Atlas connection string | Yes |
| `VITE_API_URL` | Netlify build | Public Render HTTPS origin used for REST and Socket.IO | No |

Never put `MONGODB_URI` in `.env` files committed to Git or in a `VITE_*` variable.

Example local `.env`:

```dotenv
PORT=3001
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=
```

MongoDB is optional locally. `NODE_ENV=production` requires both `MONGODB_URI` and a successful Atlas connection. Startup exits if either requirement fails.

## 4. GitHub

1. Review `git status`.
2. Ensure `.env`, `.env.*`, credentials and `node_modules` are untracked.
3. Push or merge the prepared source manually to `se254tev/AfterDistance`.
4. Do not commit Atlas credentials or Render environment values.

## 5. MongoDB Atlas

1. Create or select an Atlas cluster and project.
2. Create a database named `afterdistance`.
3. Create a database user with read/write access only to `afterdistance`.
4. Use a strong generated password.
5. Configure the cluster network access policy required by Render.
6. Copy the SRV URI and replace credentials and database name:

```text
mongodb+srv://DATABASE_USER:DATABASE_PASSWORD@CLUSTER_HOST/afterdistance?retryWrites=true&w=majority
```

Atlas stores:

- `GuestSession`: nickname, room membership and last-seen time
- `GameRoom`: room metadata, players, expiry and the complete live room snapshot
- `GameSession`: selected game configuration and questions, used-question IDs, phase deadline, player states, scores and round results
- `GameResult`: final players, round results and final scores

Private answers and predictions are persisted in MongoDB as server-authoritative game state. They must never be sent to a browser except in reveal results after both predictions complete. Timer deadlines are absolute server timestamps, so reconnecting players share the current phase and countdown; a restarted server restores the deadline from the room snapshot.

## 6. Render

Create one **Web Service**:

| Setting | Value |
| --- | --- |
| Repository | `se254tev/AfterDistance` |
| Runtime | Node |
| Root directory | `backend` |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Instance count | 1 |

Set:

```text
NODE_ENV=production
MONGODB_URI=<Atlas SRV URI>
CLIENT_ORIGIN=https://<your-netlify-site>.netlify.app
```

Do not set `PORT`; Render provides it. The server binds to `0.0.0.0`.

Startup behavior:

1. Validate the production origin.
2. Require and connect to Atlas.
3. Remove expired database rooms.
4. Recover valid room snapshots.
5. Start Express and Socket.IO.

Health response:

```json
{"ok":true,"persistence":"connected"}
```

## 7. Netlify

Import `se254tev/AfterDistance` and use `netlify.toml`:

| Setting | Value |
| --- | --- |
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `dist` |

Set:

```text
VITE_API_URL=https://<your-render-service>.onrender.com
```

Redeploy after changing this build-time variable.

The SPA redirect sends `/join/:code` and `/room/:code` to `index.html`.

## 8. CORS and WebSockets

`CLIENT_ORIGIN` must exactly match the browser origin:

- include `https://`
- exclude paths
- exclude a trailing slash
- do not use `*`

Multiple origins are comma-separated. The Socket.IO and Express servers use the same origin allowlist. HTTPS frontend traffic uses secure `wss://` Socket.IO connections.

## 9. Reconnection and room recovery

Valid room snapshots are restored on backend restart. Restored players begin offline and can reconnect using the session token stored in browser `sessionStorage`. Expired rooms are removed from memory and Atlas. Private answers remain in snapshots and are exposed only through `publicGame()` after reveal rules allow it.

Keep the Render instance count at one. MongoDB persistence supports restart recovery, but horizontal scaling still requires a Socket.IO adapter and cross-process coordination.

## 10. Verification

Run locally:

```powershell
cd backend
npm test

cd ../frontend
npm test
npm run build
```

After manual deployment:

1. Open the Render `/api/health` URL.
2. Open the Netlify root URL.
3. Open `/join/<code>` directly and refresh it.
4. Create a room in one browser.
5. Join with a second browser in another location.
6. Verify the third join is rejected.
7. Mark both players ready and start.
8. Submit private answers and verify no answer appears in the partner's room view.
9. Submit predictions and verify reveal occurs only after the second prediction.
10. Complete rounds and verify server-calculated scores.
11. Restart only with Atlas configured and verify valid room recovery.
12. Verify an expired room is rejected.

## 11. Security

- Exact HTTPS production CORS allowlist
- Helmet security headers
- 32 KB JSON body limit
- REST and join route rate limits
- Per-socket event rate limiting
- Zod payload validation before socket processing
- Server-side room membership and phase validation
- Random cryptographic guest/session tokens
- Third-player rejection
- Player-specific game projections
- Private selections omitted before reveal
- MongoDB credentials restricted to Render environment variables
- Production startup fails if persistence is unavailable

## 12. Troubleshooting

| Symptom | Cause | Resolution |
| --- | --- | --- |
| Render exits at startup | Missing/invalid Atlas or CORS configuration | Set all required variables and inspect startup logs |
| MongoDB connected but no recovery | Wrong database or old snapshot shape | Verify database name and `GameRoom.state` records |
| CORS error | Origin differs from `CLIENT_ORIGIN` | Compare exact scheme/hostname, with no trailing slash |
| Socket.IO fails | Wrong or stale `VITE_API_URL` | Set the HTTPS Render origin and rebuild Netlify |
| `/join/...` 404 | SPA redirect missing | Confirm `netlify.toml` and publish directory |
| Room restored as offline | Normal restart behavior | Reconnect the browser session |
| Room rejected after restart | Expiry elapsed | Create a new room |

## 13. Remaining blockers

Live Atlas connectivity and live multiplayer behavior cannot be verified until the user manually supplies an Atlas URI and authorizes Render/Netlify deployment.

Production scaling is not guaranteed beyond one instance. Redis or another Socket.IO adapter is not required for the initial one-instance deployment.

## Production URLs

```text
GitHub:    https://github.com/se254tev/AfterDistance
MongoDB:   <fill in Atlas project/cluster name only; never credentials>
Render:    https://<render-service>.onrender.com
Netlify:   https://<netlify-site>.netlify.app
Custom:    https://<custom-domain>
Health:    https://<render-service>.onrender.com/api/health
```
