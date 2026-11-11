import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Switch } from '@foldkit/ui'

import {
  ROUTINE_PRESETS,
  ROUTINE_TIME_OPTIONS,
  type RoutineDraft,
  formatShortDate,
  productById,
  routineDraftErrors,
} from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import {
  buttonContent,
  fieldLabelClassName,
  helperTextClassName,
  inputClassName,
  optionChip,
  optionChipClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from './components'
import { type IconName, icon, kindIcon } from './icons'

const STEP_COUNT = 3
const LAST_STEP = STEP_COUNT - 1

const PRESET_ICONS: Record<string, IconName> = {
  Morning: 'sunrise',
  Midday: 'sun',
  Evening: 'sunset',
  Night: 'moon',
  'After shower': 'shower',
  'Before bed': 'bed',
}

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

const question = (text: string, h: HtmlBuilder<Message>): Html =>
  h.h1(
    [h.Class('text-2xl font-semibold text-[var(--ms-text)] mt-6 mb-1')],
    [text],
  )

const hint = (text: string, h: HtmlBuilder<Message>): Html =>
  h.p([h.Class(helperTextClassName + ' mb-5')], [text])

const progress = (stepIndex: number, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('mb-2')],
    [
      h.p(
        [h.Class('text-sm text-[var(--ms-text-2)]')],
        [`Step ${stepIndex + 1} of ${STEP_COUNT}`],
      ),
      h.div(
        [h.Class('h-1 rounded-full bg-[var(--ms-bg)] overflow-hidden mt-2')],
        [
          h.div([
            h.Class('h-full bg-[var(--ms-accent)]'),
            h.Style({
              width: `${Math.round(((stepIndex + 1) / STEP_COUNT) * 100)}%`,
            }),
          ]),
        ],
      ),
    ],
  )

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
  const kind = product !== null ? product.kind : 'Other'
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
                'w-6 shrink-0 text-center text-sm text-[var(--ms-accent)]',
              ),
            ],
            [String(index + 1)],
          ),
          icon(kindIcon(kind), h, 'h-5 w-5 shrink-0 text-[var(--ms-text-2)]'),
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
            [icon('arrowLeft', h, 'h-5 w-5 rotate-90')],
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
            [icon('arrowRight', h, 'h-5 w-5 rotate-90')],
          ),
          h.button(
            [
              h.Class(
                'h-12 w-12 rounded-lg text-[var(--ms-text-2)] cursor-pointer',
              ),
              h.AriaLabel(`Remove ${productName}`),
              h.OnClick(Message.ClickedRemoveStep({ stepIndex: index })),
            ],
            [icon('close', h, 'h-5 w-5')],
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
            h.InputMode('numeric'),
            h.EnterKeyHint('done'),
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

/** A product the routine does not use yet: one tap appends it as the next step. */
const addRow = (
  product: Model['products'][number],
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Class(
        'w-full flex items-center gap-3 min-h-14 px-3 rounded-xl border border-[var(--ms-border)] cursor-pointer text-left',
      ),
      h.OnClick(Message.SelectedStepProduct({ productId: product.id })),
    ],
    [
      icon(
        kindIcon(product.kind),
        h,
        'h-5 w-5 shrink-0 text-[var(--ms-text-2)]',
      ),
      h.span(
        [h.Class('flex-1 min-w-0')],
        [
          h.span(
            [h.Class('block text-base text-[var(--ms-text)] truncate')],
            [product.name],
          ),
          h.span(
            [h.Class('block text-sm text-[var(--ms-text-2)]')],
            [
              product.area === ''
                ? `${product.defaultWaitMinutes} min wait`
                : `${product.area} · ${product.defaultWaitMinutes} min wait`,
            ],
          ),
        ],
      ),
      icon('plus', h, 'h-5 w-5 shrink-0 text-[var(--ms-accent)]'),
    ],
  )

