import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { PRODUCT_WIZARD_LAST_STEP, productDraftErrors } from '../domain'
import type { ProductDraft, ProductKind } from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import {
  buttonContent,
  fieldLabelClassName,
  helperTextClassName,
  inputClassName,
  optionChipClassName,
  primaryButtonClassName,
  readingLabelView,
  secondaryButtonClassName,
} from './components'
import type { IconName } from './icons'

const STEP_COUNT = PRODUCT_WIZARD_LAST_STEP + 1

const KIND_OPTIONS: ReadonlyArray<{
  readonly kind: ProductKind
  readonly icon: IconName
}> = [
  { kind: 'Cream', icon: 'tube' },
  { kind: 'Ointment', icon: 'jar' },
  { kind: 'Gel', icon: 'droplet' },
  { kind: 'Lotion', icon: 'pumpBottle' },
  { kind: 'Drops', icon: 'dropper' },
  { kind: 'Spray', icon: 'spray' },
  { kind: 'Tablet', icon: 'tablet' },
  { kind: 'Capsule', icon: 'capsule' },
  { kind: 'Syrup', icon: 'bottle' },
  { kind: 'Other', icon: 'dots' },
]

const AMOUNT_OPTIONS: ReadonlyArray<{
  readonly value: string
  readonly icon: IconName
}> = [
  { value: 'Thin layer', icon: 'layer' },
  { value: '2 pumps', icon: 'pumpBottle' },
  { value: 'A few drops', icon: 'droplet' },
  { value: '1 tablet', icon: 'tablet' },
  { value: '1 capsule', icon: 'capsule' },
  { value: '1 spoon', icon: 'spoon' },
]

const WAIT_OPTIONS: ReadonlyArray<number> = [0, 5, 10, 15, 20, 30, 60]

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
      h.Class(secondaryButtonClassName + ' gap-2'),
      h.OnClick(
        draft.wizardStep === 0
          ? Message.ClickedBackFromEditor()
          : Message.ClickedProductBack(),
      ),
    ],
    buttonContent(
      draft.wizardStep === 0 ? 'Cancel' : 'Back',
      draft.wizardStep === 0 ? 'close' : 'arrowLeft',
      h,
    ),
  ),
]

const photoBlock = (
  model: Model,
  draft: ProductDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  draft.thumbnail === ''
    ? h.button(
        [
          h.Class(secondaryButtonClassName + ' w-full mb-4'),
          h.OnClick(Message.ClickedPickLabelPhoto()),
        ],
        buttonContent('Take a photo of the label', 'camera', h),
      )
    : h.div(
        [h.Class('flex items-center gap-3 mb-4')],
        [
          h.img([
            h.Class(
              'h-16 w-16 rounded-xl object-cover shrink-0 border border-[var(--ms-border)]',
            ),
            h.Src(draft.thumbnail),
            h.Alt('Label photo'),
          ]),
          h.button(
            [
              h.Class(secondaryButtonClassName + ' flex-1'),
              h.OnClick(Message.ClickedPickLabelPhoto()),
            ],
            buttonContent('Retake photo', 'refresh', h),
          ),
        ],
      ),
  ...(model.labelStatus === 'reading' ? [readingLabelView(h)] : []),
  ...(model.labelStatus === 'failed'
    ? [
        h.p(
          [h.Class(helperTextClassName + ' mb-4')],
          ['Could not read it. Type the name below.'],
        ),
      ]
    : []),
]

/** `isDisabled` is for the name field only: it is filled from the label photo, so it waits. */
const textField = (
  id: string,
  label: string,
  value: string,
  placeholder: string,
  toMessage: (value: string) => Message,
  h: HtmlBuilder<Message>,
  isDisabled = false,
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
        h.Disabled(isDisabled),
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
    Array.map(KIND_OPTIONS, option =>
      h.keyed('button')(
        option.kind,
        [
          h.Class(optionChipClassName(draft.kind === option.kind)),
          h.OnClick(Message.SelectedProductKind({ kind: option.kind })),
        ],
        buttonContent(option.kind, option.icon, h),
      ),
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
    Array.map(AMOUNT_OPTIONS, option =>
      h.keyed('button')(
        option.value,
        [
          h.Class(optionChipClassName(draft.amount === option.value)),
          h.OnClick(Message.SelectedProductAmount({ value: option.value })),
        ],
        buttonContent(option.value, option.icon, h),
      ),
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
      h.keyed('button')(
        String(minutes),
        [
          h.Class(optionChipClassName(draft.defaultWaitMinutes === minutes)),
          h.OnClick(Message.SelectedProductWait({ minutes })),
        ],
        buttonContent(`${minutes} min`, 'clock', h),
      ),
    ),
  ),
  h.div(
    [h.Class('flex items-center gap-3 mb-2')],
    [
      h.input([
        h.Class(inputClassName + ' !w-28 text-center'),
        h.Id('product-wait'),
        h.Type('number'),
        h.InputMode('numeric'),
        h.EnterKeyHint('done'),
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
          h.Class(optionChipClassName(!draft.asNeeded) + ' !h-16 gap-3'),
          h.OnClick(Message.ToggledProductAsNeeded({ isChecked: false })),
        ],
        buttonContent('Part of a routine', 'list', h),
      ),
      h.button(
        [
          h.Class(optionChipClassName(draft.asNeeded) + ' !h-16 gap-3'),
          h.OnClick(Message.ToggledProductAsNeeded({ isChecked: true })),
        ],
        buttonContent('Only when I need it', 'plusCircle', h),
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
  ]
}

const reviewActions = (
  draft: ProductDraft,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const errors = productDraftErrors(draft)
  const isEditing = Option.isSome(draft.maybeProductId)
  return [
    h.button(
      [
        h.Class(primaryButtonClassName + ' gap-2'),
        h.Disabled(errors.length > 0),
        h.OnClick(Message.SubmittedProduct()),
      ],
      buttonContent(isEditing ? 'Save changes' : 'Add product', 'check', h),
    ),
    ...backRow(draft, h),
    ...(isEditing
      ? [
          h.button(
            [
              h.Class(
                secondaryButtonClassName + ' gap-2 text-[var(--ms-text-2)]',
              ),
              h.OnClick(
                Message.ClickedDeleteProduct({
                  productId: Option.getOrElse(draft.maybeProductId, () => ''),
                }),
              ),
            ],
            buttonContent('Delete product', 'trash', h),
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
              hint(
                'Take a photo of the label and the name fills itself in, or type it.',
                h,
              ),
              ...photoBlock(model, draft, h),
              textField(
                'product-name',
                'Name',
                draft.name,
                'Hydrocortisone',
                value => Message.UpdatedProductName({ value }),
                h,
                model.labelStatus === 'reading',
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

      const canContinue = draft.name.trim() !== ''
      const nextButton = (isEnabled: boolean): Html =>
        h.button(
          [
            h.Class(primaryButtonClassName + ' gap-2'),
            h.Disabled(!isEnabled),
            h.OnClick(Message.ClickedProductNext()),
          ],
          buttonContent('Next', 'arrowRight', h),
        )
      const needsNext = step === 0 || step >= 2
      const actions: ReadonlyArray<Html> =
        step === 6
          ? reviewActions(draft, h)
          : [
              ...(needsNext ? [nextButton(step !== 0 || canContinue)] : []),
              ...backRow(draft, h),
            ]

      return h.div(
        [h.Class('flex flex-col min-h-[70dvh]')],
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
          h.div([h.Class('mt-auto pt-8 flex flex-col gap-3')], actions),
        ],
      )
    },
  })
