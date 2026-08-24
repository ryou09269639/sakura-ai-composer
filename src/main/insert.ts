import { clipboard } from 'electron'
import { getPlatformDriver, type ActiveWindowHandle } from './platform'

export async function captureActiveWindow(): Promise<ActiveWindowHandle | null> {
  try {
    return await getPlatformDriver().captureActiveWindow()
  } catch (err) {
    console.error('[insert] captureActiveWindow failed', err)
    return null
  }
}

export async function insertTextIntoWindow(
  handle: ActiveWindowHandle,
  text: string,
  pressEnter: boolean
): Promise<void> {
  const previousClipboard = clipboard.readText()
  clipboard.writeText(text)
  try {
    await getPlatformDriver().restoreAndPaste(handle, pressEnter)
  } finally {
    setTimeout(() => clipboard.writeText(previousClipboard), 1000)
  }
}
