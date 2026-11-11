import { Array, Clock, Effect, Option, Schema } from 'effect'
import { SecureRandom } from 'effect/crypto'
import { KeyValueStore } from 'effect/persistence'
import { Command } from 'foldkit'
import * as File from 'foldkit/file'
import Tesseract, { PSM } from 'tesseract.js'

import { BrowserCrypto, BrowserKeyValueStore } from '@effect/platform-browser'

import {
  PlanPhotoSource,
  SavedState,
  StoredSavedStateJsonString,
  dayKeyFromDate,
  hydrateSavedState,
  planFromText,
  planImportFromPlan,
} from './domain'
import { Message } from './message'
import { STORAGE_KEY, SavedStateJsonString } from './storage'

const generateUuid = (): Effect.Effect<string> =>
  Effect.gen(function* () {
    const secureRandom = yield* SecureRandom.SecureRandom
    return yield* secureRandom.uuidV4()
  }).pipe(Effect.provide(BrowserCrypto.layerSecureRandom))

export const SaveState = Command.define('SaveState', {
  args: { snapshot: SavedState },
  messages: [Message.SucceededSaveState, Message.FailedSaveState],
  execute: ({ snapshot }) =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore
      const encoded = yield* Schema.encodeEffect(SavedStateJsonString)(snapshot)
      yield* store.set(STORAGE_KEY, encoded)
      return Message.SucceededSaveState()
    }).pipe(
      Effect.catch(() => Effect.succeed(Message.FailedSaveState())),
      Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    ),
})

export const ReadClock = Command.define('ReadClock', {
  messages: [Message.CompletedReadClock],
  execute: Effect.gen(function* () {
    const nowMs = yield* Clock.currentTimeMillis
    return Message.CompletedReadClock({ nowMs })
  }),
})

export const ReadDayKey = Command.define('ReadDayKey', {
  messages: [Message.CompletedReadDayKey],
  execute: Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    return Message.CompletedReadDayKey({
      dayKey: dayKeyFromDate(new Date(now)),
    })
  }),
})

export const StartRun = Command.define('StartRun', {
  args: { routineId: Schema.String },
  messages: [Message.CompletedStartRun],
  execute: ({ routineId }) =>
    Effect.gen(function* () {
      const nowMs = yield* Clock.currentTimeMillis
      return Message.CompletedStartRun({ routineId, nowMs })
    }),
})

export const ApplyStep = Command.define('ApplyStep', {
  messages: [Message.CompletedApplyStep],
  execute: Effect.gen(function* () {
    const doseId = yield* generateUuid()
    const atMs = yield* Clock.currentTimeMillis
    return Message.CompletedApplyStep({ doseId, atMs })
  }),
})

export const SkipStep = Command.define('SkipStep', {
  messages: [Message.CompletedSkipStep],
  execute: Effect.gen(function* () {
    const doseId = yield* generateUuid()
    const atMs = yield* Clock.currentTimeMillis
    return Message.CompletedSkipStep({ doseId, atMs })
  }),
})

export const LogAsNeeded = Command.define('LogAsNeeded', {
  args: { productId: Schema.String },
  messages: [Message.CompletedLogAsNeeded],
  execute: ({ productId }) =>
    Effect.gen(function* () {
      const doseId = yield* generateUuid()
      const atMs = yield* Clock.currentTimeMillis
      return Message.CompletedLogAsNeeded({ productId, doseId, atMs })
    }),
})

export const GenerateProductId = Command.define('GenerateProductId', {
  messages: [Message.CompletedGenerateProductId],
  execute: Effect.gen(function* () {
    const id = yield* generateUuid()
    return Message.CompletedGenerateProductId({ id })
  }),
})

export const GenerateRoutineId = Command.define('GenerateRoutineId', {
  messages: [Message.CompletedGenerateRoutineId],
  execute: Effect.gen(function* () {
    const id = yield* generateUuid()
    return Message.CompletedGenerateRoutineId({ id })
  }),
})

