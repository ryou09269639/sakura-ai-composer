export interface AppSettings {
  apiBaseUrl: string
  apiKey: string
  model: string
  toggleHotkey: string
  autoPressEnterAfterInsert: boolean
  correctionStyle: CorrectionStyle
  contextHistory: string[]
}

export type CorrectionStyle = 'natural' | 'polite' | 'casual'

export interface ProcessDraftRequest {
  draft: string
  history: string[]
  style: CorrectionStyle
  /** falseの場合、次の一言候補は生成しない（送信直前の最終校正など、速度優先の場面用） */
  includeSuggestions: boolean
}

export interface ProcessDraftResponse {
  corrected: string
  changed: boolean
  suggestions: string[]
}

export interface InsertTextRequest {
  text: string
  pressEnter: boolean
}

export interface InsertTextResult {
  ok: boolean
  message: string
}
