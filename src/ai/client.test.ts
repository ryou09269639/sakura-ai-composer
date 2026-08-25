import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '@shared/types'
import { correctText } from './client'

const baseSettings: AppSettings = {
  apiBaseUrl: 'https://example.sakura.ne.jp/v1',
  apiKey: 'test-key',
  model: 'test-model',
  toggleHotkey: 'Alt+Space',
  autoPressEnterAfterInsert: false,
  correctionStyle: 'natural',
  styleSample: ''
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function chatBody(content: string): { choices: Array<{ message: { content: string } }> } {
  return { choices: [{ message: { content } }] }
}

describe('correctText', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('空文字ならfetchせずそのまま返す', async () => {
    const result = await correctText(baseSettings, '', 'natural')
    expect(result).toEqual({ corrected: '', changed: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('校正結果を返す', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody(JSON.stringify({ corrected: 'こんにちは、元気ですか？', changed: true })))
    )

    const result = await correctText(baseSettings, 'こんにちわ、元気ですか？', 'natural')

    expect(result.corrected).toBe('こんにちは、元気ですか？')
    expect(result.changed).toBe(true)
  })

  it('修正なしならchangedはfalseで、correctedはdraftのまま', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody(JSON.stringify({ corrected: 'そのままです', changed: false })))
    )

    const result = await correctText(baseSettings, 'そのままです', 'natural')
    expect(result.changed).toBe(false)
    expect(result.corrected).toBe('そのままです')
  })

  it('前後に説明文が付いたJSONでもパースできる(フォールバック抽出)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody('了解しました。\n{"corrected": "修正後", "changed": true}\nよろしくお願いします。'))
    )

    const result = await correctText(baseSettings, '修正前', 'natural')
    expect(result.corrected).toBe('修正後')
  })

  it('response_formatが原因と分かる400はフォールバックしてリトライする', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('Unsupported parameter: response_format', { status: 400 }))
      .mockResolvedValueOnce(jsonResponse(chatBody(JSON.stringify({ corrected: '修正後', changed: true }))))

    const result = await correctText(baseSettings, '下書き', 'natural')

    expect(fetch).toHaveBeenCalledTimes(2)
    const secondCallBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))
    expect(secondCallBody.response_format).toBeUndefined()
    expect(result.corrected).toBe('修正後')
  })

  it('response_formatと無関係な400はリトライせず即エラーにする', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('model not found', { status: 400 }))

    await expect(correctText(baseSettings, '下書き', 'natural')).rejects.toThrow(/HTTP 400/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('APIキー未設定ならfetchせずエラーを投げる', async () => {
    await expect(correctText({ ...baseSettings, apiKey: '' }, '下書き', 'natural')).rejects.toThrow(/未設定/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('タイムアウトすると分かりやすいエラーになる', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        })
    )

    const promise = correctText(baseSettings, '下書き', 'natural')
    const assertion = expect(promise).rejects.toThrow(/タイムアウト/)
    await vi.advanceTimersByTimeAsync(12_000)
    await assertion
  })

  it('styleSampleが設定されていればsystemプロンプトに文体サンプルとして含める', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody(JSON.stringify({ corrected: '直りました', changed: true })))
    )

    await correctText({ ...baseSettings, styleSample: '今日もお疲れ様〜！これから飯食う' }, 'なおりました', 'natural')

    const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))
    const systemMessage = requestBody.messages.find((m: { role: string }) => m.role === 'system')
    expect(systemMessage.content).toContain('今日もお疲れ様〜！これから飯食う')
  })

  it('外部signalがabortされると新しいリクエストを優先してキャンセルされる', async () => {
    const controller = new AbortController()
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        })
    )

    const promise = correctText(baseSettings, '下書き', 'natural', controller.signal)
    controller.abort()

    await expect(promise).rejects.toThrow()
  })
})
