# Deploying Almoner

Almoner is two services:

| Piece | What it is | Host | Why |
| --- | --- | --- | --- |
| **Backend** (`server/`) | Hono API — the relayer + operator signing service (holds keys) | **Railway** | needs a long-running server + secrets |
| **Frontend** (`app/`) | Static Vite/React bundle (holds **no** keys) | **Vercel** | static CDN |

The Stellar **contracts are already live on testnet** — nothing to deploy there. You're only hosting the app. Deploy the backend first (you need its URL for the frontend).

---

## 1. Backend → Railway

> **One service, at the repo root — not per workspace.** When you connect the
> repo, Railway sees the npm `workspaces` and auto-proposes a service for each
> (`@almoner/app`, `@almoner/lib`, `@almoner/circuits`). **Discard all of those**
> (the "Apply N changes" / `⋮` → Discard). None of them is the backend — `app` is
> the frontend (→ Vercel), `lib`/`circuits` are libraries, and `server/` isn't a
> workspace so it's never listed. You want a single service whose **Root Directory
> is empty (the repo root)**. It can't be `server/`: the backend imports from
> `app/` and uses the root `package.json`, so it must build from the whole repo.

1. **New Project → Deploy from GitHub repo** → pick `frankolien/almoner`.
2. Discard any auto-detected workspace services (see the note above). Then add **one**
   service for the repo and, in **Settings → Build**, set **Root Directory** to empty
   (the repo root) and **Start Command** to `npm start`.
3. Railway reads [`railway.json`](railway.json): no build step, starts with `npm start` (`tsx server/index.ts`), health-checks `/api/health`.
4. **Settings → Variables** — add these (copy the values from your local `.env`, which `npm run deploy:testnet` already filled in):

   ```
   NETWORK=testnet
   POOL_CONTRACT_ID=CCF37LWGSKRCE6C465I2S4ASAJ6YIEEG2TSWWS3VTFWG3CPTDJWCFQRN
   USDC_TOKEN_ID=CBVYDNNVSNGI5UDTRMHSRQZDSPOJHIE2VL5H2SJPAFWAPYAGFTSCSCY2
   ADMIN_PUBLIC_KEY=GAE2XMCTYBP6GW5UZ34KNXNGR4IAXVBTIEMJKSMWB4WNFPB472HUHYFY
   ADMIN_SECRET=          ← from .env
   RELAYER_PUBLIC_KEY=GAJEH3OQWWPLSES4NYYXATQFN53NTGUILLEAREY4DI7EO3BVZLGANSB2
   RELAYER_SECRET=        ← from .env
   AUDITOR_PUBLIC_KEY=9d8a1027983750fe05df463d6b4ed7187ab29520ac4ce85fe8c9138f7f529a15
   AUDITOR_SECRET=        ← from .env
   ```

   Do **not** set `PORT` — Railway injects it and the server reads it automatically.
5. **Settings → Networking → Generate Domain.** Copy the URL, e.g. `https://almoner-production.up.railway.app`. That's your API base.
6. Sanity check: open `https://<your-railway-url>/api/health` → should return `{"ok":true}`.

> These are **testnet throwaway keys** baked in for the one-click demo. For a real deployment, rotate them and move signing to a KMS/HSM.

---

## 2. Frontend → Vercel

1. **Add New → Project** → import `frankolien/almoner`.
2. Vercel reads [`vercel.json`](vercel.json): installs at the repo root, builds the `app` workspace (`npm run build`), serves `app/dist`. Leave the dashboard build settings on **Auto** — `vercel.json` overrides them.
3. **Settings → Environment Variables** — add **one**:

   ```
   VITE_API_BASE = https://<your-railway-url>     (no trailing slash)
   ```

   Apply it to **Production** (and Preview if you want preview deploys to work).
4. **Deploy.** Because `VITE_API_BASE` is baked in at build time, if you add it *after* the first deploy, hit **Redeploy** so it takes effect.

That's it — the frontend calls the Railway backend directly; CORS is already enabled server-side (`app.use('/api/*', cors())`).

---

## How it wires together

- **Local dev:** `VITE_API_BASE` is unset → frontend calls same-origin `/api`, and Vite proxies it to `localhost:8787` (see `app/vite.config.js`). `npm run dev` runs both.
- **Production:** `VITE_API_BASE=https://…railway.app` → browser calls the Railway backend directly. The eligibility proof is still generated **on the beneficiary's device**; only the proof is posted to the server.
- If the backend is ever down, the dashboard still loads read-only from the committed `app/public/deployment.json` (public IDs only, no secrets).

## Redeploys

Both hosts auto-deploy on push to `main`. Push code → Railway + Vercel rebuild. You only touch env vars again if a key or contract ID changes.
