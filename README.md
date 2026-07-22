# Leaflet — read any PDF like a real book

A working v1 of a flipbook-style PDF reader: drop in a PDF, get realistic
page-turn animation, bookmarks, table of contents, search, zoom, night mode,
and a progress bar. Everything runs client-side — no backend, no file
upload to any server. Fully responsive (single page on phones, spread on
tablet/desktop), so it works in Android and iOS browsers out of the box.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL. Any modern phone on the same network can
also hit it via your machine's local IP for testing on real devices.

```bash
npm run build      # production build -> dist/
npm run preview    # preview the production build locally
```

Deploy the `dist/` folder to Vercel, Netlify, Cloudflare Pages, or any
static host — there's no server component to run.

It's also an installable PWA: on a production build, `manifest.json` and
a service worker (`public/sw.js`) are registered automatically, so
mobile/desktop browsers offer an "Install" / "Add to Home Screen" prompt
and previously-visited pages keep working offline.

## How it works

- **`src/utils/pdfEngine.js`** — all pdf.js logic: loading a PDF, rendering
  pages to images, reading the embedded table of contents, and searching
  page text.
- **`src/App.jsx`** — orchestrates the upload → render → read flow, and
  persists bookmarks + last-read-page per book in `localStorage`
  (keyed by filename + size + last-modified, so re-opening the same file
  restores your place).
- **`src/components/FlipbookReader.jsx`** — the actual book, built on
  `react-pageflip`. Handles page-turn physics, responsive sizing, and the
  zoom-to-full-resolution modal (re-renders the current page at 3x scale
  from the original PDF rather than just CSS-scaling the thumbnail, so
  zoomed text stays crisp).
- **`src/components/Toolbar.jsx` / `SidePanel.jsx`** — reading controls
  and the contents/bookmarks/search drawer.

## Loading a PDF from a pasted link

You can now paste a URL on the upload screen instead of choosing a file.
It tries a direct browser fetch first (works if the source server allows
CORS); if that's blocked, it automatically falls back to the
`/api/pdf-proxy` serverless function in `api/pdf-proxy.js`, which fetches
server-side and also handles the case where the pasted link is a normal
webpage that merely *contains* a PDF (it scans the HTML for the first
`.pdf` link and fetches that instead).

**This proxy only runs when deployed to a platform that supports
serverless functions** — Vercel picks up `/api/*.js` automatically with
zero config. `npm run dev` alone won't serve it, so during local
development the direct-fetch path is the only one that'll work unless
you also run `vercel dev` instead of `vite dev`. If you deploy elsewhere
(Netlify, Cloudflare Pages, your own Node server), port the handler in
`api/pdf-proxy.js` to that platform's function signature — the actual
fetch/parse logic is plain JS and drops in as-is.

A few sites (Google Drive share links, some LMS platforms) require a
signed/authenticated request and won't work through a generic proxy —
those need a source-specific integration if you want to support them.

## Known limitations to fix before a public launch

1. **All pages render upfront.** Fine for a 50–150 page book; a 800-page
   textbook will feel slow to open. Next step: lazy-render only the
   current page ± 2 (see `renderAllPages` in `pdfEngine.js` — swap it for
   an on-demand render keyed to `onFlip`).
2. **No accounts / cross-device sync.** Bookmarks and progress live in
   this browser's `localStorage` only. Adding Supabase (Postgres + auth +
   storage) is the fastest path to a synced personal library.
3. **Large PDFs use real memory** since every page is a decoded JPEG
   data URL held in React state. The lazy-render fix above solves this
   too.
4. **No copyright/DRM concept.** This is a personal reading tool. If you
   ever let strangers upload other people's copyrighted books, you'll
   need takedown handling — worth deciding early whether this is a
   personal tool or a public product, since that changes the legal
   surface area a lot.

## Design

Palette and type are defined in `tailwind.config.js` under a "reading
lamp at night" concept — ink-navy UI chrome, a warm brass accent, and a
warm paper-white for the pages themselves, with Fraunces (display serif)
+ Inter (UI) + JetBrains Mono (page numbers/data). Adjust the `ink`,
`brass`, and `paper` color scales there to reskin it.
