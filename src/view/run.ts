import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type Run,
  formatHourMinute,
  formatMmSs,
  isRunFinished,
  productById,
  remainingMs,
  routineById,
  verb,
} from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import {
  buttonContent,
  primaryButtonClassName,
  quietButtonClassName,
  secondaryButtonClassName,
} from './components'

const stepProduct = (
  model: Model,
  routineId: string,
  stepIndex: number,
): Option.Option<NonNullable<Model['products'][number]>> =>
  Option.match(routineById(model.routines, routineId), {
    onNone: () => Option.none(),
    onSome: routine => {
      const step = routine.steps[stepIndex]
      return step ? productById(model.products, step.productId) : Option.none()
    },
  })

const readyView = (
  model: Model,
  run: Run,
  routine: {
    readonly name: string
    readonly steps: readonly {
      readonly productId: string
      readonly waitMinutes: number
    }[]
  },
  h: HtmlBuilder<Message>,
): Html => {
  const step = routine.steps[run.stepIndex]
  if (step === undefined) {
    return h.empty
  }
  const product = Option.getOrElse(
    stepProduct(model, run.routineId, run.stepIndex),
    () => null,
  )
  if (product === null) {
    return h.empty
  }
  const hasNext = run.stepIndex + 1 < routine.steps.length
  const verbLabel = verb(product.kind) === 'Apply' ? 'Applied' : 'Taken'
  const facts: ReadonlyArray<{
    readonly label: string
    readonly value: string
  }> = [
    { label: 'Amount', value: product.amount },
    { label: 'Where', value: product.area },
    ...(hasNext && step.waitMinutes > 0
      ? [
          {
            label: 'Wait',
            value: `then ${step.waitMinutes} min before the next step`,
          },
        ]
      : []),
    ...(product.note !== '' ? [{ label: 'Note', value: product.note }] : []),
  ]

  return h.div(
    [h.Class('flex-1 flex flex-col justify-end pb-8')],
    [
      h.div(
        [h.Class('mb-8')],
        [
          h.h1(
            [
              h.Class(
                'text-3xl font-semibold text-[var(--ms-text)] text-wrap-balance mb-1',
              ),
            ],
            [product.name],
          ),
          h.p(
            [h.Class('text-base text-[var(--ms-text-2)]')],
            [product.strength],
          ),
        ],
      ),
      h.ul(
        [h.Class('flex flex-col gap-3 mb-8')],
        [
          ...Array.map(facts, fact =>
            h.li(
              [h.Class('flex gap-3 text-base')],
              [
                h.span(
                  [h.Class('w-16 shrink-0 text-[var(--ms-text-2)]')],
                  [fact.label],
                ),
                h.span([h.Class('flex-1 text-[var(--ms-text)]')], [fact.value]),
              ],
            ),
          ),
        ],
      ),
      h.div(
        [h.Class('flex flex-col gap-3')],
        [
          h.button(
            [
              h.Class(primaryButtonClassName),
              h.OnClick(Message.ClickedApplyStep()),
            ],
            buttonContent(verbLabel, 'check', h),
          ),
          h.button(
            [
              h.Class(secondaryButtonClassName),
              h.OnClick(Message.ClickedSkipStep()),
            ],
            buttonContent('Skip', 'close', h),
          ),
        ],
      ),
    ],
  )
}

const waitingView = (
  model: Model,
  run: Run,
  routine: {
    readonly steps: readonly {
      readonly productId: string
      readonly waitMinutes: number
    }[]
  },
  h: HtmlBuilder<Message>,
): Html => {
  const waitEndsAtMs = Option.getOrElse(run.waitEndsAtMs, () => 0)
  const remaining = remainingMs(waitEndsAtMs, model.nowMs)
  const isZero = remaining === 0
  const step = routine.steps[run.stepIndex]
  const doneProduct = Option.getOrElse(
    stepProduct(model, run.routineId, run.stepIndex),
    () => null,
  )
  const nextProduct = Option.getOrElse(
    stepProduct(model, run.routineId, run.stepIndex + 1),
    () => null,
  )
  const waitTotal = Math.max(1, (step?.waitMinutes ?? 0) * 60000)
  const elapsed = Math.max(0, Math.min(waitTotal, waitTotal - remaining))
  const fraction = elapsed / waitTotal

  return h.div(
    [h.Class('flex-1 flex flex-col justify-end pb-8')],
    [
      h.div(
        [h.Class('mb-8 text-center')],
        [
          h.p(
            [h.Class('text-base text-[var(--ms-text-2)] mb-6')],
            [
              doneProduct !== null && step !== undefined
                ? `${doneProduct.name} ✓ ${formatHourMinute(waitEndsAtMs - step.waitMinutes * 60000)}`
                : '',
            ],
          ),
          h.p(
            [
              h.Class(
                'text-6xl font-semibold leading-none tabular-nums tracking-tight text-[var(--ms-text)]',
              ),
            ],
            [isZero ? 'Ready' : formatMmSs(remaining)],
          ),
          h.div(
            [
              h.Class(
                'h-1.5 rounded-full bg-[var(--ms-bg)] overflow-hidden mt-6 mx-auto max-w-[280px]',
              ),
            ],
            [
              h.div([
                h.Class(
                  'h-full bg-[var(--ms-accent)] transition-[width] duration-1000 ease-out motion-reduce:transition-none',
                ),
                h.Style({
                  width: `${Math.round(isZero ? 100 : fraction * 100)}%`,
                }),
              ]),
            ],
          ),
          h.p(
            [h.Class('text-base text-[var(--ms-text-2)] mt-6')],
            [nextProduct !== null ? `Next: ${nextProduct.name}` : ''],
          ),
        ],
      ),
      h.div(
        [h.Class('flex flex-col gap-3')],
        [
          h.button(
            [
              h.Class(primaryButtonClassName),
              h.OnClick(Message.ClickedNext()),
              h.Disabled(!isZero),
            ],
            [isZero ? 'Ready' : formatMmSs(remaining)],
          ),
          h.button(
            [
              h.Class(secondaryButtonClassName),
              h.OnClick(Message.ClickedSkipWait()),
            ],
            buttonContent('Skip wait', 'arrowRight', h),
          ),
        ],
      ),
    ],
  )
}

