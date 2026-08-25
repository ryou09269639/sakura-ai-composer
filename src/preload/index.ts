import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type {
  AppSettings,
  CorrectRequest,
  CorrectResponse,
  InsertTextRequest,
  InsertTextResult
} from '@shared/types'

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IpcChannels.GetSettings),

  saveSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannels.SaveSettings, patch),

  correctText: (req: CorrectRequest): Promise<CorrectResponse> =>
    ipcRenderer.invoke(IpcChannels.Correct, req),

  insertText: (req: InsertTextRequest): Promise<InsertTextResult> =>
    ipcRenderer.invoke(IpcChannels.InsertText, req),

  hideComposer: (): void => ipcRenderer.send(IpcChannels.HideComposer),

  onComposerShown: (callback: (targetLabel: string | null) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, label: string | null): void => callback(label)
    ipcRenderer.on(IpcChannels.ComposerShown, listener)
    return () => ipcRenderer.removeListener(IpcChannels.ComposerShown, listener)
  }
}

contextBridge.exposeInMainWorld('sakuraApi', api)

export type SakuraApi = typeof api
