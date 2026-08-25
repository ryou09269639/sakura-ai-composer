import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promisify } from 'node:util'

const mocks = vi.hoisted(() => ({
  execFile: vi.fn()
}))

vi.mock('child_process', () => ({
  execFile: mocks.execFile
}))

// child_process.execFile はNode組み込みのpromisify.customで{stdout, stderr}に変換され、
// 失敗時はそのstdout/stderrがエラーオブジェクトにも付与される（実際のNode挙動に合わせる。
// これを省くと、ydotool本体が診断メッセージをstdoutに出す実際の失敗パターンを見逃す）。
;(mocks.execFile as unknown as Record<symbol, unknown>)[promisify.custom] = (
  cmd: string,
  args: string[]
) =>
  new Promise((resolve, reject) => {
    mocks.execFile(cmd, args, (err: (Error & { stdout?: string; stderr?: string }) | null, stdout: string, stderr: string) => {
      if (err) {
        err.stdout = stdout
        err.stderr = stderr
        reject(err)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })

const { linuxDriver } = await import('./linux')

function mockExecFileOnce(impl: (cmd: string, args: string[]) => { stdout: string }): void {
  mocks.execFile.mockImplementationOnce((cmd, args, cb) => {
    const { stdout } = impl(cmd, args)
    cb(null, stdout, '')
  })
}

// 実際のchild_process同様、失敗時のErrorはmessageに原因を含まず、stdout/stderr側に入る。
function mockExecFileError(err: NodeJS.ErrnoException, stdout = '', stderr = ''): void {
  mocks.execFile.mockImplementationOnce((_cmd, _args, cb) => cb(err, stdout, stderr))
}

describe('linuxDriver (X11)', () => {
  const originalSessionType = process.env.XDG_SESSION_TYPE

  beforeEach(() => {
    process.env.XDG_SESSION_TYPE = 'x11'
    mocks.execFile.mockReset()
  })

  afterEach(() => {
    process.env.XDG_SESSION_TYPE = originalSessionType
  })

  it('xdotoolでアクティブウィンドウを取得する', async () => {
    mockExecFileOnce(() => ({ stdout: '12345\n' }))
    mockExecFileOnce(() => ({ stdout: 'Discord\n' }))

    const handle = await linuxDriver.captureActiveWindow()

    expect(handle).toEqual({ platform: 'linux', id: '12345', label: 'Discord' })
    expect(mocks.execFile).toHaveBeenNthCalledWith(1, 'xdotool', ['getactivewindow'], expect.any(Function))
  })

  it('xdotoolが無ければインストール手順を案内する', async () => {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' })
    mockExecFileError(err)

    await expect(linuxDriver.captureActiveWindow()).rejects.toThrow(/sudo apt install xdotool/)
  })

  it('restoreAndPasteはwindowactivateしてからCtrl+Vを送る', async () => {
    mockExecFileOnce(() => ({ stdout: '' }))
    mockExecFileOnce(() => ({ stdout: '' }))

    await linuxDriver.restoreAndPaste({ platform: 'linux', id: '12345', label: 'Discord' }, false)

    expect(mocks.execFile).toHaveBeenNthCalledWith(
      1,
      'xdotool',
      ['windowactivate', '--sync', '12345'],
      expect.any(Function)
    )
    expect(mocks.execFile).toHaveBeenNthCalledWith(
      2,
      'xdotool',
      ['key', '--clearmodifiers', 'ctrl+v'],
      expect.any(Function)
    )
  })
})

describe('linuxDriver (Wayland)', () => {
  const originalSessionType = process.env.XDG_SESSION_TYPE

  beforeEach(() => {
    process.env.XDG_SESSION_TYPE = 'wayland'
    mocks.execFile.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    process.env.XDG_SESSION_TYPE = originalSessionType
    vi.useRealTimers()
  })

  it('captureActiveWindowはウィンドウ操作を試みず汎用ハンドルを返す', async () => {
    const handle = await linuxDriver.captureActiveWindow()

    expect(handle).toEqual({ platform: 'linux', id: 'wayland', label: '直前にフォーカスしていたウィンドウ' })
    expect(mocks.execFile).not.toHaveBeenCalled()
  })

  it('restoreAndPasteはydotoolでCtrl+Vのキーコードを送る', async () => {
    mockExecFileOnce(() => ({ stdout: '' }))

    const promise = linuxDriver.restoreAndPaste({ platform: 'linux', id: 'wayland', label: '' }, false)
    await vi.advanceTimersByTimeAsync(150)
    await promise

    expect(mocks.execFile).toHaveBeenCalledWith(
      'ydotool',
      ['key', '29:1', '47:1', '47:0', '29:0'],
      expect.any(Function)
    )
  })

  it('pressEnter指定時はCtrl+Vの後にEnterキーコードも送る', async () => {
    mockExecFileOnce(() => ({ stdout: '' }))
    mockExecFileOnce(() => ({ stdout: '' }))

    const promise = linuxDriver.restoreAndPaste({ platform: 'linux', id: 'wayland', label: '' }, true)
    await vi.advanceTimersByTimeAsync(150)
    await vi.advanceTimersByTimeAsync(80)
    await promise

    expect(mocks.execFile).toHaveBeenNthCalledWith(2, 'ydotool', ['key', '28:1', '28:0'], expect.any(Function))
  })

  it('ydotoolが未インストールならインストール手順を案内する', async () => {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' })
    mockExecFileError(err)

    const promise = linuxDriver.restoreAndPaste({ platform: 'linux', id: 'wayland', label: '' }, false)
    const assertion = expect(promise).rejects.toThrow(/sudo apt install ydotool/)
    await vi.advanceTimersByTimeAsync(150)
    await assertion
  })

  it('ydotoold未起動時は起動手順を案内する', async () => {
    // 実機のydotool 1.0.4は診断メッセージをstderrではなくstdoutに出し、
    // execFileの Error#message には "Command failed: ..." としか入らない。
    mockExecFileError(
      new Error('Command failed: ydotool key 29:1 47:1 47:0 29:0\n'),
      "failed to connect socket `/run/user/1000/.ydotool_socket': No such file or directory\nPlease check if ydotoold is running.\n"
    )

    const promise = linuxDriver.restoreAndPaste({ platform: 'linux', id: 'wayland', label: '' }, false)
    const assertion = expect(promise).rejects.toThrow(/ydotoold/)
    await vi.advanceTimersByTimeAsync(150)
    await assertion
  })
})
