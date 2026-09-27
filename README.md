# Whispr Backend

Backend API for the Whispr app (Node.js + Express + MongoDB).

## Tech stack

- Node.js
- Express
- MongoDB + Mongoose
- JWT auth (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- File uploads (`multer`)
- Security and ops middleware (`helmet`, `cors`, `express-rate-limit`, `morgan`)

## Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended
- MongoDB database (local or cloud)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create or update `backend/.env.local`:

```bash
PORT=5000
NODE_ENV=development
MONGODB_URI=<your_mongodb_connection_string>
JWT_SECRET=<long_random_secret>
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=*
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=25
```

3. Run the server:

```bash
npm run dev
```

4. Verify:

- Health check: `GET http://localhost:5000/health`
- API base: `http://localhost:5000/api`

## Scripts

- `npm run dev` - Start with nodemon.
- `npm run start` - Start with Node.

## Environment variables

- `PORT` (default: `5000`) - HTTP port.
- `HOST` (default: `0.0.0.0`) - Bind host.
- `NODE_ENV` (default: `development`) - Runtime mode.
- `MONGODB_URI` - Mongo connection string (required).
- `JWT_SECRET` - Signing secret for access tokens.
- `JWT_EXPIRES_IN` (default: `7d`) - JWT expiry.
- `CLIENT_ORIGIN` (default: `*`) - CORS allowlist (`*` or comma-separated list).
- `UPLOAD_DIR` (default: `uploads`) - Upload storage path.
- `MAX_FILE_SIZE_MB` (default: `25`) - Max upload size in MB.

## Auth model

- Bearer token auth via `Authorization: Bearer <token>`.
- Register/login return a token in `data.session.token`.
- Protected routes require a valid token.

## API overview

Base prefix: `/api`

- Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

- Users
- `GET /users`
- `GET /users/:id`
- `GET /users/:id/followers`
- `GET /users/:id/following`
- `PATCH /users/me`

- Poems
- `GET /poems`
- `GET /poems/public`
- `GET /poems/daily-quote`
- `GET /poems/mine`
- `GET /poems/:id`
- `POST /poems`
- `PATCH /poems/:id`
- `DELETE /poems/:id`
- `POST /poems/:id/like-toggle`

- Drafts
- `GET /drafts`
- `POST /drafts`
- `PATCH /drafts/:id`
- `DELETE /drafts/:id`

- Social
- `GET /social/bookmarks`
- `POST /social/bookmarks/toggle`
- `GET /social/follows`
- `POST /social/follows/:userId`
- `DELETE /social/follows/:userId`
- `GET /social/comments/:poemId`
- `POST /social/comments/:poemId`
- `GET /social/messages/:userId`
- `POST /social/messages/:userId`
- `GET /social/favorite-authors`
- `POST /social/favorite-authors/toggle`
- `GET /social/activity`
- `POST /social/activity`

- Sync and uploads
- `GET /sync/bootstrap`
- `POST /uploads/single`
- `POST /uploads/multiple`

Some internal routes are intentionally not listed here.

## Uploads

- Upload routes expect `multipart/form-data`.
- Single upload field: `file`
- Multi upload field: `files` (up to 12 files)
- Public file serving: `/uploads/*`

## Response shape

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Error message"
}
```

## Frontend env (deployed backend)

Use this in `frontend/.env.local`:

```bash
EXPO_PUBLIC_API_URL=https://whispr-backend-3old.onrender.com
EXPO_PUBLIC_API_URL_WEB=https://whispr-backend-3old.onrender.com
```