export const ExportState = Command.define('ExportState', {
  args: { snapshot: SavedState },
  messages: [Message.CompletedExportState, Message.FailedExportState],
  execute: ({ snapshot }) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const dayKey = dayKeyFromDate(new Date(now))
      const json = yield* Schema.encodeEffect(SavedStateJsonString)(snapshot)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `medstack-export-${dayKey}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      return Message.CompletedExportState()
    }).pipe(Effect.catch(() => Effect.succeed(Message.FailedExportState()))),
})

export const SelectImportFile = Command.define('SelectImportFile', {
  messages: [Message.CompletedSelectImportFile],
  execute: File.select(['application/json', 'text/plain']).pipe(
    Effect.map(maybeFile => Message.CompletedSelectImportFile({ maybeFile })),
  ),
})

export const ReadImportFile = Command.define('ReadImportFile', {
  args: { file: File.File },
  messages: [Message.CompletedReadImportFile, Message.FailedReadImportFile],
  execute: ({ file }) =>
    File.readAsText(file).pipe(
      Effect.map(text => Message.CompletedReadImportFile({ text })),
      Effect.catch(() => Effect.succeed(Message.FailedReadImportFile())),
    ),
})

export const DecodeImport = Command.define('DecodeImport', {
  args: { text: Schema.String },
  messages: [Message.SucceededDecodeImport, Message.FailedDecodeImport],
  execute: ({ text }) =>
    Effect.gen(function* () {
      const decoded = yield* Schema.decodeEffect(StoredSavedStateJsonString)(
        text,
      )
      const hydrated = hydrateSavedState(decoded)
      return Message.SucceededDecodeImport({
        products: hydrated.products,
        routines: hydrated.routines,
        doses: hydrated.doses,
      })
    }).pipe(Effect.catch(() => Effect.succeed(Message.FailedDecodeImport()))),
})

const getAudioContext = (): AudioContext | null => {
  try {
    return new AudioContext()
  } catch {
    return null
  }
}

const blip = (ctx: AudioContext, frequency: number, startAt: number): void => {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.frequency.value = frequency
  oscillator.type = 'sine'
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + 0.13)
}

export const PlayWaitEndSound = Command.define('PlayWaitEndSound', {
  messages: [Message.CompletedPlayWaitEndSound],
  execute: Effect.sync(() => {
    const ctx = getAudioContext()
    if (ctx !== null) {
      void ctx.resume().catch(() => {})
      const when = ctx.currentTime
      blip(ctx, 880, when)
      blip(ctx, 660, when + 0.16)
    }
    return Message.CompletedPlayWaitEndSound()
  }),
})

export const RequestWakeLock = Command.define('RequestWakeLock', {
  messages: [Message.CompletedRequestWakeLock],
  execute: Effect.sync(() => {
    const nav: {
      wakeLock?: { request(type?: 'screen'): Promise<WakeLockSentinel> }
    } = navigator
    if (nav.wakeLock?.request) {
      nav.wakeLock.request('screen').catch(() => {})
    }
    return Message.CompletedRequestWakeLock()
  }),
})

export const CopyPlanPrompt = Command.define('CopyPlanPrompt', {
  args: { text: Schema.String },
  messages: [Message.CompletedCopyPlanPrompt, Message.FailedCopyPlanPrompt],
  execute: ({ text }) =>
    Effect.tryPromise({
      try: () => navigator.clipboard.writeText(text),
      catch: () => new Error('clipboard unavailable'),
    }).pipe(
      Effect.map(() => Message.CompletedCopyPlanPrompt()),
      Effect.catch(() => Effect.succeed(Message.FailedCopyPlanPrompt())),
    ),
})

/**
 * The paste box is 224px of empty space on a phone, and long-pressing it is the fiddliest
 * gesture the plan round trip asks for. The button is one tap and the browser explains itself.
 */
export const ReadClipboardText = Command.define('ReadClipboardText', {
  messages: [
    Message.CompletedReadClipboardText,
    Message.FailedReadClipboardText,
  ],
  execute: Effect.tryPromise({
    try: () => navigator.clipboard.readText(),
    catch: () => new Error('clipboard unavailable'),
  }).pipe(
    Effect.map(text => Message.CompletedReadClipboardText({ text })),
    Effect.catch(() => Effect.succeed(Message.FailedReadClipboardText())),
  ),
})

export const ImportPlan = Command.define('ImportPlan', {
  args: { text: Schema.String },
  messages: [Message.SucceededImportPlan, Message.FailedImportPlan],
  execute: ({ text }) =>
    Effect.gen(function* () {
      const maybePlan = planFromText(text)
      if (Option.isNone(maybePlan)) {
        return Message.FailedImportPlan({
          message:
            'That is not a medstack plan. Ask ChatGPT to send only the json block.',
        })
      }
      const plan = maybePlan.value
      const nowMs = yield* Clock.currentTimeMillis
      const idCount = plan.products.length + plan.routines.length
      const ids = yield* Effect.forEach(
        Array.makeBy(idCount, () => 0),
        () => generateUuid(),
      )
      let cursor = 0
      const makeId = (): string => {
        const id = ids[cursor]
        cursor = cursor + 1
        return id ?? ''
      }
      const imported = planImportFromPlan(plan, makeId, nowMs)
      if (imported.products.length === 0) {
        return Message.FailedImportPlan({
          message: 'The plan had no products in it.',
        })
      }
      return Message.SucceededImportPlan(imported)
    }),
})

export const MarkRoutineReviewed = Command.define('MarkRoutineReviewed', {
  args: { routineId: Schema.String },
  messages: [Message.CompletedMarkRoutineReviewed],
  execute: ({ routineId }) =>
    Effect.gen(function* () {
      const atMs = yield* Clock.currentTimeMillis
      return Message.CompletedMarkRoutineReviewed({ routineId, atMs })
    }),
})

const OCR_WORKER_EFFECT = Effect.cached(
  Effect.tryPromise({
    try: async () => {
      const worker = await Tesseract.createWorker('eng', 1, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract/core',
        langPath: '/tesseract/lang',
        logger: () => {},
      })
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
      return worker
    },
    catch: () => new Error('ocr unavailable'),
  }),
)

const canvasFromFile = async (
  file: File.File,
  maxEdge: number,
): Promise<HTMLCanvasElement | null> => {
  const bitmap = await createImageBitmap(file)
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = longest > maxEdge ? maxEdge / longest : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (context === null) {
    bitmap.close()
    return null
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

/**
 * `File.select` cannot ask the phone for the camera, so the plan screen builds its own
 * `<input type="file">` and sets `capture`. Without it, a phone opens the gallery.
 */
const openPhotoPicker = (
  source: PlanPhotoSource,
): Effect.Effect<ReadonlyArray<File.File>> =>
  Effect.callback((resume, signal) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = source === 'library'
    if (source === 'camera') {
      // The property alone does not write the attribute in Chrome, so set it directly.
      input.setAttribute('capture', 'environment')
    }
    input.style.display = 'none'
    const cleanup = () => {
      input.remove()
    }
    const handleChange = () => {
      const files = input.files === null ? [] : Array.fromIterable(input.files)
      cleanup()
      resume(Effect.succeed(files))
    }
    const handleCancel = () => {
      cleanup()
      resume(Effect.succeed([]))
    }
    input.addEventListener('change', handleChange)
    input.addEventListener('cancel', handleCancel)
    signal.addEventListener('abort', cleanup)
    document.body.appendChild(input)
    input.click()
  })

export const SelectPlanPhotos = Command.define('SelectPlanPhotos', {
  args: { source: PlanPhotoSource },
  messages: [Message.SelectedLabelPhotos],
  execute: ({ source }) =>
    openPhotoPicker(source).pipe(
      Effect.map(files => Message.SelectedLabelPhotos({ files })),
    ),
})

export const SelectLabelPhoto = Command.define('SelectLabelPhoto', {
  messages: [Message.SelectedLabelPhoto],
  execute: File.select(['image/*']).pipe(
    Effect.map(maybeFile => Message.SelectedLabelPhoto({ maybeFile })),
  ),
})

export const MakeLabelThumbnail = Command.define('MakeLabelThumbnail', {
  args: { file: File.File },
  messages: [Message.CompletedLabelThumbnail, Message.FailedLabelThumbnail],
  execute: ({ file }) =>
    Effect.tryPromise({
      try: async () => {
        const bitmap = await createImageBitmap(file)
        const size = 112
        const scale = Math.max(size / bitmap.width, size / bitmap.height)
        const width = Math.round(bitmap.width * scale)
        const height = Math.round(bitmap.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d')
        if (context === null) {
          bitmap.close()
          return Message.FailedLabelThumbnail()
        }
        context.drawImage(
          bitmap,
          (size - width) / 2,
          (size - height) / 2,
          width,
          height,
        )
        bitmap.close()
        return Message.CompletedLabelThumbnail({
          thumbnail: canvas.toDataURL('image/webp', 0.72),
        })
      },
      catch: () => new Error('thumbnail'),
    }).pipe(Effect.catch(() => Effect.succeed(Message.FailedLabelThumbnail()))),
})

export const ReadLabelText = Command.define('ReadLabelText', {
  args: { file: File.File },
  messages: [Message.CompletedLabelText, Message.FailedLabelText],
  execute: ({ file }) =>
    Effect.gen(function* () {
      const worker = yield* yield* OCR_WORKER_EFFECT
      const text = yield* Effect.tryPromise({
        try: async () => {
          const canvas = await canvasFromFile(file, 1600)
          if (canvas === null) {
            throw new Error('no canvas')
          }
          const result = await worker.recognize(canvas)
          return result.data.text
        },
        catch: () => new Error('ocr'),
      })
      return Message.CompletedLabelText({ text })
    }).pipe(Effect.catch(() => Effect.succeed(Message.FailedLabelText()))),
})

/**
 * Reads several labels on one OCR worker, one photo after another: the worker handles one
 * job at a time, so firing them in parallel would fail on all but the first.
 */
export const ReadLabelPhotos = Command.define('ReadLabelPhotos', {
  args: { files: Schema.Array(File.File) },
  messages: [Message.CompletedLabelPhotos, Message.FailedLabelText],
  execute: ({ files }) =>
    Effect.gen(function* () {
      const worker = yield* yield* OCR_WORKER_EFFECT
      const read = yield* Effect.forEach(files, file =>
        Effect.tryPromise({
          try: async () => {
            const canvas = await canvasFromFile(file, 1600)
            if (canvas === null) {
              throw new Error('no canvas')
            }
            const result = await worker.recognize(canvas)
            return result.data.text
          },
          catch: () => new Error('ocr'),
        }).pipe(Effect.option),
      )
      const texts = Array.flatMap(read, maybeText =>
        Option.match(maybeText, {
          onNone: () => [],
          onSome: text => (text.trim() === '' ? [] : [text]),
        }),
      )
      const failedCount = read.length - texts.length
      return texts.length === 0
        ? Message.FailedLabelText()
        : Message.CompletedLabelPhotos({ texts, failedCount })
    }).pipe(Effect.catch(() => Effect.succeed(Message.FailedLabelText()))),
})
