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

export interface CorrectTextRequest {
  draft: string
  style: CorrectionStyle
}

export interface CorrectTextResponse {
  corrected: string
  changed: boolean
}

export interface SuggestNextRequest {
  history: string[]
  draft: string
}

export interface SuggestNextResponse {
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
