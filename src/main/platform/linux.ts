import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ActiveWindowHandle, PlatformDriver } from './types'

const execFileAsync = promisify(execFile)

function assertX11(): void {
  const sessionType = (process.env.XDG_SESSION_TYPE || '').toLowerCase()
  if (sessionType === 'wayland') {
    throw new Error(
      'Waylandセッションではウィンドウ操作の自動化に未対応です（xdotoolが動作しません）。' +
        'X11セッションでログインするか、コピー機能のみをご利用ください。'
    )
  }
}

async function runXdotool(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('xdotool', args)
    return stdout.trim()
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        'xdotool が見つかりません。`sudo apt install xdotool` 等でインストールしてください。'
      )
    }
    throw err
  }
}

export const linuxDriver: PlatformDriver = {
  async captureActiveWindow() {
    assertX11()
    const id = await runXdotool(['getactivewindow'])
    if (!id) return null
    const name = await runXdotool(['getwindowname', id]).catch(() => 'unknown window')
    return { platform: 'linux', id, label: name }
  },

  async restoreAndPaste(handle, pressEnter) {
    assertX11()
    await runXdotool(['windowactivate', '--sync', handle.id])
    await runXdotool(['key', '--clearmodifiers', 'ctrl+v'])
    if (pressEnter) {
      await runXdotool(['key', '--clearmodifiers', 'Return'])
    }
  }
}
