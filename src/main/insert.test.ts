import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clipboardStore: { value: '' },
  restoreAndPaste: vi.fn()
}))

vi.mock('electron', () => ({
  clipboard: {
    readText: () => mocks.clipboardStore.value,
    writeText: (text: string) => {
      mocks.clipboardStore.value = text
    }
  }
}))

vi.mock('./platform', () => ({
  getPlatformDriver: () => ({
    captureActiveWindow: vi.fn(),
    restoreAndPaste: mocks.restoreAndPaste
  })
}))

const { insertTextIntoWindow } = await import('./insert')
const handle = { platform: 'linux' as const, id: '1', label: 'test window' }

describe('insertTextIntoWindow', () => {
  beforeEach(() => {
    mocks.clipboardStore.value = '直前にコピーしていたテキスト'
    mocks.restoreAndPaste.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('成功時は貼り付け後1秒で元のクリップボードに復元する', async () => {
    mocks.restoreAndPaste.mockResolvedValueOnce(undefined)

    await insertTextIntoWindow(handle, '新しいテキスト', false)

    expect(mocks.clipboardStore.value).toBe('新しいテキスト')
    await vi.advanceTimersByTimeAsync(1000)
    expect(mocks.clipboardStore.value).toBe('直前にコピーしていたテキスト')
  })

  it('失敗時はクリップボードを書き戻さず、新しいテキストを残す', async () => {
    mocks.restoreAndPaste.mockRejectedValueOnce(new Error('xdotoolが見つかりません'))

    await expect(insertTextIntoWindow(handle, '新しいテキスト', false)).rejects.toThrow(
      /xdotoolが見つかりません/
    )
    expect(mocks.clipboardStore.value).toBe('新しいテキスト')

    // 復元用のタイマーは張られていないはず（張られていても書き戻ってはいけない）
    await vi.advanceTimersByTimeAsync(5000)
    expect(mocks.clipboardStore.value).toBe('新しいテキスト')
  })

  it('失敗時のエラーメッセージは手動貼り付けを案内する', async () => {
    mocks.restoreAndPaste.mockRejectedValueOnce(new Error('Waylandセッションでは未対応です'))

    await expect(insertTextIntoWindow(handle, 'テキスト', false)).rejects.toThrow(
      /クリップボードにコピー済み/
    )
  })
})
