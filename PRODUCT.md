# medstack — product spec v1

**One line:** A private, offline routine tracker that answers two questions at the moment
they matter — *what goes on next?* and *how long do I wait?*

**Why it exists.** Leo came home from the doctor with several ointments and medicines. The
label tube says nothing about sequence, and nothing about the gap between one cream and the
next. He applies them late, in a dim room, half asleep, one-handed, and forgets what he
already did today. This app is the answer sheet he wishes the pharmacy had printed.

Everything here is **his own data, entered by him**. The app never invents a regimen, never
loads a medical preset, and never phones home.

---

## 1. Non-goals (do not build these)

- No accounts, no sync, no backend, no network calls of any kind.
- No medical advice engine, no drug database, no dose calculation, no interaction warnings.
- No reminders/notifications (no service worker, no Notification API in v1).
- No charts or analytics. No streaks/gamification.
- No multi-user, no sharing, no QR export.
- No dark/light theme switch — one carefully tuned theme (see §7).
- No new npm dependencies, **except** the on-device OCR module `tesseract.js` (added for label
  reading, see §3.10) and its local language data. Everything it needs is served from this
  app's own `public/tesseract/`; it never contacts a third party.

---

## 2. Domain model

Three nouns. Keep the vocabulary exact in code, copy, and tests.

- **Product** — one thing from a tube, bottle, or box. `Clobetasol propionate 0.05%`,
  `Menthol 1% in aqueous cream`, `Vitamin D 1000 IU`.
- **Routine** — a named, ordered sequence of products for one occasion in the day.
  `Morning`, `Night`, `After shower`. Order is the whole point.
- **Dose** — one recorded application/intake of one product. The log. Immutable once written
  (the only edit is delete).

A routine is *not* a schedule engine. It has one optional time-of-day and is meant once a day.
If something happens twice a day, the user makes two routines.

### 2.1 Product

```ts
{
  id: string                  // opaque, generated
  name: string                // required, trimmed, 1..80
  strength: string            // optional free text, '' when absent, e.g. '0.05%'
  kind: 'Cream' | 'Ointment' | 'Gel' | 'Lotion' | 'Drops' | 'Spray' | 'Tablet' | 'Capsule'
      | 'Syrup' | 'Other'     // display + verb only. Never medical logic.
  amount: string              // free text, e.g. 'thin layer', '2 pumps', '1 tablet'
  area: string                // free text, e.g. 'inner elbows, neck'
  note: string                // free text
  defaultWaitMinutes: number  // 0..240, integer. Minutes to wait AFTER this product
                              // before the next one in a routine.
  asNeeded: boolean           // true => logged ad hoc from Today, never part of a routine
}
```

`verb(kind)` returns `'Apply'` for Cream/Ointment/Gel/Lotion/Spray, `'Take'` for the rest.
`asNeeded` products are excluded from routine step pickers.

### 2.2 Routine

```ts
{
  id: string
  name: string                // required, trimmed, 1..40
  scheduledTime: Option<'HH:MM'>   // 24h, local. None => any time.
  isPaused: boolean           // paused routines are not shown as due
  steps: ReadonlyArray<{
    productId: string
    waitMinutes: number       // 0..240, overrides product.defaultWaitMinutes at creation
  }>
}
```

- Step order = array order = application order. This is the app's entire value.
- The last step's `waitMinutes` is never enforced (nothing follows it) but is preserved so
  reordering doesn't silently lose intent.
- A routine with `steps.length === 0` cannot be saved.
- The same product may appear twice in one routine (e.g. morning and evening areas). Do not
  dedupe steps. Do not key steps by `productId`.

### 2.3 Dose

```ts
{
  id: string
  productId: string
  routineId: Option<string>   // None for as-needed doses
  dayKey: string              // 'YYYY-MM-DD' local, computed when logged
  atMs: number                // epoch ms, from the Clock service
  outcome: 'applied' | 'skipped'
}
```

### 2.4 Active run

At most one run exists at a time. It is the guided walk through a routine's steps.

```ts
{
  routineId: string
  dayKey: string              // 'YYYY-MM-DD' of the day the run belongs to
  stepIndex: number           // the step being displayed, 0-based
  startedAtMs: number
  waitEndsAtMs: Option<number>  // Some(t) while waiting after a completed step
}
```

Rules:

- Starting a routine that already has doses today resumes progress rather than duplicating:
  find the first step whose product has no `applied` dose today for that routine. If every
  step is covered, the run opens finished.
