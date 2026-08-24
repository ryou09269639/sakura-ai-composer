import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ActiveWindowHandle, PlatformDriver } from './types'

const execFileAsync = promisify(execFile)

async function runOsascript(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-e', script])
  return stdout.trim()
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

const CAPTURE_SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  return name of frontApp
end tell
`

export const darwinDriver: PlatformDriver = {
  async captureActiveWindow() {
    const appName = await runOsascript(CAPTURE_SCRIPT)
    if (!appName) return null
    return { platform: 'darwin', id: appName, label: appName }
  },

  async restoreAndPaste(handle, pressEnter) {
    const appName = escapeAppleScriptString(handle.id)
    const keys = ['delay 0.15', 'tell application "System Events"']
    keys.push(`  set frontmost of first application process whose name is "${appName}" to true`)
    keys.push('  delay 0.15')
    keys.push('  keystroke "v" using command down')
    if (pressEnter) {
      keys.push('  delay 0.08')
      keys.push('  key code 36')
    }
    keys.push('end tell')
    await runOsascript(keys.join('\n'))
  }
}
