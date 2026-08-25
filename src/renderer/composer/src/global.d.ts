import type {
  AppSettings,
  CorrectRequest,
  CorrectResponse,
  InsertTextRequest,
  InsertTextResult,
  PredictRequest,
  PredictResponse
} from '@shared/types'

declare global {
  interface Window {
    sakuraApi: {
      getSettings: () => Promise<AppSettings>
      saveSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>
      predictCompletion: (req: PredictRequest) => Promise<PredictResponse>
      correctText: (req: CorrectRequest) => Promise<CorrectResponse>
      insertText: (req: InsertTextRequest) => Promise<InsertTextResult>
      hideComposer: () => void
      onComposerShown: (callback: (targetLabel: string | null) => void) => () => void
    }
  }
}

export {}
