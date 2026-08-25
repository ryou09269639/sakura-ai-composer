import Store from 'electron-store'
import type { AppSettings } from '@shared/types'
import { DEFAULT_AI_ENGINE_BASE_URL, DEFAULT_AI_ENGINE_MODEL } from '@shared/default-settings'

const defaults: AppSettings = {
  apiBaseUrl: DEFAULT_AI_ENGINE_BASE_URL,
  apiKey: '',
  model: DEFAULT_AI_ENGINE_MODEL,
  toggleHotkey: 'Alt+Space',
  autoPressEnterAfterInsert: false,
  correctionStyle: 'natural',
  contextHistory: [],
  styleSample: '',
  autoApplyCorrection: false
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
