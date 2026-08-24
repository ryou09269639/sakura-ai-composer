export const IpcChannels = {
  ProcessDraft: 'ai:process-draft',
  InsertText: 'insert:text',
  GetSettings: 'settings:get',
  SaveSettings: 'settings:save',
  HideComposer: 'composer:hide',
  ComposerShown: 'composer:shown'
} as const
