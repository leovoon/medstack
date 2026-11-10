import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  coveredStepCount,
  dueRoutines,
  formatLongDayKey,
  isLaterThanUsual,
  isRoutineDoneToday,
  isRunFinished,
  routineById,
  verb,
} from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import {
  cardClassName,
  dotsView,
  helperTextClassName,
  primaryButtonClassName,
  quietButtonClassName,
  secondaryButtonClassName,
  timePill,
} from './components'

const headerLine = (model: Model): string => {
  const hasAnyDoses = Array.some(
    model.doses,
    dose => dose.dayKey === model.todayKey,
  )
  if (!hasAnyDoses) {
    return 'Nothing logged yet'
  }
  const visible = Array.filter(
    model.routines,
    routine => !routine.isPaused && routine.steps.length > 0,
  )
  const doneCount = Array.length(
    Array.filter(visible, routine =>
      isRoutineDoneToday(routine, model.doses, model.todayKey),
    ),
  )
  if (visible.length > 0 && doneCount === visible.length) {
    return 'All done. Good night.'
  }
  return `${visible.length} routines · ${doneCount} done`
}

const routineCard = (
  model: Model,
  routine: { readonly id: string },
  h: HtmlBuilder<Message>,
): Html => {
  const fullRoutine = Option.getOrElse(
    routineById(model.routines, routine.id),
    () => null,
  )
  if (fullRoutine === null) {
    return h.empty
  }
  const done = isRoutineDoneToday(fullRoutine, model.doses, model.todayKey)
  const covered = coveredStepCount(fullRoutine, model.doses, model.todayKey)
  const isActive =
    Option.isSome(model.activeRun) &&
    model.activeRun.value.routineId === fullRoutine.id &&
    !done
  const later = !done && isLaterThanUsual(fullRoutine, model.nowMs)
  const actionLabel = done
    ? 'Done ✓'
    : isActive || covered > 0
      ? 'Continue'
      : 'Start'
  const actionMessage = done
    ? Message.ClickedTabHistory()
    : isActive
      ? Message.ClickedResumeRun()
      : Message.ClickedStartRoutine({ routineId: fullRoutine.id })

  return h.div(
    [h.Class(cardClassName)],
    [
      h.div(
        [h.Class('flex items-start gap-3')],
        [
          h.div(
            [h.Class('flex-1 min-w-0')],
            [
              h.div(
                [h.Class('flex items-center gap-2 mb-1')],
                [
                  timePill(
                    Option.match(fullRoutine.scheduledTime, {
                      onNone: () => 'Anytime',
                      onSome: time => time,
                    }),
                    h,
                  ),
                  ...(later
                    ? [
                        h.span(
                          [h.Class('text-xs text-[var(--ms-text-2)]')],
                          ['later than usual'],
                        ),
                      ]
                    : []),
                ],
              ),
              h.h3(
                [h.Class('text-base font-semibold text-[var(--ms-text)] mb-2')],
                [fullRoutine.name],
              ),
            ],
          ),
          h.button(
            [
              h.Class(
                'h-12 shrink-0 px-4 rounded-lg font-semibold text-sm cursor-pointer ' +
                  (done
                    ? 'border border-[var(--ms-border)] text-[var(--ms-text-2)]'
                    : 'bg-[var(--ms-accent)] text-[#1a120a]'),
              ),
              h.OnClick(actionMessage),
            ],
            [actionLabel],
          ),
        ],
      ),
      h.div(
        [h.Class('flex items-center gap-2')],
        [
          dotsView(fullRoutine, model.doses, model.todayKey, h),
          h.span(
            [h.Class('text-xs text-[var(--ms-text-2)]')],
            [`${covered}/${fullRoutine.steps.length}`],
          ),
        ],
      ),
    ],
  )
}

