import { Array, Match, Option, Order, Schema, pipe } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

// MODEL

export const ProductKind = Schema.Literals([
  'Cream',
  'Ointment',
  'Gel',
  'Lotion',
  'Drops',
  'Spray',
  'Tablet',
  'Capsule',
  'Syrup',
  'Other',
])
export type ProductKind = typeof ProductKind.Type

export const Origin = defineTaggedUnion({
  Manual: {},
  Plan: {
    planId: Schema.String,
    planTitle: Schema.String,
    modelLabel: Schema.String,
    capturedAtMs: Schema.Number,
  },
})
export type Origin = typeof Origin.Type

export const Product = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  strength: Schema.String,
  kind: ProductKind,
  amount: Schema.String,
  area: Schema.String,
  note: Schema.String,
  defaultWaitMinutes: Schema.Number,
  asNeeded: Schema.Boolean,
  origin: Origin,
  thumbnail: Schema.String,
})
export type Product = typeof Product.Type

export const Step = Schema.Struct({
  productId: Schema.String,
  waitMinutes: Schema.Number,
})
export type Step = typeof Step.Type

export const Routine = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  scheduledTime: Schema.Option(Schema.String),
  isPaused: Schema.Boolean,
  steps: Schema.Array(Step),
  origin: Origin,
  detail: Schema.String,
  reviewedAtMs: Schema.Option(Schema.Number),
})
export type Routine = typeof Routine.Type

export const StoredProduct = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  strength: Schema.String,
  kind: ProductKind,
  amount: Schema.String,
  area: Schema.String,
  note: Schema.String,
  defaultWaitMinutes: Schema.Number,
  asNeeded: Schema.Boolean,
  origin: Schema.optionalKey(Origin),
  thumbnail: Schema.optionalKey(Schema.String),
})
export type StoredProduct = typeof StoredProduct.Type

export const StoredRoutine = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  scheduledTime: Schema.Option(Schema.String),
  isPaused: Schema.Boolean,
  steps: Schema.Array(Step),
  origin: Schema.optionalKey(Origin),
  detail: Schema.optionalKey(Schema.String),
  reviewedAtMs: Schema.optionalKey(Schema.Option(Schema.Number)),
})
export type StoredRoutine = typeof StoredRoutine.Type

export const DoseOutcome = Schema.Literals(['applied', 'skipped'])
export type DoseOutcome = typeof DoseOutcome.Type

export const Dose = Schema.Struct({
  id: Schema.String,
  productId: Schema.String,
  routineId: Schema.Option(Schema.String),
  dayKey: Schema.String,
  atMs: Schema.Number,
  outcome: DoseOutcome,
})
export type Dose = typeof Dose.Type

export const Run = Schema.Struct({
  routineId: Schema.String,
  dayKey: Schema.String,
  stepIndex: Schema.Number,
  startedAtMs: Schema.Number,
  waitEndsAtMs: Schema.Option(Schema.Number),
})
export type Run = typeof Run.Type

export const Settings = Schema.Struct({
  soundOnWaitEnd: Schema.Boolean,
  defaultWaitMinutes: Schema.Number,
})
export type Settings = typeof Settings.Type

export const Page = defineTaggedUnion({
  Today: {},
  Run: {},
  Routines: {},
  RoutineEditor: { routineId: Schema.Option(Schema.String) },
  Products: {},
  ProductEditor: { productId: Schema.Option(Schema.String) },
  History: {},
  Settings: {},
  Plan: {},
})
export type Page = typeof Page.Type

export const ConfirmKind = defineTaggedUnion({
  DeleteRoutine: { routineId: Schema.String },
  DeleteProduct: { productId: Schema.String },
  ImportReplace: {},
  PlanImport: {},
  ClearHistory: {},
  DeleteEverything: {},
})
export type ConfirmKind = typeof ConfirmKind.Type

export const ImportSnapshot = Schema.Struct({
  products: Schema.Array(Product),
  routines: Schema.Array(Routine),
  doses: Schema.Array(Dose),
})
export type ImportSnapshot = typeof ImportSnapshot.Type

