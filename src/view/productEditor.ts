import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { PRODUCT_WIZARD_LAST_STEP, productDraftErrors } from '../domain'
import type { ProductDraft, ProductKind } from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import {
  fieldLabelClassName,
  helperTextClassName,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from './components'

const STEP_COUNT = PRODUCT_WIZARD_LAST_STEP + 1

const KIND_OPTIONS: ReadonlyArray<ProductKind> = [
  'Cream',
  'Ointment',
  'Gel',
  'Lotion',
  'Drops',
  'Spray',
  'Tablet',
  'Capsule',
  'Syrup',
  'Other',
]

const AMOUNT_OPTIONS: ReadonlyArray<string> = [
  'Thin layer',
  '2 pumps',
  'A few drops',
  '1 tablet',
  '1 capsule',
  '1 spoon',
]

const WAIT_OPTIONS: ReadonlyArray<number> = [0, 5, 10, 15, 20, 30, 60]

const chipClassName = (isActive: boolean): string =>
  'h-14 rounded-xl border text-base font-medium cursor-pointer px-2 ' +
  (isActive
    ? 'border-[var(--ms-accent)] bg-[var(--ms-surface)] text-[var(--ms-text)]'
    : 'border-[var(--ms-border)] bg-transparent text-[var(--ms-text)]')

const progress = (draft: ProductDraft, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('mb-2')],
    [
      h.p(
        [h.Class('text-sm text-[var(--ms-text-2)]')],
        [`Step ${draft.wizardStep + 1} of ${STEP_COUNT}`],
      ),
      h.div(
        [h.Class('h-1 rounded-full bg-[var(--ms-bg)] overflow-hidden mt-2')],
        [
          h.div([
            h.Class('h-full bg-[var(--ms-accent)]'),
            h.Style({
              width: `${Math.round(((draft.wizardStep + 1) / STEP_COUNT) * 100)}%`,
            }),
          ]),
        ],
      ),
    ],
  )

const question = (text: string, h: HtmlBuilder<Message>): Html =>
  h.h1(
    [h.Class('text-2xl font-semibold text-[var(--ms-text)] mt-6 mb-1')],
    [text],
  )

const hint = (text: string, h: HtmlBuilder<Message>): Html =>
  h.p([h.Class(helperTextClassName + ' mb-5')], [text])

const backRow = (
  draft: ProductDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.button(
    [
      h.Class(secondaryButtonClassName + ' mt-3'),
      h.OnClick(
        draft.wizardStep === 0
          ? Message.ClickedBackFromEditor()
          : Message.ClickedProductBack(),
      ),
    ],
    [draft.wizardStep === 0 ? 'Cancel' : 'Back'],
  ),
]

const textField = (
  id: string,
  label: string,
  value: string,
  placeholder: string,
  toMessage: (value: string) => Message,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('mb-4')],
    [
      h.label([h.Class(fieldLabelClassName), h.For(id)], [label]),
      h.input([
        h.Class(inputClassName),
        h.Id(id),
        h.Value(value),
        h.Placeholder(placeholder),
        h.OnInput(toMessage),
      ]),
    ],
  )

const kindStep = (
  draft: ProductDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  question('What kind is it?', h),
  hint('Tap the one that matches the tube, bottle, or box.', h),
  h.div(
    [h.Class('grid grid-cols-2 gap-3')],
    Array.map(KIND_OPTIONS, kind =>
      h.keyed('button')(kind, [
        h.Class(chipClassName(draft.kind === kind)),
        h.OnClick(Message.SelectedProductKind({ kind })),
      ]),
    ),
  ),
]

const amountStep = (
  draft: ProductDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  question('How much goes on?', h),
  hint('Tap one, or type it in your own words.', h),
  h.div(
    [h.Class('grid grid-cols-2 gap-3 mb-4')],
    Array.map(AMOUNT_OPTIONS, amount =>
      h.keyed('button')(amount, [
        h.Class(chipClassName(draft.amount === amount)),
        h.OnClick(Message.SelectedProductAmount({ value: amount })),
      ]),
    ),
  ),
  textField(
    'product-amount',
    'Or type it',
    draft.amount,
    'thin layer on the elbows',
    value => Message.UpdatedProductAmount({ value }),
    h,
  ),
]

const whereStep = (
  draft: ProductDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  question('Where does it go?', h),
  hint('Optional. Leave it empty if it is for the whole body.', h),
  textField(
    'product-area',
    'Where',
    draft.area,
    'inner elbows, neck',
    value => Message.UpdatedProductArea({ value }),
    h,
  ),
]

const waitStep = (
  draft: ProductDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  question('Wait before the next one?', h),
  hint('Only if your doctor or the label says to wait. 0 means no wait.', h),
  h.div(
    [h.Class('grid grid-cols-4 gap-3 mb-4')],
    Array.map(WAIT_OPTIONS, minutes =>
      h.keyed('button')(String(minutes), [
        h.Class(chipClassName(draft.defaultWaitMinutes === minutes)),
        h.OnClick(Message.SelectedProductWait({ minutes })),
      ]),
    ),
  ),
  h.div(
    [h.Class('flex items-center gap-3 mb-2')],
    [
      h.input([
        h.Class(inputClassName + ' !w-28 text-center'),
        h.Id('product-wait'),
        h.Type('number'),
        h.Min('0'),
        h.Max('240'),
        h.Value(String(draft.defaultWaitMinutes)),
        h.AriaLabel('wait minutes'),
        h.OnInput(value => {
          const parsed = Number.parseInt(value, 10)
          return Message.UpdatedProductDefaultWait({
            minutes: Number.isNaN(parsed) ? 0 : parsed,
          })
        }),
      ]),
      h.span([h.Class('text-base text-[var(--ms-text-2)]')], ['min']),
    ],
  ),
]

