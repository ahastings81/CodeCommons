# CodeCommons — Developer Notes

## Quick start
- Install deps in both apps:
  - `npm run install-all`
- Run server and client together from repo root:
  - `npm run dev`
- Or run separately:
  - Server: `cd server && npm start` (http://localhost:4000)
  - Client: `cd client && npm run dev` (http://localhost:5173)

## Environment
- Client API target is configured via `VITE_API_BASE`.
- Server origin/cors is configured via `CLIENT_ORIGIN`.
- See `client/.env.example` and `server/.env.example`.

## Default demo logins
- admin@collabhub.local / admin123
- demo@collabhub.local / demo123

If demo logins fail, delete `server/data/users.json` and re-run the server to trigger seeding.
