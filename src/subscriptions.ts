import { Duration, Effect, Option, Schema, Stream } from 'effect'
import { Subscription } from 'foldkit'

import { BrowserStream } from '@effect/platform-browser'

import { Message } from './message'
import type { Model } from './model'

const isWaiting = (model: Model): boolean =>
  Option.isSome(model.activeRun) &&
  Option.isSome(model.activeRun.value.waitEndsAtMs) &&
  model.page._tag === 'Run'

export const subscriptions = Subscription.make<Model, Message>()(entry => ({
  tick: entry(
    { isWaiting: Schema.Boolean },
    {
      modelToDependencies: model => ({ isWaiting: isWaiting(model) }),
      dependenciesToStream: ({ isWaiting: waiting }) =>
        Stream.when(
          Stream.tick(Duration.millis(1000)).pipe(
            Stream.drop(1),
            Stream.map(() => Message.Ticked()),
          ),
          Effect.sync(() => waiting),
        ),
    },
  ),
  dayRollover: entry(
    {},
    {
      modelToDependencies: () => ({}),
      dependenciesToStream: () =>
        Stream.tick(Duration.millis(60000)).pipe(
          Stream.drop(1),
          Stream.map(() => Message.CheckedDayKey()),
        ),
    },
  ),
  wakeLock: entry(
    { isRunActive: Schema.Boolean },
    {
      modelToDependencies: model => ({
        isRunActive: Option.isSome(model.activeRun),
      }),
      dependenciesToStream: ({ isRunActive }) =>
        Stream.when(
          Stream.concat(
            Stream.succeed(Message.RequestedWakeLock()),
            BrowserStream.fromEventListenerDocument('visibilitychange').pipe(
              Stream.map(() => Message.RequestedWakeLock()),
            ),
          ),
          Effect.sync(() => isRunActive),
        ),
    },
  ),
}))
