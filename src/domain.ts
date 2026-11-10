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
})
export type Page = typeof Page.Type

export const ConfirmKind = defineTaggedUnion({
  DeleteRoutine: { routineId: Schema.String },
  DeleteProduct: { productId: Schema.String },
  ImportReplace: {},
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
  name: Schema.String,
  strength: Schema.String,
  kind: ProductKind,
  amount: Schema.String,
  area: Schema.String,
  note: Schema.String,
  defaultWaitMinutes: Schema.Number,
  asNeeded: Schema.Boolean,
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
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) /
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
): Option.Option<Product> => Array.findFirst(products, product => product.id === id)

export const routineById = (
  routines: ReadonlyArray<Routine>,
  id: string,
): Option.Option<Routine> => Array.findFirst(routines, routine => routine.id === id)

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
  Array.reduce(
    routine.steps,
    0,
    (count, step) =>
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
    Array.findFirstIndex(step => !isStepCovered(step, routine.id, doses, dayKey)),
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
  stepIndex: Option.getOrElse(firstUncoveredStepIndex(routine, doses, dayKey), () =>
    routine.steps.length,
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
  const visible = Array.filter(routines, routine => !routine.isPaused)
  const due = Array.sortWith(
    visible,
    routine =>
      Option.match(routine.scheduledTime, {
        onNone: () => '99:99',
        onSome: time => time,
      }),
    Order.String,
  )
  const pausedCount = Array.length(Array.filter(routines, routine => routine.isPaused))
  return { due, pausedCount }
}

export const isLaterThanUsual = (
  routine: Routine,
  nowMs: number,
): boolean =>
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
  | { readonly _tag: 'routine'; readonly routineId: string; readonly title: string; readonly doses: ReadonlyArray<Dose> }
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
          onNone: () =>
            appendToAsNeededSection(acc, dose),
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
  const maybeIndex = Array.findFirstIndex(sections, section =>
    section._tag === 'asNeeded',
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
  const existing = Array.findFirst(sections, section =>
    section._tag === 'routine' && section.routineId === routineId,
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
  name: product.name,
  strength: product.strength,
  kind: product.kind,
  amount: product.amount,
  area: product.area,
  note: product.note,
  defaultWaitMinutes: product.defaultWaitMinutes,
  asNeeded: product.asNeeded,
})

export const emptyProductDraft = (defaultWaitMinutes: number): ProductDraft => ({
  maybeProductId: Option.none(),
  name: '',
  strength: '',
  kind: 'Cream',
  amount: '',
  area: '',
  note: '',
  defaultWaitMinutes,
  asNeeded: false,
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
})

export const productDraftErrors = (draft: ProductDraft): ReadonlyArray<string> => {
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
