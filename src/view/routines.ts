import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { productById, routineById, routineNeedsStep } from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import {
  cardClassName,
  dotsView,
  helperTextClassName,
  primaryButtonClassName,
  timePill,
} from './components'

const routineRow = (
  model: Model,
  id: string,
  h: HtmlBuilder<Message>,
): Html => {
  const routine = Option.getOrElse(routineById(model.routines, id), () => null)
  if (routine === null) {
    return h.empty
  }
  const firstStep = routine.steps[0]
  const firstProduct = firstStep
    ? Option.getOrElse(
        productById(model.products, firstStep.productId),
        () => null,
      )
    : null
  const more = Math.max(0, routine.steps.length - 1)

  return h.div(
    [
      h.Class(cardClassName + ' cursor-pointer'),
      h.OnClick(Message.ClickedEditRoutine({ routineId: id })),
    ],
    [
      h.div(
        [h.Class('flex items-center gap-2 mb-2')],
        [
          timePill(
            Option.match(routine.scheduledTime, {
              onNone: () => 'Anytime',
              onSome: time => time,
            }),
            h,
          ),
          ...(routine.isPaused
            ? [
                h.span(
                  [
                    h.Class(
                      'rounded-full border border-[var(--ms-border)] px-2.5 py-1 text-xs text-[var(--ms-text-2)]',
                    ),
                  ],
                  ['Paused'],
                ),
              ]
            : []),
          ...(routineNeedsStep(routine)
            ? [
                h.span(
                  [
                    h.Class(
                      'rounded-full border border-[var(--ms-border)] px-2.5 py-1 text-xs text-[var(--ms-text-2)]',
                    ),
                  ],
                  ['Needs a step'],
                ),
              ]
            : []),
        ],
      ),
      h.h3(
        [h.Class('text-base font-semibold text-[var(--ms-text)] mb-2')],
        [routine.name],
      ),
      h.div(
        [h.Class('flex items-center justify-between')],
        [
          h.span(
            [h.Class('text-sm text-[var(--ms-text-2)]')],
            [
              `${routine.steps.length} step${routine.steps.length === 1 ? '' : 's'}`,
              ...(firstProduct !== null
                ? [
                    ` · ${firstProduct.name}`,
                    ...(more > 0 ? [` +${more} more`] : []),
                  ]
                : []),
            ],
          ),
          dotsView(routine, model.doses, model.todayKey, h),
        ],
      ),
      h.button(
        [
          h.Class(
            'mt-3 h-12 px-3 rounded-lg border border-[var(--ms-border)] text-sm text-[var(--ms-text-2)] cursor-pointer',
          ),
          h.OnClick(Message.ClickedTabHistory()),
        ],
        ['View log'],
      ),
    ],
  )
}

export const routinesView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      h.div(
        [h.Class('flex items-center justify-between mb-4')],
        [
          h.h1(
            [h.Class('text-2xl font-semibold text-[var(--ms-text)]')],
            ['Routines'],
          ),
          h.button(
            [
              h.Class(primaryButtonClassName + ' !w-auto px-5 !h-12'),
              h.OnClick(Message.ClickedNewRoutine()),
            ],
            ['New routine'],
          ),
        ],
      ),
      Array.match(model.routines, {
        onEmpty: () =>
          h.div(
            [h.Class('text-center mt-16')],
            [
              h.p(
                [h.Class(helperTextClassName + ' max-w-[300px] mx-auto')],
                [
                  'A routine is the order you apply things, with the wait between each step. Create one when you have products.',
                ],
              ),
            ],
          ),
        onNonEmpty: routines =>
          h.div(
            [h.Class('flex flex-col gap-3')],
            [
              ...Array.map(routines, routine =>
                routineRow(model, routine.id, h),
              ),
            ],
          ),
      }),
    ],
  )
