import { Option, Schema } from 'effect'

import { Dialog } from '@foldkit/ui'

import {
  ConfirmKind,
  Dose,
  ImportSnapshot,
  Page,
  Product,
  ProductDraft,
  Routine,
  RoutineDraft,
  Run,
  SavedState,
  Settings,
} from './domain'

export const Model = Schema.Struct({
  products: Schema.Array(Product),
  routines: Schema.Array(Routine),
  doses: Schema.Array(Dose),
  activeRun: Schema.Option(Run),
  page: Page,
  settings: Settings,
  todayKey: Schema.String,
  nowMs: Schema.Number,
  maybeProductDraft: Schema.Option(ProductDraft),
  maybeRoutineDraft: Schema.Option(RoutineDraft),
  maybeConfirm: Schema.Option(ConfirmKind),
  maybeImportSnapshot: Schema.Option(ImportSnapshot),
  deleteEverythingText: Schema.String,
  historyOpenDayKey: Schema.Option(Schema.String),
  confirmDialog: Dialog.Model,
  stepPickerDialog: Dialog.Model,
  maybeToast: Schema.Option(Schema.String),
})
export type Model = typeof Model.Type

export const snapshotFromModel = (model: Model): SavedState => ({
  version: 1,
  products: model.products,
  routines: model.routines,
  doses: model.doses,
  activeRun: model.activeRun,
  page: model.page,
  settings: model.settings,
})

export const baseModel = (): Model => ({
  products: [],
  routines: [],
  doses: [],
  activeRun: Option.none(),
  page: Page.Today(),
  settings: { soundOnWaitEnd: false, defaultWaitMinutes: 20 },
  todayKey: '',
  nowMs: 0,
  maybeProductDraft: Option.none(),
  maybeRoutineDraft: Option.none(),
  maybeConfirm: Option.none(),
  maybeImportSnapshot: Option.none(),
  deleteEverythingText: '',
  historyOpenDayKey: Option.none(),
  confirmDialog: Dialog.init({ id: 'confirm-dialog' }),
  stepPickerDialog: Dialog.init({ id: 'step-picker-dialog' }),
  maybeToast: Option.none(),
})
