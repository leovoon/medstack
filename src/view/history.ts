import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type DayGroup,
  type DaySection,
  formatDayHeader,
  formatHourMinute,
  groupDosesByDay,
  productById,
} from '../domain'
import type { Model } from '../model'
import { Message } from '../message'
import { cardClassName, helperTextClassName } from './components'

const sectionRows = (
  model: Model,
  section: DaySection,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Array.map(section.doses, dose => {
    const product = Option.getOrElse(
      productById(model.products, dose.productId),
      () => null,
    )
    return h.keyed('li')(dose.id, [], [
      h.div([h.Class('flex items-center justify-between gap-3 py-2 text-base')], [
        h.span(
          [
            h.Class(
              'flex-1 min-w-0 truncate ' +
                (dose.outcome === 'skipped'
                  ? 'text-[var(--ms-text-2)] line-through'
                  : 'text-[var(--ms-text)]'),
            ),
          ],
          [product !== null ? product.name : 'Product removed'],
        ),
        h.span(
          [h.Class('text-sm text-[var(--ms-text-2)] shrink-0')],
          [formatHourMinute(dose.atMs)],
        ),
      ]),
    ])
  })

const dayGroupView = (
  model: Model,
  group: DayGroup,
  isOpen: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.div([h.Class(cardClassName)] , [
    h.button(
      [
        h.Class('w-full flex items-center justify-between cursor-pointer h-12'),
        h.OnClick(Message.ClickedToggleHistoryDay({ dayKey: group.dayKey })),
      ],
      [
        h.span([h.Class('text-base font-semibold text-[var(--ms-text)]')], [
          formatDayHeader(group.dayKey, model.todayKey),
        ]),
        h.span([h.Class('text-sm text-[var(--ms-text-2)]')], [isOpen ? '−' : '+']),
      ],
    ),
    ...(isOpen
      ? [
          h.div([h.Class('mt-2')], [
            ...Array.map(group.sections, section => {
              const sectionTitle =
                section._tag === 'routine' ? section.title : 'As needed'
              return h.div([h.Class('mb-3')], [
                h.p(
                  [h.Class('text-sm text-[var(--ms-text-2)] mb-1')],
                  [sectionTitle],
                ),
                h.ul([h.Class('flex flex-col')], sectionRows(model, section, h)),
              ])
            }),
          ]),
        ]
      : []),
  ])

export const historyView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const groups = groupDosesByDay(model.doses, model.routines)
  const defaultOpen = groups[0]?.dayKey ?? ''
  return h.div([], [
    h.h1([h.Class('text-2xl font-semibold text-[var(--ms-text)] mb-4')], ['History']),
    Array.match(groups, {
      onEmpty: () =>
        h.div(
          [h.Class('text-center mt-16')],
          [h.p([h.Class(helperTextClassName)], ['Nothing logged yet'])],
        ),
      onNonEmpty: items =>
        h.div([h.Class('flex flex-col gap-3')], [
          ...Array.map(items, group =>
            h.keyed('div')(group.dayKey, [], [
              dayGroupView(model, group, isOpenFor(model, group.dayKey, defaultOpen), h),
            ]),
          ),
        ]),
    }),
  ])
}

const isOpenFor = (
  model: Model,
  dayKey: string,
  defaultOpen: string,
): boolean =>
  Option.match(model.historyOpenDayKey, {
    onNone: () => dayKey === defaultOpen,
    onSome: open => open === dayKey,
  })
