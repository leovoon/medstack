import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Switch } from '@foldkit/ui'

import {
  type RoutineDraft,
  formatShortDate,
  productById,
  routineDraftErrors,
} from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import {
  fieldLabelClassName,
  helperTextClassName,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from './components'

const stepKey = (
  steps: ReadonlyArray<{ readonly productId: string }>,
  productId: string,
  index: number,
): string => {
  const occurrence = Array.length(
    Array.filter(steps.slice(0, index), s => s.productId === productId),
  )
  return `${productId}#${occurrence}`
}

const stepRow = (
  model: Model,
  draft: RoutineDraft,
  index: number,
  h: HtmlBuilder<Message>,
): Html => {
  const step = draft.steps[index]!
  const product = Option.getOrElse(
    productById(model.products, step.productId),
    () => null,
  )
  const productName = product !== null ? product.name : 'Removed product'
  const kind = product !== null ? product.kind : ''
  const hasConflict =
    product !== null && step.waitMinutes !== product.defaultWaitMinutes
  const isFirst = index === 0
  const isLast = index === draft.steps.length - 1

  return h.div(
    [h.Class('border border-[var(--ms-border)] rounded-xl p-3')],
    [
      h.div(
        [h.Class('flex items-center gap-3')],
        [
          h.span(
            [
              h.Class(
                'w-6 shrink-0 text-center text-sm text-[var(--ms-text-2)]',
              ),
            ],
            [String(index + 1)],
          ),
          h.div(
            [h.Class('flex-1 min-w-0')],
            [
              h.p(
                [h.Class('text-base text-[var(--ms-text)] truncate')],
                [productName],
              ),
              h.p([h.Class('text-sm text-[var(--ms-text-2)]')], [kind]),
            ],
          ),
          h.button(
            [
              h.Class(
                'h-12 w-12 rounded-lg text-[var(--ms-text-2)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-30',
              ),
              h.Disabled(isFirst),
              h.AriaLabel(`Move ${productName} up`),
              h.OnClick(Message.ClickedMoveStepUp({ stepIndex: index })),
            ],
            ['↑'],
          ),
          h.button(
            [
              h.Class(
                'h-12 w-12 rounded-lg text-[var(--ms-text-2)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-30',
              ),
              h.Disabled(isLast),
              h.AriaLabel(`Move ${productName} down`),
              h.OnClick(Message.ClickedMoveStepDown({ stepIndex: index })),
            ],
            ['↓'],
          ),
          h.button(
            [
              h.Class(
                'h-12 w-12 rounded-lg text-[var(--ms-text-2)] cursor-pointer',
              ),
              h.AriaLabel(`Remove ${productName}`),
              h.OnClick(Message.ClickedRemoveStep({ stepIndex: index })),
            ],
            ['×'],
          ),
        ],
      ),
      h.div(
        [h.Class('mt-3 flex items-center gap-3')],
        [
          h.label(
            [
              h.Class(fieldLabelClassName + ' mb-0 shrink-0'),
              h.For(`step-wait-${index}`),
            ],
            ['wait'],
          ),
          h.input([
            h.Class(inputClassName + ' !w-24 !h-12 text-center'),
            h.Id(`step-wait-${index}`),
            h.Type('number'),
            h.Min('0'),
            h.Max('240'),
            h.Value(String(step.waitMinutes)),
            h.AriaLabel(`wait minutes for ${productName}`),
            h.OnInput(value => {
              const parsed = Number.parseInt(value, 10)
              return Message.UpdatedStepWait({
                stepIndex: index,
                minutes: Number.isNaN(parsed) ? 0 : parsed,
              })
            }),
          ]),
          h.span([h.Class('text-sm text-[var(--ms-text-2)]')], ['min']),
        ],
      ),
      ...(hasConflict
        ? [
            h.button(
              [
                h.Class(
                  'mt-2 text-sm text-[var(--ms-text-2)] underline cursor-pointer text-left',
                ),
                h.OnClick(Message.ClickedResetStepWait({ stepIndex: index })),
              ],
              [
                `${productName} is set to ${product!.defaultWaitMinutes} min, this step waits ${step.waitMinutes}. Tap to reset.`,
              ],
            ),
          ]
        : []),
    ],
  )
}

export const routineEditorView = (
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(model.maybeRoutineDraft, {
    onNone: () => h.empty,
    onSome: draft => {
      const errors = routineDraftErrors(draft)
      const isValid = errors.length === 0
      const isEditing = Option.isSome(draft.maybeRoutineId)
      const originLine = Option.match(draft.maybeRoutineId, {
        onNone: () => Option.none(),
        onSome: id => {
          const routine = Option.getOrElse(
            Array.findFirst(model.routines, r => r.id === id),
            () => null,
          )
          return routine !== null && routine.origin._tag === 'Plan'
            ? Option.some(routine)
            : Option.none()
        },
      })

      return h.div(
        [],
        [
          h.div(
            [h.Class('flex items-center justify-between mb-4')],
            [
              h.h1(
                [h.Class('text-2xl font-semibold text-[var(--ms-text)]')],
                [isEditing ? 'Edit routine' : 'New routine'],
              ),
              h.button(
                [
                  h.Class(secondaryButtonClassName + ' !w-auto px-5 !h-12'),
                  h.OnClick(Message.ClickedBackFromEditor()),
                ],
                ['Cancel'],
              ),
            ],
          ),

          h.div(
            [h.Class('flex flex-col gap-5')],
            [
              h.div(
                [],
                [
                  h.label(
                    [h.Class(fieldLabelClassName), h.For('routine-name')],
                    ['Name'],
                  ),
                  h.input([
                    h.Class(inputClassName),
                    h.Id('routine-name'),
                    h.Value(draft.name),
                    h.Placeholder('Night routine'),
                    h.OnInput(value => Message.UpdatedRoutineName({ value })),
                  ]),
                  ...(errors.includes('Name is required')
                    ? [
                        h.p(
                          [h.Class('text-sm text-[var(--ms-text-2)] mt-1')],
                          ['Name is required'],
                        ),
                      ]
                    : []),
                ],
              ),

              h.div(
                [h.Class('flex items-center justify-between gap-3')],
                [
                  h.span(
                    [h.Class('text-base text-[var(--ms-text)]')],
                    ['Any time'],
                  ),
                  Switch.view(
                    {
                      id: 'routine-anytime',
                      isChecked: Option.isNone(draft.scheduledTime),
                      onToggle: isChecked =>
                        Message.ToggledRoutineAnytime({ isChecked }),
                      toView: attributes =>
                        h.button(
                          [
                            ...attributes.button,
                            h.Class(
                              'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ' +
                                (Option.isNone(draft.scheduledTime)
                                  ? 'bg-[var(--ms-accent)]'
                                  : 'bg-[var(--ms-text-2)]/40'),
                            ),
                          ],
                          [
                            h.span([
                              h.Class(
                                'pointer-events-none inline-block h-5 w-5 rounded-full bg-[var(--ms-bg)] shadow transition-transform ' +
                                  (Option.isNone(draft.scheduledTime)
                                    ? 'translate-x-6'
                                    : 'translate-x-1'),
                              ),
                            ]),
                          ],
                        ),
                    },
                    h,
                  ),
                ],
              ),

              ...(Option.isSome(draft.scheduledTime)
                ? [
                    h.div(
                      [],
                      [
                        h.label(
                          [h.Class(fieldLabelClassName), h.For('routine-time')],
                          ['Time'],
                        ),
                        h.input([
                          h.Class(inputClassName),
                          h.Id('routine-time'),
                          h.Type('time'),
                          h.Value(
                            Option.getOrElse(
                              draft.scheduledTime,
                              () => '08:00',
                            ),
                          ),
                          h.OnInput(value =>
                            Message.UpdatedRoutineTime({ value }),
                          ),
                        ]),
                      ],
                    ),
                  ]
                : []),

              h.div(
                [h.Class('flex items-center justify-between gap-3')],
                [
                  h.span(
                    [h.Class('text-base text-[var(--ms-text)]')],
                    ['Pause this routine'],
                  ),
                  Switch.view(
                    {
                      id: 'routine-paused',
                      isChecked: draft.isPaused,
                      onToggle: isChecked =>
                        Message.ToggledRoutinePaused({ isChecked }),
                      toView: attributes =>
                        h.button(
                          [
                            ...attributes.button,
                            h.Class(
                              'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ' +
                                (draft.isPaused
                                  ? 'bg-[var(--ms-accent)]'
                                  : 'bg-[var(--ms-text-2)]/40'),
                            ),
                          ],
                          [
                            h.span([
                              h.Class(
                                'pointer-events-none inline-block h-5 w-5 rounded-full bg-[var(--ms-bg)] shadow transition-transform ' +
                                  (draft.isPaused
                                    ? 'translate-x-6'
                                    : 'translate-x-1'),
                              ),
                            ]),
                          ],
                        ),
                    },
                    h,
                  ),
                ],
              ),
              h.p(
                [h.Class(helperTextClassName)],
                ['hidden from Today, history kept'],
              ),

              h.div(
                [],
                [
                  h.label(
                    [h.Class(fieldLabelClassName), h.For('routine-detail')],
                    ['Detail (optional)'],
                  ),
                  h.input([
                    h.Class(inputClassName),
                    h.Id('routine-detail'),
                    h.Value(draft.detail),
                    h.Maxlength(120),
                    h.Placeholder(
                      'Take on an empty stomach, 30 min before food',
                    ),
                    h.OnInput(value => Message.UpdatedRoutineDetail({ value })),
                  ]),
                ],
              ),

              ...Option.match(originLine, {
                onNone: () => [],
                onSome: routine => [
                  h.p(
                    [h.Class(helperTextClassName)],
                    [
                      `from plan · checked ${Option.match(
                        routine.reviewedAtMs,
                        {
                          onNone: () => 'not checked yet',
                          onSome: atMs => formatShortDate(atMs),
                        },
                      )}`,
                    ],
                  ),
                ],
              }),

              h.div(
                [],
                [
                  h.h2(
                    [
                      h.Class(
                        'text-base font-semibold text-[var(--ms-text)] mb-3',
                      ),
                    ],
                    ['Steps'],
                  ),
                  h.ul(
                    [h.Class('flex flex-col gap-3')],
                    [
                      ...Array.map(
                        Array.map(draft.steps, (step, index) => ({
                          key: stepKey(draft.steps, step.productId, index),
                          step,
                          index,
                        })),
                        entry =>
                          h.keyed('li')(
                            entry.key,
                            [],
                            [stepRow(model, draft, entry.index, h)],
                          ),
                      ),
                    ],
                  ),
                  ...(errors.includes('Add at least one step')
                    ? [
                        h.p(
                          [h.Class('text-sm text-[var(--ms-text-2)] mt-1')],
                          ['Add at least one step'],
                        ),
                      ]
                    : []),
                  h.button(
                    [
                      h.Class(secondaryButtonClassName + ' mt-3'),
                      h.OnClick(Message.ClickedAddStep()),
                    ],
                    ['Add step'],
                  ),
                  h.p(
                    [h.Class(helperTextClassName + ' mt-3')],
                    [
                      'Thin medicated creams first, thick emollients and ointments last. Use the wait your doctor or pharmacist gave you.',
                    ],
                  ),
                ],
              ),

              h.button(
                [
                  h.Class(primaryButtonClassName),
                  h.Disabled(!isValid),
                  h.OnClick(Message.SubmittedRoutine()),
                ],
                [isEditing ? 'Save changes' : 'Create routine'],
              ),

              ...(isEditing
                ? [
                    h.button(
                      [
                        h.Class(
                          'h-12 rounded-xl border border-[var(--ms-border)] text-[var(--ms-text-2)] text-base cursor-pointer',
                        ),
                        h.OnClick(
                          Message.ClickedDeleteRoutine({
                            routineId: Option.getOrElse(
                              draft.maybeRoutineId,
                              () => '',
                            ),
                          }),
                        ),
                      ],
                      ['Delete routine'],
                    ),
                  ]
                : []),
            ],
          ),
        ],
      )
    },
  })