export const ProductDraft = Schema.Struct({
  maybeProductId: Schema.Option(Schema.String),
  wizardStep: Schema.Number,
  name: Schema.String,
  strength: Schema.String,
  kind: ProductKind,
  amount: Schema.String,
  area: Schema.String,
  note: Schema.String,
  defaultWaitMinutes: Schema.Number,
  asNeeded: Schema.Boolean,
  thumbnail: Schema.String,
})
export type ProductDraft = typeof ProductDraft.Type

export const RoutineDraft = Schema.Struct({
  maybeRoutineId: Schema.Option(Schema.String),
  name: Schema.String,
  scheduledTime: Schema.Option(Schema.String),
  isPaused: Schema.Boolean,
  steps: Schema.Array(Step),
  detail: Schema.String,
})
export type RoutineDraft = typeof RoutineDraft.Type

export const SavedState = Schema.Struct({
  version: Schema.Literal(1),
  products: Schema.Array(Product),
  routines: Schema.Array(Routine),
  doses: Schema.Array(Dose),
  activeRun: Schema.Option(Run),
  page: Page,
  settings: Settings,
})
export type SavedState = typeof SavedState.Type

export const StoredSavedState = Schema.Struct({
  version: Schema.Literal(1),
  products: Schema.Array(StoredProduct),
  routines: Schema.Array(StoredRoutine),
  doses: Schema.Array(Dose),
  activeRun: Schema.Option(Run),
  page: Page,
  settings: Settings,
})
export type StoredSavedState = typeof StoredSavedState.Type

export const StoredSavedStateJsonString = Schema.fromJsonString(
  Schema.toCodecJson(StoredSavedState),
)

export const hydrateProduct = (stored: StoredProduct): Product => ({
  ...stored,
  origin: stored.origin ?? Origin.Manual(),
  thumbnail: stored.thumbnail ?? '',
})

export const hydrateRoutine = (stored: StoredRoutine): Routine => ({
  ...stored,
  origin: stored.origin ?? Origin.Manual(),
  detail: stored.detail ?? '',
  reviewedAtMs: stored.reviewedAtMs ?? Option.none(),
})

export const hydrateSavedState = (stored: StoredSavedState): SavedState => ({
  ...stored,
  products: Array.map(stored.products, hydrateProduct),
  routines: Array.map(stored.routines, hydrateRoutine),
})

// CONSTANTS

export const MAX_DOSES = 1000
export const DEFAULT_SETTINGS: Settings = {
  soundOnWaitEnd: false,
  defaultWaitMinutes: 20,
}
export const EMPTY_SAVED: SavedState = {
  version: 1,
  products: [],
  routines: [],
  doses: [],
  activeRun: Option.none(),
  page: Page.Today(),
  settings: DEFAULT_SETTINGS,
}

// VERBS

export const verb = (kind: ProductKind): 'Apply' | 'Take' =>
  Match.value(kind).pipe(
    Match.withReturnType<'Apply' | 'Take'>(),
    Match.when('Cream', () => 'Apply'),
    Match.when('Ointment', () => 'Apply'),
    Match.when('Gel', () => 'Apply'),
    Match.when('Lotion', () => 'Apply'),
    Match.when('Spray', () => 'Apply'),
    Match.orElse(() => 'Take'),
  )

// DATE HELPERS (pure; no Date construction)

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const daysFromCivil = (y: number, m: number, d: number): number => {
  const yy = m <= 2 ? y - 1 : y
  const era = Math.floor(yy / 400)
  const yoe = yy - era * 400
  const mp = (m + 9) % 12
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

const civilFromDays = (z: number): [number, number, number] => {
  const zz = z + 719468
  const era = Math.floor(zz / 146097)
  const doe = zz - era * 146097
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1460) +
      Math.floor(doe / 36524) -
      Math.floor(doe / 146096)) /
      365,
  )
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  return [m <= 2 ? y + 1 : y, m, d]
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

