export interface ActiveWindowHandle {
  platform: 'win32' | 'darwin' | 'linux'
  id: string
  label: string
}

export interface PlatformDriver {
  captureActiveWindow(): Promise<ActiveWindowHandle | null>
  restoreAndPaste(handle: ActiveWindowHandle, pressEnter: boolean): Promise<void>
}