const nameStep = (
  draft: RoutineDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  question('When do you use it?', h),
  hint('Tap one — the name and time are filled in for you.', h),
  h.div(
    [h.Class('grid grid-cols-2 gap-3 mb-5')],
    Array.map(ROUTINE_PRESETS, preset =>
      h.keyed('button')(
        preset.name,
        [
          h.Class(optionChipClassName(draft.name === preset.name)),
          h.OnClick(
            Message.SelectedRoutinePreset({
              name: preset.name,
              time: preset.time,
            }),
          ),
        ],
        [
          icon(PRESET_ICONS[preset.name] ?? 'clock', h),
          h.span([], [preset.name]),
        ],
      ),
    ),
  ),
  h.div(
    [],
    [
      h.label(
        [h.Class(fieldLabelClassName), h.For('routine-name')],
        ['Or name it yourself'],
      ),
      h.input([
        h.Class(inputClassName),
        h.Id('routine-name'),
        h.Value(draft.name),
        h.Placeholder('Night routine'),
        h.OnInput(value => Message.UpdatedRoutineName({ value })),
      ]),
    ],
  ),
]

const productsStep = (
  model: Model,
  draft: RoutineDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const unused = Array.filter(
    model.products,
    product => !Array.some(draft.steps, step => step.productId === product.id),
  )
  const isEmpty = model.products.length === 0
  return [
    question('Which products, in what order?', h),
    hint(
      'Tap in the order you apply them. The wait is what you set for each.',
      h,
    ),
    ...(draft.steps.length === 0
      ? []
      : [
          h.ul(
            [h.Class('flex flex-col gap-3 mb-5')],
            Array.map(
              Array.map(draft.steps, (step, index) => ({
                key: stepKey(draft.steps, step.productId, index),
                index,
              })),
              entry =>
                h.keyed('li')(
                  entry.key,
                  [],
                  [stepRow(model, draft, entry.index, h)],
                ),
            ),
          ),
        ]),
    ...(isEmpty
      ? [
          h.p(
            [h.Class(helperTextClassName + ' mb-5')],
            ['Add a product first, then come back and put it in order.'],
          ),
        ]
      : unused.length === 0
        ? draft.steps.length === 0
          ? []
          : [
              h.p(
                [h.Class(helperTextClassName + ' mb-5')],
                ['Every product is already in this routine.'],
              ),
            ]
        : [
            h.p(
              [
                h.Class(
                  fieldLabelClassName +
                    ' !text-base !text-[var(--ms-text)] mb-3',
                ),
              ],
              ['Add a product'],
            ),
            h.ul(
              [h.Class('flex flex-col gap-3')],
              Array.map(unused, product =>
                h.keyed('li')(product.id, [], [addRow(product, h)]),
              ),
            ),
          ]),
    h.p(
      [h.Class(helperTextClassName + ' mt-5')],
      [
        'Thin medicated creams first, thick emollients and ointments last. Use the wait your doctor or pharmacist gave you.',
      ],
    ),
  ]
}

const timeChipLabel = (value: string): string =>
  value === '' ? 'Any time' : value

