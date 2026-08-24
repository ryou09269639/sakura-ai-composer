export const IpcChannels = {
  CorrectText: 'ai:correct-text',
  SuggestNext: 'ai:suggest-next',
  InsertText: 'insert:text',
  GetSettings: 'settings:get',
  SaveSettings: 'settings:save',
  HideComposer: 'composer:hide',
  ComposerShown: 'composer:shown',
  ReportInsertResult: 'insert:result'
} as const
