export interface AppSettings {
  apiBaseUrl: string
  apiKey: string
  model: string
  toggleHotkey: string
  autoPressEnterAfterInsert: boolean
  correctionStyle: CorrectionStyle
  contextHistory: string[]
  /** ユーザー本人の過去の発言サンプル（文体模写の参考用。貼り付けたチャット履歴など） */
  styleSample: string
}

export type CorrectionStyle = 'natural' | 'polite' | 'casual'

export interface PredictRequest {
  draft: string
  history: string[]
  style: CorrectionStyle
}

export interface PredictResponse {
  /** draftに続けてそのまま採用できる続きの断片（IMEの予測変換候補に相当） */
  completion: string
}

export interface CorrectRequest {
  draft: string
  style: CorrectionStyle
}

export interface CorrectResponse {
  corrected: string
  changed: boolean
}

export interface InsertTextRequest {
  text: string
  pressEnter: boolean
}

export interface InsertTextResult {
  ok: boolean
  message: string
}
