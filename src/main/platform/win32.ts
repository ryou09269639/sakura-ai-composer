import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ActiveWindowHandle, PlatformDriver } from './types'

const execFileAsync = promisify(execFile)

async function runPowerShell(script: string): Promise<string> {
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script
  ])
  return stdout.trim()
}

const CAPTURE_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
Write-Output "$($hwnd.ToInt64())|$($sb.ToString())"
`

function restoreScript(hwndValue: string): string {
  return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Restore {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
$hwnd = [IntPtr]${hwndValue}
[Win32Restore]::ShowWindow($hwnd, 9) | Out-Null
[Win32Restore]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 150
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("^v")
`
}

const ENTER_SCRIPT = `
Start-Sleep -Milliseconds 80
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
`

export const win32Driver: PlatformDriver = {
  async captureActiveWindow() {
    const out = await runPowerShell(CAPTURE_SCRIPT)
    const [id, ...rest] = out.split('|')
    if (!id) return null
    return { platform: 'win32', id, label: rest.join('|') || 'unknown window' }
  },

  async restoreAndPaste(handle, pressEnter) {
    await runPowerShell(restoreScript(handle.id))
    if (pressEnter) {
      await runPowerShell(ENTER_SCRIPT)
    }
  }
}
