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
  /** trueの場合、AI修正案をTabキーの採用を待たず自動的に下書きへ反映する */
  autoApplyCorrection: boolean
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
