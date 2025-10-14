# CodeCommons (v1.2.0)

An evolution of CodeCommonsPlus with **roles, tiers, admin controls, security**, and UX upgrades.

## Highlights
- **Roles:** `admin` > `moderator` > `user`
- **Tiers:** `free` vs `pro` (badge + higher limits + highlighting)
- **Admin Control Panel:** manage users (role/tier/ban), feature/unfeature content, review all reports
- **Security/Abuse:** job reporting, content reporting (threads/posts), banned user enforcement, extra rate limits
- **Job Board++:** structured fields, reporting, featured marker
- **Projects UX:** filters (tech, difficulty, mentorship-friendly), tags, featured projects
- **Hackathons:** create/list (simple JSON backed)
- **Global:** Dark mode, search, JSON storage for local dev

## Run
```bash
npm run install-all
npm run dev
```
- API: http://localhost:4000
- Web: http://localhost:5173

### Demo logins
- **Admin:** admin@collabhub.local / admin123
- **Moderator:** demo@collabhub.local / demo123

> NOTE: This remains a JSON-file backend for local dev. For production, swap to Postgres/Prisma and add Stripe for Pro billing.
