import { Clock, Effect, Schema } from 'effect'
import { SecureRandom } from 'effect/crypto'
import { KeyValueStore } from 'effect/persistence'
import { Command } from 'foldkit'
import * as File from 'foldkit/file'

import { BrowserCrypto, BrowserKeyValueStore } from '@effect/platform-browser'

import {
  SavedState,
  StoredSavedStateJsonString,
  dayKeyFromDate,
  hydrateSavedState,
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
