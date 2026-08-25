export const IpcChannels = {
  Predict: 'ai:predict',
  Correct: 'ai:correct',
  InsertText: 'insert:text',
  GetSettings: 'settings:get',
  SaveSettings: 'settings:save',
  HideComposer: 'composer:hide',
  ComposerShown: 'composer:shown'
} as const
