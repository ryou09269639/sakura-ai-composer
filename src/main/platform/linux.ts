import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ActiveWindowHandle, PlatformDriver } from './types'

const execFileAsync = promisify(execFile)

// Linuxカーネルの入力イベントコード（linux/input-event-codes.h）。
// ydotoolはキー名ではなくこの数値指定のみ受け付ける。
const KEY_LEFTCTRL = 29
const KEY_V = 47
const KEY_ENTER = 28

function isWayland(): boolean {
  return (process.env.XDG_SESSION_TYPE || '').toLowerCase() === 'wayland'
}

function isEnoent(err: unknown): boolean {
  return err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
}

async function runXdotool(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('xdotool', args)
    return stdout.trim()
  } catch (err) {
    if (isEnoent(err)) {
      throw new Error('xdotool が見つかりません。`sudo apt install xdotool` 等でインストールしてください。')
    }
    throw err
  }
}

async function runYdotool(args: string[]): Promise<void> {
  try {
    await execFileAsync('ydotool', args)
  } catch (err) {
    if (isEnoent(err)) {
      throw new Error(
        'ydotool が見つかりません。Waylandセッションでの自動貼り付けには ydotool が必要です。' +
          '`sudo apt install ydotool` でインストールしてください。'
      )
    }
    // ydotoold未起動時、ydotool本体は診断メッセージをstdoutに出して非0終了する。
    // execFileAsyncが失敗時にrejectするErrorはmessageに"Command failed: ..."としか
    // 入らないため、実際の原因はstdout/stderrプロパティ側を見る必要がある。
    const err2 = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    const diagnostic = `${err2.message ?? ''}\n${err2.stdout ?? ''}\n${err2.stderr ?? ''}`
    if (/ydotoold|socket/i.test(diagnostic)) {
      throw new Error(
        'ydotoold（ydotoolの常駐サービス）に接続できませんでした。' +
          '`systemctl --user enable --now ydotool` を実行するか `ydotoold` を起動してから、' +
          'さくらAIコンポーザーを再起動してください。'
      )
    }
    throw err
  }
}

export const linuxDriver: PlatformDriver = {
  async captureActiveWindow(): Promise<ActiveWindowHandle | null> {
    if (isWayland()) {
      // Waylandはセキュリティモデル上、他アプリのウィンドウID/タイトルを取得できない。
      // 貼り付け先の特定は「コンポーザー窓を隠すとコンポジタが直前のウィンドウへ
      // フォーカスを戻す」挙動に任せる（restoreAndPaste側を参照）。
      return { platform: 'linux', id: 'wayland', label: '直前にフォーカスしていたウィンドウ' }
    }
    const id = await runXdotool(['getactivewindow'])
    if (!id) return null
    const name = await runXdotool(['getwindowname', id]).catch(() => 'unknown window')
    return { platform: 'linux', id, label: name }
  },

  async restoreAndPaste(handle, pressEnter) {
    if (isWayland()) {
      // コンポーザー窓は呼び出し元（main.ts）で既にhide済み。コンポジタが直前の
      // ウィンドウへフォーカスを戻すのを少し待ってから、ydotool（/dev/uinput経由で
      // キー入力を送るため、xdotoolと違いWaylandでも動作する）でCtrl+Vを送出する。
      await new Promise((resolve) => setTimeout(resolve, 150))
      await runYdotool(['key', `${KEY_LEFTCTRL}:1`, `${KEY_V}:1`, `${KEY_V}:0`, `${KEY_LEFTCTRL}:0`])
      if (pressEnter) {
        await new Promise((resolve) => setTimeout(resolve, 80))
        await runYdotool(['key', `${KEY_ENTER}:1`, `${KEY_ENTER}:0`])
      }
      return
    }
    await runXdotool(['windowactivate', '--sync', handle.id])
    await runXdotool(['key', '--clearmodifiers', 'ctrl+v'])
    if (pressEnter) {
      await runXdotool(['key', '--clearmodifiers', 'Return'])
    }
  }
}
