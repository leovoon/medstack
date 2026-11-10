import { Effect, Option, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'

import { BrowserKeyValueStore } from '@effect/platform-browser'

import {
  SavedState,
  StoredSavedStateJsonString,
  hydrateSavedState,
} from './domain'

export const STORAGE_KEY = 'medstack:v1'

export const SavedStateJsonString = Schema.fromJsonString(
  Schema.toCodecJson(SavedState),
)

export const Flags = Schema.Struct({
  maybeSaved: Schema.Option(SavedState),
})
export type Flags = typeof Flags.Type

export const flags: Effect.Effect<Flags> = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore
  const raw = yield* Effect.fromOption(
    Option.fromNullishOr(yield* store.get(STORAGE_KEY)),
  )
  const saved = yield* Schema.decodeEffect(StoredSavedStateJsonString)(raw)
  return { maybeSaved: Option.some(hydrateSavedState(saved)) }
}).pipe(
  Effect.catch(() => Effect.succeed({ maybeSaved: Option.none() })),
  Effect.provide(BrowserKeyValueStore.layerLocalStorage),
)
