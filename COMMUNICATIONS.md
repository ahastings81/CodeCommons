# Communication Features Added

This update adds **Friends**, **Direct Messages (DMs)**, **Message Requests**, **Follows**, **Blocks**, **Notifications**, and a **Messaging Dashboard**.

## Run
- Start the server: `cd server && npm start` (listens on http://localhost:4000)
- Start the client: `cd client && npm run dev` (Vite on http://localhost:5173)

## New API (Server)
- `GET /social/friends` — list accepted friends
- `POST /social/friends/request { toUserId }`
- `POST /social/friends/respond { requestId, action: 'accept'|'deny' }`
- `GET /social/friends/requests` — incoming/outgoing pending
- `DELETE /social/friends/:friendUserId` — remove friendship
- `POST /social/follow { userId }` / `POST /social/unfollow { userId }`
- `GET /social/followers` / `GET /social/following`
- `GET /social/blocked` / `POST /social/block { userId }` / `POST /social/unblock { userId }`

**DMs**
- `POST /dm/request { toUserId, message? }` — send DM request (if not friends)
- `POST /dm/requests/respond { requestId, action }` — accept/deny
- `GET /dm/requests` — list pending
- `POST /dm/start { userId }` — create/open conversation (requires friends OR accepted request)
- `GET /dm/conversations`
- `GET /dm/:id/messages`
- `POST /dm/:id/messages { content }`

**Notifications**
- `GET /notifications` — all for user
- `GET /notifications/unread-count`
- `POST /notifications/mark-read { ids?: string[], all?: boolean }`

## Socket.IO
Client joins a **user** room for notifications and **dm** rooms per conversation:
- `joinUser`, `leaveUser`
- `joinDm`, `leaveDm`
Server emits:
- `dmMessage` — new DM in a room
- `notify` — generic notification (used by DM + friend events)

## Client UI
- New pages: **Friends**, **Messages**, **User Profile** (/u/:userId)
- Header shows **Friends** and **Messages** with an unread badge
- Search → “View” on a user goes to their profile where you can **Add Friend**, **Message Request**, **Follow**, **Block**
- Messages page shows conversations and **Message Requests** (accept/deny)

## Persistence
Stored as JSON files under `server/data/`:
- `friends.json`, `follows.json`, `blocks.json`, `notifications.json`, `dm_conversations.json`, `dm_messages.json`, `dm_requests.json`

This integrates with the existing auth/users model. Demo users remain: `admin@collabhub.local / admin123`, `demo@collabhub.local / demo123`.