const asNeededSection = (model: Model, h: HtmlBuilder<Message>): Html => {
  const products = Array.filter(model.products, product => product.asNeeded)
  return Array.match(products, {
    onEmpty: () => h.empty,
    onNonEmpty: items =>
      h.div(
        [h.Class('mt-6')],
        [
          h.h2(
            [h.Class('text-base font-semibold text-[var(--ms-text)] mb-3')],
            ['As needed'],
          ),
          h.ul(
            [h.Class('flex flex-col gap-2')],
            [
              ...Array.map(items, product => {
                const todayCount = Array.length(
                  Array.filter(
                    model.doses,
                    dose =>
                      dose.productId === product.id &&
                      dose.dayKey === model.todayKey,
                  ),
                )
                return h.keyed('li')(
                  product.id,
                  [],
                  [
                    h.div(
                      [h.Class('flex items-center gap-3')],
                      [
                        h.div(
                          [h.Class('flex-1 min-w-0')],
                          [
                            h.p(
                              [
                                h.Class(
                                  'text-base text-[var(--ms-text)] truncate',
                                ),
                              ],
                              [product.name],
                            ),
                            h.p(
                              [h.Class('text-sm text-[var(--ms-text-2)]')],
                              [
                                `${verb(product.kind)} · ${
                                  todayCount > 0
                                    ? `${todayCount}× today`
                                    : 'not today'
                                }`,
                              ],
                            ),
                          ],
                        ),
                        h.button(
                          [
                            h.Class(
                              'h-12 w-12 rounded-xl bg-[var(--ms-accent)] text-[#1a120a] text-2xl font-semibold cursor-pointer',
                            ),
                            h.AriaLabel(
                              `${verb(product.kind)} ${product.name}`,
                            ),
                            h.OnClick(
                              Message.ClickedLogAsNeeded({
                                productId: product.id,
                              }),
                            ),
                          ],
                          ['+'],
                        ),
                      ],
                    ),
                  ],
                )
              }),
            ],
          ),
        ],
      ),
  })
}

const activeRunBanner = (model: Model, h: HtmlBuilder<Message>): Html =>
  Option.match(model.activeRun, {
    onNone: () => h.empty,
    onSome: run => {
      const routine = Option.getOrElse(
        routineById(model.routines, run.routineId),
        () => null,
      )
      if (routine === null || isRunFinished(run, routine)) {
        return h.empty
      }
      const total = routine.steps.length
      const current = Math.min(run.stepIndex + 1, total)
      return h.button(
        [
          h.Class(
            'w-full mb-5 rounded-xl border border-[var(--ms-border)] bg-[var(--ms-surface)] p-4 text-left cursor-pointer',
          ),
          h.OnClick(Message.ClickedResumeRun()),
        ],
        [
          h.p(
            [h.Class('text-sm text-[var(--ms-text-2)] mb-1')],
            [`In progress — ${routine.name}, step ${current} of ${total}`],
          ),
          h.div(
            [h.Class('h-1 rounded-full bg-[var(--ms-bg)] overflow-hidden')],
            [
              h.div([
                h.Class('h-full bg-[var(--ms-accent)]'),
                h.Style({ width: `${Math.round((current / total) * 100)}%` }),
              ]),
            ],
          ),
        ],
      )
    },
  })

const setupPanel = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('mt-10 text-center')],
    [
      h.p(
        [h.Class(helperTextClassName + ' mb-6 max-w-[300px] mx-auto')],
        [
          'Add what the doctor gave you, in the order you use it, with the wait between each step.',
        ],
      ),
      h.div(
        [h.Class('flex flex-col gap-3 max-w-[280px] mx-auto')],
        [
          h.button(
            [
              h.Class(primaryButtonClassName),
              h.OnClick(Message.ClickedNewProduct()),
            ],
            ['Add a product'],
          ),
          h.button(
            [
              h.Class(secondaryButtonClassName),
              h.OnClick(Message.ClickedNewRoutine()),
            ],
            ['Create a routine'],
          ),
        ],
      ),
    ],
  )

export const todayView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const { due, pausedCount } = dueRoutines(model.routines)
  const isFirstRun = model.products.length === 0 && model.routines.length === 0

  return h.div(
    [],
    [
      h.div(
        [h.Class('flex items-start justify-between mb-1')],
        [
          h.div(
            [],
            [
              h.h1(
                [h.Class('text-2xl font-semibold text-[var(--ms-text)]')],
                [formatLongDayKey(model.todayKey)],
              ),
              h.p(
                [h.Class('text-base text-[var(--ms-text-2)] mt-1')],
                [headerLine(model)],
              ),
            ],
          ),
          h.button(
            [
              h.Class(quietButtonClassName + ' -mr-3'),
              h.AriaLabel('Settings'),
              h.OnClick(Message.ClickedSettings()),
            ],
            ['Settings'],
          ),
        ],
      ),

      activeRunBanner(model, h),

      isFirstRun
        ? setupPanel(model, h)
        : h.div(
            [],
            [
              Array.match(due, {
                onEmpty: () => h.empty,
                onNonEmpty: routines =>
                  h.div(
                    [h.Class('flex flex-col gap-3 mt-5')],
                    [
                      ...Array.map(routines, routine =>
                        routineCard(model, routine, h),
                      ),
                      ...(pausedCount > 0
                        ? [
                            h.div(
                              [
                                h.Class(
                                  'rounded-xl border border-dashed border-[var(--ms-border)] p-3 text-center text-sm text-[var(--ms-text-2)]',
                                ),
                              ],
                              [`Paused (${pausedCount})`],
                            ),
                          ]
                        : []),
                    ],
                  ),
              }),
              asNeededSection(model, h),
            ],
          ),
    ],
  )
}