export const dayKeyFromDate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

export const previousDayKey = (key: string): string => {
  const parts = key.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const [ny, nm, nd] = civilFromDays(daysFromCivil(y, m, d) - 1)
  return `${ny}-${pad2(nm)}-${pad2(nd)}`
}

export const formatLongDayKey = (key: string): string => {
  const parts = key.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const weekday = (daysFromCivil(y, m, d) + 4 + 7 * 1000) % 7
  return `${WEEKDAYS[weekday]} ${d} ${MONTHS[m - 1]}`
}

const hourMinuteFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  hourCycle: 'h23',
})

export const formatHourMinute = (atMs: number): string =>
  hourMinuteFormatter.format(atMs)

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
})

export const formatShortDate = (atMs: number): string =>
  shortDateFormatter.format(atMs)

export const formatDayHeader = (dayKey: string, todayKey: string): string => {
  if (dayKey === todayKey) {
    return 'Today'
  }
  if (dayKey === previousDayKey(todayKey)) {
    return 'Yesterday'
  }
  return formatLongDayKey(dayKey)
}

// TIME / COUNTDOWN

export const remainingMs = (waitEndsAtMs: number, nowMs: number): number =>
  Math.max(0, waitEndsAtMs - nowMs)

export const formatMmSs = (ms: number): string => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${pad2(minutes)}:${pad2(seconds)}`
}

export const sanitizeMinutes = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0
  }
  return Math.min(240, Math.max(0, Math.round(value)))
}

// LOOKUPS

export const productById = (
  products: ReadonlyArray<Product>,
  id: string,
): Option.Option<Product> =>
  Array.findFirst(products, product => product.id === id)

export const routineById = (
  routines: ReadonlyArray<Routine>,
  id: string,
): Option.Option<Routine> =>
  Array.findFirst(routines, routine => routine.id === id)

export const routineNeedsStep = (routine: Routine): boolean =>
  routine.steps.length === 0

// DAY PROGRESS

export const isStepCovered = (
  step: Step,
  routineId: string,
  doses: ReadonlyArray<Dose>,
  dayKey: string,
): boolean =>
  Array.some(
    doses,
    dose =>
      dose.dayKey === dayKey &&
      dose.productId === step.productId &&
      Option.exists(dose.routineId, id => id === routineId),
  )

export const coveredStepCount = (
  routine: Routine,
  doses: ReadonlyArray<Dose>,
  dayKey: string,
): number =>
  Array.reduce(routine.steps, 0, (count, step) =>
    isStepCovered(step, routine.id, doses, dayKey) ? count + 1 : count,
  )

export const isRoutineDoneToday = (
  routine: Routine,
  doses: ReadonlyArray<Dose>,
  dayKey: string,
): boolean =>
  routine.steps.length > 0 &&
  coveredStepCount(routine, doses, dayKey) === routine.steps.length

export const firstUncoveredStepIndex = (
  routine: Routine,
  doses: ReadonlyArray<Dose>,
  dayKey: string,
): Option.Option<number> =>
  pipe(
    routine.steps,
    Array.findFirstIndex(
      step => !isStepCovered(step, routine.id, doses, dayKey),
    ),
  )

export const progressDots = (
  routine: Routine,
  doses: ReadonlyArray<Dose>,
  dayKey: string,
): ReadonlyArray<boolean> =>
  Array.map(routine.steps, step =>
    isStepCovered(step, routine.id, doses, dayKey),
  )

export const buildRun = (
  routine: Routine,
  doses: ReadonlyArray<Dose>,
  dayKey: string,
  startedAtMs: number,
): Run => ({
  routineId: routine.id,
  dayKey,
  stepIndex: Option.getOrElse(
    firstUncoveredStepIndex(routine, doses, dayKey),
    () => routine.steps.length,
  ),
  startedAtMs,
  waitEndsAtMs: Option.none(),
})

export const isRunFinished = (run: Run, routine: Routine): boolean =>
  run.stepIndex >= routine.steps.length

// DUE ROUTINES

export const dueRoutines = (
  routines: ReadonlyArray<Routine>,
): { readonly due: ReadonlyArray<Routine>; readonly pausedCount: number } => {
  const visible = Array.filter(
    routines,
    routine => !routine.isPaused && !routineNeedsStep(routine),
  )
  const due = Array.sortWith(
    visible,
    routine =>
      Option.match(routine.scheduledTime, {
        onNone: () => '99:99',
        onSome: time => time,
      }),
    Order.String,
  )
  const pausedCount = Array.length(
    Array.filter(
      routines,
      routine => routine.isPaused && !routineNeedsStep(routine),
    ),
  )
  return { due, pausedCount }
}

export const isLaterThanUsual = (routine: Routine, nowMs: number): boolean =>
  Option.match(routine.scheduledTime, {
    onNone: () => false,
    onSome: time => time < formatHourMinute(nowMs),
  })

// DOSES

export const appendDose = (
  doses: ReadonlyArray<Dose>,
  dose: Dose,
): ReadonlyArray<Dose> => {
  const next = [...doses, dose]
  if (next.length <= MAX_DOSES) {
    return next
  }
  return Array.sortWith(next, d => d.atMs, Order.Number).slice(
    next.length - MAX_DOSES,
  )
}

export type DaySection =
  | {
      readonly _tag: 'routine'
      readonly routineId: string
      readonly title: string
      readonly doses: ReadonlyArray<Dose>
    }
  | { readonly _tag: 'asNeeded'; readonly doses: ReadonlyArray<Dose> }

export type DayGroup = {
  readonly dayKey: string
  readonly sections: ReadonlyArray<DaySection>
}

export const groupDosesByDay = (
  doses: ReadonlyArray<Dose>,
  routines: ReadonlyArray<Routine>,
): ReadonlyArray<DayGroup> => {
  const dayKeys = pipe(
    doses,
    Array.map(dose => dose.dayKey),
    Array.dedupe,
  )
  const sortedKeys = Array.sortWith(dayKeys, key => key, Order.String).reverse()

  return Array.map(sortedKeys, dayKey => {
    const dayDoses = Array.filter(doses, dose => dose.dayKey === dayKey)
    const sections = Array.reduce<Dose, ReadonlyArray<DaySection>>(
      dayDoses,
      [],
      (acc, dose) =>
        Option.match(dose.routineId, {
          onNone: () => appendToAsNeededSection(acc, dose),
          onSome: routineId =>
            appendToRoutineSection(acc, dose, routineId, routines),
        }),
    )
    return { dayKey, sections }
  })
}

const appendToAsNeededSection = (
  sections: ReadonlyArray<DaySection>,
  dose: Dose,
): ReadonlyArray<DaySection> => {
  const maybeIndex = Array.findFirstIndex(
    sections,
    section => section._tag === 'asNeeded',
  )
  return Option.match(maybeIndex, {
    onNone: () => [...sections, { _tag: 'asNeeded', doses: [dose] }],
    onSome: index => {
      const modified = Array.modify(sections, index, section => ({
        ...section,
        doses: [...section.doses, dose],
      }))
      return Option.getOrElse(modified, () => sections)
    },
  })
}

const appendToRoutineSection = (
  sections: ReadonlyArray<DaySection>,
  dose: Dose,
  routineId: string,
  routines: ReadonlyArray<Routine>,
): ReadonlyArray<DaySection> => {
  const existing = Array.findFirst(
    sections,
    section => section._tag === 'routine' && section.routineId === routineId,
  )
  if (Option.isSome(existing)) {
    return Array.map(sections, section =>
      section._tag === 'routine' && section.routineId === routineId
        ? { ...section, doses: [...section.doses, dose] }
        : section,
    )
  }
  const title = Option.getOrElse(
    pipe(
      routineById(routines, routineId),
      Option.map(routine => routine.name),
    ),
    () => 'Routine deleted',
  )
  return [...sections, { _tag: 'routine', routineId, title, doses: [dose] }]
}

// DRAFTS

export const productDraftFromProduct = (product: Product): ProductDraft => ({
  maybeProductId: Option.some(product.id),
  wizardStep: 0,
  name: product.name,
  strength: product.strength,
  kind: product.kind,
  amount: product.amount,
  area: product.area,
  note: product.note,
  defaultWaitMinutes: product.defaultWaitMinutes,
  asNeeded: product.asNeeded,
  thumbnail: product.thumbnail,
})

export const emptyProductDraft = (
  defaultWaitMinutes: number,
): ProductDraft => ({
  maybeProductId: Option.none(),
  wizardStep: 0,
  name: '',
  strength: '',
  kind: 'Cream',
  amount: '',
  area: '',
  note: '',
  defaultWaitMinutes,
  asNeeded: false,
  thumbnail: '',
})

export const productFromDraft = (
  draft: ProductDraft,
  id: string,
  origin: Origin,
): Product => ({
  id,
  name: draft.name.trim(),
  strength: draft.strength.trim(),
  kind: draft.kind,
  amount: draft.amount.trim(),
  area: draft.area.trim(),
  note: draft.note.trim(),
  defaultWaitMinutes: draft.defaultWaitMinutes,
  asNeeded: draft.asNeeded,
  origin,
  thumbnail: draft.thumbnail,
})

export const productDraftErrors = (
  draft: ProductDraft,
): ReadonlyArray<string> => {
  const errors: string[] = []
  if (StringTrimEmpty(draft.name)) {
    errors.push('Name is required')
  }
  if (draft.defaultWaitMinutes < 0 || draft.defaultWaitMinutes > 240) {
    errors.push('Wait must be 0–240 minutes')
  }
  return errors
}

const StringTrimEmpty = (value: string): boolean => value.trim().length === 0

/** The names people actually use, so the routine wizard never asks for a name first. */
export const ROUTINE_PRESETS: ReadonlyArray<{
  readonly name: string
  readonly time: string
}> = [
  { name: 'Morning', time: '07:30' },
  { name: 'Midday', time: '12:00' },
  { name: 'Evening', time: '18:00' },
  { name: 'Night', time: '21:30' },
  { name: 'After shower', time: '' },
  { name: 'Before bed', time: '22:30' },
]

/** Includes every preset time so a preset always shows as selected. */
export const ROUTINE_TIME_OPTIONS: ReadonlyArray<string> = [
  '',
  '07:30',
  '08:00',
  '12:00',
  '18:00',
  '21:30',
  '22:30',
]

export const routineDraftFromRoutine = (routine: Routine): RoutineDraft => ({
  maybeRoutineId: Option.some(routine.id),
  name: routine.name,
  scheduledTime: routine.scheduledTime,
  isPaused: routine.isPaused,
  steps: routine.steps,
  detail: routine.detail,
})

export const emptyRoutineDraft = (): RoutineDraft => ({
  maybeRoutineId: Option.none(),
  name: '',
  scheduledTime: Option.none(),
  isPaused: false,
  steps: [],
  detail: '',
})

export const routineFromDraft = (
  draft: RoutineDraft,
  id: string,
  origin: Origin,
  maybeReviewedAtMs: Option.Option<number>,
): Routine => ({
  id,
  name: draft.name.trim(),
  scheduledTime: draft.scheduledTime,
  isPaused: draft.isPaused,
  steps: draft.steps,
  origin,
  detail: draft.detail,
  reviewedAtMs: maybeReviewedAtMs,
})

export const routineDraftErrors = (
  draft: RoutineDraft,
): ReadonlyArray<string> => {
  const errors: string[] = []
  if (StringTrimEmpty(draft.name)) {
    errors.push('Name is required')
  }
  if (draft.steps.length === 0) {
    errors.push('Add at least one step')
  }
  return errors
}

export const moveStep = (
  steps: ReadonlyArray<Step>,
  index: number,
  direction: -1 | 1,
): ReadonlyArray<Step> => {
  const target = index + direction
  if (target < 0 || target >= steps.length) {
    return steps
  }
  return Array.map(steps, (step, i) => {
    if (i === index) {
      return steps[target]!
    }
    if (i === target) {
      return steps[index]!
    }
    return step
  })
}

export const removeStepAt = (
  steps: ReadonlyArray<Step>,
  index: number,
): ReadonlyArray<Step> => Array.filter(steps, (_, i) => i !== index)

export const updateStepWait = (
  steps: ReadonlyArray<Step>,
  index: number,
  waitMinutes: number,
): ReadonlyArray<Step> =>
  Array.map(steps, (step, i) =>
    i === index ? { ...step, waitMinutes: sanitizeMinutes(waitMinutes) } : step,
  )

// PLAN (ChatGPT round-trip)

export const PLAN_SCHEMA = 'medstack.plan/1'

export const PlanProduct = Schema.Struct({
  name: Schema.String,
  strength: Schema.optionalKey(Schema.String),
  form: Schema.optionalKey(Schema.String),
  amount: Schema.optionalKey(Schema.String),
  site: Schema.optionalKey(Schema.String),
  note: Schema.optionalKey(Schema.String),
  waitMinutes: Schema.optionalKey(Schema.Number),
  asNeeded: Schema.optionalKey(Schema.Boolean),
})
export type PlanProduct = typeof PlanProduct.Type

export const PlanStep = Schema.Struct({
  productName: Schema.String,
  waitMinutes: Schema.optionalKey(Schema.Number),
})
export type PlanStep = typeof PlanStep.Type

export const PlanRoutine = Schema.Struct({
  name: Schema.String,
  time: Schema.optionalKey(Schema.String),
  detail: Schema.optionalKey(Schema.String),
  steps: Schema.Array(PlanStep),
})
export type PlanRoutine = typeof PlanRoutine.Type

export const PRODUCT_WIZARD_LAST_STEP = 6

export const Plan = Schema.Struct({
  schema: Schema.Literal(PLAN_SCHEMA),
  createdAt: Schema.optionalKey(Schema.String),
  products: Schema.Array(PlanProduct),
  routines: Schema.Array(PlanRoutine),
  pharmacistQuestions: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type Plan = typeof Plan.Type

const PlanJsonString = Schema.fromJsonString(Schema.toCodecJson(Plan))

const JSON_FENCE = /```(?:json)?\r?\n?([\s\S]*?)```/

const sliceBraces = (text: string): Option.Option<string> => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) {
    return Option.none()
  }
  return Option.some(text.slice(start, end + 1))
}

export const planFromText = (text: string): Option.Option<Plan> => {
  const fenced = JSON_FENCE.exec(text)
  const maybeJson =
    fenced !== null && fenced[1] !== undefined && fenced[1].trim() !== ''
      ? Option.some(fenced[1].trim())
      : sliceBraces(text)
  return Option.flatMap(maybeJson, json =>
    Schema.decodeOption(PlanJsonString)(json),
  )
}

export const kindFromForm = (form: string): ProductKind => {
  const value = form.trim().toLowerCase()
  if (value === 'cream') {
    return 'Cream'
  }
  if (value === 'ointment') {
    return 'Ointment'
  }
  if (value === 'gel') {
    return 'Gel'
  }
  if (value === 'lotion') {
    return 'Lotion'
  }
  if (value === 'drops' || value === 'solution') {
    return 'Drops'
  }
  if (value === 'spray' || value === 'foam') {
    return 'Spray'
  }
  if (value === 'tablet') {
    return 'Tablet'
  }
  if (value === 'capsule') {
    return 'Capsule'
  }
  if (value === 'syrup') {
    return 'Syrup'
  }
  return 'Other'
}

export const PlanScope = Schema.Literals(['one', 'many'])
export type PlanScope = typeof PlanScope.Type

export const PlanPhotoSource = Schema.Literals(['camera', 'library'])
export type PlanPhotoSource = typeof PlanPhotoSource.Type

const scopeLine = (scope: PlanScope): string =>
  scope === 'one' ? 'one plan' : 'more than one plan, one label block per plan'

const scopeRule = (scope: PlanScope): string =>
  scope === 'one'
    ? '6. This is one plan. Put it into one routine per time of day, never one routine per product.'
    : '6. These are separate plans. Give each plan its own routine, named after that plan, and never merge steps from two plans into one routine, even when the product is the same.'

export const planPrompt = (
  medicine: string,
  labelText: string,
  scope: PlanScope,
): string =>
  [
    'You are filling in a routine tracker for one person. Do not diagnose and do not change any dose.',
    '',
    'Patient input',
    `Medicine: ${medicine === '' ? '(not given)' : medicine}`,
    `What the doctor gave me: ${scopeLine(scope)}`,
    'Label or instructions, copied exactly, one block per label:',
    labelText === '' ? '(not given)' : labelText,
    '',
    'Rules',
    '1. Use only what is on the label or in the instructions above. If something is missing, leave it out and add the question to pharmacistQuestions. Never guess a dose, a strength, or a wait.',
    '2. One product per entry. Never put two products in one step.',
    '3. Only give a wait when the label or the instructions say one. Otherwise use 0.',
    '4. Order steps only where the order matters (same skin, same moment). Do not invent an order.',
    '5. Output exactly one ```json block and nothing else. No prose before or after it.',
    scopeRule(scope),
    '',
    `Shape (schema ${PLAN_SCHEMA}):`,
    '{',
    `  "schema": "${PLAN_SCHEMA}",`,
    '  "createdAt": "2026-11-10T21:00:00Z",',
    '  "products": [',
    '    { "name": "Hydrocortisone", "strength": "0.05%", "form": "cream",',
    '      "amount": "thin layer", "site": "inner elbows", "note": "not on the face",',
    '      "waitMinutes": 20, "asNeeded": false }',
    '  ],',
    '  "routines": [',
    '    { "name": "Night", "time": "21:30", "detail": "on an empty stomach",',
    '      "steps": [ { "productName": "Hydrocortisone", "waitMinutes": 20 } ] }',
    '  ],',
    '  "pharmacistQuestions": ["How long should the steroid stay on?"]',
    '}',
    '',
    'form is one of: cream, ointment, gel, lotion, drops, spray, tablet, capsule, syrup, other.',
    'time is 24h HH:MM, or leave it out for "any time".',
    'waitMinutes is a whole number from 0 to 240.',
  ].join('\n')

