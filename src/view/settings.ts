import type { Html, HtmlBuilder } from 'foldkit/html'

import { Switch } from '@foldkit/ui'

import { Message } from '../message'
import type { Model } from '../model'
import {
  buttonContent,
  fieldLabelClassName,
  helperTextClassName,
  inputClassName,
  secondaryButtonClassName,
} from './components'

export const settingsView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      h.h1(
        [h.Class('text-2xl font-semibold text-[var(--ms-text)] mb-5')],
        ['Settings'],
      ),

      h.div(
        [h.Class('flex flex-col gap-6')],
        [
          h.div(
            [h.Class('flex items-center justify-between gap-3')],
            [
              h.div(
                [],
                [
                  h.p(
                    [h.Class('text-base text-[var(--ms-text)]')],
                    ['Sound when the wait ends'],
                  ),
                  h.p(
                    [h.Class(helperTextClassName)],
                    ['Two quiet blips when the countdown reaches zero.'],
                  ),
                ],
              ),
              Switch.view(
                {
                  id: 'settings-sound',
                  isChecked: model.settings.soundOnWaitEnd,
                  onToggle: isChecked => Message.ToggledSound({ isChecked }),
                  toView: attributes =>
                    h.button(
                      [
                        ...attributes.button,
                        h.Class(
                          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ' +
                            (model.settings.soundOnWaitEnd
                              ? 'bg-[var(--ms-accent)]'
                              : 'bg-[var(--ms-text-2)]/40'),
                        ),
                      ],
                      [
                        h.span([
                          h.Class(
                            'pointer-events-none inline-block h-5 w-5 rounded-full bg-[var(--ms-bg)] shadow transition-transform ' +
                              (model.settings.soundOnWaitEnd
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

          h.div(
            [],
            [
              h.label(
                [h.Class(fieldLabelClassName), h.For('settings-default-wait')],
                ['Default wait (minutes)'],
              ),
              h.input([
                h.Class(inputClassName + ' !w-24 !h-12 text-center'),
                h.Id('settings-default-wait'),
                h.Type('number'),
                h.Min('0'),
                h.Max('240'),
                h.Value(String(model.settings.defaultWaitMinutes)),
                h.OnInput(value => {
                  const parsed = Number.parseInt(value, 10)
                  return Message.UpdatedDefaultWait({
                    minutes: Number.isNaN(parsed) ? 0 : parsed,
                  })
                }),
              ]),
              h.p(
                [h.Class(helperTextClassName + ' mt-1')],
                ['Used to prefill new products.'],
              ),
            ],
          ),

          h.div(
            [h.Class('flex flex-col gap-3')],
            [
              h.button(
                [
                  h.Class(secondaryButtonClassName),
                  h.OnClick(Message.ClickedGetPlan()),
                ],
                buttonContent('Get a plan from ChatGPT', 'external', h),
              ),
              h.p(
                [h.Class(helperTextClassName)],
                [
                  'Copies a prompt you can paste into ChatGPT, then brings its answer back in as products and routines.',
                ],
              ),
              h.button(
                [
                  h.Class(secondaryButtonClassName),
                  h.OnClick(Message.ClickedExport()),
                ],
                buttonContent('Export data', 'download', h),
              ),
              h.button(
                [
                  h.Class(secondaryButtonClassName),
                  h.OnClick(Message.ClickedImport()),
                ],
                buttonContent('Import data', 'upload', h),
              ),
              h.button(
                [
                  h.Class(secondaryButtonClassName),
                  h.OnClick(Message.ClickedClearHistory()),
                ],
                buttonContent('Clear history', 'trash', h),
              ),
              h.button(
                [
                  h.Class(secondaryButtonClassName),
                  h.OnClick(Message.ClickedDeleteEverything()),
                ],
                buttonContent('Delete everything', 'trash', h),
              ),
              h.p(
                [h.Class(helperTextClassName)],
                [
                  'Export saves a JSON file of your data. Import replaces it after confirmation. Clear history deletes logged doses only. Delete everything removes all products, routines, and doses.',
                ],
              ),
            ],
          ),

          h.p(
            [h.Class(helperTextClassName + ' mt-4')],
            [
              'Not medical advice. Follow your doctor’s or pharmacist’s instructions.',
            ],
          ),
          h.p(
            [h.Class('text-sm text-[var(--ms-text-2)]/70')],
            ['medstack 1.0'],
          ),
        ],
      ),
    ],
  )
