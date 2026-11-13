# CineAI Studio — install & run guide

CineAI Studio is a personal tool for an Instagram movie page. It runs on your own computer:

- **OTT Desk / Cinema Desk / World Movies & Series** – verified release data, approval queues, post editor, carousels
- **Reels** – from post slides or trailer clips (auto-pick), with music, voice-over and webcam
- **Posting** – Instagram (photos, carousels, Reels), Facebook Page, YouTube Shorts — always behind a confirm step
- **On this day**, **Trending now** (Tamil Nadu / India news), **Growth & analytics**, **Watch Free site**

It has two parts that run side by side:

| Part | Folder | Address | Built with |
|---|---|---|---|
| Backend (data, posting, video) | `backend/` | http://localhost:3000 | NestJS 11, Prisma 5, SQLite, ffmpeg |
| Frontend (the app you click) | `frontend/` | http://localhost:3001 | Next.js 16, React 19, Tailwind 4 |

---

## 1. What you need

**Computer**

| | Minimum | Recommended |
|---|---|---|
| OS | Windows 10/11, macOS 12+, or Linux | Windows 11 |
| Memory (RAM) | 8 GB | 16 GB (Reels from HD trailers use ~0.7 GB while rendering) |
| Free disk | 5 GB | 10 GB (IMDb rating files ≈ 250 MB, database grows to ~150 MB) |
| Internet | Needed — all data comes from free online sources | |
| Browser | Chrome or Edge (webcam / microphone recording needs one of these) | |

**Software** (all free)

| Install | Version | Get it | Check it |
|---|---|---|---|
| Node.js (includes npm) | **20 LTS or newer** (tested on 24) | https://nodejs.org | `node -v` |
| Git | any recent | https://git-scm.com | `git --version` |