const finishedView = (
  model: Model,
  run: Run,
  routine: {
    readonly name: string
    readonly steps: readonly {
      readonly productId: string
      readonly waitMinutes: number
    }[]
  },
  h: HtmlBuilder<Message>,
): Html => {
  const rows = Array.map(routine.steps, step => {
    const product = Option.getOrElse(
      productById(model.products, step.productId),
      () => null,
    )
    const dose = Array.findFirst(
      model.doses,
      d =>
        d.dayKey === run.dayKey &&
        Option.getOrElse(d.routineId, () => '') === run.routineId &&
        d.productId === step.productId,
    )
    return { product, dose }
  })
  return h.div(
    [h.Class('flex-1 flex flex-col justify-end pb-8')],
    [
      h.h1(
        [
          h.Class(
            'text-3xl font-semibold text-[var(--ms-text)] mb-8 text-center',
          ),
        ],
        ['Done for today'],
      ),
      h.ul(
        [h.Class('flex flex-col gap-2 mb-8')],
        [
          ...Array.map(rows, row =>
            h.li(
              [h.Class('flex items-center justify-between gap-3 text-base')],
              [
                h.span(
                  [h.Class('flex-1 min-w-0 truncate text-[var(--ms-text)]')],
                  [row.product !== null ? row.product.name : 'Product removed'],
                ),
                Option.match(row.dose, {
                  onNone: () =>
                    h.span([h.Class('text-[var(--ms-text-2)]')], ['—']),
                  onSome: dose =>
                    h.span(
                      [
                        h.Class(
                          dose.outcome === 'skipped'
                            ? 'text-[var(--ms-text-2)] line-through'
                            : 'text-[var(--ms-text-2)]',
                        ),
                      ],
                      [formatHourMinute(dose.atMs)],
                    ),
                }),
              ],
            ),
          ),
        ],
      ),
      h.button(
        [h.Class(primaryButtonClassName), h.OnClick(Message.ClickedExitRun())],
        buttonContent('Back to today', 'arrowLeft', h),
      ),
    ],
  )
}

const noRunView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        'flex-1 flex flex-col items-center justify-center text-center gap-6',
      ),
    ],
    [
      h.p(
        [h.Class('text-base text-[var(--ms-text-2)]')],
        ['Start a routine from Today.'],
      ),
      h.button(
        [
          h.Class(secondaryButtonClassName + ' !w-auto px-5'),
          h.OnClick(Message.ClickedExitRun()),
        ],
        buttonContent('Back to today', 'arrowLeft', h),
      ),
    ],
  )

export const runView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Option.match(model.activeRun, {
    onNone: () => noRunView(h),
    onSome: run => {
      const routine = Option.getOrElse(
        routineById(model.routines, run.routineId),
        () => null,
      )
      if (routine === null) {
        return noRunView(h)
      }
      const total = routine.steps.length
      const finished = isRunFinished(run, routine)
      const current = finished ? total : Math.min(run.stepIndex + 1, total)

      return h.div(
        [h.Class('flex-1 flex flex-col min-h-0')],
        [
          h.div(
            [h.Class('mb-6')],
            [
              h.div(
                [h.Class('flex items-center justify-between mb-2')],
                [
                  h.p(
                    [h.Class('text-sm text-[var(--ms-text-2)]')],
                    [`Step ${current} of ${total}`],
                  ),
                  h.button(
                    [
                      h.Class(quietButtonClassName + ' -mr-3'),
                      h.OnClick(Message.ClickedExitRun()),
                    ],
                    ['Exit'],
                  ),
                ],
              ),
              h.div(
                [h.Class('h-1 rounded-full bg-[var(--ms-bg)] overflow-hidden')],
                [
                  h.div([
                    h.Class('h-full bg-[var(--ms-accent)]'),
                    h.Style({
                      width: `${Math.round((current / total) * 100)}%`,
                    }),
                  ]),
                ],
              ),
              h.h1(
                [h.Class('text-2xl font-semibold text-[var(--ms-text)] mt-4')],
                [routine.name],
              ),
              ...(routine.detail !== ''
                ? [
                    h.p(
                      [h.Class('text-sm text-[var(--ms-text-2)] mt-1')],
                      [routine.detail],
                    ),
                  ]
                : []),
            ],
          ),
          finished
            ? finishedView(model, run, routine, h)
            : Option.isSome(run.waitEndsAtMs)
              ? waitingView(model, run, routine, h)
              : readyView(model, run, routine, h),
          h.div(
            [h.Class('sr-only')],
            [
              h.span(
                [h.AriaLive('polite')],
                [
                  Option.isSome(run.waitEndsAtMs) &&
                  remainingMs(
                    Option.getOrElse(run.waitEndsAtMs, () => 0),
                    model.nowMs,
                  ) === 0
                    ? 'Ready for the next step.'
                    : '',
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('sr-only')],
            [
              h.span(
                [h.AriaLive('polite')],
                [finished ? 'Done for today.' : ''],
              ),
            ],
          ),
        ],
      )
    },
  })
