import { Effect, Option, Schema } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import {
  ApplyStep,
  ConfirmKind,
  CopyPlanPrompt,
  DEFAULT_SETTINGS,
  DecodeImport,
  GenerateProductId,
  GenerateRoutineId,
  LogAsNeeded,
  Message,
  type Model,
  Origin,
  Page,
  PlayWaitEndSound,
  ReadClock,
  ReadDayKey,
  SaveState,
  type SavedState,
  SavedStateJsonString,
  SkipStep,
  StartRun,
  StoredSavedStateJsonString,
  baseModel,
  hydrateSavedState,
  labelNameFromText,
  mergePlanImport,
  planFromText,
  planImportFromPlan,
  planPrompt,
  update,
  verb,
} from './main'

const modelWith = (patch: Partial<Model> = {}): Model => ({
  ...baseModel(),
  ...patch,
})

const draftStep = (m: Model): number =>
  Option.getOrElse(
    Option.map(m.maybeProductDraft, draft => draft.wizardStep),
    () => -1,
  )

const draftSteps = (
  m: Model,
): ReadonlyArray<{
  readonly productId: string
  readonly waitMinutes: number
}> =>
  Option.match(m.maybeRoutineDraft, {
    onNone: () => [],
    onSome: draft => draft.steps,
  })

const runStepIndex = (m: Model): number =>
  Option.getOrElse(
    Option.map(m.activeRun, run => run.stepIndex),
    () => -1,
  )

const runDayKey = (m: Model): string =>
  Option.getOrElse(
    Option.map(m.activeRun, run => run.dayKey),
    () => '',
  )

const runWaitEnds = (m: Model): Option.Option<number> =>
  Option.getOrElse(
    Option.map(m.activeRun, run => run.waitEndsAtMs),
    () => Option.none(),
  )

const importFirstProductId = (m: Model): string =>
  Option.getOrElse(
    Option.map(
      m.maybeImportSnapshot,
      snapshot => snapshot.products[0]?.id ?? '',
    ),
    () => '',
  )

const confirmTag = (m: Model): string =>
  Option.getOrElse(
    Option.map(m.maybeConfirm, confirm => confirm._tag),
    () => '',
  )

const product = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `P${id}`,
  strength: '',
  kind: 'Cream' as const,
  amount: 'thin layer',
  area: '',
  note: '',
  defaultWaitMinutes: 20,
  asNeeded: false,
  origin: Origin.Manual(),
  thumbnail: '',
  ...over,
})

const routine = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `R${id}`,
  scheduledTime: Option.none(),
  isPaused: false,
  steps: [],
  origin: Origin.Manual(),
  detail: '',
  reviewedAtMs: Option.none(),
  ...over,
})

const dose = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  productId: 'a',
  routineId: Option.some('r1'),
  dayKey: '2024-01-01',
  atMs: 1000,
  outcome: 'applied' as const,
  ...over,
})

const productDraft = (over: Record<string, unknown> = {}) => ({
  maybeProductId: Option.none(),
  wizardStep: 0,
  name: '',
  strength: '',
  kind: 'Cream' as const,
  amount: '',
  area: '',
  note: '',
  defaultWaitMinutes: 20,
  asNeeded: false,
  thumbnail: '',
  ...over,
})

const routineDraft = (over: Record<string, unknown> = {}) => ({
  maybeRoutineId: Option.none(),
  name: '',
  scheduledTime: Option.none(),
  isPaused: false,
  steps: [],
  detail: '',
  ...over,
})

