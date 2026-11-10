import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Select, Switch } from '@foldkit/ui'

import { type ProductKind, productDraftErrors } from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import {
  fieldLabelClassName,
  helperTextClassName,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from './components'

const KINDS: ReadonlyArray<ProductKind> = [
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

export const productEditorView = (
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(model.maybeProductDraft, {
    onNone: () => h.empty,
    onSome: draft => {
      const errors = productDraftErrors(draft)
      const isValid = errors.length === 0
      const isEditing = Option.isSome(draft.maybeProductId)
      const showWaitError =
        draft.defaultWaitMinutes < 0 || draft.defaultWaitMinutes > 240

      return h.div(
        [],
        [
          h.div(
            [h.Class('flex items-center justify-between mb-4')],
            [
              h.h1(
                [h.Class('text-2xl font-semibold text-[var(--ms-text)]')],
                [isEditing ? 'Edit product' : 'New product'],
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
                    [h.Class(fieldLabelClassName), h.For('product-name')],
                    ['Name'],
                  ),
                  h.input([
                    h.Class(inputClassName),
                    h.Id('product-name'),
                    h.Value(draft.name),
                    h.Placeholder('Clobetasol propionate 0.05%'),
                    h.OnInput(value => Message.UpdatedProductName({ value })),
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
                [],
                [
                  h.label(
                    [h.Class(fieldLabelClassName), h.For('product-strength')],
                    ['Strength (optional)'],
                  ),
                  h.input([
                    h.Class(inputClassName),
                    h.Id('product-strength'),
                    h.Value(draft.strength),
                    h.Placeholder('0.05%'),
                    h.OnInput(value =>
                      Message.UpdatedProductStrength({ value }),
                    ),
                  ]),
                ],
              ),

              h.div(
                [],
                [
                  h.label(
                    [h.Class(fieldLabelClassName), h.For('product-kind')],
                    ['Kind'],
                  ),
                  Select.view(
                    {
                      id: 'product-kind',
                      value: draft.kind,
                      onChange: value => {
                        const kind = KINDS.find(
                          candidate => candidate === value,
                        )
                        return Message.SelectedProductKind({
                          kind: kind ?? draft.kind,
                        })
                      },
                      toView: attributes =>
                        h.div(
                          [h.Class('relative')],
                          [
                            h.select(
                              [
                                ...attributes.select,
                                h.Class(
                                  inputClassName +
                                    ' appearance-none pr-10 cursor-pointer',
                                ),
                              ],
                              Array.map(KINDS, kind =>
                                h.option([h.Value(kind)], [kind]),
                              ),
                            ),
                          ],
                        ),
                    },
                    h,
                  ),
                ],
              ),

              h.div(
                [],
                [
                  h.label(
                    [h.Class(fieldLabelClassName), h.For('product-amount')],
                    ['Amount'],
                  ),
                  h.input([
                    h.Class(inputClassName),
                    h.Id('product-amount'),
                    h.Value(draft.amount),
                    h.Placeholder('thin layer'),
                    h.OnInput(value => Message.UpdatedProductAmount({ value })),
                  ]),
                ],
              ),

              h.div(
                [],
                [
                  h.label(
                    [h.Class(fieldLabelClassName), h.For('product-area')],
                    ['Where'],
                  ),
                  h.input([
                    h.Class(inputClassName),
                    h.Id('product-area'),
                    h.Value(draft.area),
                    h.Placeholder('inner elbows, neck'),
                    h.OnInput(value => Message.UpdatedProductArea({ value })),
                  ]),
                ],
              ),

              h.div(
                [],
                [
                  h.label(
                    [h.Class(fieldLabelClassName), h.For('product-note')],
                    ['Note (optional)'],
                  ),
                  h.input([
                    h.Class(inputClassName),
                    h.Id('product-note'),
                    h.Value(draft.note),
                    h.OnInput(value => Message.UpdatedProductNote({ value })),
                  ]),
                ],
              ),

              h.div(
                [
                  h.Class(
                    draft.asNeeded ? 'opacity-40 pointer-events-none' : '',
                  ),
                ],
                [
                  h.label(
                    [h.Class(fieldLabelClassName), h.For('product-wait')],
                    ['Wait after applying'],
                  ),
                  h.div(
                    [h.Class('flex items-center gap-3')],
                    [
                      h.input([
                        h.Class(inputClassName + ' !w-24 !h-12 text-center'),
                        h.Id('product-wait'),
                        h.Type('number'),
                        h.Min('0'),
                        h.Max('240'),
                        h.Value(String(draft.defaultWaitMinutes)),
                        h.OnInput(value => {
                          const parsed = Number.parseInt(value, 10)
                          return Message.UpdatedProductDefaultWait({
                            minutes: Number.isNaN(parsed) ? 0 : parsed,
                          })
                        }),
                      ]),
                      h.span(
                        [h.Class('text-sm text-[var(--ms-text-2)]')],
                        ['min'],
                      ),
                    ],
                  ),
                  h.p(
                    [h.Class(helperTextClassName + ' mt-1')],
                    ['Time before the next product goes on. 0 means none.'],
                  ),
                  ...(showWaitError
                    ? [
                        h.p(
                          [h.Class('text-sm text-[var(--ms-text-2)] mt-1')],
                          ['Wait must be 0–240 minutes'],
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
                    ['Only as needed'],
                  ),
                  Switch.view(
                    {
                      id: 'product-as-needed',
                      isChecked: draft.asNeeded,
                      onToggle: isChecked =>
                        Message.ToggledProductAsNeeded({ isChecked }),
                      toView: attributes =>
                        h.button(
                          [
                            ...attributes.button,
                            h.Class(
                              'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ' +
                                (draft.asNeeded
                                  ? 'bg-[var(--ms-accent)]'
                                  : 'bg-[var(--ms-text-2)]/40'),
                            ),
                          ],
                          [
                            h.span([
                              h.Class(
                                'pointer-events-none inline-block h-5 w-5 rounded-full bg-[var(--ms-bg)] shadow transition-transform ' +
                                  (draft.asNeeded
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

              h.button(
                [
                  h.Class(primaryButtonClassName),
                  h.Disabled(!isValid),
                  h.OnClick(Message.SubmittedProduct()),
                ],
                [isEditing ? 'Save changes' : 'Add product'],
              ),

              ...(isEditing
                ? [
                    h.button(
                      [
                        h.Class(
                          'h-12 rounded-xl border border-[var(--ms-border)] text-[var(--ms-text-2)] text-base cursor-pointer',
                        ),
                        h.OnClick(
                          Message.ClickedDeleteProduct({
                            productId: Option.getOrElse(
                              draft.maybeProductId,
                              () => '',
                            ),
                          }),
                        ),
                      ],
                      ['Delete product'],
                    ),
                  ]
                : []),
            ],
          ),
        ],
      )
    },
  })
