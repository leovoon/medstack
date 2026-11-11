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
  primaryButtonClassName,
  quietButtonClassName,
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
 * The two things the user has to tell us live in one block, because one photo of the
 * label is meant to fill both of them.
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
          'Take a photo and both boxes fill in. Fix anything it gets wrong, or type it yourself.',
        ],
      ),
      h.button(
        [
          h.Class(secondaryButtonClassName + ' mb-4'),
          h.Disabled(model.labelStatus === 'reading'),
          h.OnClick(Message.ClickedPickLabelPhoto()),
        ],
        buttonContent(
          model.labelStatus === 'reading'
            ? 'Reading the label...'
            : 'Take a photo of the label',
          'camera',
          h,
        ),
      ),
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
  const prompt = planPrompt(model.planMedicine, model.planLabel)
  return [
    h.p(
      [h.Class(helperTextClassName + ' mb-5')],
      [
        'Fill this in, copy the prompt, and open ChatGPT. Then come back and paste the answer.',
      ],
    ),
    labelBlock(model, h),
    h.button(
      [
        h.Class(primaryButtonClassName + ' gap-2'),
        h.Disabled(model.planMedicine.trim() === ''),
        h.OnClick(Message.ClickedCopyPlanPrompt()),
      ],
      buttonContent('Copy the prompt', 'copy', h),
    ),
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
      h.label(
        [h.Class(fieldLabelClassName), h.For('plan-paste')],
        ['The answer'],
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
