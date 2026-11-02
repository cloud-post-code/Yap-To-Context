# Yap to Context

Talk first, organize later. Yap to Context turns voice notes and transcripts into an organized folder tree of documents, so a rambling two-minute recording becomes a titled summary filed in the right place.

## How it works

1. **Capture.** Record in the browser (Web Speech API), upload an audio file, or paste a transcript. Audio is stored on disk, not in the database.
2. **Extract.** OpenAI transcribes the audio and returns a structured summary with proposed folders and metadata, validated against a JSON schema.
3. **File.** New documents land in the Inbox, then move into the tree. Default roots are Company, Blog, Ideas, and Inbox.
4. **Approve.** The model can propose new folders. Proposals wait in an approvals queue until you accept or reject them.
5. **Export.** Download any folder and its documents as a zip.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router), React 19, Tailwind 4 |
| Data | PostgreSQL via Drizzle ORM |
| AI | OpenAI for transcription and structured extraction |
| Auth | Single shared secret, used as the login password and as a bearer token on every API call |
| Hosting | Railway (see `railway.toml`), with a volume for audio |

## Run locally

```bash
npm install
cp .env.example .env   # set DATABASE_URL, OPENAI_API_KEY, AUTH_SECRET
npm run db:push
npm run dev
```

Open http://localhost:3000 and sign in with the value of `AUTH_SECRET`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | Transcription and extraction |
| `AUTH_SECRET` | Login password and API bearer token |
| `AUDIO_STORAGE_PATH` | Where audio files are written. Defaults to `./storage/audio` |

## Project layout

```
src/app/            pages and API routes (ingest, folders, documents, approvals, tree)
src/components/     client UI, including the recorder and folder tree
src/lib/            extraction, folder proposals, tree building, zip export, auth
src/db/             Drizzle schema, client, and first-run bootstrap
drizzle/            generated migrations
scripts/            build helpers
```

## API

Every route under `/api` expects `Authorization: Bearer <AUTH_SECRET>`.

| Route | What it does |
|---|---|
| `POST /api/ingest` | Submit audio or text for extraction |
| `GET /api/tree` | Full folder tree |
| `GET /api/folders/:id/documents` | Documents in a folder |
| `GET /api/folders/:id/download` | Zip of a folder |
| `GET /api/pending-proposals` | Folder proposals awaiting review |
| `POST /api/pending-proposals/approve` | Accept a proposal |
| `POST /api/pending-proposals/reject` | Reject a proposal |

## License

MIT
