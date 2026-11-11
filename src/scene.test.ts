import { Option } from 'effect'
import { expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { type Model, Origin, Page, baseModel, update, view } from './main'

const modelWith = (patch: Partial<Model>): Model => ({
  ...baseModel(),
  ...patch,
})

const product = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `P${id}`,
  strength: '',
  kind: 'Cream' as const,
  amount: 'thin layer',
  area: 'inner elbows',
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
  scheduledTime: Option.some('20:00'),
  isPaused: false,
  steps: [{ productId: 'a', waitMinutes: 20 }],
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

const emptyModel = modelWith({ todayKey: '2024-01-01' })

const startedRoutineModel = modelWith({
  products: [product('a')],
  routines: [routine('r1')],
  todayKey: '2024-01-01',
})

describe('view', () => {
  test('empty Today shows the setup panel', () => {
    scene(
      { update, view },
      given(emptyModel),
      expect(text('Add a product')).toExist(),
      expect(text('Create a routine')).toExist(),
      expect(role('button', { name: 'Get a plan from ChatGPT' })).toExist(),
    )
  })

  test('Today keeps the plan entry visible once routines exist', () => {
    scene(
      { update, view },
      given(startedRoutineModel),
      expect(role('button', { name: 'Get a plan from ChatGPT' })).toExist(),
    )
  })

  test('empty Today explains nothing is logged', () => {
    scene(
      { update, view },
      given(startedRoutineModel),
      expect(text('Nothing logged yet')).toExist(),
    )
  })

  test('a due routine card shows Start', () => {
    scene(
      { update, view },
      given(startedRoutineModel),
      expect(role('button', { name: 'Start' })).toExist(),
    )
  })

  test('a covered routine card shows Done', () => {
    const model = modelWith({
      products: [product('a')],
      routines: [routine('r1')],
      doses: [dose('d1', { productId: 'a', routineId: Option.some('r1') })],
      todayKey: '2024-01-01',
    })
    scene({ update, view }, given(model), expect(text('Done ✓')).toExist())
  })

  test('Run ready shows product name, amount, and the applied verb', () => {
    const model = modelWith({
      products: [product('a')],
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
      nowMs: 1000,
    })
    scene(
      { update, view },
      given(model),
      expect(text('Pa')).toExist(),
      expect(text('thin layer')).toExist(),
      expect(role('button', { name: 'Applied' })).toExist(),
      expect(role('button', { name: 'Skip' })).toExist(),
    )
  })

  test('Run waiting shows a countdown, disabled Next, and skip wait', () => {
    const model = modelWith({
      products: [product('a'), product('b')],
      routines: [
        routine('r1', {
          steps: [
            { productId: 'a', waitMinutes: 20 },
            { productId: 'b', waitMinutes: 0 },
          ],
        }),
      ],
      activeRun: Option.some({
        routineId: 'r1',
        dayKey: '2024-01-01',
        stepIndex: 0,
        startedAtMs: 0,
        waitEndsAtMs: Option.some(1200000),
      }),
      page: Page.Run(),
      todayKey: '2024-01-01',
      nowMs: 0,
    })
    scene(
      { update, view },
      given(model),
      expect(text('20:00')).toExist(),
      expect(text('Next: Pb')).toExist(),
      expect(role('button', { name: 'Skip wait' })).toExist(),
    )
  })

  test('Run waiting at zero says Ready', () => {
    const model = modelWith({
      products: [product('a'), product('b')],
      routines: [
        routine('r1', {
          steps: [
            { productId: 'a', waitMinutes: 20 },
            { productId: 'b', waitMinutes: 0 },
          ],
        }),
      ],
      activeRun: Option.some({
        routineId: 'r1',
        dayKey: '2024-01-01',
        stepIndex: 0,
        startedAtMs: 0,
        waitEndsAtMs: Option.some(100000),
      }),
      page: Page.Run(),
      todayKey: '2024-01-01',
      nowMs: 100000,
    })
    scene(
      { update, view },
      given(model),
      expect(text('Ready')).toExist(),
      expect(text('Ready for the next step.')).toExist(),
    )
  })

  test('Run finished shows the done line and back button', () => {
    const model = modelWith({
      products: [product('a')],
      routines: [routine('r1')],
      activeRun: Option.some({
        routineId: 'r1',
        dayKey: '2024-01-01',
        stepIndex: 1,
        startedAtMs: 0,
        waitEndsAtMs: Option.none(),
      }),
      page: Page.Run(),
      todayKey: '2024-01-01',
      nowMs: 1000,
    })
    scene(
      { update, view },
      given(model),
      expect(text('Done for today')).toExist(),
      expect(role('button', { name: 'Back to today' })).toExist(),
      expect(text('Done for today.')).toExist(),
    )
  })

  test('History groups two doses for one day under the Today heading', () => {
    const model = modelWith({
      products: [product('a')],
      routines: [routine('r1')],
      doses: [
        dose('d1', { productId: 'a', routineId: Option.some('r1') }),
        dose('d2', { productId: 'a', routineId: Option.some('r1') }),
      ],
      page: Page.History(),
      todayKey: '2024-01-01',
    })
    scene(
      { update, view },
      given(model),
      expect(text('Today')).toExist(),
      expect(text('Pa')).toExist(),
    )
  })

  test('product form shows Name is required inline', () => {
    const model = modelWith({
      page: Page.ProductEditor({ productId: Option.none() }),
      maybeProductDraft: Option.some({
        maybeProductId: Option.none(),
        wizardStep: 6,
        name: '',
        strength: '',
        kind: 'Cream' as const,
        amount: '',
        area: '',
        note: '',
        defaultWaitMinutes: 20,
        asNeeded: false,
        thumbnail: '',
      }),
    })
    scene(
      { update, view },
      given(model),
      expect(text('Name is required')).toExist(),
    )
  })

  test('the routine wizard asks when first, with fixed names', () => {
    const editorPage = Page.RoutineEditor({ routineId: Option.none() })
    scene(
      { update, view },
      given(
        modelWith({
          page: editorPage,
          maybeRoutineDraft: Option.some({
            maybeRoutineId: Option.none(),
            name: '',
            scheduledTime: Option.none(),
            isPaused: false,
            steps: [],
            detail: '',
          }),
        }),
      ),
      expect(text('Step 1 of 3')).toExist(),
      expect(text('When do you use it?')).toExist(),
      expect(role('button', { name: 'Morning' })).toExist(),
      expect(role('button', { name: 'Night' })).toExist(),
      expect(role('button', { name: 'Before bed' })).toExist(),
    )
  })

  test('the routine wizard puts products in order on step two', () => {
    scene(
      { update, view },
      given(
        modelWith({
          products: [product('a', { name: 'Clobetasol' })],
          page: Page.RoutineEditor({ routineId: Option.none() }),
          routineWizardStep: 1,
          maybeRoutineDraft: Option.some({
            maybeRoutineId: Option.none(),
            name: 'Night',
            scheduledTime: Option.some('21:30'),
            isPaused: false,
            steps: [],
            detail: '',
          }),
        }),
      ),
      expect(text('Which products, in what order?')).toExist(),
      expect(role('button', { name: /Clobetasol/ })).toExist(),
    )
  })

  test('the routine wizard review offers fixed times and saves', () => {
    scene(
      { update, view },
      given(
        modelWith({
          page: Page.RoutineEditor({ routineId: Option.none() }),
          routineWizardStep: 2,
          maybeRoutineDraft: Option.some({
            maybeRoutineId: Option.none(),
            name: 'Night',
            scheduledTime: Option.some('21:30'),
            isPaused: false,
            steps: [{ productId: 'a', waitMinutes: 20 }],
            detail: '',
          }),
        }),
      ),
      expect(role('button', { name: 'Any time' })).toExist(),
      expect(role('button', { name: '22:30' })).toExist(),
      expect(role('button', { name: 'Create routine' })).toExist(),
    )
  })

  test('routine editor shows plan origin line only for plan routines', () => {
    const planRoutine = routine('r1', {
      origin: Origin.Plan({
        planId: 'plan1',
        planTitle: 'Plan',
        modelLabel: 'claude',
        capturedAtMs: 5,
      }),
      reviewedAtMs: Option.none(),
    })
    const model = modelWith({
      routines: [planRoutine],
      page: Page.RoutineEditor({ routineId: Option.some('r1') }),
      routineWizardStep: 2,
      maybeRoutineDraft: Option.some({
        maybeRoutineId: Option.some('r1'),
        name: 'R1',
        scheduledTime: Option.some('20:00'),
        isPaused: false,
        steps: [{ productId: 'a', waitMinutes: 20 }],
        detail: '',
      }),
    })
    scene(
      { update, view },
      given(model),
      expect(text(/from plan/)).toExist(),
      expect(text(/not checked yet/)).toExist(),
    )

    const manualModel = modelWith({
      routines: [routine('r1')],
      page: Page.RoutineEditor({ routineId: Option.some('r1') }),
      routineWizardStep: 2,
      maybeRoutineDraft: Option.some({
        maybeRoutineId: Option.some('r1'),
        name: 'R1',
        scheduledTime: Option.some('20:00'),
        isPaused: false,
        steps: [{ productId: 'a', waitMinutes: 20 }],
        detail: '',
      }),
    })
    scene(
      { update, view },
      given(manualModel),
      expect(text(/from plan/)).toBeAbsent(),
    )
  })

  test('routine detail renders on the Run screen', () => {
    const longDetail = 'Take on an empty stomach, 30 min before food. '
      .repeat(4)
      .trim()
    const model = modelWith({
      products: [product('a')],
      routines: [
        routine('r1', {
          steps: [{ productId: 'a', waitMinutes: 20 }],
          detail: longDetail,
        }),
      ],
      activeRun: Option.some({
        routineId: 'r1',
        dayKey: '2024-01-01',
        stepIndex: 0,
        startedAtMs: 0,
        waitEndsAtMs: Option.none(),
      }),
      page: Page.Run(),
      todayKey: '2024-01-01',
      nowMs: 1000,
    })
    scene({ update, view }, given(model), expect(text(longDetail)).toExist())
  })

  test('Today hides a routine that has no steps', () => {
    const model = modelWith({
      products: [product('a')],
      routines: [routine('r1', { steps: [] })],
      todayKey: '2024-01-01',
    })
    scene(
      { update, view },
      given(model),
      expect(text('R1')).toBeAbsent(),
      expect(role('button', { name: 'Start' })).toBeAbsent(),
    )
  })

  test('Today hides the in-progress banner once the run is finished', () => {
    const model = modelWith({
      products: [product('a')],
      routines: [routine('r1')],
      activeRun: Option.some({
        routineId: 'r1',
        dayKey: '2024-01-01',
        stepIndex: 1,
        startedAtMs: 0,
        waitEndsAtMs: Option.none(),
      }),
      todayKey: '2024-01-01',
    })
    scene(
      { update, view },
      given(model),
      expect(text(/In progress/)).toBeAbsent(),
    )
  })

  test('the product wizard asks one question per screen', () => {
    const model = modelWith({
      page: Page.ProductEditor({ productId: Option.none() }),
      maybeProductDraft: Option.some({
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
      }),
    })
    scene(
      { update, view },
      given(model),
      expect(text('What is it?')).toExist(),
      expect(text('Step 1 of 7')).toExist(),
      expect(text('Take a photo of the label')).toExist(),
      expect(text('What kind is it?')).toBeAbsent(),
      expect(text('How much goes on?')).toBeAbsent(),
    )
  })

  test('every wizard chip grid labels its buttons', () => {
    const draftAt = (wizardStep: number) =>
      Option.some({
        maybeProductId: Option.none(),
        wizardStep,
        name: 'Clobetasol',
        strength: '',
        kind: 'Cream' as const,
        amount: '',
        area: '',
        note: '',
        defaultWaitMinutes: 20,
        asNeeded: false,
        thumbnail: '',
      })
    const editorPage = Page.ProductEditor({ productId: Option.none() })
    scene(
      { update, view },
      given(modelWith({ page: editorPage, maybeProductDraft: draftAt(1) })),
      expect(role('button', { name: 'Cream' })).toExist(),
      expect(role('button', { name: 'Ointment' })).toExist(),
      expect(text('What kind is it?')).toExist(),
    )
    scene(
      { update, view },
      given(modelWith({ page: editorPage, maybeProductDraft: draftAt(2) })),
      expect(role('button', { name: 'Thin layer' })).toExist(),
      expect(role('button', { name: '2 pumps' })).toExist(),
    )
    scene(
      { update, view },
      given(modelWith({ page: editorPage, maybeProductDraft: draftAt(4) })),
      expect(role('button', { name: '20 min' })).toExist(),
      expect(role('button', { name: '0 min' })).toExist(),
    )
  })

  test('the plan screen offers a prompt to copy and a paste step', () => {
    const model = modelWith({
      page: Page.Plan(),
      planStage: 'ask',
      planMedicine: 'Clobetasol',
    })
    scene(
      { update, view },
      given(model),
      expect(role('button', { name: 'Copy the prompt' })).toExist(),
      expect(role('button', { name: 'Take a photo of the label' })).toExist(),
      expect(text('What did the doctor give you?')).toExist(),
      expect(text('Copy what the label says')).toExist(),
      expect(text('Open ChatGPT')).toExist(),
      expect(role('button', { name: 'I have the answer' })).toExist(),
    )
  })

  test('the plan paste step accepts the answer', () => {
    const model = modelWith({
      page: Page.Plan(),
      planStage: 'paste',
    })
    scene(
      { update, view },
      given(model),
      expect(text('The answer')).toExist(),
      expect(role('button', { name: 'Import the plan' })).toExist(),
    )
  })

  test('bottom bar shows tabs and marks the active one', () => {
    scene(
      { update, view },
      given(startedRoutineModel),
      expect(role('button', { name: 'Today' })).toExist(),
      expect(role('button', { name: 'Routines' })).toExist(),
      expect(role('button', { name: 'Products' })).toExist(),
      expect(role('button', { name: 'History' })).toExist(),
    )
  })
})