- `Applied` on a step → append Dose `{outcome:'applied'}`, then if a next step exists and the
  current step's `waitMinutes > 0` → `waitEndsAtMs = Some(now + waitMinutes*60000)` and
  `stepIndex` stays; when the countdown reaches 0 the UI advances to the next step.
  If `waitMinutes === 0` or it is the last step → advance immediately / finish.
- Wait state shows: remaining `mm:ss`, the name of the step just done, and the name of the
  next step ("Next: Night cream").
- Primary "Next" is disabled until remaining is 0. Secondary **"Skip wait"** is always
  available and advances immediately. Skipping is not logged as its own event; the applied
  doses already tell the truth.
- `Skipped` on a step → Dose `{outcome:'skipped'}`, advance with **no** wait countdown.
- Last step applied/skipped → run ends (write nothing extra; completion is derived).
- A run whose `dayKey` is not today is discarded on boot and on day rollover, never resumed.

**Completion is derived, never stored.** A routine is done for a day when every step's
product has an `applied` or `skipped` dose today with that routine, or when no run is active
and the count of covered steps equals the step count. Progress = covered steps / total steps
(dots, not a percentage bar).

### 2.5 Persistence

Single `localStorage` key `medstack:v1`, value = JSON string of:

```ts
{ version: 1, products, routines, doses, activeRun: Option<Run>, page: Page, settings }
```

- Write on every state change that matters (add/edit/delete product, add/edit/delete routine,
  step applied/skipped, run start/end, settings toggle, as-needed dose, import, clear).
  Use one command, `SaveState`, that encodes and writes the whole snapshot. Do not write on
  1s ticks or on unrelated UI messages.
- `doses` is capped at the most recent **1000** entries, oldest dropped on append.
- Additive fields decode with a default (`thumbnail` on a stored product defaults to `''`), so an
  older export or save keeps loading; nothing is rewritten until the next save.
- Boot: read → `Schema.decode` → on any failure (missing, corrupt, wrong version) start from
  `init` with `[]` everywhere and keep booting. Never show a crash view for bad storage.
  Never wipe the bad value automatically; the first successful save replaces it.
- **Export** writes the same JSON to `medstack-export-YYYY-MM-DD.json` via a Blob download.
- **Import** reads a chosen file, decodes it against the same schema, and on success replaces
  products/routines/doses after a confirm Dialog. On failure: error toast, current data
  untouched. Imported `settings`/`page` are ignored (keep local), doses are kept as-is.

---

## 3. Screens

`Page` is a tagged union: `Today`, `Run`, `Routines`, `RoutineEditor({routineId})`,
`Products`, `ProductEditor({productId})`, `History`, `Settings`, `Plan`. No router, no URL — this is
a single-user appliance. Persist `page`.

Bottom bar (hidden while on `Run`): **Today · Routines · Products · History** with icons and
labels, 56px tall + `env(safe-area-inset-bottom)`, current tab marked with accent colour and
`aria-current="page"`. A gear button sits top-right in the Today header and opens `Settings`
as a normal page (not a dialog). History is also reachable from a routine card.

### 3.1 Today

- Header: weekday + date ("Mon 10 Nov"), then one calm line that changes with state, e.g.
  `"3 routines · 2 done"`, `"Nothing logged yet"`, `"All done. Good night."`.
- **Due routines**, ordered by `scheduledTime` (None last), paused ones hidden behind a
  collapsed "Paused (1)" row. Card shows: time pill, name, progress dots, and either
  `Start` / `Continue` / `Done ✓ (view log)`. A routine whose time has passed and which is not
  done gets a quiet "later than usual" marker, not an alarm.
- **As needed** section: one row per `asNeeded` product — name, `Applied/Taken` verb, today's
  count (`2× today`), and a big `+` button that logs a dose immediately.