const usageStep = (
  draft: ProductDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  question('Is it part of a routine?', h),
  hint('Only-when-needed products stay on Today with a + button.', h),
  h.div(
    [h.Class('flex flex-col gap-3')],
    [
      h.button(
        [
          h.Class(chipClassName(!draft.asNeeded) + ' !h-16'),
          h.OnClick(Message.ToggledProductAsNeeded({ isChecked: false })),
        ],
        ['Part of a routine'],
      ),
      h.button(
        [
          h.Class(chipClassName(draft.asNeeded) + ' !h-16'),
          h.OnClick(Message.ToggledProductAsNeeded({ isChecked: true })),
        ],
        ['Only when I need it'],
      ),
    ],
  ),
]

const reviewStep = (
  model: Model,
  draft: ProductDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const errors = productDraftErrors(draft)
  const facts: ReadonlyArray<{
    readonly label: string
    readonly value: string
  }> = [
    { label: 'Name', value: draft.name },
    { label: 'Strength', value: draft.strength === '' ? '—' : draft.strength },
    { label: 'Kind', value: draft.kind },
    { label: 'Amount', value: draft.amount === '' ? '—' : draft.amount },
    { label: 'Where', value: draft.area === '' ? '—' : draft.area },
    {
      label: 'Wait',
      value: draft.asNeeded ? '—' : `${draft.defaultWaitMinutes} min`,
    },
    { label: 'Use', value: draft.asNeeded ? 'Only when needed' : 'Routine' },
  ]
  const isEditing = Option.isSome(draft.maybeProductId)
  return [
    question('Check it over', h),
    h.ul(
      [h.Class('flex flex-col gap-2 mb-5')],
      Array.map(facts, fact =>
        h.li(
          [h.Class('flex gap-3 text-base')],
          [
            h.span(
              [h.Class('w-24 shrink-0 text-[var(--ms-text-2)]')],
              [fact.label],
            ),
            h.span([h.Class('flex-1 text-[var(--ms-text)]')], [fact.value]),
          ],
        ),
      ),
    ),
    textField(
      'product-note',
      'Note (optional)',
      draft.note,
      'not on the face',
      value => Message.UpdatedProductNote({ value }),
      h,
    ),
    ...Array.map(errors, error =>
      h.p([h.Class('text-sm text-[var(--ms-text-2)] mb-2')], [error]),
    ),
    h.button(
      [
        h.Class(primaryButtonClassName),
        h.Disabled(errors.length > 0),
        h.OnClick(Message.SubmittedProduct()),
      ],
      [isEditing ? 'Save changes' : 'Add product'],
    ),
    ...(isEditing
      ? [
          h.button(
            [
              h.Class(
                'h-12 rounded-xl border border-[var(--ms-border)] text-[var(--ms-text-2)] text-base cursor-pointer mt-3',
              ),
              h.OnClick(
                Message.ClickedDeleteProduct({
                  productId: Option.getOrElse(draft.maybeProductId, () => ''),
                }),
              ),
            ],
            ['Delete product'],
          ),
        ]
      : []),
  ]
}

export const productEditorView = (
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(model.maybeProductDraft, {
    onNone: () => h.empty,
    onSome: draft => {
      const step = draft.wizardStep
      const body =
        step === 0
          ? [
              question('What is it?', h),
              hint('Use the name printed on the tube, bottle, or box.', h),
              textField(
                'product-name',
                'Name',
                draft.name,
                'Clobetasol propionate',
                value => Message.UpdatedProductName({ value }),
                h,
              ),
              textField(
                'product-strength',
                'Strength (optional)',
                draft.strength,
                '0.05%',
                value => Message.UpdatedProductStrength({ value }),
                h,
              ),
            ]
          : step === 1
            ? kindStep(draft, h)
            : step === 2
              ? amountStep(draft, h)
              : step === 3
                ? whereStep(draft, h)
                : step === 4
                  ? waitStep(draft, h)
                  : step === 5
                    ? usageStep(draft, h)
                    : reviewStep(model, draft, h)

      const canContinue = step !== 0 || draft.name.trim() !== ''

      return h.div(
        [],
        [
          h.div(
            [h.Class('flex items-center justify-between mb-4')],
            [
              h.h1(
                [h.Class('text-2xl font-semibold text-[var(--ms-text)]')],
                [
                  Option.isSome(draft.maybeProductId)
                    ? 'Edit product'
                    : 'Add a product',
                ],
              ),
            ],
          ),
          progress(draft, h),
          ...body,
          ...(step === 0
            ? [
                h.button(
                  [
                    h.Class(primaryButtonClassName + ' mt-3'),
                    h.Disabled(!canContinue),
                    h.OnClick(Message.ClickedProductNext()),
                  ],
                  ['Next'],
                ),
              ]
            : []),
          ...(step === 1 || step === 5
            ? []
            : step === 2 || step === 3 || step === 4
              ? [
                  h.button(
                    [
                      h.Class(primaryButtonClassName + ' mt-3'),
                      h.OnClick(Message.ClickedProductNext()),
                    ],
                    ['Next'],
                  ),
                ]
              : []),
          ...backRow(draft, h),
        ],
      )
    },
  })
