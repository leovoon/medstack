import { Array } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Message } from '../message'
import type { Model } from '../model'
import {
  buttonContent,
  cardClassName,
  helperTextClassName,
  primaryButtonClassName,
} from './components'

const groupedProducts = (
  model: Model,
): ReadonlyArray<{
  readonly kind: string
  readonly products: ReadonlyArray<Model['products'][number]>
}> => {
  const kinds = Array.reduce(
    model.products,
    Array.empty<string>(),
    (acc, product) =>
      acc.includes(product.kind) ? acc : [...acc, product.kind],
  )
  return Array.map(kinds, kind => ({
    kind,
    products: Array.filter(model.products, product => product.kind === kind),
  }))
}

export const productsView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      h.div(
        [h.Class('flex items-center justify-between mb-4')],
        [
          h.h1(
            [h.Class('text-2xl font-semibold text-[var(--ms-text)]')],
            ['Products'],
          ),
          h.button(
            [
              h.Class(primaryButtonClassName + ' !w-auto px-5 !h-12'),
              h.OnClick(Message.ClickedNewProduct()),
            ],
            buttonContent('New product', 'plus', h),
          ),
        ],
      ),
      Array.match(model.products, {
        onEmpty: () =>
          h.div(
            [h.Class('text-center mt-16')],
            [
              h.p(
                [h.Class(helperTextClassName + ' max-w-[300px] mx-auto')],
                [
                  'No products yet. Add what the doctor gave you, then put them in a routine.',
                ],
              ),
            ],
          ),
        onNonEmpty: () =>
          h.div(
            [h.Class('flex flex-col gap-6')],
            [
              ...Array.map(groupedProducts(model), group =>
                h.div(
                  [],
                  [
                    h.h2(
                      [
                        h.Class(
                          'text-base font-semibold text-[var(--ms-text)] mb-3',
                        ),
                      ],
                      [group.kind],
                    ),
                    h.div(
                      [h.Class('flex flex-col gap-3')],
                      [
                        ...Array.map(group.products, product =>
                          h.keyed('div')(
                            product.id,
                            [],
                            [
                              h.button(
                                [
                                  h.Class(
                                    cardClassName +
                                      ' w-full text-left cursor-pointer',
                                  ),
                                  h.OnClick(
                                    Message.ClickedEditProduct({
                                      productId: product.id,
                                    }),
                                  ),
                                ],
                                [
                                  h.div(
                                    [h.Class('flex items-center gap-2 mb-1')],
                                    [
                                      ...(product.thumbnail !== ''
                                        ? [
                                            h.img([
                                              h.Class(
                                                'h-10 w-10 rounded-lg object-cover shrink-0 border border-[var(--ms-border)]',
                                              ),
                                              h.Src(product.thumbnail),
                                              h.Alt('Label photo'),
                                            ]),
                                          ]
                                        : []),
                                      h.span(
                                        [
                                          h.Class(
                                            'text-base font-semibold text-[var(--ms-text)]',
                                          ),
                                        ],
                                        [product.name],
                                      ),
                                      ...(product.strength !== ''
                                        ? [
                                            h.span(
                                              [
                                                h.Class(
                                                  'text-sm text-[var(--ms-text-2)]',
                                                ),
                                              ],
                                              [product.strength],
                                            ),
                                          ]
                                        : []),
                                    ],
                                  ),
                                  h.div(
                                    [
                                      h.Class(
                                        'text-sm text-[var(--ms-text-2)]',
                                      ),
                                    ],
                                    [
                                      ...(product.area !== ''
                                        ? [`${product.area} · `]
                                        : []),
                                      product.asNeeded
                                        ? 'as needed'
                                        : `wait ${product.defaultWaitMinutes} min`,
                                    ],
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
      }),
    ],
  )