- **Active run** is surfaced as a pinned banner above the routines ("In progress — Night,
  step 2 of 4") that reopens `Run`.
- **Get a plan from ChatGPT** is the main way in, so it is never hidden: a bordered tile with a
  sparkle icon and the line *"It reads your labels and writes the routines"* sits directly under
  the header, above the routine cards, on every Today visit. It opens `Get a plan`.
- First run (no products and no routines): a setup panel, not a blank screen. The primary button
  is `Get a plan from ChatGPT` with the explanation *"Answer a few questions, paste the prompt
  into ChatGPT, then paste its answer back here. It fills in the products and the routines."*,
  then an `or do it by hand` divider and the two secondary buttons `Add a product` and
  `Create a routine`. No demo data, no prescriptions.

### 3.2 Run (the point of the app)

Full-height, one decision per screen. No bottom bar.

- Top: routine name, `Step 2 of 4`, thin progress line, and `Exit` (quiet, returns to Today;
  the run stays resumable). Exiting never discards a dose.
- **Ready state**: step number, product name at 2xl–3xl, then labelled facts —
  `Amount`, `Where`, `Wait` ("then 20 min before the next step"), `Note`. Two actions:
  primary `Applied` (or `Taken`), secondary `Skip`.
- **Waiting state**: replaces the step card, keeps the whole screen calm —
  the step just done in small text ("Clobetasol propionate ✓ 20:41"), then a large
  `mm:ss` countdown (`tabular-nums`, 5xl–6xl) with a thin circular or linear progress
  indicator that is CSS-only and `prefers-reduced-motion`-safe, then `Next: Night cream`.
  Primary `Next` is disabled and its label reads the remaining time; secondary
  `Skip wait`. Do not auto-advance — the user must confirm the next application.
- **Finished state**: "Done for today", steps summary with times, `Back to today`.
- Screen wake: while a run is active, attempt a `WakeLock` request; re-request on
  `visibilitychange`. It is optional — every failure path is silent. Never block on it.

### 3.3 Routines

List: name, time or `Anytime`, `4 steps`, first product + "+3 more", `Paused` badge.
Buttons: `New routine`. Row taps → editor. Empty state explains sequence + wait.

### 3.4 Routine editor — a three-step wizard, fixed names

Naming is the hard part, so the wizard starts from names people already use. Three steps, the
same on every visit, new or edited:

| Step | Question | Control | Advances by |
| --- | --- | --- | --- |
| 1 | When do you use it? | six fixed preset chips, plus `Or name it yourself` for a free name | `Next`, disabled while the name is blank |
| 2 | Which products, in what order? | the chosen steps in order, then one-tap rows for unused products | `Next` |
| 3 | Check it over | name, time chips + exact time, detail, pause, errors | `Create routine` / `Save changes` |

- Presets fill in name **and** time in one tap: `Morning` 07:30, `Midday` 12:00, `Evening` 18:00,
  `Night` 21:30, `After shower` any time (no clock is invented), `Before bed` 22:30. The name
  field stays editable, so a preset is a starting point, not a lock.
- Header shows `Step 1 of 3` and a thin progress line. `Cancel` on every step; `Back` from steps
  2 and 3. Actions sit at the foot of the screen, one primary full-width button plus quieter
  ones below it.
- **Steps**: ordered list, each row: position number, kind icon, product name, kind, wait
  (number input, minutes, 0..240, blank = 0, defaults to the product's `defaultWaitMinutes`),
  and `↑ ↓ ✕` controls. `↑` on the first row and `↓` on the last are disabled, not hidden.
- Products are added inline: step 2 lists the products the routine does not use yet as rows
  (`name`, `area · 20 min wait`, `+`); one tap appends it as the next step. When every product is
  already in the routine the list is replaced by *"Every product is already in this routine."*,
  and with no products at all, *"Add a product first, then come back and put it in order."*
- Warning row when a step's wait conflicts with its product default:
  "Clobetasol is set to 20 min, this step waits 5." → tap to reset to 20. Informational only.
- Helper text under the steps, muted, non-prescriptive:
  *"Thin medicated creams first, thick emollients and ointments last. Use the wait your doctor
  or pharmacist gave you."*
- Step 3 time: `Any time` chip plus fixed times (07:30, 08:00, 12:00, 18:00, 21:30, 22:30) that
  include every preset time, so a preset is always visibly selected; a `type="time"` input
  covers anything else.
- Step 3 also holds `Detail (optional)`, the `Pause this routine` switch ("hidden from Today,
  history kept"), the plan-origin line for plan routines, and the inline reasons that disable
  save (`Name is required`, `Add at least one step`). Cancel discards with no confirmation
  (nothing was saved).
- Delete routine: step 3 footer, `Dialog` confirm naming the routine. Doses are kept (they are
  history) and render as "Routine deleted" in History.

### 3.5 Products

List grouped by kind, showing name · strength, area, wait. `New product` button.

### 3.6 Product editor — a wizard, one question per screen

Written for an older user reading in a dim room. The same seven steps run for every product,
new or edited; nothing is a single wall of fields.

| Step | Question | Control | Advances by |
| --- | --- | --- | --- |
| 1 | What is it? | `Take a photo of the label` + name (required) + strength (optional) | `Next`, disabled while the name is blank |
| 2 | What kind is it? | 2-column kind chips | tapping a chip |
| 3 | How much goes on? | amount chips + free text | tapping a chip, or `Next` |
| 4 | Where does it go? | free text, optional | `Next` (skipping is allowed) |
| 5 | Wait before the next one? | `0/5/10/15/20/30/60` chips + minutes input | tapping a chip, or `Next` |
| 6 | Is it part of a routine? | two big buttons | tapping either |
| 7 | Check it over | fact list + note + errors | `Add product` / `Save changes` |

- The photo on step 1 is optional and never blocks: the name stays editable, typed text is never
  overwritten by a late OCR result, and a failed read only says *"Could not read it. Type the name
  below."*
- Header shows `Step 3 of 7` and a thin progress line. Every step has `Back`, except step 1
  which has `Cancel` (nothing is saved).
- Validation appears on step 7, next to the save button: `Name is required`,
  `Wait must be 0–240 minutes`. The save button is disabled while an error stands.
- `Only when I need it` forces the wait to 0, as before.
- Every chip and action button in the wizard carries a line icon to the left of its text
  (see §7); the icon never replaces the label.
- Delete (existing products only) sits on step 7, below save, via `Dialog`: **"Delete
  Clobetasol propionate? It is in 1 routine. Past doses are kept."** — deleting removes the
  product from any routine steps, and a routine that ends up with 0 steps is kept but flagged
  `Needs a step` and hidden from Today.

### 3.9 Get a plan (ChatGPT round-trip, no network)

Reached from the Today setup panel and from Settings. The app never calls a network; the user
moves the text.

- **Ask:** one labelled block — `The label` — holding `Take a photo of the label` above the two
  inputs (`What did the doctor give you?`, `Copy what the label says`). The photo is read by the
  same on-device OCR as §3.10 and fills both boxes (the doctor box gets the strongest drug-name
  line), and anything already typed is never overwritten. Then a
  `Copy the prompt` button that puts a self-contained prompt on the clipboard. The prompt
  carries the patient input, the `medstack.plan/1` shape, and the hard rules: use only the
  label, mark gaps as questions, never guess a dose or a wait, output one ```json block.
- `Open ChatGPT` opens `https://chatgpt.com/?q=<prompt>` in a new tab. A collapsed
  `Show the prompt` block holds the same text for hand-copying when the clipboard is blocked.
- **Paste:** `I have the answer` swaps to a paste box. `Import the plan` decodes the first
  ```json block (or the outermost `{…}`) against the plan schema; surrounding prose is
  ignored. A failure shows one plain toast and changes nothing.
- **Confirm:** the dialog names the counts (`3 products and 2 routines will be added`), lists
  up to five `Ask your pharmacist` questions from the plan, and only then merges.
- **Merge, never replace:** products are matched by name (case-insensitive); an existing
  product keeps its own details and its id, and plan steps are remapped onto it. Routines
  whose name already exists are skipped. Imported products and routines carry
  `origin: Plan{planId, planTitle, modelLabel, capturedAtMs}`.
- A plan routine's editor shows `from plan · checked <date>`; until the user taps
  `I checked this` it reads `not checked yet` and the tap stores `reviewedAtMs`.
- Imported routines are ordinary routines: editable, pausable, deletable, and their doses are
  ordinary doses.

### 3.7 History

Reverse chronological, grouped by `dayKey` with a human header (`Today`, `Yesterday`,
`Mon 10 Nov`). Within a day, group by routine (name, or `Routine deleted`), then as-needed.
Each dose row: time `HH:MM`, product name, and `skipped` as a quiet strikethrough/ghost.
Disclosure per day, most recent day open by default. Empty state: "Nothing logged yet."
`Clear history` lives in Settings, not here.

### 3.8 Settings

- `Sound when the wait ends` switch (default **off**; two short sine blips ~880/660 Hz,
  120 ms each, via one lazily created `AudioContext` resumed on the user gesture; every
  failure swallowed).
- `Default wait` number (minutes) used to prefill new products. Default 20.
- Export / Import / `Clear history` (doses only) / `Delete everything` (Dialog, requires
  typing `delete`) — each with one plain sentence of consequence.
- A muted footnote, the only medical-adjacent text in the app:
  *"Not medical advice. Follow your doctor's or pharmacist's instructions."*
- Version line: `medstack 1.0`.

### 3.10 Label photo and text reading (on-device OCR)

Typing `Clobetasol propionate 0.05%` one-handed is the worst part of adding a product, so step 1
of the wizard offers a camera — and so does `Get a plan`, where the same photo fills both ask boxes
(§3.9).

- `Take a photo of the label` opens the phone's photo picker through `<input type="file"
  accept="image/*">`, which offers `Take Photo` on iOS and Android, so the camera is one tap
  away. No `getUserMedia`, no permission prompt beyond the OS one.
- Two things happen at once: a 112×112 WebP thumbnail is cut from the photo, and the same photo is
  downscaled to 1600 px and read by Tesseract.js running as WASM **on the device**.
- The first line that looks like a drug name (letters, not an `NDC`/`Lot`/`Exp` line, ≥ 3 letters)
  is trimmed to 80 characters and put in the name field. A typed name is never overwritten. The
  field stays editable — OCR is a head start, not an authority.
- The thumbnail is stored on the product (`thumbnail`, a data URL, ~6–10 kB) and shown in the
  Products list and in the wizard review step. It is only a memory aid; it is not read again.
- Assets are self-hosted under `public/tesseract/` (`worker.min.js`, three LSTM cores, `eng` fast
  traineddata) — ~13 MB on disk, and a browser fetches only the one core it can run, only when a
  photo is first read. Nothing is requested from a CDN, ever.
- No text is sent anywhere; the OCR never leaves the device, and the app still works with the
  network unplugged once the assets are cached.
- Measured in Chrome 157 (desktop, warm dev server, 900×480 synthetic label): worker + model
  208–303 ms, first read 126–149 ms, second read 100 ms. A phone pays the core + model download
  once (~6 MB) on the first photo.

---

## 4. Time, clock, and correctness rules

- **Never** call `Date.now()`, `new Date()`, `setTimeout`, `setInterval`, or `Math.random()`
  outside a Command's `execute`. Model values come from Messages only.
- Now / today / timers come from Effect (`Clock.currentTimeMillis`). Ids come from
  `SecureRandom` (`effect/crypto`) or `Random`, generated in `execute`
  (`BrowserCrypto.layerSecureRandom` provided where needed).
- Remaining time is **derived**: `remainingMs = max(0, waitEndsAtMs - nowMs)`, `mm:ss` formatted
  with non-negative guards. Never a decrementing counter. Never a stored `remainingMinutes`.
- The 1s tick runs **only** while `page === 'Run'` and a wait is in progress (± 0). Idle app: no
  tick. Implement with `Subscription.make` + `Stream.tick(Duration.millis(1000))`
  (`examples/stopwatch` in the reference is the pattern) and a `TickedClock` message; compute
  `nowMs` in a `ReadClock` Command, not in update.
- Day rollover: a 60s subscription recomputes `dayKey`; when it changes, an in-progress run is
  dropped and Today recomputes its progress. A user applying cream at 00:20 must see 00:20's
  day, not yesterday's.
- Countdown must be correct after: tab backgrounding, phone sleep, reload mid-wait,
  reload mid-run. Because it is derived from `waitEndsAtMs` + Clock, all four are free —
  do not break them with any "interval that keeps decrementing" design.

---

## 5. Copy voice

- Lowercase sentence-start labels are fine in the UI (`start`, `wait 20 min`) but headings and
  buttons are sentence case: `Night routine`, `Add a product`, `Skip wait`.
- Verbs come from the product kind: `Applied` / `Taken`. Never "complete", "check off",
  "log intake", or "compliance".
- No exclamation marks, no streak praise, no emoji in product UI. One `✓` glyph is allowed as
  a done mark, and `×` for remove where an icon is not used.
- Numbers are digits: `20 min`, `2 of 4`, `20:41`.
- Second person, quiet, specific: *"Wait 20 min before the next step."*

---

## 6. Reference material (read before writing code)

- `./FOLDKIT.md` — the framework conventions. **Read it whole.** It wins any disagreement with
  this dotfile about Foldkit style.
- `./AGENTS.md` — project notes (this project's additions are below the Foldkit marker).
- `/tmp/foldkit-ref/examples/stopwatch/` — a pure Effect+Schema timer with a Subscription tick,
  a `ReadClock` Command and 1:1 story/scene tests. The closest sibling to the Run screen.
- `/tmp/foldkit-ref/examples/todo/` — the shape this repo was scaffolded from (persistence via
  `KeyValueStore`, Story/Scene tests, Tailwind classes).
- `/tmp/foldkit-ref/examples/kanban/` — list mutation, reordering, dialogs, `message.ts` /
  `command.ts` / `domain` split at real size.
- `/tmp/foldkit-ref/examples/ui-showcase/` — what `@foldkit/ui` actually offers, with the
  attribute-spreading idiom for `Button`, `Input`, `Switch`, `Select`, `Dialog`, `Tabs`,
  `Progress`, `Toast`.
- `/tmp/foldkit-ref/packages/typing-game/client/src/` and `.../packages/website/src/` —
  production file organisation and Submodel use.
- `node_modules/foldkit/dist/**/*.d.ts` and `node_modules/@foldkit/ui/dist/**/public.d.ts` —
  ground truth for signatures. When a doc and a `.d.ts` disagree, the `.d.ts` wins.

Reference code is **read-only**: never import from `/tmp/foldkit-ref`, never copy its tests
wholesale. Adapt.

---

## 7. Visual and interaction requirements

The moment of use: 02:40, one bar of warm lamp light, one hand, tired, a little sore, and
nothing should make him think.

- **Theme**: dark-first and only. Page `#0d1013`-ish, surfaces one step up, hairline borders
  `rgba(255,255,255,.08)`, text `#e8eaed` primary / `#9aa0a6` secondary. One accent: warm amber
  (~`#f5b544`) for the primary action, the active tab, the countdown, and progress. Semantics
  sparing: a skipped dose is quiet grey, not red. Contrast ≥ 4.5:1 for text, ≥ 3:1 for large
  numerals and UI borders. Nothing pure-black, nothing pure-white, no bright blue, no gradient
  soup, no glassmorphism, no drop-shadow stacks.
- **Typography**: system stack (`ui-sans-serif, -apple-system, …`). 16px base, 15px minimum
  anywhere. Product name on Run: 28–32px, weight 600, `text-wrap: balance`. Countdown:
  `tabular-nums`, weight 600, big enough to read at arm's length (≥ 56px), letter-spacing
  slightly tight, `font-variant-numeric: tabular-nums`.
- **Icons**: hand-drawn inline SVG, 24×24, `stroke="currentColor"`, `fill="none"`, declared
  once in `src/view/icons.ts` (`kindIcon()` maps product kinds). Every option chip and action
  button shows one before its label; icons are `aria-hidden` and decorative — the text label is
  always present, so no accessible name depends on an icon. No icon package, no emoji.
- **Touch**: every target ≥ 48px in its smallest dimension; primary Run buttons full width,
  64px; ≥ 12px gap between adjacent targets. No hover-only affordances, no long-press, no
  swipe-to-delete. One-handed reach: all primary actions in the bottom 45% of the screen.
- **Layout**: single column, `max-width: 480px`, centred, page padding 20px, bottom padding =
  safe area + bar. iPhone SE (375×667) with 16px text must not scroll horizontally or clip
  the countdown.
- **Motion**: 120–160ms ease-out for state changes; the countdown ring never animates
  faster than 1s per step; everything collapses to instant under
  `@media (prefers-reduced-motion: reduce)`. No bouncing, no pulsing.
- **States**: every list has an empty state that says what to do next; every invalid form
  field has an inline message in text, not just a red border; the Run screen is the only
  place with a waiting state, and it is never a spinner.
- **A11y**: real `<button>`s, `<label for>` on every input, `aria-current` on the active tab,
  `aria-live="polite"` for exactly two announcements on the Run screen — "Ready for the next
  step." and the routine-finished line — via a visually-hidden region, never per-second.
  Countdown text is duplicated only if `aria-hidden` hides the visual copy. Focus visible
  with an amber ring. Tab order follows reading order.
- **Tone of the timer**: the countdown is information, not pressure. No red, no flashing, no
  "hurry". When it hits zero the ring settles and the copy becomes "Ready".

---

## 8. Technical constraints

- Stack as scaffolded: Vite 8, Foldkit 0.170.0, Effect 4.1.0, `@foldkit/ui` 0.170.0, Tailwind 4,
  Vitest, oxlint/oxfmt, plus `tesseract.js` for on-device OCR (§3.10). **Do not add, remove, or
  bump any other dependency.** No router, no date library, no state library.
- Client-rendered SPA. `src/entry.ts` only calls `Runtime.makeApplication` + `Runtime.run`
  (+`subscriptions`). Pure definitions stay out of it so tests can import them.
- Keep `src/main.ts` as the public barrel: it must export `Model`, `Message`, `Flags`, `init`,
  `update`, `view`, `subscriptions`, and the Commands the Story tests import. `entry.ts` and
  both test files import from `./main`. Split the *implementation* into sibling modules
  (`domain.ts`, `message.ts`, `command.ts`, `update.ts`, `view/…`, `storage.ts`) — re-export
  from `main.ts`. If you keep everything in `main.ts`, it is fine only if it stays readable;
  recommend the split.
- Storage through `effect/persistence` `KeyValueStore` + `BrowserKeyValueStore.layerLocalStorage`
  inside a Command (the todo example's `SaveTodos` is the shape). Never `localStorage.x`
  directly in `update` or `view`.
- No date library. `dayKey` from a `Date` built on `Clock` inside a Command, padded `YYYY-MM-DD`
  in local time; formatting via `Intl.DateTimeFormat`.
- Heavy aggregates (today's covered steps, history grouping) are pure functions in
  `domain.ts` over Model values. The view calls them; it does not mutate.
- Remove the todo example's scaffolding honestly: no dead `Filter`/`EditingState` types, no
  unused imports, no `TODO` comments left behind. `index.html` title `medstack`, `<meta
  name="theme-color" content="#0d1013">`, `apple-mobile-web-app-capable`, `viewport-fit=cover`.
  Add `public/manifest.webmanifest` (name, short_name, `display: standalone`, dark
  `background_color`/`theme_color`, generated 192/512 `icon.svg` references) and link it.
  No service worker.

### Tests (required, both styles)

- `src/story.test.ts` — drive `update` with Messages: product add/edit/delete + validation
  failures, routine add + reorder (↑/↓ boundaries) + remove step + add step, start run with
  existing progress resumes at the right step, apply step sets `waitEndsAtMs` from the step's
  wait, skip-wait advances, skip-dose advances with no wait, final step finishes the run and
  writes doses once, as-needed dose logged, import rejects malformed JSON and keeps state,
  import success replaces, day rollover drops a stale run, tick before zero does not advance.
  Use `Command` assertions to prove `SaveState` is emitted on mutations and **not** emitted on
  1s ticks.
- `src/scene.test.ts` — through `view`: empty Today shows the setup panel; a due routine card
  shows `Start`; Run shows product name, amount, and a disabled `Next` while waiting with the
  remaining label; after zero it is enabled; History groups two doses on one day under one
  heading; product form shows `Name is required`.
- Fixed inputs only: no real timers, no `Date.now()` in tests; pass `nowMs`/`dayKey` as Message
  payloads or Command args.

### Gates — run them all, paste the output in the report

```sh
npm run typecheck      # tsc --noEmit, zero errors
npm test               # vitest run, all green, >= 30 tests
npm run build          # vite build, zero warnings you introduced
npm run lint           # oxlint guardrails + effect lint, zero errors
npm run format -- --check package.json 2>/dev/null || npx oxfmt --check src || true
```

If `oxlint` flags something the conventions require, fix the code, not the config.
`FOLDKIT.md`, `package.json` `dependencies` (other than `tesseract.js`), and `vite.config.ts`
input list are **frozen**; only `package.json`'s `scripts` may be touched if a script is
factually broken.

---

## 9. Definition of done (self-check, answer each in the report)

1. `npm run typecheck && npm test && npm run build && npm run lint` pass; paste the tail.
2. Two products and one 3-step routine can be created, ordered, and persisted across reload
   without touching devtools.
3. Applying step 1 of a 20-min-wait routine shows `20:00`, counts down correctly after a
   reload of the page, and `Next` is disabled until `00:00`.
4. All deleted: app returns to the setup panel and does not crash.
5. Corrupt `localStorage` value: boots into setup panel, no crash view.
6. Import of a non-medstack JSON file: error toast, previous data intact.
7. Every rule in §4 holds — grep the diff for `Date.now`, `setTimeout`, `setInterval`,
   `Math.random`, `switch (` and paste the result (expected: no hits outside tests).
8. Nothing in §1 was built.
