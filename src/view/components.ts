import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Dialog } from '@foldkit/ui'

import { ConfirmKind, type Routine, progressDots, routineById } from '../domain'
import type { Model } from '../model'
import { Message } from '../message'

export const cardClassName =
  'rounded-xl bg-[var(--ms-surface)] border border-[var(--ms-border)] p-4'

export const primaryButtonClassName =
  'w-full h-16 rounded-xl bg-[var(--ms-accent)] text-[#1a120a] font-semibold text-base transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center'

export const secondaryButtonClassName =
  'w-full h-12 rounded-xl border border-[var(--ms-border)] text-[var(--ms-text)] font-medium text-base transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center bg-transparent'

export const quietButtonClassName =
  'h-12 px-3 rounded-lg text-[var(--ms-text-2)] text-sm transition-colors cursor-pointer hover:text-[var(--ms-text)]'

export const fieldLabelClassName = 'block text-sm text-[var(--ms-text-2)] mb-1'

export const inputClassName =
  'w-full h-12 px-3 rounded-lg bg-[var(--ms-bg)] border border-[var(--ms-border)] text-[var(--ms-text)] text-base placeholder:text-[var(--ms-text-2)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--ms-accent)] disabled:opacity-50'

export const helperTextClassName = 'text-sm text-[var(--ms-text-2)]'

export const dotsView = (
  routine: Routine,
  doses: Model['doses'],
  dayKey: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex items-center gap-1.5')],
    Array.map(progressDots(routine, doses, dayKey), done =>
      h.span([
        h.Class(
          done
            ? 'h-2 w-2 rounded-full bg-[var(--ms-accent)]'
            : 'h-2 w-2 rounded-full border border-[var(--ms-text-2)]/50',
        ),
      ]),
    ),
  )

export const timePill = (label: string, h: HtmlBuilder<Message>): Html =>
  h.span(
    [
      h.Class(
        'rounded-full border border-[var(--ms-border)] px-2.5 py-1 text-xs text-[var(--ms-text-2)]',
      ),
    ],
    [label],
  )

