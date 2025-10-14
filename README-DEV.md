# CodeCommons — Communications-Enabled Build (Fixed)

## Quick Start
- Install deps in each app:
  - `cd server && npm install`
  - `cd ../client && npm install`
- From repo root, run both together:
  - `npm run dev`  (runs server and client concurrently via `dev.js`)
- Or separately:
  - Server: `cd server && npm start` (http://localhost:4000)
  - Client: `cd client && npm run dev` (http://localhost:5173)

## Default Demo Logins
- admin@collabhub.local / admin123
- demo@collabhub.local / demo123

If demo logins fail, delete `server/data/users.json` and re-run the server to trigger seeding.
