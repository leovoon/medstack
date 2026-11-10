import type { Html, HtmlBuilder } from 'foldkit/html'

import { planPrompt } from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import {
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
    h.div(
      [h.Class('mb-4')],
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
      [h.Class('mb-4')],
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
    h.button(
      [
        h.Class(primaryButtonClassName),
        h.Disabled(model.planMedicine.trim() === ''),
        h.OnClick(Message.ClickedCopyPlanPrompt()),
      ],
      ['Copy the prompt'],
    ),
    h.a(
      [
        h.Class(
          secondaryButtonClassName +
            ' mt-3 no-underline text-center flex items-center justify-center',
        ),
        h.Href(chatGptLink(prompt)),
        h.Target('_blank'),
        h.Rel('noreferrer'),
      ],
      ['Open ChatGPT'],
    ),
    h.button(
      [
        h.Class(secondaryButtonClassName + ' mt-3'),
        h.OnClick(Message.ClickedPlanPasteStep()),
      ],
      ['I have the answer'],
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
      h.Class(primaryButtonClassName),
      h.Disabled(model.planPaste.trim() === ''),
      h.OnClick(Message.SubmittedPlanImport()),
    ],
    ['Import the plan'],
  ),
  h.button(
    [
      h.Class(secondaryButtonClassName + ' mt-3'),
      h.OnClick(Message.ClickedPlanAskStep()),
    ],
    ['Back'],
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