const reviewStep = (
  model: Model,
  draft: RoutineDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const errors = routineDraftErrors(draft)
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
  return [
    question('Check it over', h),
    h.label([h.Class(fieldLabelClassName), h.For('routine-name')], ['Name']),
    h.input([
      h.Class(inputClassName + ' mb-5'),
      h.Id('routine-name'),
      h.Value(draft.name),
      h.Placeholder('Night routine'),
      h.OnInput(value => Message.UpdatedRoutineName({ value })),
    ]),
    h.p(
      [
        h.Class(
          fieldLabelClassName + ' !text-base !text-[var(--ms-text)] mb-3',
        ),
      ],
      ['Time'],
    ),
    h.div(
      [h.Class('grid grid-cols-3 gap-3 mb-3')],
      Array.map(ROUTINE_TIME_OPTIONS, value =>
        optionChip(
          timeChipLabel(value),
          'clock',
          Option.getOrElse(draft.scheduledTime, () => '') === value,
          value === ''
            ? Message.ToggledRoutineAnytime({ isChecked: true })
            : Message.UpdatedRoutineTime({ value }),
          h,
          true,
        ),
      ),
    ),
    h.div(
      [h.Class('flex items-center gap-3 mb-5')],
      [
        h.input([
          h.Class(inputClassName + ' !w-40'),
          h.Id('routine-time'),
          h.Type('time'),
          h.Value(Option.getOrElse(draft.scheduledTime, () => '')),
          h.AriaLabel('exact time'),
          h.OnInput(value => Message.UpdatedRoutineTime({ value })),
        ]),
        h.span([h.Class(helperTextClassName)], ['or set an exact time']),
      ],
    ),
    h.div(
      [h.Class('mb-1')],
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
          h.Placeholder('Take on an empty stomach, 30 min before food'),
          h.OnInput(value => Message.UpdatedRoutineDetail({ value })),
        ]),
      ],
    ),
    h.div(
      [h.Class('flex items-center justify-between gap-3 mt-5 mb-1')],
      [
        h.span(
          [h.Class('text-base text-[var(--ms-text)]')],
          ['Pause this routine'],
        ),
        Switch.view(
          {
            id: 'routine-paused',
            isChecked: draft.isPaused,
            onToggle: isChecked => Message.ToggledRoutinePaused({ isChecked }),
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
                        (draft.isPaused ? 'translate-x-6' : 'translate-x-1'),
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
      [h.Class(helperTextClassName + ' mb-5')],
      ['hidden from Today, history kept'],
    ),
    ...Option.match(originLine, {
      onNone: (): ReadonlyArray<Html> => [],
      onSome: routine => [
        h.p(
          [h.Class(helperTextClassName)],
          [
            `from plan · checked ${Option.match(routine.reviewedAtMs, {
              onNone: () => 'not checked yet',
              onSome: atMs => formatShortDate(atMs),
            })}`,
          ],
        ),
        ...(Option.isNone(routine.reviewedAtMs)
          ? [
              h.button(
                [
                  h.Class(secondaryButtonClassName + ' gap-2 mt-2'),
                  h.OnClick(
                    Message.ClickedMarkRoutineReviewed({
                      routineId: routine.id,
                    }),
                  ),
                ],
                buttonContent('I checked this', 'check', h),
              ),
            ]
          : []),
      ],
    }),
    ...Array.map(errors, error =>
      h.p([h.Class('text-sm text-[var(--ms-text-2)] mt-3')], [error]),
    ),
  ]
}

export const routineEditorView = (
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(model.maybeRoutineDraft, {
    onNone: () => h.empty,
    onSome: draft => {
      const step = Math.min(Math.max(model.routineWizardStep, 0), LAST_STEP)
      const isEditing = Option.isSome(draft.maybeRoutineId)
      const errors = routineDraftErrors(draft)
      const body =
        step === 0
          ? nameStep(draft, h)
          : step === 1
            ? productsStep(model, draft, h)
            : reviewStep(model, draft, h)
      const nextButton = (isEnabled: boolean): Html =>
        h.button(
          [
            h.Class(primaryButtonClassName + ' gap-2'),
            h.Disabled(!isEnabled),
            h.OnClick(Message.ClickedRoutineNext()),
          ],
          buttonContent('Next', 'arrowRight', h),
        )
      const backButton = h.button(
        [
          h.Class(secondaryButtonClassName + ' gap-2'),
          h.OnClick(Message.ClickedRoutineBack()),
        ],
        buttonContent('Back', 'arrowLeft', h),
      )
      const actions: ReadonlyArray<Html> =
        step === 0
          ? [nextButton(draft.name.trim() !== '')]
          : step === 1
            ? [nextButton(true), backButton]
            : [
                h.button(
                  [
                    h.Class(primaryButtonClassName + ' gap-2'),
                    h.Disabled(errors.length > 0),
                    h.OnClick(Message.SubmittedRoutine()),
                  ],
                  buttonContent(
                    isEditing ? 'Save changes' : 'Create routine',
                    'check',
                    h,
                  ),
                ),
                backButton,
                ...(isEditing
                  ? [
                      h.button(
                        [
                          h.Class(
                            secondaryButtonClassName +
                              ' gap-2 text-[var(--ms-text-2)]',
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
                        buttonContent('Delete routine', 'trash', h),
                      ),
                    ]
                  : []),
              ]

      return h.div(
        [h.Class('flex flex-col min-h-[70dvh]')],
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
                  h.Class(
                    secondaryButtonClassName + ' !w-auto px-5 !h-12 gap-2',
                  ),
                  h.OnClick(Message.ClickedBackFromEditor()),
                ],
                buttonContent('Cancel', 'close', h),
              ),
            ],
          ),
          progress(step, h),
          ...body,
          h.div([h.Class('mt-auto pt-8 flex flex-col gap-3')], actions),
        ],
      )
    },
  })