describe('update', () => {
  describe('products', () => {
    test('adds a new product and saves it', () => {
      const inputModel = modelWith({
        page: Page.ProductEditor({ productId: Option.none() }),
        maybeProductDraft: Option.some(productDraft({ name: 'Clobetasol' })),
      })
      story(
        update,
        given(inputModel),
        message(Message.SubmittedProduct()),
        Command.expectHas(GenerateProductId),
        Command.resolve(
          GenerateProductId,
          Message.CompletedGenerateProductId({ id: 'p1' }),
        ),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.products).toHaveLength(1)
          expect(next.products[0]?.name).toBe('Clobetasol')
          expect(next.products[0]?.origin).toStrictEqual(Origin.Manual())
          expect(next.page).toStrictEqual(Page.Products())
        }),
      )
    })

    test('rejects empty name without saving', () => {
      const inputModel = modelWith({
        maybeProductDraft: Option.some(productDraft()),
      })
      story(
        update,
        given(inputModel),
        message(Message.SubmittedProduct()),
        Command.expectNone(),
        model(next => {
          expect(next.products).toHaveLength(0)
        }),
      )
    })

    test('rejects wait out of range without saving', () => {
      const inputModel = modelWith({
        maybeProductDraft: Option.some(
          productDraft({ name: 'A', defaultWaitMinutes: 300 }),
        ),
      })
      story(
        update,
        given(inputModel),
        message(Message.SubmittedProduct()),
        Command.expectNone(),
      )
    })

    test('editing preserves an imported origin', () => {
      const planProduct = product('p1', {
        origin: Origin.Plan({
          planId: 'plan1',
          planTitle: 'Plan',
          modelLabel: 'claude',
          capturedAtMs: 5,
        }),
      })
      const inputModel = modelWith({ products: [planProduct] })
      story(
        update,
        given(inputModel),
        message(Message.ClickedEditProduct({ productId: 'p1' })),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        message(Message.UpdatedProductName({ value: 'Renamed' })),
        message(Message.SubmittedProduct()),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          const updated = next.products[0]!
          expect(updated.name).toBe('Renamed')
          expect(updated.origin).toStrictEqual(planProduct.origin)
        }),
      )
    })

    test('deleting a product removes it from routine steps and drops a run on it', () => {
      const routineWithStep = routine('r1', {
        steps: [{ productId: 'p1', waitMinutes: 20 }],
      })
      const inputModel = modelWith({
        products: [product('p1')],
        routines: [routineWithStep],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.none(),
        }),
      })
      story(
        update,
        given(inputModel),
        message(Message.ConfirmedDeleteProduct({ productId: 'p1' })),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.products).toHaveLength(0)
          expect(next.routines[0]?.steps).toHaveLength(0)
          expect(next.activeRun).toStrictEqual(Option.none())
        }),
      )
    })
  })

  describe('routines', () => {
    test('creates a routine with steps and saves', () => {
      const inputModel = modelWith({
        products: [product('p1')],
        page: Page.RoutineEditor({ routineId: Option.none() }),
        maybeRoutineDraft: Option.some(
          routineDraft({
            name: 'Night',
            steps: [{ productId: 'p1', waitMinutes: 20 }],
          }),
        ),
      })
      story(
        update,
        given(inputModel),
        message(Message.SubmittedRoutine()),
        Command.expectHas(GenerateRoutineId),
        Command.resolve(
          GenerateRoutineId,
          Message.CompletedGenerateRoutineId({ id: 'r1' }),
        ),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.routines).toHaveLength(1)
          expect(next.routines[0]?.origin).toStrictEqual(Origin.Manual())
          expect(next.routines[0]?.detail).toBe('')
          expect(next.routines[0]?.reviewedAtMs).toStrictEqual(Option.none())
        }),
      )
    })

    test('rejects a routine with no name', () => {
      const inputModel = modelWith({
        maybeRoutineDraft: Option.some(routineDraft()),
      })
      story(
        update,
        given(inputModel),
        message(Message.SubmittedRoutine()),
        Command.expectNone(),
      )
    })

    test('rejects a routine with no steps', () => {
      const inputModel = modelWith({
        maybeRoutineDraft: Option.some(routineDraft({ name: 'Night' })),
      })
      story(
        update,
        given(inputModel),
        message(Message.SubmittedRoutine()),
        Command.expectNone(),
      )
    })

    test('move up is a no-op on the first step', () => {
      const inputModel = modelWith({
        maybeRoutineDraft: Option.some(
          routineDraft({
            steps: [
              { productId: 'a', waitMinutes: 1 },
              { productId: 'b', waitMinutes: 2 },
            ],
          }),
        ),
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedMoveStepUp({ stepIndex: 0 })),
        Command.expectNone(),
        model(next => {
          const steps = draftSteps(next)
          expect(steps[0]?.productId).toBe('a')
        }),
      )
    })

    test('move up swaps with the previous step', () => {
      const inputModel = modelWith({
        maybeRoutineDraft: Option.some(
          routineDraft({
            steps: [
              { productId: 'a', waitMinutes: 1 },
              { productId: 'b', waitMinutes: 2 },
            ],
          }),
        ),
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedMoveStepUp({ stepIndex: 1 })),
        Command.expectNone(),
        model(next => {
          const steps = draftSteps(next)
          expect(steps[0]?.productId).toBe('b')
          expect(steps[1]?.productId).toBe('a')
        }),
      )
    })

    test('move down is a no-op on the last step', () => {
      const inputModel = modelWith({
        maybeRoutineDraft: Option.some(
          routineDraft({
            steps: [
              { productId: 'a', waitMinutes: 1 },
              { productId: 'b', waitMinutes: 2 },
            ],
          }),
        ),
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedMoveStepDown({ stepIndex: 1 })),
        Command.expectNone(),
      )
    })

    test('removes a step', () => {
      const inputModel = modelWith({
        maybeRoutineDraft: Option.some(
          routineDraft({
            steps: [
              { productId: 'a', waitMinutes: 1 },
              { productId: 'b', waitMinutes: 2 },
            ],
          }),
        ),
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedRemoveStep({ stepIndex: 0 })),
        Command.expectNone(),
        model(next => {
          expect(draftSteps(next)).toHaveLength(1)
        }),
      )
    })

    test('add step uses product default wait and closes the picker', () => {
      const inputModel = modelWith({
        products: [product('p1', { defaultWaitMinutes: 5 })],
        maybeRoutineDraft: Option.some(routineDraft()),
        stepPickerDialog: {
          ...baseModel().stepPickerDialog,
          isOpen: true,
        },
      })
      story(
        update,
        given(inputModel),
        message(Message.SelectedStepProduct({ productId: 'p1' })),
        Command.expectNone(),
        model(next => {
          expect(draftSteps(next)).toStrictEqual([
            { productId: 'p1', waitMinutes: 5 },
          ])
          expect(next.stepPickerDialog.isOpen).toBe(false)
        }),
      )
    })

    test('sanitizes step wait to 0–240', () => {
      const inputModel = modelWith({
        maybeRoutineDraft: Option.some(
          routineDraft({
            steps: [{ productId: 'a', waitMinutes: 1 }],
          }),
        ),
      })
      story(
        update,
        given(inputModel),
        message(Message.UpdatedStepWait({ stepIndex: 0, minutes: 999 })),
        Command.expectNone(),
        model(next => {
          expect(draftSteps(next)[0]?.waitMinutes).toBe(240)
        }),
      )
    })

    test('reset step wait restores product default', () => {
      const inputModel = modelWith({
        products: [product('p1', { defaultWaitMinutes: 20 })],
        maybeRoutineDraft: Option.some(
          routineDraft({
            steps: [{ productId: 'p1', waitMinutes: 2 }],
          }),
        ),
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedResetStepWait({ stepIndex: 0 })),
        Command.expectNone(),
        model(next => {
          expect(draftSteps(next)[0]?.waitMinutes).toBe(20)
        }),
      )
    })

    test('deleting a routine drops its active run and keeps doses', () => {
      const inputModel = modelWith({
        routines: [routine('r1')],
        doses: [dose('d1')],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.none(),
        }),
      })
      story(
        update,
        given(inputModel),
        message(Message.ConfirmedDeleteRoutine({ routineId: 'r1' })),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.routines).toHaveLength(0)
          expect(next.activeRun).toStrictEqual(Option.none())
          expect(next.doses).toHaveLength(1)
        }),
      )
    })
  })

  describe('run', () => {
    const twoStepRoutine = routine('r1', {
      steps: [
        { productId: 'p1', waitMinutes: 20 },
        { productId: 'p2', waitMinutes: 0 },
      ],
    })

    test('starting resumes at the first uncovered step', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        doses: [
          dose('d1', {
            productId: 'p1',
            routineId: Option.some('r1'),
            dayKey: '2024-01-01',
          }),
        ],
        todayKey: '2024-01-01',
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedStartRoutine({ routineId: 'r1' })),
        Command.expectExact(StartRun),
        Command.resolve(
          StartRun,
          Message.CompletedStartRun({ routineId: 'r1', nowMs: 5000 }),
        ),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(runStepIndex(next)).toBe(1)
          expect(runDayKey(next)).toBe('2024-01-01')
          expect(next.page).toStrictEqual(Page.Run())
        }),
      )
    })

    test('starting an already-covered routine opens finished', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        doses: [
          dose('d1', {
            productId: 'p1',
            routineId: Option.some('r1'),
            dayKey: '2024-01-01',
          }),
          dose('d2', {
            productId: 'p2',
            routineId: Option.some('r1'),
            dayKey: '2024-01-01',
          }),
        ],
        todayKey: '2024-01-01',
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedStartRoutine({ routineId: 'r1' })),
        Command.resolve(
          StartRun,
          Message.CompletedStartRun({ routineId: 'r1', nowMs: 5000 }),
        ),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(runStepIndex(next)).toBe(2)
        }),
      )
    })

    test('apply step with a wait sets waitEndsAtMs and keeps the step', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.none(),
        }),
        todayKey: '2024-01-01',
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedApplyStep()),
        Command.expectExact(ApplyStep),
        Command.resolve(
          ApplyStep,
          Message.CompletedApplyStep({ doseId: 'd1', atMs: 100000 }),
        ),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.doses).toHaveLength(1)
          expect(next.doses[0]?.outcome).toBe('applied')
          expect(next.doses[0]?.routineId).toStrictEqual(Option.some('r1'))
          expect(runStepIndex(next)).toBe(0)
          expect(runWaitEnds(next)).toStrictEqual(
            Option.some(100000 + 20 * 60000),
          )
        }),
      )
    })

    test('apply step with a zero wait advances immediately', () => {
      const zeroWaitRoutine = routine('r1', {
        steps: [
          { productId: 'p1', waitMinutes: 0 },
          { productId: 'p2', waitMinutes: 0 },
        ],
      })
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [zeroWaitRoutine],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.none(),
        }),
        todayKey: '2024-01-01',
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedApplyStep()),
        Command.resolve(
          ApplyStep,
          Message.CompletedApplyStep({ doseId: 'd1', atMs: 1000 }),
        ),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(runStepIndex(next)).toBe(1)
          expect(runWaitEnds(next)).toStrictEqual(Option.none())
        }),
      )
    })

    test('applying the last step finishes the run', () => {
      const inputModel = modelWith({
        products: [product('p1')],
        routines: [
          routine('r1', {
            steps: [{ productId: 'p1', waitMinutes: 20 }],
          }),
        ],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.none(),
        }),
        todayKey: '2024-01-01',
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedApplyStep()),
        Command.resolve(
          ApplyStep,
          Message.CompletedApplyStep({ doseId: 'd1', atMs: 1000 }),
        ),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(runStepIndex(next)).toBe(1)
          expect(runWaitEnds(next)).toStrictEqual(Option.none())
        }),
      )
    })

    test('skip dose logs a skipped dose and advances without a wait', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.none(),
        }),
        todayKey: '2024-01-01',
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedSkipStep()),
        Command.expectExact(SkipStep),
        Command.resolve(
          SkipStep,
          Message.CompletedSkipStep({ doseId: 'd1', atMs: 1000 }),
        ),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.doses[0]?.outcome).toBe('skipped')
          expect(runStepIndex(next)).toBe(1)
          expect(runWaitEnds(next)).toStrictEqual(Option.none())
        }),
      )
    })

    test('skip wait advances to the next step', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.some(100000),
        }),
        todayKey: '2024-01-01',
        nowMs: 50000,
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedSkipWait()),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(runStepIndex(next)).toBe(1)
          expect(runWaitEnds(next)).toStrictEqual(Option.none())
        }),
      )
    })

    test('next is ignored before zero', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.some(100000),
        }),
        todayKey: '2024-01-01',
        nowMs: 50000,
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedNext()),
        Command.expectNone(),
        model(next => {
          expect(runStepIndex(next)).toBe(0)
        }),
      )
    })

    test('next advances once zero is reached', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.some(100000),
        }),
        todayKey: '2024-01-01',
        nowMs: 100000,
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedNext()),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(runStepIndex(next)).toBe(1)
        }),
      )
    })

    test('tick before zero refreshes the clock without saving or advancing', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.some(100000),
        }),
        todayKey: '2024-01-01',
        nowMs: 50000,
      })
      story(
        update,
        given(inputModel),
        message(Message.Ticked()),
        Command.expectExact(ReadClock),
        Command.resolve(
          ReadClock,
          Message.CompletedReadClock({ nowMs: 60000 }),
        ),
        Command.expectNone(),
        model(next => {
          expect(next.nowMs).toBe(60000)
          expect(runStepIndex(next)).toBe(0)
          expect(runWaitEnds(next)).toStrictEqual(Option.some(100000))
        }),
      )
    })

    test('tick crossing zero emits the wait-end sound when enabled and never saves', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.some(100000),
        }),
        settings: { soundOnWaitEnd: true, defaultWaitMinutes: 20 },
        todayKey: '2024-01-01',
        nowMs: 50000,
      })
      story(
        update,
        given(inputModel),
        message(Message.Ticked()),
        Command.resolve(
          ReadClock,
          Message.CompletedReadClock({ nowMs: 100000 }),
        ),
        Command.expectHas(PlayWaitEndSound),
        Command.resolve(PlayWaitEndSound, Message.CompletedPlayWaitEndSound()),
        model(next => {
          expect(runStepIndex(next)).toBe(0)
        }),
      )
    })

    test('tick crossing zero is silent when sound is disabled', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.some(100000),
        }),
        settings: { soundOnWaitEnd: false, defaultWaitMinutes: 20 },
        todayKey: '2024-01-01',
        nowMs: 50000,
      })
      story(
        update,
        given(inputModel),
        message(Message.Ticked()),
        Command.resolve(
          ReadClock,
          Message.CompletedReadClock({ nowMs: 100000 }),
        ),
        Command.expectNone(),
      )
    })

    test('exiting the run keeps it resumable', () => {
      const inputModel = modelWith({
        products: [product('p1'), product('p2')],
        routines: [twoStepRoutine],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.none(),
        }),
        page: Page.Run(),
        todayKey: '2024-01-01',
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedExitRun()),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.page).toStrictEqual(Page.Today())
          expect(Option.isSome(next.activeRun)).toBe(true)
        }),
      )
    })
  })

  describe('as-needed', () => {
    test('logs an as-needed dose immediately', () => {
      const inputModel = modelWith({
        products: [product('p1', { asNeeded: true })],
        todayKey: '2024-01-01',
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedLogAsNeeded({ productId: 'p1' })),
        Command.expectExact(LogAsNeeded),
        Command.resolve(
          LogAsNeeded,
          Message.CompletedLogAsNeeded({
            productId: 'p1',
            doseId: 'd1',
            atMs: 2000,
          }),
        ),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.doses).toHaveLength(1)
          expect(next.doses[0]?.routineId).toStrictEqual(Option.none())
          expect(next.doses[0]?.dayKey).toBe('2024-01-01')
        }),
      )
    })

    test('ignores logging for non-as-needed products', () => {
      const inputModel = modelWith({
        products: [product('p1', { asNeeded: false })],
      })
      story(
        update,
        given(inputModel),
        message(Message.ClickedLogAsNeeded({ productId: 'p1' })),
        Command.expectNone(),
      )
    })
  })

  describe('import', () => {
    test('rejects malformed JSON and keeps current data', () => {
      const inputModel = modelWith({
        products: [product('p1')],
      })
      story(
        update,
        given(inputModel),
        message(Message.CompletedReadImportFile({ text: 'not json' })),
        Command.expectHas(DecodeImport),
        Command.resolve(DecodeImport, Message.FailedDecodeImport()),
        Command.expectNone(),
        model(next => {
          expect(next.products).toHaveLength(1)
          expect(next.maybeToast).not.toStrictEqual(Option.none())
        }),
      )
    })

    test('successful decode stages data and opens the confirm dialog', () => {
      const inputModel = modelWith({ products: [product('p1')] })
      story(
        update,
        given(inputModel),
        message(Message.CompletedReadImportFile({ text: '{}' })),
        Command.resolve(
          DecodeImport,
          Message.SucceededDecodeImport({
            products: [product('p9')],
            routines: [],
            doses: [],
          }),
        ),
        Command.expectNone(),
        model(next => {
          expect(importFirstProductId(next)).toBe('p9')
          expect(next.confirmDialog.isOpen).toBe(true)
          expect(confirmTag(next)).toBe('ImportReplace')
        }),
      )
    })

    test('confirming the import replaces data and saves', () => {
      const inputModel = modelWith({
        products: [product('p1')],
        maybeImportSnapshot: Option.some({
          products: [product('p9')],
          routines: [],
          doses: [],
        }),
        maybeConfirm: Option.some(ConfirmKind.ImportReplace()),
      })
      story(
        update,
        given(inputModel),
        message(Message.ConfirmedImport()),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.products[0]?.id).toBe('p9')
          expect(next.maybeImportSnapshot).toStrictEqual(Option.none())
        }),
      )
    })
  })

  describe('day rollover', () => {
    test('drops a stale run when the day changes and returns to Today', () => {
      const inputModel = modelWith({
        routines: [routine('r1')],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-01',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.none(),
        }),
        page: Page.Run(),
        todayKey: '2024-01-01',
      })
      story(
        update,
        given(inputModel),
        message(Message.CheckedDayKey()),
        Command.expectExact(ReadDayKey),
        Command.resolve(
          ReadDayKey,
          Message.CompletedReadDayKey({ dayKey: '2024-01-02' }),
        ),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.todayKey).toBe('2024-01-02')
          expect(next.activeRun).toStrictEqual(Option.none())
          expect(next.page._tag).toBe('Today')
        }),
      )
    })

    test('keeps a run that belongs to today', () => {
      const inputModel = modelWith({
        routines: [routine('r1')],
        activeRun: Option.some({
          routineId: 'r1',
          dayKey: '2024-01-02',
          stepIndex: 0,
          startedAtMs: 0,
          waitEndsAtMs: Option.none(),
        }),
        todayKey: '2024-01-01',
      })
      story(
        update,
        given(inputModel),
        message(Message.CheckedDayKey()),
        Command.resolve(
          ReadDayKey,
          Message.CompletedReadDayKey({ dayKey: '2024-01-02' }),
        ),
        Command.expectNone(),
        model(next => {
          expect(next.todayKey).toBe('2024-01-02')
          expect(Option.isSome(next.activeRun)).toBe(true)
        }),
      )
    })
  })

  describe('product wizard', () => {
    test('asks one question at a time and advances on Next', () => {
      story(
        update,
        given(modelWith({ maybeProductDraft: Option.some(productDraft()) })),
        message(Message.ClickedProductNext()),
        model(next => {
          expect(draftStep(next)).toBe(1)
        }),
        message(Message.ClickedProductBack()),
        model(next => {
          expect(draftStep(next)).toBe(0)
        }),
      )
    })

    test('picking a kind moves to the amount question', () => {
      story(
        update,
        given(
          modelWith({
            maybeProductDraft: Option.some(productDraft({ wizardStep: 1 })),
          }),
        ),
        message(Message.SelectedProductKind({ kind: 'Ointment' })),
        model(next => {
          expect(draftStep(next)).toBe(2)
          expect(next.maybeProductDraft).toStrictEqual(
            Option.some(
              expect.objectContaining({ kind: 'Ointment', wizardStep: 2 }),
            ),
          )
        }),
      )
    })

    test('the wizard stops back at the first step', () => {
      story(
        update,
        given(modelWith({ maybeProductDraft: Option.some(productDraft()) })),
        message(Message.ClickedProductBack()),
        model(next => {
          expect(draftStep(next)).toBe(0)
        }),
      )
    })
  })

  describe('label photo', () => {
    const draftModel = (draft: Record<string, unknown>) =>
      modelWith({
        page: Page.ProductEditor({ productId: Option.none() }),
        maybeProductDraft: Option.some(productDraft(draft)),
      })

    test('the read text fills an empty name', () => {
      story(
        update,
        given(draftModel({})),
        message(
          Message.CompletedLabelText({
            text: 'CLOBETASOL PROPIONATE\nCream 0.05%\nApply twice daily',
          }),
        ),
        model(next => {
          expect(Option.getOrThrow(next.maybeProductDraft).name).toBe(
            'CLOBETASOL PROPIONATE',
          )
          expect(next.labelStatus).toBe('idle')
        }),
      )
    })

    test('the read text never overwrites a typed name', () => {
      story(
        update,
        given(draftModel({ name: 'My cream' })),
        message(Message.CompletedLabelText({ text: 'CLOBETASOL PROPIONATE' })),
        model(next => {
          expect(Option.getOrThrow(next.maybeProductDraft).name).toBe(
            'My cream',
          )
        }),
      )
    })

    test('the thumbnail lands on the draft', () => {
      story(
        update,
        given(draftModel({})),
        message(
          Message.CompletedLabelThumbnail({
            thumbnail: 'data:image/webp;base64,AA',
          }),
        ),
        model(next => {
          expect(Option.getOrThrow(next.maybeProductDraft).thumbnail).toBe(
            'data:image/webp;base64,AA',
          )
        }),
      )
    })

    test('a failed read says so and keeps the form', () => {
      story(
        update,
        given(draftModel({ name: 'Clobetasol' })),
        message(Message.FailedLabelText()),
        model(next => {
          expect(next.labelStatus).toBe('failed')
          expect(next.maybeToast).toStrictEqual(
            Option.some('Could not read the label. Type the name.'),
          )
          expect(Option.getOrThrow(next.maybeProductDraft).name).toBe(
            'Clobetasol',
          )
        }),
      )
    })

    test('label text is reduced to a usable name', () => {
      expect(labelNameFromText('5%\n\nNDC 12345\nTacrolimus ointment')).toBe(
        'Tacrolimus ointment',
      )
      expect(labelNameFromText('0.05%\n20 g')).toBe('')
    })
  })

  describe('plan round-trip', () => {
    const planText = [
      'Here is the plan you asked for:',
      '```json',
      JSON.stringify({
        schema: 'medstack.plan/1',
        createdAt: '2026-11-10T13:00:00Z',
        products: [
          {
            name: 'Clobetasol propionate',
            strength: '0.05%',
            form: 'cream',
            amount: 'thin layer',
            site: 'inner elbows',
            waitMinutes: 20,
          },
          { name: 'Emollient', form: 'ointment', asNeeded: true },
        ],
        routines: [
          {
            name: 'Night',
            time: '21:30',
            detail: 'thin layer first',
            steps: [
              { productName: 'Clobetasol propionate', waitMinutes: 20 },
              { productName: 'Emollient', waitMinutes: 0 },
            ],
          },
          {
            name: 'Unknown product routine',
            steps: [{ productName: 'Not in the plan', waitMinutes: 0 }],
          },
        ],
        pharmacistQuestions: ['How long should the steroid stay on?'],
      }),
      '```',
      'Ask your pharmacist about the wait.',
    ].join('\n')

    test('the prompt carries the schema and the patient input', () => {
      const prompt = planPrompt('Clobetasol cream', 'Apply twice a day.')
      expect(prompt).toContain('medstack.plan/1')
      expect(prompt).toContain('Clobetasol cream')
      expect(prompt).toContain('Apply twice a day.')
      expect(prompt).toContain('Never guess')
      expect(prompt).toContain('pharmacistQuestions')
    })

    test('copying the prompt emits the clipboard command', () => {
      story(
        update,
        given(modelWith({ planMedicine: 'Clobetasol' })),
        message(Message.ClickedCopyPlanPrompt()),
        Command.expectExact(CopyPlanPrompt),
        Command.resolve(CopyPlanPrompt, Message.CompletedCopyPlanPrompt()),
        model(next => {
          expect(next.maybeToast).toStrictEqual(
            Option.some('Prompt copied. Paste it into ChatGPT.'),
          )
        }),
      )
    })

    test('a fenced plan parses and maps to products and routines', () => {
      const maybePlan = planFromText(planText)
      expect(Option.isSome(maybePlan)).toBe(true)
      const plan = Option.getOrElse(maybePlan, () => {
        throw new Error('expected a parsed plan')
      })
      let counter = 0
      const imported = planImportFromPlan(
        plan,
        () => {
          counter = counter + 1
          return `id-${counter}`
        },
        5000,
      )
      expect(imported.products.length).toBe(2)
      expect(imported.products[0]?.kind).toBe('Cream')
      expect(imported.products[0]?.defaultWaitMinutes).toBe(20)
      expect(imported.products[1]?.asNeeded).toBe(true)
      expect(imported.products[1]?.defaultWaitMinutes).toBe(0)
      expect(imported.routines.length).toBe(1)
      expect(imported.routines[0]?.scheduledTime).toStrictEqual(
        Option.some('21:30'),
      )
      expect(imported.routines[0]?.steps[0]?.productId).toBe(
        imported.products[0]?.id,
      )
      expect(imported.routines[0]?.origin._tag).toBe('Plan')
      expect(imported.questions).toStrictEqual([
        'How long should the steroid stay on?',
      ])
    })

    test('prose without a plan is rejected', () => {
      expect(Option.isNone(planFromText('Sure! Here are some tips.'))).toBe(
        true,
      )
      expect(
        Option.isNone(planFromText('```json\n{ "schema": "other/1" }\n```')),
      ).toBe(true)
    })

    test('merging keeps existing products and skips a routine already there', () => {
      let counter = 0
      const imported = planImportFromPlan(
        Option.getOrElse(planFromText(planText), () => {
          throw new Error('expected a parsed plan')
        }),
        () => {
          counter = counter + 1
          return `new-${counter}`
        },
        5000,
      )
      const existing = product('p1', { name: 'Clobetasol propionate' })
      const merged = mergePlanImport(
        [existing],
        [
          routine('r1', {
            name: 'Night',
            steps: [{ productId: 'p1', waitMinutes: 20 }],
          }),
        ],
        imported,
      )
      expect(merged.addedProducts).toBe(1)
      expect(merged.addedRoutines).toBe(0)
      expect(merged.products[0]?.id).toBe('p1')
    })

    test('a decoded plan opens the confirm and merges on confirm', () => {
      let counter = 0
      const imported = planImportFromPlan(
        Option.getOrElse(planFromText(planText), () => {
          throw new Error('expected a parsed plan')
        }),
        () => {
          counter = counter + 1
          return `new-${counter}`
        },
        5000,
      )
      story(
        update,
        given(modelWith()),
        message(Message.SucceededImportPlan(imported)),
        model(next => {
          expect(confirmTag(next)).toBe('PlanImport')
          expect(Option.isSome(next.maybePlanImport)).toBe(true)
        }),
        message(Message.ConfirmedPlanImport()),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.products.length).toBe(2)
          expect(next.routines.length).toBe(1)
          expect(next.page._tag).toBe('Today')
          expect(Option.isNone(next.maybePlanImport)).toBe(true)
        }),
      )
    })

    test('a malformed paste shows a toast and changes nothing', () => {
      story(
        update,
        given(modelWith()),
        message(
          Message.FailedImportPlan({ message: 'That is not a medstack plan.' }),
        ),
        model(next => {
          expect(next.maybeToast).toStrictEqual(
            Option.some('That is not a medstack plan.'),
          )
          expect(next.products).toStrictEqual([])
        }),
      )
    })
  })

  describe('settings and data', () => {
    test('toggling sound saves', () => {
      const inputModel = modelWith()
      story(
        update,
        given(inputModel),
        message(Message.ToggledSound({ isChecked: true })),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.settings.soundOnWaitEnd).toBe(true)
        }),
      )
    })

    test('clear history wipes doses only after confirm', () => {
      const inputModel = modelWith({ doses: [dose('d1')] })
      story(
        update,
        given(inputModel),
        message(Message.ConfirmedClearHistory()),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.doses).toHaveLength(0)
          expect(next.products).toHaveLength(0)
        }),
      )
    })

    test('delete everything requires typing delete', () => {
      const inputModel = modelWith({
        products: [product('p1')],
        deleteEverythingText: 'x',
      })
      story(
        update,
        given(inputModel),
        message(Message.ConfirmedDeleteEverything()),
        Command.expectNone(),
        model(next => {
          expect(next.products).toHaveLength(1)
        }),
      )
      const ready = modelWith({
        products: [product('p1')],
        deleteEverythingText: 'delete',
      })
      story(
        update,
        given(ready),
        message(Message.ConfirmedDeleteEverything()),
        Command.expectExact(SaveState),
        Command.resolve(SaveState, Message.SucceededSaveState()),
        model(next => {
          expect(next.products).toHaveLength(0)
          expect(next.page).toStrictEqual(Page.Today())
        }),
      )
    })
  })

  describe('verb', () => {
    test('applies for topicals and takes for the rest', () => {
      expect(verb('Cream')).toBe('Apply')
      expect(verb('Ointment')).toBe('Apply')
      expect(verb('Spray')).toBe('Apply')
      expect(verb('Tablet')).toBe('Take')
      expect(verb('Capsule')).toBe('Take')
      expect(verb('Syrup')).toBe('Take')
    })
  })
})