export const PlanImportPreview = Schema.Struct({
  products: Schema.Array(Product),
  routines: Schema.Array(Routine),
  questions: Schema.Array(Schema.String),
})
export type PlanImport = typeof PlanImportPreview.Type

const planOrigin = (plan: Plan, capturedAtMs: number): Origin => {
  const title =
    plan.createdAt !== undefined && plan.createdAt !== ''
      ? `Plan from ${plan.createdAt.slice(0, 10)}`
      : 'Plan from ChatGPT'
  return Origin.Plan({
    planId: plan.createdAt ?? 'plan',
    planTitle: title,
    modelLabel: 'chatgpt',
    capturedAtMs,
  })
}

const routineTimeFromPlan = (
  time: string | undefined,
): Option.Option<string> =>
  time !== undefined && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ? Option.some(time)
    : Option.none()

export const planImportFromPlan = (
  plan: Plan,
  makeId: () => string,
  capturedAtMs: number,
): PlanImport => {
  const origin = planOrigin(plan, capturedAtMs)
  const products = Array.map(plan.products, entry => {
    const waitMinutes = sanitizeMinutes(entry.waitMinutes ?? 0)
    const asNeeded = entry.asNeeded === true
    return {
      id: makeId(),
      name: entry.name.trim(),
      strength: (entry.strength ?? '').trim(),
      kind: kindFromForm(entry.form ?? ''),
      amount: (entry.amount ?? '').trim(),
      area: (entry.site ?? '').trim(),
      note: (entry.note ?? '').trim(),
      defaultWaitMinutes: asNeeded ? 0 : waitMinutes,
      asNeeded,
      origin,
      thumbnail: '',
    }
  })

  const idByName = Array.reduce(
    products,
    new Map<string, string>(),
    (index, product) => {
      const key = product.name.toLowerCase()
      if (!index.has(key)) {
        index.set(key, product.id)
      }
      return index
    },
  )

  const routines = Array.flatMap(plan.routines, entry => {
    const name = entry.name.trim()
    const steps = Array.flatMap(entry.steps, step => {
      const productId = idByName.get(step.productName.trim().toLowerCase())
      return productId === undefined
        ? []
        : [{ productId, waitMinutes: sanitizeMinutes(step.waitMinutes ?? 0) }]
    })
    if (name === '' || steps.length === 0) {
      return []
    }
    return [
      {
        id: makeId(),
        name,
        scheduledTime: routineTimeFromPlan(entry.time),
        isPaused: false,
        steps,
        origin,
        detail: (entry.detail ?? '').slice(0, 120),
        reviewedAtMs: Option.none(),
      },
    ]
  })

  return {
    products,
    routines,
    questions: Array.map(plan.pharmacistQuestions ?? [], question =>
      question.trim(),
    ),
  }
}

