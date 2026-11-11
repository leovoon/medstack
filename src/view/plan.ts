import type { Html, HtmlBuilder } from 'foldkit/html'

import { planPrompt } from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import {
  buttonContent,
  cardClassName,
  fieldLabelClassName,
  helperTextClassName,
  inputClassName,
  optionChip,
  primaryButtonClassName,
  quietButtonClassName,
  readingLabelView,
  secondaryButtonClassName,
} from './components'

const chatGptLink = (prompt: string): string =>
  `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`

const header = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex items-center justify-between mb-4')],
    [
      h.h1(
        [h.Class('text-2xl font-semibold text-[var(--ms-text)]')],
        ['Get a plan'],
      ),
      h.button(
        [
          h.Class(quietButtonClassName + ' -mr-3'),
          h.OnClick(Message.ClickedTabToday()),
        ],
        ['Close'],
      ),
    ],
  )

/**
 * The round trip is two steps, not one screen: say what it is, then bring the answer back.
 * Saying which step you are on is what keeps the second half from being a surprise.
 */
const progress = (stage: Model['planStage'], h: HtmlBuilder<Message>): Html => {
  const stepIndex = stage === 'ask' ? 0 : 1
  return h.div(
    [h.Class('mb-5')],
    [
      h.p(
        [h.Class('text-sm text-[var(--ms-text-2)]')],
        [`Step ${stepIndex + 1} of 2`],
      ),
      h.div(
        [
          h.Class(
            'h-1 rounded-full bg-[var(--ms-surface)] overflow-hidden mt-2',
          ),
        ],
        [
          h.div([
            h.Class('h-full bg-[var(--ms-accent)]'),
            h.Style({ width: `${Math.round(((stepIndex + 1) / 2) * 100)}%` }),
          ]),
        ],
      ),
    ],
  )
}

const photoButton = (
  label: string,
  source: 'camera' | 'library',
  iconName: 'camera' | 'plus',
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Class(secondaryButtonClassName + ' flex-1 basis-[8.5rem]'),
      h.Disabled(model.labelStatus === 'reading'),
      h.OnClick(Message.ClickedPickPlanPhotos({ source })),
    ],
    buttonContent(label, iconName, h),
  )

/**
 * The two things the user has to tell us live in one block, because the photos of the
 * labels are meant to fill both of them.
 */
const labelBlock = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class(cardClassName + ' mb-4')],
    [
      h.p(
        [h.Class('text-base font-medium text-[var(--ms-text)]')],
        ['The label'],
      ),
      h.p(
        [h.Class(helperTextClassName + ' mb-3')],
        [
          'One photo per label fills both boxes. Take them in any order and fix anything it gets wrong.',
        ],
      ),
      h.div(
        [h.Class('flex flex-wrap gap-3 mb-4')],
        [
          photoButton('Camera', 'camera', 'camera', model, h),
          photoButton('Gallery', 'library', 'plus', model, h),
        ],
      ),
      ...(model.labelStatus === 'reading' ? [readingLabelView(h)] : []),
      ...(model.labelStatus === 'failed'
        ? [
            h.p(
              [h.Class(helperTextClassName + ' mb-3')],
              ['Could not read it. Type it instead.'],
            ),
          ]
        : []),
      h.div(
        [h.Class('mb-3')],
        [
          h.label(
            [h.Class(fieldLabelClassName), h.For('plan-medicine')],
            ['What did the doctor give you?'],
          ),
          h.input([
            h.Class(inputClassName),
            h.Id('plan-medicine'),
            h.Value(model.planMedicine),
            h.Placeholder('Clobetasol cream and vitamin D tablets'),
            h.Disabled(model.labelStatus === 'reading'),
            h.OnInput(value => Message.UpdatedPlanMedicine({ value })),
          ]),
        ],
      ),
      h.div(
        [],
        [
          h.label(
            [h.Class(fieldLabelClassName), h.For('plan-label')],
            ['Copy what the label says'],
          ),
          h.textarea([
            h.Class(inputClassName + ' !h-32 py-3'),
            h.Id('plan-label'),
            h.Rows(5),
            h.Value(model.planLabel),
            h.Placeholder('Apply thinly to affected areas twice a day.'),
            h.Disabled(model.labelStatus === 'reading'),
            h.OnInput(value => Message.UpdatedPlanLabel({ value })),
          ]),
        ],
      ),
    ],
  )

