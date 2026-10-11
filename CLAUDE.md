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

**Sync (family mode).** Firebase layout: `families/{CODE}/{meta, ann, members/{id}, events/{id}, tasks/{id}, lists/{id}, items/{id}, wishes/{id}, activity/{id}}`. `render()` ends with `commit()`, which flattens `S` to `collection/id` paths (`flat()`), diffs each record against the last known version (`baseC`, canonical JSON via `canon()`), queues changed/removed paths in `store.pending`, and `flush()` sends them in one multi-path `PATCH`. Failed sends retry with backoff and on the `online` event. Incoming changes arrive via `EventSource` on the family path (`connect()`); `put`/`patch` events are applied to `store.R`, then `fromRemote()` rebuilds `S` from `store.R` plus `store.pending`. Remote data is untrusted: `norm()` validates every record (ids, dates, enums, colors) before it reaches the templates — keep that in place when adding fields, and always `esc()` user text.

**Undo.** `snap()` captures the flattened state before a change; `toast(msg, undo)` captures the state after it. Undo reverts only the paths that this change touched, so it doesn't clobber edits from other phones.

**Roles** (`can()`): admin / adult / child. They shape the UI (child view shows only own items, can't assign others) but are not security — anyone with the family code can read and write that family. `database.rules.json` only blocks listing all families.

**Reminders** are best-effort: `checkReminders()` runs every 30 s while the app is open and shows a notification (via the service worker registration) for the current member's events. Real push would need a server.

**Conventions.** All user-facing strings are Turkish; use `toLocaleUpperCase('tr')` / `toLocaleLowerCase('tr')`. Colors are CSS custom properties with light and dark sets (`:root`, `prefers-color-scheme`, `[data-theme]`). Member colors come from `COLORS`. IDs come from `uid()` (time-based base36, always starts with a letter so Firebase never treats a collection as an array).
