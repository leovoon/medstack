# Agent Development Notes

This is a Foldkit app. Read [`FOLDKIT.md`](./FOLDKIT.md) before writing any code in this project. It covers the architecture, the APIs, and the conventions the project is built on.

Foldkit owns `FOLDKIT.md` and replaces it whole on upgrade. This file is yours. Anything you want an agent to know about this project goes below, where an upgrade won't touch it.

`FOLDKIT.md` reads the line below to decide whether it has already offered to vendor the Foldkit source. Leave it in place.

subtree_prompted: false

## Project Notes

Domain vocabulary, deployment steps, local conventions that differ from Foldkit's defaults: write them here.

## medstack — project notes

**Read `PRODUCT.md` first.** It is the build contract: domain model, screens, copy voice,
time rules, visual requirements, and the definition of done. `FOLDKIT.md` governs *how* the
code is written; `PRODUCT.md` governs *what* it does. Where they disagree about Foldkit
style, `FOLDKIT.md` wins.

What this is: a private, offline, single-user tracker for a topical/oral regimen. It answers
"what goes on next?" and "how long do I wait?" and it keeps the log. It is not a medical
product, not a reminder service, and not a health record for anyone else.

Domain vocabulary (use these words exactly, in code and copy):

- `Product` — one tube/bottle/box. Not "medication", not "item", not "drug".
- `Routine` — a named ordered sequence of products for one occasion (`Morning`, `Night`).
  Not "schedule", not "plan".
- `Dose` — one recorded application or intake. Not "entry", not "log", not "intake".
- `Run` — the guided walk through one routine, today. Not "session".
- `wait` — minutes between one step and the next. Never "delay", "gap", "interval".

Hard rules that outrank convenience:

- Offline-only. No `fetch`, no analytics, no fonts/CDNs, no service worker.
- No new dependencies, no version bumps. Vite 8 + Foldkit 0.170 + Effect 4.1 + Tailwind 4 is
  the whole toolbox.
- Model is Schema-backed; no booleans where a union says it better; `Option` for absence.
- Time and randomness live in Commands only (§4 of `PRODUCT.md`). A countdown is *derived*
  from `waitEndsAtMs`, never decremented.
- Writes happen through `SaveState`; 1s ticks must not touch storage.
- Dark, calm, one-handed, 48px targets. Amber accent. No exclamation marks, no streaks, no
  emoji in the UI, no red for a skipped dose.

Reference source (read-only, not imported): `/tmp/foldkit-ref` — a shallow clone of
`github.com/foldkit/foldkit` at the `foldkit@0.170.0` tag. `examples/stopwatch` is the timer
precedent, `examples/kanban` the list/dialog precedent, `examples/ui-showcase` the
`@foldkit/ui` inventory, `packages/typing-game/client/src` the production file layout.

Commands:

```sh
npm run dev        # vite dev server + foldkit devtools
npm run typecheck  # tsc --noEmit  — gate
npm test           # vitest run    — gate
npm run build      # vite build    — gate
npm run lint       # oxlint + effect-tsgo — gate
```

Local conventions: `src/main.ts` is the public barrel (definitions and helpers re-exported so
`entry.ts` and the tests keep one import path). Implementation lives in sibling modules:
`domain.ts` (schemas, types, pure derivations), `message.ts`, `command.ts`, `update.ts`,
`subscriptions.ts`, `storage.ts`, `view/`. Tailwind classes live in the view modules; design
tokens are documented in `PRODUCT.md` §7 and must not drift.
