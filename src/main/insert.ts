import { clipboard } from 'electron'
import { toErrorMessage } from '@shared/errors'
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
  } catch (err) {
    // 自動貼り付けに失敗した場合、ユーザーが手動でCtrl+V/Cmd+Vできるようクリップボードは書き換えない。
    throw new Error(
      `${toErrorMessage(err)}\n（テキストはクリップボードにコピー済みです。手動で貼り付けてください）`
    )
  }
  // 成功時のみ、元のクリップボード内容へ復元する。
  setTimeout(() => clipboard.writeText(previousClipboard), 1000)
}
