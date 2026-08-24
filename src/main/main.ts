import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  Notification
} from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { IpcChannels } from '@shared/ipc-channels'
import type { AppSettings, InsertTextRequest, InsertTextResult, ProcessDraftRequest } from '@shared/types'
import { toErrorMessage } from '@shared/errors'
import { getSettings, saveSettings, pushHistory } from './settings'
import { processDraft } from '@ai/client'
import { captureActiveWindow, insertTextIntoWindow } from './insert'
import type { ActiveWindowHandle } from './platform'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let composerWindow: BrowserWindow | null = null
let tray: Tray | null = null
let lastActiveWindow: ActiveWindowHandle | null = null
let registeredHotkey: string | null = null

const isDev = !app.isPackaged

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body }).show()
}

function registerHotkey(hotkey: string): boolean {
  if (!hotkey.trim()) return false

  if (registeredHotkey) {
    globalShortcut.unregister(registeredHotkey)
    registeredHotkey = null
  }
  // 不正な形式のaccelerator文字列（例: 空白のみ、存在しないキー名）はElectronが
  // 同期的にthrowすることがあるため、メインプロセスを落とさないようここで吸収する。
  let ok: boolean
  try {
    ok = globalShortcut.register(hotkey, () => {
      toggleComposer()
    })
  } catch (err) {
    console.error(`[main] グローバルホットキーの登録中にエラーが発生しました: ${hotkey}`, err)
    ok = false
  }
  if (ok) {
    registeredHotkey = hotkey
  } else {
    console.error(`[main] グローバルホットキーの登録に失敗しました: ${hotkey}`)
  }
  return ok
}

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

  ipcMain.handle(IpcChannels.SaveSettings, (_e, patch: Partial<AppSettings>): AppSettings => {
    const saved = saveSettings(patch)
    if (patch.toggleHotkey && patch.toggleHotkey !== registeredHotkey) {
      const previous = registeredHotkey
      if (!registerHotkey(patch.toggleHotkey)) {
        notify(
          'ホットキー登録に失敗しました',
          `「${patch.toggleHotkey}」は他のアプリと競合している可能性があります。設定から別のキーをお試しください。`
        )
        if (previous) registerHotkey(previous)
      }
    }
    return saved
  })

  let inFlightProcessController: AbortController | null = null

  ipcMain.handle(IpcChannels.ProcessDraft, async (_e, req: ProcessDraftRequest) => {
    inFlightProcessController?.abort()
    const controller = new AbortController()
    inFlightProcessController = controller
    try {
      const settings = getSettings()
      return await processDraft(
        { ...settings, correctionStyle: req.style },
        req.history,
        req.draft,
        req.includeSuggestions,
        controller.signal
      )
    } finally {
      if (inFlightProcessController === controller) inFlightProcessController = null
    }
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
        return { ok: false, message: toErrorMessage(err) }
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

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    toggleComposer()
  })

  app.whenReady().then(() => {
    composerWindow = createComposerWindow()
    registerIpcHandlers()
    createTray()

    const settings = getSettings()
    if (!registerHotkey(settings.toggleHotkey)) {
      notify(
        'ホットキー登録に失敗しました',
        `「${settings.toggleHotkey}」は他のアプリと競合している可能性があります。トレイアイコンのクリックでも呼び出せます。設定から別のキーに変更できます。`
      )
    }
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })

  app.on('window-all-closed', () => {
    // トレイ常駐アプリのため、ウィンドウを閉じてもアプリは終了しない
  })
}
