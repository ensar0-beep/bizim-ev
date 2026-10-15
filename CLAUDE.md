# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Bizim Ev" — a Turkish-language family organizer PWA. The whole app (markup, CSS, JS) lives in `index.html`; there is no build step, package manager or test suite. `sw.js` caches the app shell, `manifest.json` + `icons/` make it installable. Deployed with GitHub Pages from `main` (root).

## Running / developing

- Serve the folder statically (`python3 -m http.server`) and open it. A service worker only registers over http(s), not `file://`.
- Data sync goes to the Firebase Realtime Database in `FB_URL` (top of the "Durum" section). With `FB_URL` empty the app only offers the local "örnek aile" demo.
- For local testing without touching the real database, point `FB_URL` at a small REST+SSE mock (GET/PUT/PATCH on `/families/{code}.json`, and `text/event-stream` GET that sends `put`/`patch` events like Firebase).
- When shipping a change that the service worker must pick up, bump `CACHE` in `sw.js`.

## Architecture

**Modes.** `store.mode` is `null` (welcome screen), `'demo'` (seeded sample family from `seed()`, local only) or `'family'` (synced). `store` is persisted to localStorage under `bizim-ev.v1` and also caches the last remote tree (`store.R`) and unsent writes (`store.pending`), so the app opens instantly and works offline.

**State and rendering.** `S` is the in-memory view: `{meta, ann, members[], events[], tasks[], lists[], items[], wishes[], activity[]}`. Views are template-string functions (`vToday`, `vCal`, `vLists`/`vWishes`, `vTasks`, `vFamily`) rendered into `#screen` by `render()`. Clicks are delegated through `data-act` → the `A` actions object; form submits through `data-form` → `FORMS`. Bottom sheets (`sheet()`) hold every form and detail view. Mutations change `S` directly and then call `render()`.

**Day agenda.** Bugün and Takvim list days one under another (`flowHTML`; empty days collapse into one dashed row). Tasks sit among events on their due day, sorted by time (`tasksOn`, `cTaskRow`); overdue open tasks move to today and done tasks stay on the day they were done. A sticky week strip (`strip`) sits above the list and `trackStrip()` (on `#screen` scroll and after each render) marks the day at the top; in Takvim it also moves to the next week. The month view lists the month's days under the grid, and tapping a day scrolls to it (`UI.pending` → `scrollToDay`).

**Sync (family mode).** Firebase layout: `families/{CODE}/{meta, ann, members/{id}, events/{id}, tasks/{id}, lists/{id}, items/{id}, wishes/{id}, activity/{id}}`. `render()` ends with `commit()`, which flattens `S` to `collection/id` paths (`flat()`), diffs each record against the last known version (`baseC`, canonical JSON via `canon()`), queues changed/removed paths in `store.pending`, and `flush()` sends them in one multi-path `PATCH`. Failed sends retry with backoff and on the `online` event. Incoming changes arrive via `EventSource` on the family path (`connect()`); `put`/`patch` events are applied to `store.R`, then `fromRemote()` rebuilds `S` from `store.R` plus `store.pending`. Remote data is untrusted: `norm()` validates every record (ids, dates, enums, colors) before it reaches the templates — keep that in place when adding fields, and always `esc()` user text.

**Shared tasks.** A task can have several people in `who` (`assignee` stays `who[0]`, rotation uses it). By default one of them finishing completes it; with `all` each person ticks their own part (`dn`) and it completes when everyone has. Use `ws(t)` / `isFor(t,id)` instead of reading `assignee` directly.

**Places in wishes.** For `mekan`/`yer` wishes, `wish.place = {n, a, u}` (name, address, Google Maps link). It arrives through the manifest `share_target` (Google Maps → Paylaş → Bizim Ev opens `./?text=…`, parsed by `parsePlace()` at boot) or a pasted link in the wish form. No Maps API key: detail buttons use plain Google Maps URLs (`mapsUrl`, `dirUrl`). `okMapsUrl()` only accepts https Google Maps hosts; `norm()` drops anything else.

**Undo.** `snap()` captures the flattened state before a change; `toast(msg, undo)` captures the state after it. Undo reverts only the paths that this change touched, so it doesn't clobber edits from other phones.

**Device identity.** With `FB_KEY` (Firebase Web API key) set, every device signs up anonymously once (`authTok()`, refresh token in `store.auth`), writes itself into `families/{CODE}/uids/{uid}` (`claimUid`, `ensureUid` on every boot) and appends `?auth=<idToken>` to every REST and `EventSource` request. `database.rules.v2.json` then opens a family only to the uids listed under it (`meta`/`members` stay readable so the join screen works). `database.rules.gecis.json` is the interim set: families as before, plus the `avatars` node. Rollout order: set `FB_KEY` → every phone opens the app once → paste the stricter rules in the console. With `FB_KEY` empty everything falls back to the old code-only behaviour.

**Family avatars.** Family photos are not in the repo; they live under `avatars/{CODE}/{id} = {n,t,d}` (`d` = 256px webp data URL) and are readable only by the family's uids. `loadAv()` fetches the id list (`?shallow=true`) and downloads only missing ones into `store.av` (image) / `store.avi` (person, label); `save()` drops that cache first if localStorage is full. Avatar keys are `ozel/<id>`; `norm()` rewrites the old `ayas/<id>` values. `yukle.html` is the upload page (same origin, reuses the app's identity from localStorage): resizes photos to 256px webp, uploads, deletes, and has a one-time button to move the old repo avatars across.

**Roles** (`can()`): admin / adult / child. They shape the UI (child view shows only own items, can't assign others) but are not security — anyone with the family code can read and write that family. `database.rules.json` only blocks listing all families.

**Reminders** are best-effort: `checkReminders()` runs every 30 s while the app is open and shows a notification (via the service worker registration) for the current member's events. Real push would need a server.

**Conventions.** All user-facing strings are Turkish; use `toLocaleUpperCase('tr')` / `toLocaleLowerCase('tr')`. Colors are CSS custom properties with light and dark sets (`:root`, `prefers-color-scheme`, `[data-theme]`). Member colors come from `COLORS`. IDs come from `uid()` (time-based base36, always starts with a letter so Firebase never treats a collection as an array).
