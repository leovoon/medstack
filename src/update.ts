import { Array, Option, pipe } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Dialog } from '@foldkit/ui'

import {
  ApplyStep,
  CopyPlanPrompt,
  DecodeImport,
  ExportState,
  GenerateProductId,
  GenerateRoutineId,
  ImportPlan,
  LogAsNeeded,
  MakeLabelThumbnail,
  MarkRoutineReviewed,
  PlayWaitEndSound,
  ReadClock,
  ReadDayKey,
  ReadImportFile,
  ReadLabelPhotos,
  ReadLabelText,
  RequestWakeLock,
  SaveState,
  SelectImportFile,
  SelectLabelPhoto,
  SelectPlanPhotos,
  SkipStep,
  StartRun,
} from './command'
import {
  ConfirmKind,
  EMPTY_SAVED,
  Origin,
  PRODUCT_WIZARD_LAST_STEP,
  Page,
  type ProductDraft,
  type RoutineDraft,
  type SavedState,
  appendDose,
  buildRun,
  emptyProductDraft,
  emptyRoutineDraft,
  labelNameFromText,
  mergePlanImport,
  moveStep,
  planPrompt,
  productById,
  productDraftErrors,
  productDraftFromProduct,
  productFromDraft,
  remainingMs,
  removeStepAt,
  routineById,
  routineDraftErrors,
  routineDraftFromRoutine,
  routineFromDraft,
  sanitizeMinutes,
  updateStepWait,
} from './domain'
import { Message } from './message'
import { type Model, snapshotFromModel } from './model'
import { type Flags } from './storage'

type UpdateReturn = Update.Return<Model, Message>

const save = (model: Model): UpdateReturn => ({
  model,
  commands: [SaveState({ snapshot: snapshotFromModel(model) })],
})

const navigate = (model: Model, page: Page): UpdateReturn =>
  save(modifyFields(model, { page: () => page }))

/**
 * Photos queue up: each label lands under the last one, and nothing already typed or already
 * read is thrown away.
 */
const appendLabelText = (existing: string, text: string): string => {
  const trimmed = text.trim()
  if (trimmed === '' || existing.includes(trimmed)) {
    return existing
  }
  return existing.trim() === '' ? trimmed : `${existing.trim()}\n\n${trimmed}`
}

const appendMedicineName = (existing: string, text: string): string => {
  const name = labelNameFromText(text)
  if (name === '' || existing.toLowerCase().includes(name.toLowerCase())) {
    return existing
  }
  return existing.trim() === '' ? name : `${existing.trim()}, ${name}`
}

const updateProductDraft = (
  model: Model,
  f: (draft: ProductDraft) => ProductDraft,
): UpdateReturn =>
  Option.match(model.maybeProductDraft, {
    onNone: () => ({ model }),
    onSome: draft => ({
      model: modifyFields(model, {
        maybeProductDraft: () => Option.some(f(draft)),
      }),
    }),
  })

const updateRoutineDraft = (
  model: Model,
  f: (draft: RoutineDraft) => RoutineDraft,
): UpdateReturn =>
  Option.match(model.maybeRoutineDraft, {
    onNone: () => ({ model }),
    onSome: draft => ({
      model: modifyFields(model, {
        maybeRoutineDraft: () => Option.some(f(draft)),
      }),
    }),
  })

const openConfirm = (model: Model, confirm: ConfirmKind): Model =>
  modifyFields(model, {
    maybeConfirm: () => Option.some(confirm),
    deleteEverythingText: () => '',
    confirmDialog: () => Dialog.open(model.confirmDialog).model,
  })

const closeConfirm = (model: Model): Model =>
  modifyFields(model, {
    maybeConfirm: () => Option.none(),
    deleteEverythingText: () => '',
    confirmDialog: () => Dialog.close(model.confirmDialog).model,
  })

const foldConfirmDialogOutMessage = Dialog.OutMessage.match<
  Update.Step<Model, Message>
>({
  Opened: () => model => ({ model }),
  Closed: () => model => ({ model: closeConfirm(model) }),
})

const foldConfirmDialog = Update.foldChild({
  update: Dialog.update,
  read: (model: Model) => Option.some(model.confirmDialog),
  write: (model: Model, next: Model['confirmDialog']) =>
    modifyFields(model, { confirmDialog: () => next }),
  toParentMessage: (
    message: Extract<Message, { _tag: 'GotConfirmDialogMessage' }>['message'],
  ): Message => Message.GotConfirmDialogMessage({ message }),
  foldOutMessage: foldConfirmDialogOutMessage,
})

