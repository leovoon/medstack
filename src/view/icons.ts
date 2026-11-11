import type { Html, HtmlBuilder } from 'foldkit/html'

import type { ProductKind } from '../domain'
import type { Message } from '../message'

/**
 * A hand-drawn line icon set. No dependency: every icon is a 24×24 stroke path drawn with
 * `currentColor`, so it inherits the text colour of whatever chip or button holds it.
 */
const PATHS = {
  // carrier forms
  tube: ['M9 3h6v3H9z', 'M8 6h8l1.5 3v9a2 2 0 0 1-2 2H8.5a2 2 0 0 1-2-2V9z'],
  jar: ['M6 4h12v5H6z', 'M7 9h10v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z'],
  droplet: ['M12 3.5c0 0 6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10z'],
  pumpBottle: [
    'M8 10h8v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z',
    'M11 10V5h2v5',
    'M13 5h5v2h-5',
  ],
  dropper: [
    'M17 3a3 3 0 0 1 0 6l-1.5 1.5-4-4L13 5a3 3 0 0 1 4-2z',
    'M11.5 6.5l-7 7v3h3l7-7',
  ],
  spray: ['M8 11h7v9H8z', 'M10 11V8h3v3', 'M16 5h2M17 8h2M16 11h2'],
  tablet: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M8 12h8'],
  capsule: ['M8.5 3.5h4a5 5 0 0 1 0 10h-4a5 5 0 0 1 0-10z', 'M10.5 3.5v10'],
  bottle: ['M10 3h4v2h-4z', 'M10 5h4v4h-4z', 'M9 9h6v11H9z'],
  dots: ['M6 12h.01M12 12h.01M18 12h.01'],

  // amounts
  layer: ['M12 4l8 4-8 4-8-4z', 'M4 12l8 4 8-4', 'M4 16l8 4 8-4'],
  spoon: ['M7 13.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M9.5 16.5L19 7'],

  // time and order
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  list: ['M8 6h12M8 12h12M8 18h12', 'M4 6h.01M4 12h.01M4 18h.01'],

  // parts of the day
  sunrise: [
    'M12 3v3',
    'M5.6 8.6l2.1 2.1M18.4 8.6l-2.1 2.1',
    'M2 17h20M6 17a6 6 0 0 1 12 0',
  ],
  sun: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M12 2v2M12 20v2M2 12h2M20 12h2',
    'M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19',
  ],
  sunset: ['M2 20h20M6 20a6 6 0 0 1 12 0', 'M12 6v6M9.4 9.4L12 12l2.6-2.6'],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z'],
  shower: [
    'M3 20V9a5 5 0 0 1 10 0',
    'M13 8l4-1.5',
    'M15 13h.01M18 16h.01M14 17h.01',
  ],
  bed: ['M3 18v-7h13a4 4 0 0 1 4 4v3M3 18h18', 'M7 11V8h4v3'],

  // actions
  arrowRight: ['M4 12h15M13 6l6 6-6 6'],
  arrowLeft: ['M20 12H5M11 18l-6-6 6-6'],
  close: ['M6 6l12 12M18 6L6 18'],
  check: ['M4 12.5l5 5L20 6.5'],
  plus: ['M12 5v14M5 12h14'],
  plusCircle: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8v8M8 12h8'],
  camera: [
    'M4 8h3l1.5-2h7L17 8h3v11H4z',
    'M12 10a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z',
  ],
  refresh: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v5h-5'],
  pencil: ['M4 20h4l10-10-4-4L4 16z', 'M14 6l4 4'],
  trash: ['M4 7h16M9 7V4h6v3', 'M6 7l1 13h10l1-13M10 11v6M14 11v6'],
  copy: ['M8 8h12v13H8z', 'M4 16V3h12'],
  external: ['M13 4h7v7', 'M20 4l-9 9', 'M10 5H4v15h15v-6'],
  download: ['M12 4v11M7 11l5 5 5-5', 'M4 20h16'],
  upload: ['M12 20V9M7 13l5-5 5 5', 'M4 4h16'],
  clipboard: ['M8 4h8v3H8z', 'M16 6h3v15H5V6h3'],

  // the plan
  sparkle: [
    'M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 16.6l-1.9-4.9L5 9.8l5.1-1.9z',
    'M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z',
  ],

  // tabs
  today: [
    'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    'M2 20h20M6 20a6 6 0 0 1 12 0',
  ],
  box: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5M12 12v9'],
} as const

export type IconName = keyof typeof PATHS

const KIND_ICONS: Record<ProductKind, IconName> = {
  Cream: 'tube',
  Ointment: 'jar',
  Gel: 'droplet',
  Lotion: 'pumpBottle',
  Drops: 'dropper',
  Spray: 'spray',
  Tablet: 'tablet',
  Capsule: 'capsule',
  Syrup: 'bottle',
  Other: 'dots',
}

export const kindIcon = (kind: ProductKind): IconName => KIND_ICONS[kind]

export const icon = (
  name: IconName,
  h: HtmlBuilder<Message>,
  className = 'h-5 w-5 shrink-0',
): Html =>
  h.svg(
    [
      h.Class(className),
      h.ViewBox('0 0 24 24'),
      h.Fill('none'),
      h.Stroke('currentColor'),
      h.StrokeWidth('1.7'),
      h.StrokeLinecap('round'),
      h.StrokeLinejoin('round'),
      h.AriaHidden(true),
    ],
    PATHS[name].map(d => h.path([h.D(d)])),
  )
