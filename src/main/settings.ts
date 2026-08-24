import Store from 'electron-store'
import type { AppSettings } from '@shared/types'

const defaults: AppSettings = {
  apiBaseUrl: '',
  apiKey: '',
  model: 'gpt-4o-mini',
  toggleHotkey: 'Alt+Space',
  autoPressEnterAfterInsert: false,
  correctionStyle: 'natural',
  contextHistory: []
}

const store = new Store<AppSettings>({
  name: 'sakura-ai-composer-settings',
  defaults
})

export function getSettings(): AppSettings {
  return store.store
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  store.set(patch)
  return store.store
}

export function pushHistory(line: string): void {
  const history = store.get('contextHistory')
  const updated = [...history, line].slice(-30)
  store.set('contextHistory', updated)
}
