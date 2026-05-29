# Ledger — a free, private budget tracker

A mobile-first budgeting web app (PWA) that stores all data **locally on each
person's device**. No server, no database, no accounts — so it costs nothing to
run and there's nothing to maintain. Each family member just opens the URL and
adds it to their home screen; their data is theirs and never leaves their phone.

## What's in the box

```
index.html              ← the app
styles.css
app.js
manifest.webmanifest    ← makes it installable
sw.js                   ← service worker (offline support)
icons/                  ← app icons
```

It's a plain static site — **no build step, no dependencies.** That's deliberate:
it means deploying is "drop the folder on a host" and it'll keep working for years.

## Run it locally

PWA features (install + offline) need to be served over HTTP, not opened as a
`file://`. From this folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(You *can* double-click `index.html` to try the budgeting features, but the
service worker / install prompt won't activate over `file://`.)

## Deploy it for free (pick one)

All of these are genuinely free for a static site, with no idle pauses or cold
starts, and give you HTTPS automatically (required for PWA install):

- **Cloudflare Pages** — go to the dashboard → Workers & Pages → Create →
  Pages → "Upload assets", then drag this folder in. Done.
- **GitHub Pages** — push these files to a repo, then Settings → Pages → deploy
  from the `main` branch root. URL will be `username.github.io/repo`.
- **Netlify** — drag the folder onto the "Sites" area of the Netlify dashboard
  (Netlify Drop). Instant URL.

Once it's live, share the URL with family/friends. On a phone:
- **iOS Safari:** Share → *Add to Home Screen*
- **Android Chrome:** menu (⋮) → *Install app* / *Add to Home Screen*

It then opens full-screen like a native app and works offline.

## Backups (important)

Because data lives only on the device, it's gone if the browser is cleared or
the phone is lost. In **Settings** there's:
- **Export backup (.json)** — full backup you can re-import later
- **Export spreadsheet (.csv)** — open in Excel / Google Sheets
- **Restore from backup** — load a `.json` backup (replaces current data)

Tell your users to export a backup now and then.

## Customizing

- **Categories & currency symbol:** editable in-app under Settings.
- **Colors / fonts:** the palette is CSS variables at the top of `styles.css`
  (`--paper`, `--ink`, `--green`, `--clay`, …). Fonts are Fraunces + Schibsted
  Grotesk, loaded from Google Fonts in `index.html`.
- **App name / icon color:** name lives in `manifest.webmanifest` and
  `index.html`; regenerate icons with `make_icons.py` (requires Pillow:
  `pip install pillow`) if you want a different mark.

## Updating a deployed app

The service worker caches the app for offline use. When you change a file,
bump the `CACHE` version string in `sw.js` (e.g. `ledger-v1` → `ledger-v2`)
so installed copies pick up the new version.
