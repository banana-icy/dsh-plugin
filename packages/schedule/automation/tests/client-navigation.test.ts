import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { apply, inject } from '../src/client/index.js'
import {
  activateAutomationTab,
  findAutomationTab,
  type AutomationTab,
} from '../src/client/navigation.js'

function tab(textContent: string, click: () => void = () => {}): AutomationTab {
  return { textContent, click }
}

test('automation navigation clicks the localized tab and reports opened', () => {
  let clicks = 0
  let unavailable = 0
  const tabs = [tab('Chat'), tab('\n  Automations  ', () => { clicks += 1 })]

  assert.equal(findAutomationTab(tabs, 'Automations'), tabs[1])
  assert.equal(activateAutomationTab(tabs, 'Automations', () => { unavailable += 1 }), 'opened')
  assert.equal(clicks, 1)
  assert.equal(unavailable, 0)
})

test('automation navigation never silently no-ops when hero state has no tabs', () => {
  let unavailable = 0

  assert.equal(activateAutomationTab([], 'Automations', () => { unavailable += 1 }), 'unavailable')
  assert.equal(unavailable, 1)
})

test('client registers the session view and wires model catalog through remote.session', async () => {
  const registrations: Array<{
    readonly options: { readonly name: string; readonly id?: string; readonly inject?: () => unknown }
    readonly component: { readonly name?: string }
  }> = []
  const effects: Array<{ readonly factory: () => unknown; readonly label?: string }> = []
  const ctx = {
    effect: (factory: () => unknown, label?: string) => {
      effects.push({ factory, ...(label === undefined ? {} : { label }) })
    },
    connection: { rpc: { call: async () => ({}) } },
    remote: {
      session: {
        modelCatalog: async () => ({ ok: true, value: { groups: [], failures: [] } }),
      },
    },
    sessions: { refresh: async () => {}, open: () => {} },
    locale: {
      register: () => () => {},
      bind: () => (key: string) => key,
    },
    slots: {
      inject: (_name: string, register: () => void | (() => void)) => { register() },
      register: (options: { readonly name: string; readonly id?: string; readonly inject?: () => unknown }, component: { readonly name?: string }) => {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }

  apply(ctx as never)

  assert.deepEqual(registrations.map(({ options }) => [options.name, options.id]), [
    ['sidebar.action', undefined],
    ['conversation.view', 'automation'],
  ])
  const action = registrations.find(({ options }) => options.name === 'sidebar.action')
  assert.equal(action?.component.name, 'SidebarAction')
  const view = registrations.find(({ options }) => options.name === 'conversation.view')
  assert.equal(view?.component.name, 'AutomationView')
  assert.deepEqual(inject, ['slots', 'locale', 'connection', 'sessions', 'remote', 'remote.session'])
  const injected = view?.options.inject?.() as { readonly loadModelCatalog: () => Promise<unknown> }
  assert.deepEqual(await injected.loadModelCatalog(), { groups: [], failures: [] })
})

test('the sidebar entry is a contributed action row with namespaced styles', () => {
  const actionSource = readFileSync(new URL('../src/client/SidebarAction.tsx', import.meta.url), 'utf8')
  const styleSource = readFileSync(new URL('../src/client/styles.ts', import.meta.url), 'utf8')

  assert.match(actionSource, /SidebarRow/)
  assert.match(actionSource, /rail=\{!wide\}/)
  assert.match(actionSource, /role="status"/)
  assert.match(actionSource, /sidebar\.unavailable/)
  assert.match(styleSource, /\.dsh-automation-sidebar-notice\{/)
  assert.doesNotMatch(styleSource, /dsh-automation-sidebar-entry/)
})
