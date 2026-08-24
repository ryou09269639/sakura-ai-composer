import type {
  AppSettings,
  CorrectTextRequest,
  CorrectTextResponse,
  InsertTextRequest,
  InsertTextResult,
  SuggestNextRequest,
  SuggestNextResponse
} from '@shared/types'

declare global {
  interface Window {
    sakuraApi: {
      getSettings: () => Promise<AppSettings>
      saveSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
      correctText: (req: CorrectTextRequest) => Promise<CorrectTextResponse>
      suggestNext: (req: SuggestNextRequest) => Promise<SuggestNextResponse>
      insertText: (req: InsertTextRequest) => Promise<InsertTextResult>
      hideComposer: () => void
      onComposerShown: (callback: (targetLabel: string | null) => void) => () => void
    }
  }
}

export {}
