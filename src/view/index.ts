import type { Document, HtmlBuilder } from 'foldkit/html'

import { Page } from '../domain'
import { Message } from '../message'
import type { Model } from '../model'
import { shell } from './components'
import { historyView } from './history'
import { productEditorView } from './productEditor'
import { productsView } from './products'
import { routineEditorView } from './routineEditor'
import { routinesView } from './routines'
import { runView } from './run'
import { settingsView } from './settings'
import { todayView } from './today'

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const body = Page.match(model.page, {
    Today: () => todayView(model, h),
    Run: () => runView(model, h),
    Routines: () => routinesView(model, h),
    RoutineEditor: () => routineEditorView(model, h),
    Products: () => productsView(model, h),
    ProductEditor: () => productEditorView(model, h),
    History: () => historyView(model, h),
    Settings: () => settingsView(model, h),
  })

  return {
    title: 'medstack',
    body: shell(model, body, h),
  }
}