const setToast = (model: Model, message: string): Model =>
  modifyFields(model, { maybeToast: () => Option.some(message) })

export const init = (flags: Flags): UpdateReturn => {
  const saved = Option.getOrElse(flags.maybeSaved, () => EMPTY_SAVED)
  const model = baseWithSaved(saved)
  return { model, commands: [ReadClock(), ReadDayKey()] }
}

const baseWithSaved = (saved: SavedState): Model => {
  const base = {
    products: saved.products,
    routines: saved.routines,
    doses: saved.doses,
    activeRun: saved.activeRun,
    page: saved.page,
    settings: saved.settings,
    todayKey: '',
    nowMs: 0,
    maybeProductDraft: Option.none(),
    maybeRoutineDraft: Option.none(),
    routineWizardStep: 0,
    maybeConfirm: Option.none(),
    maybeImportSnapshot: Option.none(),
    deleteEverythingText: '',
    historyOpenDayKey: Option.none(),
    confirmDialog: Dialog.init({ id: 'confirm-dialog' }),
    maybeToast: Option.none(),
    planStage: 'ask' as const,
    planPromptState: 'stale' as const,
    planMedicine: '',
    planLabel: '',
    planScope: 'one' as const,
    planPaste: '',
    maybePlanImport: Option.none(),
    labelStatus: 'idle' as const,
  }
  return Page.match(base.page, {
    Today: () => base,
    Run: () => base,
    Routines: () => base,
    RoutineEditor: ({ routineId }) =>
      Option.match(routineId, {
        onNone: () => base,
        onSome: id =>
          Option.match(routineById(base.routines, id), {
            onNone: () => base,
            onSome: routine => ({
              ...base,
              page: Page.Routines(),
              maybeRoutineDraft: Option.some(routineDraftFromRoutine(routine)),
            }),
          }),
      }),
    Products: () => base,
    ProductEditor: ({ productId }) =>
      Option.match(productId, {
        onNone: () => base,
        onSome: id =>
          Option.match(productById(base.products, id), {
            onNone: () => base,
            onSome: product => ({
              ...base,
              page: Page.Products(),
              maybeProductDraft: Option.some(productDraftFromProduct(product)),
            }),
          }),
      }),
    History: () => base,
    Settings: () => base,
    Plan: () => base,
  })
}

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    ClickedTabToday: () => navigate(model, Page.Today()),
    ClickedTabRoutines: () => navigate(model, Page.Routines()),
    ClickedTabProducts: () => navigate(model, Page.Products()),
    ClickedTabHistory: () => navigate(model, Page.History()),
    ClickedSettings: () => navigate(model, Page.Settings()),
    ClickedExitRun: () => navigate(model, Page.Today()),
    ClickedResumeRun: () => navigate(model, Page.Run()),
    ClickedBackFromEditor: () =>
      Page.match(model.page, {
        Today: () => ({ model }),
        Run: () => ({ model }),
        Routines: () => ({ model }),
        RoutineEditor: () =>
          navigate(
            modifyFields(model, { maybeRoutineDraft: () => Option.none() }),
            Page.Routines(),
          ),
        Products: () => ({ model }),
        ProductEditor: () =>
          navigate(
            modifyFields(model, { maybeProductDraft: () => Option.none() }),
            Page.Products(),
          ),
        History: () => ({ model }),
        Settings: () => ({ model }),
        Plan: () => ({ model }),
      }),

    ClickedNewProduct: () => {
      const draft = emptyProductDraft(model.settings.defaultWaitMinutes)
      return navigate(
        modifyFields(model, {
          maybeProductDraft: () => Option.some(draft),
        }),
        Page.ProductEditor({ productId: Option.none() }),
      )
    },
    ClickedEditProduct: ({ productId }) =>
      Option.match(productById(model.products, productId), {
        onNone: () => ({ model }),
        onSome: product =>
          navigate(
            modifyFields(model, {
              maybeProductDraft: () =>
                Option.some(productDraftFromProduct(product)),
            }),
            Page.ProductEditor({ productId: Option.some(productId) }),
          ),
      }),
    UpdatedProductName: ({ value }) =>
      updateProductDraft(model, draft => ({ ...draft, name: value })),
    UpdatedProductStrength: ({ value }) =>
      updateProductDraft(model, draft => ({ ...draft, strength: value })),
    UpdatedProductAmount: ({ value }) =>
      updateProductDraft(model, draft => ({ ...draft, amount: value })),
    UpdatedProductArea: ({ value }) =>
      updateProductDraft(model, draft => ({ ...draft, area: value })),
    UpdatedProductNote: ({ value }) =>
      updateProductDraft(model, draft => ({ ...draft, note: value })),
    UpdatedProductDefaultWait: ({ minutes }) =>
      updateProductDraft(model, draft => ({
        ...draft,
        defaultWaitMinutes: sanitizeMinutes(minutes),
      })),
    SelectedProductKind: ({ kind }) =>
      updateProductDraft(model, draft => ({
        ...draft,
        kind,
        wizardStep: draft.wizardStep === 1 ? 2 : draft.wizardStep,
      })),
    SelectedProductAmount: ({ value }) =>
      updateProductDraft(model, draft => ({
        ...draft,
        amount: value,
        wizardStep: draft.wizardStep === 2 ? 3 : draft.wizardStep,
      })),
    SelectedProductWait: ({ minutes }) =>
      updateProductDraft(model, draft => ({
        ...draft,
        defaultWaitMinutes: sanitizeMinutes(minutes),
        wizardStep: draft.wizardStep === 4 ? 5 : draft.wizardStep,
      })),
    ClickedProductNext: () =>
      updateProductDraft(model, draft => ({
        ...draft,
        wizardStep: Math.min(PRODUCT_WIZARD_LAST_STEP, draft.wizardStep + 1),
      })),
    ClickedPickLabelPhoto: () => ({ model, commands: [SelectLabelPhoto()] }),
    SelectedLabelPhoto: ({ maybeFile }) =>
      Option.match(maybeFile, {
        onNone: () => ({ model }),
        onSome: file => ({
          model: { ...model, labelStatus: 'reading' as const },
          commands: [MakeLabelThumbnail({ file }), ReadLabelText({ file })],
        }),
      }),
    CompletedLabelThumbnail: ({ thumbnail }) =>
      updateProductDraft(model, draft => ({ ...draft, thumbnail })),
    FailedLabelThumbnail: () => ({
      model: { ...model, labelStatus: 'failed' as const },
    }),
    ClickedPickPlanPhotos: ({ source }) => ({
      model,
      commands: [SelectPlanPhotos({ source })],
    }),
    SelectedLabelPhotos: ({ files }) =>
      files.length === 0
        ? { model }
        : {
            model: { ...model, labelStatus: 'reading' as const },
            commands: [ReadLabelPhotos({ files })],
          },
    CompletedLabelPhotos: ({ texts, failedCount }) => {
      const next = modifyFields(model, {
        planMedicine: current =>
          Array.reduce(texts, current, appendMedicineName),
        planLabel: current => Array.reduce(texts, current, appendLabelText),
        labelStatus: () => 'idle' as const,
      })
      if (failedCount === 0) {
        return { model: next }
      }
      return {
        model: modifyFields(next, {
          maybeToast: () =>
            Option.some(
              `Read ${texts.length} of ${texts.length + failedCount} photos. Type the rest.`,
            ),
        }),
      }
    },
    SelectedPlanScope: ({ scope }) => ({
      model: modifyFields(model, {
        planScope: () => scope,
        planPromptState: () => 'stale' as const,
      }),
    }),
    CompletedLabelText: ({ text }) => ({
      model: {
        ...updateProductDraft(model, draft => {
          const name = labelNameFromText(text)
          return {
            ...draft,
            name: draft.name.trim() === '' ? name : draft.name,
          }
        }).model,
        labelStatus: 'idle' as const,
      },
    }),
    FailedLabelText: () => ({
      model: {
        ...model,
        labelStatus: 'failed' as const,
        maybeToast: Option.some(
          model.page._tag === 'Plan'
            ? 'Could not read the label. Type what it says.'
            : 'Could not read the label. Type the name.',
        ),
      },
    }),
    ClickedProductBack: () =>
      updateProductDraft(model, draft => ({
        ...draft,
        wizardStep: Math.max(0, draft.wizardStep - 1),
      })),
    ToggledProductAsNeeded: ({ isChecked }) =>
      updateProductDraft(model, draft => ({
        ...draft,
        asNeeded: isChecked,
        defaultWaitMinutes: isChecked ? 0 : draft.defaultWaitMinutes,
        wizardStep: draft.wizardStep === 5 ? 6 : draft.wizardStep,
      })),
    SubmittedProduct: () =>
      Option.match(model.maybeProductDraft, {
        onNone: () => ({ model }),
        onSome: draft => {
          if (productDraftErrors(draft).length > 0) {
            return { model }
          }
          return Option.match(draft.maybeProductId, {
            onNone: () => ({ model, commands: [GenerateProductId()] }),
            onSome: id => {
              const existing = pipe(
                productById(model.products, id),
                Option.getOrElse(() => null),
              )
              if (existing === null) {
                return { model }
              }
              const updated = Array.map(model.products, product =>
                product.id === id
                  ? productFromDraft(draft, id, product.origin)
                  : product,
              )
              const next = modifyFields(model, {
                products: () => updated,
                maybeProductDraft: () => Option.none(),
                page: () => Page.Products(),
              })
              return save(next)
            },
          })
        },
      }),
    CompletedGenerateProductId: ({ id }) =>
      Option.match(model.maybeProductDraft, {
        onNone: () => ({ model }),
        onSome: draft => {
          const product = productFromDraft(draft, id, Origin.Manual())
          const next = modifyFields(model, {
            products: () => [...model.products, product],
            maybeProductDraft: () => Option.none(),
            page: () => Page.Products(),
          })
          return save(next)
        },
      }),
    ClickedDeleteProduct: ({ productId }) =>
      Option.match(productById(model.products, productId), {
        onNone: () => ({ model }),
        onSome: () => ({
          model: openConfirm(model, ConfirmKind.DeleteProduct({ productId })),
        }),
      }),
    ConfirmedDeleteProduct: ({ productId }) => {
      const products = Array.filter(
        model.products,
        product => product.id !== productId,
      )
      const routines = Array.map(model.routines, routine => ({
        ...routine,
        steps: Array.filter(
          routine.steps,
          step => step.productId !== productId,
        ),
      }))
      let activeRun = model.activeRun
      if (Option.isSome(model.activeRun)) {
        const run = model.activeRun.value
        const maybeRoutine = routineById(routines, run.routineId)
        if (Option.isNone(maybeRoutine)) {
          activeRun = Option.none()
        } else {
          const routine = maybeRoutine.value
          if (
            run.stepIndex >= routine.steps.length ||
            Array.some(routine.steps, step => step.productId === productId)
          ) {
            activeRun = Option.none()
          }
        }
      }
      const next = modifyFields(model, {
        products: () => products,
        routines: () => routines,
        activeRun: () => activeRun,
      })
      return save(closeConfirm(next))
    },

    ClickedNewRoutine: () =>
      navigate(
        modifyFields(model, {
          maybeRoutineDraft: () => Option.some(emptyRoutineDraft()),
          routineWizardStep: () => 0,
        }),
        Page.RoutineEditor({ routineId: Option.none() }),
      ),
    ClickedEditRoutine: ({ routineId }) =>
      Option.match(routineById(model.routines, routineId), {
        onNone: () => ({ model }),
        onSome: routine =>
          navigate(
            modifyFields(model, {
              maybeRoutineDraft: () =>
                Option.some(routineDraftFromRoutine(routine)),
              routineWizardStep: () => 0,
            }),
            Page.RoutineEditor({ routineId: Option.some(routineId) }),
          ),
      }),
    ClickedRoutineNext: () => ({
      model: modifyFields(model, {
        routineWizardStep: () => Math.min(model.routineWizardStep + 1, 2),
      }),
    }),
    ClickedRoutineBack: () => {
      if (model.routineWizardStep === 0) {
        return navigate(
          modifyFields(model, { maybeRoutineDraft: () => Option.none() }),
          Page.Routines(),
        )
      }
      return {
        model: modifyFields(model, {
          routineWizardStep: () => model.routineWizardStep - 1,
        }),
      }
    },
    SelectedRoutinePreset: ({ name, time }) =>
      updateRoutineDraft(model, draft => ({
        ...draft,
        name,
        scheduledTime: time === '' ? Option.none() : Option.some(time),
      })),
    UpdatedRoutineName: ({ value }) =>
      updateRoutineDraft(model, draft => ({ ...draft, name: value })),
    UpdatedRoutineDetail: ({ value }) =>
      updateRoutineDraft(model, draft => ({
        ...draft,
        detail: value.slice(0, 120),
      })),
    ToggledRoutineAnytime: ({ isChecked }) =>
      updateRoutineDraft(model, draft => ({
        ...draft,
        scheduledTime: isChecked
          ? Option.none()
          : Option.isSome(draft.scheduledTime)
            ? draft.scheduledTime
            : Option.some('08:00'),
      })),
    UpdatedRoutineTime: ({ value }) =>
      updateRoutineDraft(model, draft => ({
        ...draft,
        scheduledTime: Option.some(value),
      })),
    ToggledRoutinePaused: ({ isChecked }) =>
      updateRoutineDraft(model, draft => ({
        ...draft,
        isPaused: isChecked,
      })),
    SelectedStepProduct: ({ productId }) =>
      Option.match(model.maybeRoutineDraft, {
        onNone: () => ({ model }),
        onSome: draft => {
          const product = pipe(
            productById(model.products, productId),
            Option.getOrElse(() => null),
          )
          if (product === null) {
            return { model }
          }
          if (Array.some(draft.steps, step => step.productId === productId)) {
            return { model }
          }
          const next = modifyFields(model, {
            maybeRoutineDraft: () =>
              Option.some({
                ...draft,
                steps: [
                  ...draft.steps,
                  { productId, waitMinutes: product.defaultWaitMinutes },
                ],
              }),
          })
          return { model: next }
        },
      }),
    ClickedRemoveStep: ({ stepIndex }) =>
      updateRoutineDraft(model, draft => ({
        ...draft,
        steps: removeStepAt(draft.steps, stepIndex),
      })),
    ClickedMoveStepUp: ({ stepIndex }) =>
      updateRoutineDraft(model, draft => ({
        ...draft,
        steps: moveStep(draft.steps, stepIndex, -1),
      })),
    ClickedMoveStepDown: ({ stepIndex }) =>
      updateRoutineDraft(model, draft => ({
        ...draft,
        steps: moveStep(draft.steps, stepIndex, 1),
      })),
    UpdatedStepWait: ({ stepIndex, minutes }) =>
      updateRoutineDraft(model, draft => ({
        ...draft,
        steps: updateStepWait(draft.steps, stepIndex, minutes),
      })),
    ClickedResetStepWait: ({ stepIndex }) =>
      updateRoutineDraft(model, draft => {
        const step = draft.steps[stepIndex]
        const product = step
          ? pipe(
              productById(model.products, step.productId),
              Option.getOrElse(() => null),
            )
          : null
        if (product === null) {
          return draft
        }
        return {
          ...draft,
          steps: updateStepWait(
            draft.steps,
            stepIndex,
            product.defaultWaitMinutes,
          ),
        }
      }),
    SubmittedRoutine: () =>
      Option.match(model.maybeRoutineDraft, {
        onNone: () => ({ model }),
        onSome: draft => {
          if (routineDraftErrors(draft).length > 0) {
            return { model }
          }
          return Option.match(draft.maybeRoutineId, {
            onNone: () => ({ model, commands: [GenerateRoutineId()] }),
            onSome: id => {
              const existing = pipe(
                routineById(model.routines, id),
                Option.getOrElse(() => null),
              )
              if (existing === null) {
                return { model }
              }
              const updated = Array.map(model.routines, routine =>
                routine.id === id
                  ? routineFromDraft(
                      draft,
                      id,
                      routine.origin,
                      routine.reviewedAtMs,
                    )
                  : routine,
              )
              const next = modifyFields(model, {
                routines: () => updated,
                maybeRoutineDraft: () => Option.none(),
                page: () => Page.Routines(),
              })
              return save(next)
            },
          })
        },
      }),
    CompletedGenerateRoutineId: ({ id }) =>
      Option.match(model.maybeRoutineDraft, {
        onNone: () => ({ model }),
        onSome: draft => {
          const routine = routineFromDraft(
            draft,
            id,
            Origin.Manual(),
            Option.none(),
          )
          const next = modifyFields(model, {
            routines: () => [...model.routines, routine],
            maybeRoutineDraft: () => Option.none(),
            page: () => Page.Routines(),
          })
          return save(next)
        },
      }),
    ClickedDeleteRoutine: ({ routineId }) =>
      Option.match(routineById(model.routines, routineId), {
        onNone: () => ({ model }),
        onSome: () => ({
          model: openConfirm(model, ConfirmKind.DeleteRoutine({ routineId })),
        }),
      }),
    ConfirmedDeleteRoutine: ({ routineId }) => {
      const routines = Array.filter(
        model.routines,
        routine => routine.id !== routineId,
      )
      const activeRun =
        Option.isSome(model.activeRun) &&
        model.activeRun.value.routineId === routineId
          ? Option.none()
          : model.activeRun
      const next = modifyFields(model, {
        routines: () => routines,
        activeRun: () => activeRun,
      })
      return save(closeConfirm(next))
    },

    ClickedStartRoutine: ({ routineId }) => {
      if (Option.isNone(routineById(model.routines, routineId))) {
        return { model }
      }
      return { model, commands: [StartRun({ routineId })] }
    },
    CompletedStartRun: ({ routineId, nowMs }) => {
      const maybeRoutine = routineById(model.routines, routineId)
      if (Option.isNone(maybeRoutine)) {
        return { model }
      }
      const run = buildRun(
        maybeRoutine.value,
        model.doses,
        model.todayKey,
        nowMs,
      )
      const next = modifyFields(model, {
        activeRun: () => Option.some(run),
        page: () => Page.Run(),
      })
      return save(next)
    },
    ClickedApplyStep: () =>
      Option.match(model.activeRun, {
        onNone: () => ({ model }),
        onSome: run => {
          if (Option.isSome(run.waitEndsAtMs)) {
            return { model }
          }
          const maybeRoutine = routineById(model.routines, run.routineId)
          if (Option.isNone(maybeRoutine)) {
            return { model }
          }
          if (run.stepIndex >= maybeRoutine.value.steps.length) {
            return { model }
          }
          return { model, commands: [ApplyStep()] }
        },
      }),
    CompletedApplyStep: ({ doseId, atMs }) =>
      Option.match(model.activeRun, {
        onNone: () => ({ model }),
        onSome: run => {
          const maybeRoutine = routineById(model.routines, run.routineId)
          if (Option.isNone(maybeRoutine)) {
            return { model }
          }
          const routine = maybeRoutine.value
          if (run.stepIndex >= routine.steps.length) {
            return { model }
          }
          if (Option.isSome(run.waitEndsAtMs)) {
            return { model }
          }
          const step = routine.steps[run.stepIndex]!
          const dose = {
            id: doseId,
            productId: step.productId,
            routineId: Option.some(routine.id),
            dayKey: run.dayKey,
            atMs,
            outcome: 'applied' as const,
          }
          const doses = appendDose(model.doses, dose)
          const hasNext = run.stepIndex + 1 < routine.steps.length
          const hasWait = hasNext && step.waitMinutes > 0
          const nextRun = {
            ...run,
            stepIndex: hasNext
              ? hasWait
                ? run.stepIndex
                : run.stepIndex + 1
              : routine.steps.length,
            waitEndsAtMs: hasWait
              ? Option.some(atMs + step.waitMinutes * 60000)
              : Option.none(),
          }
          const next = modifyFields(model, {
            doses: () => doses,
            activeRun: () => Option.some(nextRun),
          })
          return save(next)
        },
      }),
    ClickedSkipStep: () =>
      Option.match(model.activeRun, {
        onNone: () => ({ model }),
        onSome: run => {
          if (Option.isSome(run.waitEndsAtMs)) {
            return { model }
          }
          const maybeRoutine = routineById(model.routines, run.routineId)
          if (Option.isNone(maybeRoutine)) {
            return { model }
          }
          if (run.stepIndex >= maybeRoutine.value.steps.length) {
            return { model }
          }
          return { model, commands: [SkipStep()] }
        },
      }),
    CompletedSkipStep: ({ doseId, atMs }) =>
      Option.match(model.activeRun, {
        onNone: () => ({ model }),
        onSome: run => {
          const maybeRoutine = routineById(model.routines, run.routineId)
          if (Option.isNone(maybeRoutine)) {
            return { model }
          }
          const routine = maybeRoutine.value
          if (run.stepIndex >= routine.steps.length) {
            return { model }
          }
          if (Option.isSome(run.waitEndsAtMs)) {
            return { model }
          }
          const step = routine.steps[run.stepIndex]!
          const dose = {
            id: doseId,
            productId: step.productId,
            routineId: Option.some(routine.id),
            dayKey: run.dayKey,
            atMs,
            outcome: 'skipped' as const,
          }
          const doses = appendDose(model.doses, dose)
          const nextRun = {
            ...run,
            stepIndex: Math.min(run.stepIndex + 1, routine.steps.length),
            waitEndsAtMs: Option.none(),
          }
          const next = modifyFields(model, {
            doses: () => doses,
            activeRun: () => Option.some(nextRun),
          })
          return save(next)
        },
      }),
    ClickedSkipWait: () => advanceAfterWait(model),
    ClickedNext: () => advanceAfterWait(model, true),
    Ticked: () => ({ model, commands: [ReadClock()] }),
    CompletedReadClock: ({ nowMs }) => {
      const waiting =
        Option.isSome(model.activeRun) &&
        Option.isSome(model.activeRun.value.waitEndsAtMs)
      const prevRemaining = waiting
        ? remainingMs(model.activeRun.value.waitEndsAtMs.value, model.nowMs)
        : 0
      const nextRemaining = waiting
        ? remainingMs(model.activeRun.value.waitEndsAtMs.value, nowMs)
        : 0
      const commands =
        waiting &&
        model.settings.soundOnWaitEnd &&
        prevRemaining > 0 &&
        nextRemaining === 0
          ? [PlayWaitEndSound()]
          : []
      return {
        model: modifyFields(model, { nowMs: () => nowMs }),
        commands,
      }
    },
    CheckedDayKey: () => ({ model, commands: [ReadDayKey()] }),
    CompletedReadDayKey: ({ dayKey }) => {
      if (dayKey === model.todayKey) {
        return { model }
      }
      let next = modifyFields(model, { todayKey: () => dayKey })
      if (
        Option.isSome(model.activeRun) &&
        model.activeRun.value.dayKey !== dayKey
      ) {
        next = modifyFields(next, {
          activeRun: () => Option.none(),
          page: () => Page.Today(),
        })
        return save(next)
      }
      return { model: next }
    },
    RequestedWakeLock: () => ({ model, commands: [RequestWakeLock()] }),
    CompletedRequestWakeLock: () => ({ model }),
    CompletedPlayWaitEndSound: () => ({ model }),

    ClickedLogAsNeeded: ({ productId }) => {
      const product = pipe(
        productById(model.products, productId),
        Option.getOrElse(() => null),
      )
      if (product === null || !product.asNeeded) {
        return { model }
      }
      return { model, commands: [LogAsNeeded({ productId })] }
    },
    CompletedLogAsNeeded: ({ productId, doseId, atMs }) => {
      const dose = {
        id: doseId,
        productId,
        routineId: Option.none(),
        dayKey: model.todayKey,
        atMs,
        outcome: 'applied' as const,
      }
      const doses = appendDose(model.doses, dose)
      return save(modifyFields(model, { doses: () => doses }))
    },

    ToggledSound: ({ isChecked }) =>
      save(
        modifyFields(model, {
          settings: () =>
            modifyFields(model.settings, {
              soundOnWaitEnd: () => isChecked,
            }),
        }),
      ),
    UpdatedDefaultWait: ({ minutes }) =>
      save(
        modifyFields(model, {
          settings: () =>
            modifyFields(model.settings, {
              defaultWaitMinutes: () => sanitizeMinutes(minutes),
            }),
        }),
      ),
    ClickedExport: () => ({
      model,
      commands: [ExportState({ snapshot: snapshotFromModel(model) })],
    }),
    CompletedExportState: () => ({ model }),
    FailedExportState: () => ({ model }),
    ClickedImport: () => ({ model, commands: [SelectImportFile()] }),
    CompletedSelectImportFile: ({ maybeFile }) =>
      Option.match(maybeFile, {
        onNone: () => ({ model }),
        onSome: file => ({ model, commands: [ReadImportFile({ file })] }),
      }),
    CompletedReadImportFile: ({ text }) => ({
      model,
      commands: [DecodeImport({ text })],
    }),
    FailedReadImportFile: () => ({
      model: setToast(model, 'Could not read the file'),
    }),
    SucceededDecodeImport: ({ products, routines, doses }) => {
      const next = modifyFields(model, {
        maybeImportSnapshot: () => Option.some({ products, routines, doses }),
        maybeConfirm: () => Option.some(ConfirmKind.ImportReplace()),
        deleteEverythingText: () => '',
        confirmDialog: () => Dialog.open(model.confirmDialog).model,
      })
      return { model: next }
    },
    FailedDecodeImport: () => ({
      model: setToast(
        model,
        'Not a medstack file — your data was not changed.',
      ),
    }),
    ConfirmedImport: () =>
      Option.match(model.maybeImportSnapshot, {
        onNone: () => ({ model }),
        onSome: snapshot => {
          const next = modifyFields(closeConfirm(model), {
            products: () => snapshot.products,
            routines: () => snapshot.routines,
            doses: () => snapshot.doses,
            maybeImportSnapshot: () => Option.none(),
          })
          return save(next)
        },
      }),

    ClickedToggleHistoryDay: ({ dayKey }) => ({
      model: modifyFields(model, {
        historyOpenDayKey: () =>
          Option.isSome(model.historyOpenDayKey) &&
          model.historyOpenDayKey.value === dayKey
            ? Option.none()
            : Option.some(dayKey),
      }),
    }),
    ClickedClearHistory: () => ({
      model: openConfirm(model, ConfirmKind.ClearHistory()),
    }),
    ConfirmedClearHistory: () =>
      save(modifyFields(closeConfirm(model), { doses: () => [] })),
    ClickedDeleteEverything: () => ({
      model: openConfirm(model, ConfirmKind.DeleteEverything()),
    }),
    UpdatedDeleteEverythingText: ({ value }) => ({
      model: modifyFields(model, { deleteEverythingText: () => value }),
    }),
    ConfirmedDeleteEverything: () => {
      if (model.deleteEverythingText !== 'delete') {
        return { model }
      }
      const next = modifyFields(closeConfirm(model), {
        products: () => [],
        routines: () => [],
        doses: () => [],
        activeRun: () => Option.none(),
        page: () => Page.Today(),
        maybeImportSnapshot: () => Option.none(),
      })
      return save(next)
    },

    ClickedGetPlan: () =>
      navigate(
        modifyFields(model, {
          planStage: () => 'ask' as const,
          maybePlanImport: () => Option.none(),
        }),
        Page.Plan(),
      ),
    UpdatedPlanMedicine: ({ value }) => ({
      model: modifyFields(model, {
        planMedicine: () => value,
        planPromptState: () => 'stale' as const,
      }),
    }),
    UpdatedPlanLabel: ({ value }) => ({
      model: modifyFields(model, {
        planLabel: () => value,
        planPromptState: () => 'stale' as const,
      }),
    }),
    UpdatedPlanPaste: ({ value }) => ({
      model: modifyFields(model, { planPaste: () => value }),
    }),
    ClickedCopyPlanPrompt: () => ({
      model,
      commands: [
        CopyPlanPrompt({
          text: planPrompt(
            model.planMedicine,
            model.planLabel,
            model.planScope,
          ),
        }),
      ],
    }),
    CompletedCopyPlanPrompt: () => ({
      model: modifyFields(model, {
        planPromptState: () => 'copied' as const,
      }),
    }),
    FailedCopyPlanPrompt: () => ({
      model: modifyFields(model, {
        planPromptState: () => 'failed' as const,
      }),
    }),
    ClickedPlanPasteStep: () => ({
      model: modifyFields(model, { planStage: () => 'paste' as const }),
    }),
    ClickedPlanAskStep: () => ({
      model: modifyFields(model, { planStage: () => 'ask' as const }),
    }),
    SubmittedPlanImport: () => {
      if (model.planPaste.trim() === '') {
        return { model }
      }
      return { model, commands: [ImportPlan({ text: model.planPaste })] }
    },
    SucceededImportPlan: ({ products, routines, questions }) => ({
      model: modifyFields(openConfirm(model, ConfirmKind.PlanImport()), {
        maybePlanImport: () => Option.some({ products, routines, questions }),
      }),
    }),
    FailedImportPlan: ({ message }) => ({ model: setToast(model, message) }),
    ConfirmedPlanImport: () =>
      Option.match(model.maybePlanImport, {
        onNone: () => ({ model: closeConfirm(model) }),
        onSome: imported => {
          const merged = mergePlanImport(
            model.products,
            model.routines,
            imported,
          )
          const next = modifyFields(closeConfirm(model), {
            products: () => merged.products,
            routines: () => merged.routines,
            maybePlanImport: () => Option.none(),
            page: () => Page.Today(),
            maybeToast: () =>
              Option.some(
                `Imported ${merged.addedProducts} products and ${merged.addedRoutines} routines.`,
              ),
          })
          return save(next)
        },
      }),
    ClickedMarkRoutineReviewed: ({ routineId }) => ({
      model,
      commands: [MarkRoutineReviewed({ routineId })],
    }),
    CompletedMarkRoutineReviewed: ({ routineId, atMs }) => {
      const routines = Array.map(model.routines, routine =>
        routine.id === routineId
          ? { ...routine, reviewedAtMs: Option.some(atMs) }
          : routine,
      )
      return save(modifyFields(model, { routines: () => routines }))
    },

    SucceededSaveState: () => ({ model }),
    FailedSaveState: () => ({ model }),

    GotConfirmDialogMessage: ({ message }) => foldConfirmDialog(model, message),
    ClickedDismissToast: () => ({
      model: modifyFields(model, { maybeToast: () => Option.none() }),
    }),
  })

const advanceAfterWait = (model: Model, requireZero = false): UpdateReturn =>
  Option.match(model.activeRun, {
    onNone: () => ({ model }),
    onSome: run => {
      if (Option.isNone(run.waitEndsAtMs)) {
        return { model }
      }
      const maybeRoutine = routineById(model.routines, run.routineId)
      if (Option.isNone(maybeRoutine)) {
        return { model }
      }
      if (run.stepIndex >= maybeRoutine.value.steps.length) {
        return { model }
      }
      if (requireZero && remainingMs(run.waitEndsAtMs.value, model.nowMs) > 0) {
        return { model }
      }
      const nextRun = {
        ...run,
        stepIndex: run.stepIndex + 1,
        waitEndsAtMs: Option.none(),
      }
      return save(
        modifyFields(model, { activeRun: () => Option.some(nextRun) }),
      )
    },
  })
