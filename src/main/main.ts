import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { IpcChannels } from '@shared/ipc-channels'
import type {
  AppSettings,
  CorrectTextRequest,
  InsertTextRequest,
  InsertTextResult,
  SuggestNextRequest
} from '@shared/types'
import { getSettings, saveSettings, pushHistory } from './settings'
import { correctText, suggestNext } from '@ai/client'
import { captureActiveWindow, insertTextIntoWindow } from './insert'
import type { ActiveWindowHandle } from './platform'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let composerWindow: BrowserWindow | null = null
let tray: Tray | null = null
let lastActiveWindow: ActiveWindowHandle | null = null

const isDev = !app.isPackaged

function createComposerWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 460,
    height: 320,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/composer/index.html'))
  }

  win.on('blur', () => {
    if (!isDev) win.hide()
  })

  return win
}

function positionNearCursor(win: BrowserWindow): void {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { width, height } = win.getBounds()
  const x = Math.min(cursor.x, display.workArea.x + display.workArea.width - width - 16)
  const y = Math.min(cursor.y, display.workArea.y + display.workArea.height - height - 16)
  win.setPosition(Math.max(x, display.workArea.x), Math.max(y, display.workArea.y))
}

async function toggleComposer(): Promise<void> {
  if (!composerWindow) return

  if (composerWindow.isVisible()) {
    composerWindow.hide()
    return
  }

  lastActiveWindow = await captureActiveWindow()
  positionNearCursor(composerWindow)
  composerWindow.show()
  composerWindow.focus()
  composerWindow.webContents.send(IpcChannels.ComposerShown, lastActiveWindow?.label ?? null)
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.GetSettings, (): AppSettings => getSettings())

  ipcMain.handle(IpcChannels.SaveSettings, (_e, patch: Partial<AppSettings>): AppSettings =>
    saveSettings(patch)
  )

  ipcMain.handle(IpcChannels.CorrectText, async (_e, req: CorrectTextRequest) => {
    const settings = getSettings()
    return correctText({ ...settings, correctionStyle: req.style }, req.draft)
  })

  ipcMain.handle(IpcChannels.SuggestNext, async (_e, req: SuggestNextRequest) => {
    const settings = getSettings()
    const suggestions = await suggestNext(settings, req.history, req.draft)
    return { suggestions }
  })

  ipcMain.handle(
    IpcChannels.InsertText,
    async (_e, req: InsertTextRequest): Promise<InsertTextResult> => {
      if (!lastActiveWindow) {
        return { ok: false, message: '挿入先のウィンドウ情報がありません。もう一度ホットキーで呼び出してください。' }
      }
      try {
        composerWindow?.hide()
        await new Promise((resolve) => setTimeout(resolve, 60))
        await insertTextIntoWindow(lastActiveWindow, req.text, req.pressEnter)
        pushHistory(req.text)
        return { ok: true, message: '挿入しました。' }
      } catch (err) {
        composerWindow?.show()
        composerWindow?.focus()
        return { ok: false, message: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.on(IpcChannels.HideComposer, () => {
    composerWindow?.hide()
  })
}

function createTray(): void {
  const icon = nativeImage.createFromPath(join(__dirname, '../../build/tray-icon.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('さくらAIコンポーザー')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'コンポーザーを開く', click: () => toggleComposer() },
      { type: 'separator' },
      { label: '終了', click: () => app.quit() }
    ])
  )
  tray.on('click', () => toggleComposer())
}

app.whenReady().then(() => {
  composerWindow = createComposerWindow()
  registerIpcHandlers()
  createTray()

  const settings = getSettings()
  const registered = globalShortcut.register(settings.toggleHotkey, () => {
    toggleComposer()
  })
  if (!registered) {
    console.error(`[main] グローバルホットキーの登録に失敗しました: ${settings.toggleHotkey}`)
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // トレイ常駐アプリのため、ウィンドウを閉じてもアプリは終了しない
})
