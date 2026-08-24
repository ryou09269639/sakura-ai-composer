import type {
  AppSettings,
  InsertTextRequest,
  InsertTextResult,
  ProcessDraftRequest,
  ProcessDraftResponse
} from '@shared/types'

declare global {
  interface Window {
    sakuraApi: {
      getSettings: () => Promise<AppSettings>
      saveSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
      processDraft: (req: ProcessDraftRequest) => Promise<ProcessDraftResponse>
      insertText: (req: InsertTextRequest) => Promise<InsertTextResult>
      hideComposer: () => void
      onComposerShown: (callback: (targetLabel: string | null) => void) => () => void
    }
  }
}

export {}