describe('persistence round-trips', () => {
  test('legacy stored JSON decodes with defaults and SaveState encodes them', async () => {
    const legacyJson = JSON.stringify({
      version: 1,
      products: [
        {
          id: 'a',
          name: 'A',
          strength: '',
          kind: 'Cream',
          amount: '',
          area: '',
          note: '',
          defaultWaitMinutes: 20,
          asNeeded: false,
        },
      ],
      routines: [
        {
          id: 'r',
          name: 'R',
          scheduledTime: { _tag: 'None' },
          isPaused: false,
          steps: [],
        },
      ],
      doses: [],
      activeRun: { _tag: 'None' },
      page: { _tag: 'Today' },
      settings: { soundOnWaitEnd: false, defaultWaitMinutes: 20 },
    })
    const decoded = await Effect.runPromise(
      Schema.decodeEffect(StoredSavedStateJsonString)(legacyJson),
    )
    const hydrated = hydrateSavedState(decoded)
    expect(hydrated.products[0]?.origin).toStrictEqual(Origin.Manual())
    expect(hydrated.routines[0]?.detail).toBe('')
    expect(hydrated.routines[0]?.reviewedAtMs).toStrictEqual(Option.none())
    const encoded = await Effect.runPromise(
      Schema.encodeEffect(SavedStateJsonString)(hydrated),
    )
    const parsed = JSON.parse(encoded)
    const parsedProducts: ReadonlyArray<Record<string, unknown>> =
      parsed.products
    const parsedRoutines: ReadonlyArray<Record<string, unknown>> =
      parsed.routines
    expect(parsedProducts[0]).toHaveProperty('origin')
    expect(parsedRoutines[0]).toHaveProperty('detail')
    expect(parsedRoutines[0]).toHaveProperty('reviewedAtMs')
  })

  test('export/import keeps origin and reviewedAtMs', async () => {
    const planRoutine = routine('r1', {
      origin: Origin.Plan({
        planId: 'plan1',
        planTitle: 'Plan',
        modelLabel: 'claude',
        capturedAtMs: 5,
      }),
      reviewedAtMs: Option.some(2),
    })
    const saved: SavedState = {
      version: 1,
      products: [product('a')],
      routines: [planRoutine],
      doses: [],
      activeRun: Option.none(),
      page: Page.Today(),
      settings: DEFAULT_SETTINGS,
    }
    const encoded = await Effect.runPromise(
      Schema.encodeEffect(SavedStateJsonString)(saved),
    )
    const decoded = hydrateSavedState(
      await Effect.runPromise(
        Schema.decodeEffect(StoredSavedStateJsonString)(encoded),
      ),
    )
    expect(decoded.routines[0]?.origin).toStrictEqual(planRoutine.origin)
    expect(decoded.routines[0]?.reviewedAtMs).toStrictEqual(Option.some(2))
  })
})
