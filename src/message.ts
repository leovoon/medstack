import { Schema } from 'effect'
import * as File from 'foldkit/file'
import { defineMessageUnion } from 'foldkit/message'

import { Dialog } from '@foldkit/ui'

import { Dose, Product, ProductKind, Routine } from './domain'

export const Message = defineMessageUnion({
  // navigation
  ClickedTabToday: {},
  ClickedTabRoutines: {},
  ClickedTabProducts: {},
  ClickedTabHistory: {},
  ClickedSettings: {},
  ClickedExitRun: {},
  ClickedResumeRun: {},
  ClickedBackFromEditor: {},

  // product editor
  ClickedNewProduct: {},
  ClickedEditProduct: { productId: Schema.String },
  ClickedProductNext: {},
  ClickedProductBack: {},
  UpdatedProductName: { value: Schema.String },
  UpdatedProductStrength: { value: Schema.String },
  UpdatedProductAmount: { value: Schema.String },
  UpdatedProductArea: { value: Schema.String },
  UpdatedProductNote: { value: Schema.String },
  UpdatedProductDefaultWait: { minutes: Schema.Number },
  SelectedProductKind: { kind: ProductKind },
  SelectedProductAmount: { value: Schema.String },
  SelectedProductWait: { minutes: Schema.Number },
  ToggledProductAsNeeded: { isChecked: Schema.Boolean },
  SubmittedProduct: {},
  CompletedGenerateProductId: { id: Schema.String },
  ClickedDeleteProduct: { productId: Schema.String },
  ConfirmedDeleteProduct: { productId: Schema.String },

  // routine editor
  ClickedNewRoutine: {},
  ClickedEditRoutine: { routineId: Schema.String },
  UpdatedRoutineName: { value: Schema.String },
  UpdatedRoutineDetail: { value: Schema.String },
  ToggledRoutineAnytime: { isChecked: Schema.Boolean },
  UpdatedRoutineTime: { value: Schema.String },
  ToggledRoutinePaused: { isChecked: Schema.Boolean },
  ClickedAddStep: {},
  SelectedStepProduct: { productId: Schema.String },
  ClickedRemoveStep: { stepIndex: Schema.Number },
  ClickedMoveStepUp: { stepIndex: Schema.Number },
  ClickedMoveStepDown: { stepIndex: Schema.Number },
  UpdatedStepWait: { stepIndex: Schema.Number, minutes: Schema.Number },
  ClickedResetStepWait: { stepIndex: Schema.Number },
  SubmittedRoutine: {},
  CompletedGenerateRoutineId: { id: Schema.String },
  ClickedDeleteRoutine: { routineId: Schema.String },
  ConfirmedDeleteRoutine: { routineId: Schema.String },

  // run
  ClickedStartRoutine: { routineId: Schema.String },
  CompletedStartRun: { routineId: Schema.String, nowMs: Schema.Number },
  ClickedApplyStep: {},
  CompletedApplyStep: { doseId: Schema.String, atMs: Schema.Number },
  ClickedSkipStep: {},
  CompletedSkipStep: { doseId: Schema.String, atMs: Schema.Number },
  ClickedSkipWait: {},
  ClickedNext: {},
  Ticked: {},
  CompletedReadClock: { nowMs: Schema.Number },
  CheckedDayKey: {},
  CompletedReadDayKey: { dayKey: Schema.String },
  RequestedWakeLock: {},
  CompletedRequestWakeLock: {},
  CompletedPlayWaitEndSound: {},

  // as needed
  ClickedLogAsNeeded: { productId: Schema.String },
  CompletedLogAsNeeded: {
    productId: Schema.String,
    doseId: Schema.String,
    atMs: Schema.Number,
  },

  // settings
  ToggledSound: { isChecked: Schema.Boolean },
  UpdatedDefaultWait: { minutes: Schema.Number },
  ClickedExport: {},
  CompletedExportState: {},
  FailedExportState: {},
  ClickedImport: {},
  CompletedSelectImportFile: { maybeFile: Schema.Option(File.File) },
  CompletedReadImportFile: { text: Schema.String },
  FailedReadImportFile: {},
  SucceededDecodeImport: {
    products: Schema.Array(Product),
    routines: Schema.Array(Routine),
    doses: Schema.Array(Dose),
  },
  FailedDecodeImport: {},
  ConfirmedImport: {},

  // plan (ChatGPT round-trip)
  ClickedGetPlan: {},
  UpdatedPlanMedicine: { value: Schema.String },
  UpdatedPlanLabel: { value: Schema.String },
  ClickedCopyPlanPrompt: {},
  CompletedCopyPlanPrompt: {},
  FailedCopyPlanPrompt: {},
  ClickedPlanPasteStep: {},
  ClickedPlanAskStep: {},
  UpdatedPlanPaste: { value: Schema.String },
  SubmittedPlanImport: {},
  SucceededImportPlan: {
    products: Schema.Array(Product),
    routines: Schema.Array(Routine),
    questions: Schema.Array(Schema.String),
  },
  FailedImportPlan: { message: Schema.String },
  ConfirmedPlanImport: {},
  ClickedMarkRoutineReviewed: { routineId: Schema.String },
  CompletedMarkRoutineReviewed: {
    routineId: Schema.String,
    atMs: Schema.Number,
  },

  // history / data
  ClickedToggleHistoryDay: { dayKey: Schema.String },
  ClickedClearHistory: {},
  ConfirmedClearHistory: {},
  ClickedDeleteEverything: {},
  UpdatedDeleteEverythingText: { value: Schema.String },
  ConfirmedDeleteEverything: {},

  // commands
  SucceededSaveState: {},
  FailedSaveState: {},

  // submodel bridges
  GotConfirmDialogMessage: { message: Dialog.Message },
  GotStepPickerDialogMessage: { message: Dialog.Message },
  ClickedDismissToast: {},
})

export type Message = typeof Message.Type