export type PlanMerge = {
  readonly products: ReadonlyArray<Product>
  readonly routines: ReadonlyArray<Routine>
  readonly addedProducts: number
  readonly addedRoutines: number
}

export const mergePlanImport = (
  products: ReadonlyArray<Product>,
  routines: ReadonlyArray<Routine>,
  imported: PlanImport,
): PlanMerge => {
  const existingByName = Array.reduce(
    products,
    new Map<string, Product>(),
    (index, product) => {
      const key = product.name.trim().toLowerCase()
      if (!index.has(key)) {
        index.set(key, product)
      }
      return index
    },
  )
  const idRemap = Array.reduce(
    imported.products,
    new Map<string, string>(),
    (index, product) => {
      const existing = existingByName.get(product.name.trim().toLowerCase())
      index.set(product.id, existing === undefined ? product.id : existing.id)
      return index
    },
  )
  const newProducts = Array.filter(
    imported.products,
    product => !existingByName.has(product.name.trim().toLowerCase()),
  )
  const existingRoutineNames = Array.reduce(
    routines,
    new Set<string>(),
    (names, routine) => {
      names.add(routine.name.trim().toLowerCase())
      return names
    },
  )
  const newRoutines = Array.filter(
    imported.routines,
    routine =>
      routine.steps.length > 0 &&
      !existingRoutineNames.has(routine.name.trim().toLowerCase()),
  ).map(routine => ({
    ...routine,
    steps: Array.flatMap(routine.steps, step => {
      const productId = idRemap.get(step.productId)
      return productId === undefined ? [] : [{ ...step, productId }]
    }),
  }))

  return {
    products: [...products, ...newProducts],
    routines: [
      ...routines,
      ...Array.filter(newRoutines, routine => routine.steps.length > 0),
    ],
    addedProducts: newProducts.length,
    addedRoutines: Array.length(
      Array.filter(newRoutines, routine => routine.steps.length > 0),
    ),
  }
}

// LABEL TEXT

const LABEL_NOISE =
  /^(ndc|lot|exp|mfd|ref|rx only|net wt|distributed|manufactured|store|keep out)\b/i

export const labelNameFromText = (text: string): string => {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length >= 3)
  const lettered = Array.filter(
    lines,
    line => !LABEL_NOISE.test(line) && line.replace(/[^a-z]/gi, '').length >= 3,
  )
  const strong = Array.findFirst(lettered, line => line.length >= 8)
  const chosen = Option.orElse(strong, () => Array.head(lettered))
  return Option.match(chosen, {
    onNone: () => '',
    onSome: line =>
      line
        .replace(/^[^a-z0-9]+/i, '')
        .slice(0, 80)
        .trim(),
  })
}
