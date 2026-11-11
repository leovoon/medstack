# medstack

A private, offline routine tracker for a topical and oral regimen. It answers the two
questions that matter at the sink at 1am: **what goes on next?** and **how long do I wait?**

No accounts, no sync, no backend, no network calls. The data is one person's own regimen,
entered by them, stored in the browser, and it stays there.

## What it does

- **Today** — the routines due today with progress dots, an "as needed" list you can log from
  with one tap, and a pinned banner when a run is already in progress.
- **Run** — the core screen. One decision per view: which routine, which product, apply it,
  then a live countdown of the wait until the next step. Late and skipped doses are marked
  quietly, never in red.
- **Routines and Products** — created through step-by-step wizards, one question per screen.
- **Get a plan** — a ChatGPT round trip with no network of its own. The app writes the prompt,
  you paste it into ChatGPT, then paste the JSON answer back and the products and routines are
  created for you. Typed or read from a photo.
- **Label reading** — on-device OCR (`tesseract.js`, bundled language data in `public/tesseract/`)
  pulls the product name and the label directions out of a phone photo. It never leaves the device.
- **History** — every dose written down, grouped by day. Doses are immutable; the only edit is delete.

## How it is built

A [Foldkit](https://foldkit.dev) application on [Effect](https://effect.website), built with
Vite, styled with Tailwind 4. It is a Model–View–Update app in the strict sense: the model is
schema-checked, the view is a pure function of it, and every side effect — clock, storage,
audio, OCR, clipboard — is a Command returned by `update`.

```
src/
  domain.ts          schemas and types, plus pure derivations (what is due, what waits, when)
  model.ts           the app model, one tagged union per concept
  message.ts         every event the app can receive
  command.ts         every effect the app can perform
  update.ts          the whole state machine
  subscriptions.ts   clock ticks, visibility, timers
  storage.ts         localStorage encode/decode through Schema
  main.ts            public barrel: definitions and helpers re-exported for one import path
  view/              one module per screen, plus shared components, icons, styles
```

Two rules shape the code more than anything else:

- **Time lives in Commands.** A countdown is derived from `waitEndsAtMs` on every tick, never
  decremented in state, so it survives a locked screen and a closed tab.
- **Writes are explicit.** State changes are persisted only through `SaveState`; a 1s tick must
  never touch storage.

## Running it

```sh
npm install
npm run dev
```

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Vite dev server                                                  |
| `npm run typecheck` | `tsc --noEmit`                                                   |
| `npm test`          | `vitest run`                                                     |
| `npm run lint`      | oxlint, plus the effect/tsgo pass in deny-warnings mode          |
| `npm run format`    | oxfmt                                                            |
| `npm run build`     | production build into `dist/`                                    |
| `npm run deploy`    | build, then `wrangler deploy` (Cloudflare Workers static assets) |

The deploy target is a Worker serving `dist/` with single-page-app fallback (see
`wrangler.jsonc`); no server code, no bindings, no environment.

## Tests

Two styles, both driven by Foldkit's test harness:

- **Story tests** (`src/story.test.ts`) — drive `update` with messages and assert the resulting
  model and the commands it asks for. Time, storage and OCR are `given` as fakes, so a whole
  routine can be walked through in a few lines.
- **Scene tests** (`src/scene.test.ts`) — render `view` and query it by role, name and text:
  which control exists, what it says, whether it is disabled.

## Design rules

Dark only, one theme, amber accent (`#f5b544`) on near-black (`#0d1013`), 48px targets,
480px max width, sentence case, no emoji, no exclamation marks, no streaks. Motion is used to
say "still working", never to decorate.

`PRODUCT.md` is the build contract — domain vocabulary, screens, copy voice, time rules and the
definition of done. `AGENTS.md` holds the conventions that are specific to this repo. Read both
before changing behaviour.

## Privacy

There is no server to send data to. Everything sits in the browser's key-value store
(`localStorage`, via `@effect/platform-browser`) on the device that entered it, and clearing site
data deletes it. This is a personal appliance, not a medical product: it gives
no advice, knows no drug database, and calculates no doses.