const askStage = (
  model: Model,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const prompt = planPrompt(
    model.planMedicine,
    model.planLabel,
    model.planScope,
  )
  return [
    h.p(
      [h.Class(helperTextClassName + ' mb-5')],
      [
        'Fill this in, copy the prompt, and open ChatGPT. Then come back and paste the answer.',
      ],
    ),
    labelBlock(model, h),
    h.div(
      [h.Class('mb-5')],
      [
        h.p(
          [h.Class(fieldLabelClassName)],
          ['How many plans did the doctor give you?'],
        ),
        h.div(
          [h.Class('grid grid-cols-2 gap-3')],
          [
            optionChip(
              'One plan',
              'sparkle',
              model.planScope === 'one',
              Message.SelectedPlanScope({ scope: 'one' }),
              h,
            ),
            optionChip(
              'Several plans',
              'list',
              model.planScope === 'many',
              Message.SelectedPlanScope({ scope: 'many' }),
              h,
            ),
          ],
        ),
      ],
    ),
    h.button(
      [
        h.Class(primaryButtonClassName + ' gap-2'),
        h.Disabled(model.planMedicine.trim() === ''),
        h.OnClick(Message.ClickedCopyPlanPrompt()),
      ],
      buttonContent(
        model.planPromptState === 'copied'
          ? 'Prompt copied'
          : 'Copy the prompt',
        model.planPromptState === 'copied' ? 'check' : 'copy',
        h,
      ),
    ),
    ...(model.planPromptState === 'copied'
      ? [
          h.p(
            [h.Class(helperTextClassName + ' mt-2')],
            ['Paste it into ChatGPT, then come back with the answer.'],
          ),
        ]
      : model.planPromptState === 'failed'
        ? [
            h.p(
              [h.Class(helperTextClassName + ' mt-2')],
              ['Could not copy. Open the prompt below and copy it by hand.'],
            ),
          ]
        : []),
    h.a(
      [
        h.Class(
          secondaryButtonClassName +
            ' mt-3 gap-2 no-underline text-center flex items-center justify-center',
        ),
        h.Href(chatGptLink(prompt)),
        h.Target('_blank'),
        h.Rel('noreferrer'),
      ],
      buttonContent('Open ChatGPT', 'external', h),
    ),
    h.button(
      [
        h.Class(secondaryButtonClassName + ' mt-3 gap-2'),
        h.OnClick(Message.ClickedPlanPasteStep()),
      ],
      buttonContent('I have the answer', 'clipboard', h),
    ),
    h.details(
      [h.Class('mt-6')],
      [
        h.summary(
          [h.Class(helperTextClassName + ' cursor-pointer py-2')],
          ['Show the prompt'],
        ),
        h.pre(
          [
            h.Class(
              'mt-2 whitespace-pre-wrap break-words text-sm text-[var(--ms-text-2)] bg-[var(--ms-surface)] border border-[var(--ms-border)] rounded-xl p-3',
            ),
          ],
          [prompt],
        ),
      ],
    ),
  ]
}

const pasteStage = (
  model: Model,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.p(
    [h.Class(helperTextClassName + ' mb-5')],
    [
      'Paste everything ChatGPT answered. Extra words around the json are fine.',
    ],
  ),
  h.div(
    [h.Class('mb-4')],
    [
      h.div(
        [h.Class('flex items-center justify-between')],
        [
          h.label(
            [h.Class('text-sm text-[var(--ms-text-2)]'), h.For('plan-paste')],
            ['The answer'],
          ),
          h.button(
            [
              h.Class(quietButtonClassName + ' -mr-3'),
              h.OnClick(Message.ClickedPlanPasteFromClipboard()),
            ],
            buttonContent('Paste', 'clipboard', h),
          ),
        ],
      ),
      h.textarea([
        h.Class(inputClassName + ' !h-56 py-3'),
        h.Id('plan-paste'),
        h.Rows(10),
        h.Value(model.planPaste),
        h.Placeholder('```json\n{ "schema": "medstack.plan/1", ... }\n```'),
        h.OnInput(value => Message.UpdatedPlanPaste({ value })),
      ]),
    ],
  ),
  h.button(
    [
      h.Class(primaryButtonClassName + ' gap-2'),
      h.Disabled(model.planPaste.trim() === ''),
      h.OnClick(Message.SubmittedPlanImport()),
    ],
    buttonContent('Import the plan', 'check', h),
  ),
  h.button(
    [
      h.Class(secondaryButtonClassName + ' mt-3 gap-2'),
      h.OnClick(Message.ClickedPlanAskStep()),
    ],
    buttonContent('Back', 'arrowLeft', h),
  ),
]

export const planView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      header(h),
      progress(model.planStage, h),
      ...(model.planStage === 'ask'
        ? askStage(model, h)
        : pasteStage(model, h)),
      h.div(
        [h.Class('mt-8')],
        [
          h.p(
            [h.Class(cardClassName + ' ' + helperTextClassName)],
            [
              'Nothing leaves this phone on its own. You copy the prompt, and you paste the answer.',
            ],
          ),
        ],
      ),
    ],
  )
