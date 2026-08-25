import type {
  AppSettings,
  CorrectRequest,
  CorrectResponse,
  InsertTextRequest,
  InsertTextResult
} from '@shared/types'

declare global {
  interface Window {
    sakuraApi: {
      getSettings: () => Promise<AppSettings>
      saveSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
      correctText: (req: CorrectRequest) => Promise<CorrectResponse>
      insertText: (req: InsertTextRequest) => Promise<InsertTextResult>
      hideComposer: () => void
      onComposerShown: (callback: (targetLabel: string | null) => void) => () => void
    }
  }
}

export {}
