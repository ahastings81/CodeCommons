# CodeCommons (v1.2.0)

CodeCommons is a full-stack collaboration platform with projects, community threads, jobs, hackathons, messaging, social feed, and admin tooling.

## Highlights
- Roles (`admin`, `moderator`, `user`) and user tiers (`free`, `pro`)
- Admin control panel for moderation and user management
- Social features (feed, friends, follows, DMs, notifications)
- Project collaboration with tasks and chat
- Job board + hackathons

## Local development
```bash
npm run install-all
npm run dev
```

- API: http://localhost:4000
- Web: http://localhost:5173

## Production build + start
```bash
npm run install-all
npm run build
npm run start
```

## Environment variables
### Server (`server/.env`)
Copy `server/.env.example` and update values:
- `PORT` - API port
- `NODE_ENV` - set to `production` in deploy
- `JWT_SECRET` - strong random secret
- `CLIENT_ORIGIN` - deployed frontend origin (or comma-separated list)
- `TRUST_PROXY` - set `1` behind reverse proxy/load balancer

### Client (`client/.env`)
Copy `client/.env.example`:
- `VITE_API_BASE` - deployed API base URL (example: `https://api.example.com`)

## Deployment notes
- Serve the client build output from `client/dist` (Vite build).
- Run the API as a long-lived Node process (PM2, Docker, or managed platform).
- Keep `/uploads` persisted across restarts if user uploads matter.
- Current backend storage uses JSON files in `server/data`; use managed DB for serious production workloads.

## Demo logins
- **Admin:** admin@collabhub.local / admin123
- **Moderator:** demo@collabhub.local / demo123