const dialogPanel = (
  render: Dialog.RenderInfo,
  content: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  h.dialog(
    [
      ...render.dialog,
      h.Class('bg-transparent p-0 open:flex items-center justify-center'),
    ],
    render.isVisible
      ? [
          h.div([
            ...render.backdrop,
            h.Class('fixed inset-0 bg-black/60'),
          ]),
          h.div(
            [
              ...render.panel,
              h.Class(
                'bg-[var(--ms-surface)] rounded-xl border border-[var(--ms-border)] p-5 max-w-sm w-full mx-4 relative',
              ),
            ],
            content,
          ),
        ]
      : [],
  )

type ConfirmOptions = {
  readonly title: string
  readonly description: string
  readonly confirmLabel: string
  readonly onConfirm: Message
  readonly danger: boolean
}

const confirmContent = (
  render: Dialog.RenderInfo,
  options: ConfirmOptions,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.h2(
    [...render.title, h.Class('text-lg font-semibold text-[var(--ms-text)] mb-2')],
    [options.title],
  ),
  h.p(
    [...render.description, h.Class('text-sm text-[var(--ms-text-2)] mb-5')],
    [options.description],
  ),
  h.div([h.Class('flex gap-3 justify-end')], [
    h.button(
      [
        ...render.closeButton,
        h.Class('h-12 px-4 rounded-lg border border-[var(--ms-border)] text-[var(--ms-text)] text-base cursor-pointer'),
      ],
      ['Cancel'],
    ),
    h.button(
      [
        h.Class(
          options.danger
            ? 'h-12 px-4 rounded-lg bg-[var(--ms-text)] text-[var(--ms-bg)] font-semibold text-base cursor-pointer'
            : 'h-12 px-4 rounded-lg bg-[var(--ms-accent)] text-[#1a120a] font-semibold text-base cursor-pointer',
        ),
        h.OnClick(options.onConfirm),
      ],
      [options.confirmLabel],
    ),
  ]),
]

const deleteEverythingContent = (
  render: Dialog.RenderInfo,
  model: Model,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.h2(
    [...render.title, h.Class('text-lg font-semibold text-[var(--ms-text)] mb-2')],
    ['Delete everything?'],
  ),
  h.p(
    [...render.description, h.Class('text-sm text-[var(--ms-text-2)] mb-3')],
    ['Products, routines, doses, and the active run will be deleted. Settings stay. Type delete to confirm.'],
  ),
  h.input([
    h.Class(inputClassName),
    h.Value(model.deleteEverythingText),
    h.Placeholder('type delete'),
    h.AriaLabel('type delete'),
    h.OnInput(value => Message.UpdatedDeleteEverythingText({ value })),
  ]),
  h.div([h.Class('flex gap-3 justify-end mt-5')], [
    h.button(
      [
        ...render.closeButton,
        h.Class('h-12 px-4 rounded-lg border border-[var(--ms-border)] text-[var(--ms-text)] text-base cursor-pointer'),
      ],
      ['Cancel'],
    ),
    h.button(
      [
        h.Class(
          'h-12 px-4 rounded-lg text-[var(--ms-bg)] font-semibold text-base cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ' +
            (model.deleteEverythingText === 'delete' ? 'bg-[var(--ms-text)]' : 'bg-[var(--ms-text-2)]'),
        ),
        h.OnClick(Message.ConfirmedDeleteEverything()),
        h.Disabled(model.deleteEverythingText !== 'delete'),
      ],
      ['Delete'],
    ),
  ]),
]

const routineName = (model: Model, id: string): string =>
  Option.getOrElse(
    Option.map(routineById(model.routines, id), routine => routine.name),
    () => 'This routine',
  )

const productName = (model: Model, id: string): string =>
  Option.getOrElse(
    Option.map(
      Array.findFirst(model.products, product => product.id === id),
      product => product.name,
    ),
    () => 'This product',
  )

export const confirmDialogView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.submodel({
    slotId: model.confirmDialog.id,
    model: model.confirmDialog,
    view: Dialog.view,
    viewInputs: {
      hasDescription: true,
      toView: render => {
        const content = Option.match(model.maybeConfirm, {
          onNone: () => [],
          onSome: confirm =>
            ConfirmKind.match<ReadonlyArray<Html>>(confirm, {
              DeleteRoutine: ({ routineId }) =>
                confirmContent(
                  render,
                  {
                    title: 'Delete routine?',
                    description: `${routineName(model, routineId)} will be removed. Past doses are kept.`,
                    confirmLabel: 'Delete',
                    onConfirm: Message.ConfirmedDeleteRoutine({ routineId }),
                    danger: true,
                  },
                  h,
                ),
              DeleteProduct: ({ productId }) =>
                confirmContent(
                  render,
                  {
                    title: 'Delete product?',
                    description: `${productName(model, productId)} will be removed from routine steps. Past doses are kept.`,
                    confirmLabel: 'Delete',
                    onConfirm: Message.ConfirmedDeleteProduct({ productId }),
                    danger: true,
                  },
                  h,
                ),
              ImportReplace: () =>
                confirmContent(
                  render,
                  {
                    title: 'Import this file?',
                    description: 'Products, routines, and doses will be replaced. Your settings stay as they are.',
                    confirmLabel: 'Import',
                    onConfirm: Message.ConfirmedImport(),
                    danger: false,
                  },
                  h,
                ),
              ClearHistory: () =>
                confirmContent(
                  render,
                  {
                    title: 'Clear history?',
                    description: 'All logged doses will be deleted. Products and routines stay.',
                    confirmLabel: 'Clear',
                    onConfirm: Message.ConfirmedClearHistory(),
                    danger: true,
                  },
                  h,
                ),
              DeleteEverything: () => deleteEverythingContent(render, model, h),
            }),
        })
        return dialogPanel(render, content, h)
      },
    },
    toParentMessage: message => Message.GotConfirmDialogMessage({ message }),
  })

export const stepPickerDialogView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.submodel({
    slotId: model.stepPickerDialog.id,
    model: model.stepPickerDialog,
    view: Dialog.view,
    viewInputs: {
      hasDescription: true,
      toView: render => {
        const candidates = Option.match(model.maybeRoutineDraft, {
          onNone: () => model.products,
          onSome: draft =>
            Array.filter(
              model.products,
              product =>
                !Array.some(draft.steps, step => step.productId === product.id),
            ),
        })
        const content = Array.match(candidates, {
          onEmpty: () => [
            h.p(
              [h.Class('text-sm text-[var(--ms-text-2)] mb-5')],
              ['Every product is already in this routine. Add another product first.'],
            ),
          ],
          onNonEmpty: products => [
            h.h2(
              [...render.title, h.Class('text-lg font-semibold text-[var(--ms-text)] mb-3')],
              ['Add a step'],
            ),
            h.ul(
              [h.Class('flex flex-col')],
              Array.map(products, product =>
                h.keyed('li')(
                  product.id,
                  [h.Class('border-b border-[var(--ms-border)] last:border-0')],
                  [
                    h.div(
                      [h.Class('flex items-center gap-3 py-3 min-h-12')],
                      [
                        h.div([h.Class('flex-1 min-w-0')], [
                          h.p([h.Class('text-base text-[var(--ms-text)] truncate')], [product.name]),
                          h.p([h.Class('text-sm text-[var(--ms-text-2)]')], [product.kind]),
                        ]),
                        h.button(
                          [
                            h.Class('h-12 px-4 rounded-lg bg-[var(--ms-accent)] text-[#1a120a] font-semibold text-sm cursor-pointer'),
                            h.OnClick(
                              Message.SelectedStepProduct({ productId: product.id }),
                            ),
                          ],
                          ['Add'],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        })
        return dialogPanel(render, content, h)
      },
    },
    toParentMessage: message => Message.GotStepPickerDialogMessage({ message }),
  })

const simpleToastView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Option.match(model.maybeToast, {
    onNone: () => h.empty,
    onSome: message =>
      h.div(
        [h.Class('fixed top-4 inset-x-0 z-50 flex justify-center px-5')],
        [
          h.div(
            [
              h.Class(
                'relative rounded-lg border border-[var(--ms-border)] bg-[var(--ms-surface)] px-4 py-3 pr-10 text-[var(--ms-text)] shadow-lg max-w-[360px]',
              ),
            ],
            [
              h.p([h.Class('text-sm')], [message]),
              h.button(
                [
                  h.Class('absolute top-2 right-2 h-9 w-9 rounded text-[var(--ms-text-2)] cursor-pointer'),
                  h.AriaLabel('Dismiss'),
                  h.OnClick(Message.ClickedDismissToast()),
                ],
                ['×'],
              ),
            ],
          ),
        ],
      ),
  })

export const bottomBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const tabs: ReadonlyArray<{
    readonly label: string
    readonly message: Message
    readonly isActive: boolean
  }> = [
    { label: 'Today', message: Message.ClickedTabToday(), isActive: model.page._tag === 'Today' },
    { label: 'Routines', message: Message.ClickedTabRoutines(), isActive: model.page._tag === 'Routines' },
    { label: 'Products', message: Message.ClickedTabProducts(), isActive: model.page._tag === 'Products' },
    { label: 'History', message: Message.ClickedTabHistory(), isActive: model.page._tag === 'History' },
  ]
  return h.nav(
    [h.Class('fixed bottom-0 inset-x-0 border-t border-[var(--ms-border)] bg-[var(--ms-surface)]')],
    [
      h.div(
        [h.Class('max-w-[480px] mx-auto grid grid-cols-4 px-2')],
        tabs.map(tab =>
          h.button(
            [
              h.Class(
                'flex flex-col items-center justify-center gap-1 h-14 text-sm cursor-pointer ' +
                  (tab.isActive ? 'text-[var(--ms-accent)]' : 'text-[var(--ms-text-2)]'),
              ),
              h.OnClick(tab.message),
              ...(tab.isActive ? [h.AriaCurrent('page')] : []),
            ],
            [h.span([], [tab.label])],
          ),
        ),
      ),
    ],
  )
}

export const shell = (
  model: Model,
  body: Html,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('min-h-screen bg-[var(--ms-bg)] text-[var(--ms-text)]')],
    [
      h.div(
        [h.Class('mx-auto max-w-[480px] px-5 pt-5 pb-28 min-h-screen flex flex-col')],
        [body],
      ),
      ...(model.page._tag === 'Run' ? [] : [bottomBar(model, h)]),
      confirmDialogView(model, h),
      stepPickerDialogView(model, h),
      simpleToastView(model, h),
    ],
  )