You do **not** need to install ffmpeg (it comes with the backend), a database server (it's a single SQLite file), Docker, Python or anything else.
`docker-compose.yml` in the repo is from an older version and isn't used.

---

## 2. Get the code

```bash
git clone https://github.com/ptkarthik/quickflix.git
cd quickflix
```

---

## 3. One-time setup

### 3.1 Backend

```bash
cd backend
npm install
```

Create your settings file from the template:

- Windows (PowerShell): `Copy-Item .env.example .env`
- macOS / Linux: `cp .env.example .env`

Open `backend/.env` in any text editor and fill in at least:

```
TMDB_API_KEY=your_key_here
```

(How to get keys → section 6. Everything else is optional and can be added later.)

Create the database (an empty SQLite file at `backend/prisma/dev.db`):

```bash
npx prisma db push
```

### 3.2 Frontend

```bash
cd ../frontend
npm install
```

### 3.3 The "start both" helper (root folder)

```bash
cd ..
npm install
```

---

## 4. Start the app (every day)

**Easiest (Windows):** double-click **`start.bat`** in the project folder.

**Or from a terminal in the project folder:**

```bash
npm run dev
```

This starts the backend and the frontend together. Wait until you see both:

- `Nest application successfully started` (backend)
- `Ready in …` (frontend)

Then open **http://localhost:3001** in Chrome or Edge.

**Starting them separately** (two terminals) also works:

```bash
# terminal 1
cd backend
npm run start:dev

# terminal 2
cd frontend
npm run dev
```

**Stop:** press `Ctrl + C` in the terminal(s), or close the window.

### First start — what to expect

- The backend downloads IMDb's daily ratings files (~250 MB) in the background and starts collecting OTT / cinema / world data. The first full fill takes a while (minutes to an hour, depending on your connection) — the app is usable meanwhile.
- "On this day" prepares the next 7 days (≈ 2–3 min per day) and "Trending now" refreshes every 30 minutes.
- Pages that need a key you haven't added show a "not set up" note with the steps.

---

## 5. Where your data lives (and backups)

| What | Where | In git? |
|---|---|---|
| Database (titles, approvals, ratings, post history) | `backend/prisma/dev.db` | **No** — backup yourself |
| Downloaded / cached data (IMDb files, music, critics, trends, analytics) | `backend/data/` | No (re-downloads by itself) |
| Your keys & tokens | `backend/.env`, `backend/.instagram-token.json`, `backend/data/youtube-token.json` | **No — never share** |
| Your theme favourites, saved headlines, layouts | the browser (localStorage) | No |

**Backup:** stop the app, then copy `backend/prisma/dev.db` (and `backend/.env`) somewhere safe.
**Restore / move to a new PC:** install as above, then put your `dev.db` into `backend/prisma/` and your `.env` into `backend/` before starting.

---

## 6. Keys — what's free and what each unlocks

| Setting in `backend/.env` | Cost | Unlocks | Where |
|---|---|---|---|
| `TMDB_API_KEY` | Free | **Required** — titles, posters, release dates, trailers | themoviedb.org → Settings → API |
| `OMDB_API_KEY` | Free (~1,000/day) | Rotten Tomatoes & Metacritic scores, plot, awards | omdbapi.com/apikey.aspx |
| `MDBLIST_API_KEY` | Free | Letterboxd, Trakt, RT audience ratings | mdblist.com/preferences |
| `GEMINI_API_KEY` | Free for text; **paid** for AI posters | "Write with AI" captions / one-liners, AI posters (click-only) | aistudio.google.com/apikey |
| `IMGBB_API_KEY` | Free | Instagram **photo / carousel** posting (10-min temporary hosting) | api.imgbb.com |
| `IG_ACCESS_TOKEN`, `IG_USER_ID` | Free | Instagram posting (photos, carousels, Reels) + Growth analytics | see 6.1 |
| `FB_PAGE_ID`, `FB_PAGE_TOKEN` | Free | Facebook Page photos / Reels | Meta Graph API Explorer (page token) |
| `YT_CLIENT_ID`, `YT_CLIENT_SECRET` | Free (~6 uploads/day) | YouTube Shorts upload ("Connect YouTube" in the app) | Google Cloud Console → OAuth client (Web), redirect `http://localhost:3000/publish/youtube/callback` |
| `YT_API_KEY` | Free | Watch Free site — scanning official YouTube channels | Google Cloud Console → API key (YouTube Data API v3) |

After changing `.env`, restart the backend.

### 6.1 Instagram (posting + analytics)

1. Make your Instagram account a **Professional (Creator or Business)** account and link it to a **Facebook Page**.
2. Create an app at **developers.facebook.com** (type: Business).
3. Open **Graph API Explorer**, select your app, and add these permissions:
   `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `business_management`.
   (`instagram_manage_insights` is what the **Growth & analytics** page needs for reach, views, sends, saves and watch time.)
4. **Generate Access Token**, then in the Access Token Debugger click **Extend Access Token** (long-lived, ~60 days).
5. Find your Instagram account id: in the Explorer run `me/accounts?fields=instagram_business_account` and copy the `instagram_business_account.id`.
6. In `backend/.env`:
   ```
   IG_ACCESS_TOKEN=the_long_lived_token
   IG_USER_ID=the_instagram_business_account_id
   IG_GRAPH_HOST=graph.facebook.com
   IMGBB_API_KEY=your_imgbb_key
   ```
7. Restart the backend. The post editors show "as @yourname" next to **Post to Instagram**.

Facebook-login tokens last about 60 days — when posting says the token expired, repeat steps 3–4 and replace it.

---

## 7. Updating to a newer version

```bash
git pull
cd backend && npm install && npx prisma db push && cd ..
cd frontend && npm install && cd ..
npm run dev
```

`prisma db push` adds any new database columns and keeps your data. (Back up `dev.db` first, to be safe.)

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `Port 3000 is already in use` / changes don't show up | An old backend is still running. Windows PowerShell: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" \| Where-Object { $_.CommandLine -match 'backend' } \| ForEach-Object { Stop-Process -Id $_.ProcessId -Force }` then start again. |
| Frontend loads but shows errors / "Failed to fetch" | The backend isn't running (or still starting) — check its terminal for `Nest application successfully started`. |
| `Environment variable not found: DATABASE_URL` | `backend/.env` is missing — copy `.env.example` to `.env`. |
| `The table … does not exist` | Run `npx prisma db push` in `backend/`. |
| "Not set up (missing …)" on a page | Add the named key(s) to `backend/.env` and restart the backend. |
| Reel making fails with "malloc failed" / runs out of memory | Close other heavy apps (many Chrome tabs), then try again. |
| Webcam / mic not working in Make Reel | Use Chrome or Edge on `http://localhost:3001` and allow camera/microphone (icon in the address bar). |
| Instagram: "token is invalid or expired" | Generate a new long-lived token (section 6.1). |
| Instagram analytics in "Basic mode" | The token lacks `instagram_manage_insights` — regenerate it with that permission. |

---

## 9. Project map

```
backend/
  prisma/schema.prisma      database tables
  src/ott, src/cinema       OTT & theatrical release data + Instagram posting
  src/world                 World movies & series (TMDB + IMDb daily files)
  src/extras                one-liners, ratings, critics' reviews
  src/reels                 Reel rendering (slides, trailer cuts, auto-pick, voice-over)
  src/publish               Facebook & YouTube
  src/onthisday, src/trends, src/growth, src/watch
  .env.example              all settings, explained
frontend/
  src/app/…                 pages (ott, cinema, world, on-this-day, trends, growth, watch-free …)
  src/components/…          editors, Reel maker, pickers
  src/lib/…                 API calls, themes (349), headlines (206)
start.bat, package.json     start both halves together
```

---

## 10. Data sources & licences

- Movie / TV data and images: **TMDB** (attribution required — "This product uses the TMDB API but is not endorsed or certified by TMDB").
- IMDb ratings: IMDb's official datasets — **personal and non-commercial use only** (set `IMDB_DATASETS=false` to switch off).
- Free music library: Kevin MacLeod (incompetech.com), **CC BY 4.0** — the app adds the required credit to captions.
- News & reviews: headlines and links belong to their outlets; the app groups and links them. Use your own words and your own photos in posts.
- Nothing is posted automatically — every Instagram / Facebook / YouTube post needs your click and a confirmation.
