import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '@shared/types'
import { correctText, predictCompletion } from './client'

const baseSettings: AppSettings = {
  apiBaseUrl: 'https://example.sakura.ne.jp/v1',
  apiKey: 'test-key',
  model: 'test-model',
  toggleHotkey: 'Alt+Space',
  autoPressEnterAfterInsert: false,
  correctionStyle: 'natural',
  contextHistory: [],
  styleSample: ''
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function chatBody(content: string): { choices: Array<{ message: { content: string } }> } {
  return { choices: [{ message: { content } }] }
}

describe('predictCompletion', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('入力中の文章に続く断片をfetchして返す', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody(JSON.stringify({ completion: 'いい天気ですね' })))
    )

    const result = await predictCompletion(baseSettings, [], '今日は', 'natural')

    expect(result).toBe('いい天気ですね')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('下書きが空でも履歴があれば会話の流れとして提案を生成する', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody(JSON.stringify({ completion: 'こんにちは' })))
    )

    const result = await predictCompletion(baseSettings, ['配信主: 今日は寒いですね'], '', 'natural')

    expect(result).toBe('こんにちは')
    const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))
    const userMessage = requestBody.messages.find((m: { role: string }) => m.role === 'user')
    expect(userMessage.content).toContain('配信主: 今日は寒いですね')
  })

  it('モデルが入力済み部分まで繰り返した場合はその分を取り除く', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody(JSON.stringify({ completion: '今日はいい天気ですね' })))
    )

    const result = await predictCompletion(baseSettings, [], '今日は', 'natural')

    expect(result).toBe('いい天気ですね')
  })

  it('前後に説明文が付いたJSONでもパースできる(フォールバック抽出)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody('了解しました。\n{"completion": "続きです"}\nよろしくお願いします。'))
    )

    const result = await predictCompletion(baseSettings, [], '下書き', 'natural')
    expect(result).toBe('続きです')
  })

  it('response_formatが原因と分かる400はフォールバックしてリトライする', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('Unsupported parameter: response_format', { status: 400 }))
      .mockResolvedValueOnce(jsonResponse(chatBody(JSON.stringify({ completion: '続き' }))))

    const result = await predictCompletion(baseSettings, [], '下書き', 'natural')

    expect(fetch).toHaveBeenCalledTimes(2)
    const secondCallBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))
    expect(secondCallBody.response_format).toBeUndefined()
    expect(result).toBe('続き')
  })

  it('response_formatと無関係な400はリトライせず即エラーにする', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('model not found', { status: 400 }))

    await expect(predictCompletion(baseSettings, [], '下書き', 'natural')).rejects.toThrow(/HTTP 400/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('APIキー未設定ならエラーを投げる', async () => {
    await expect(
      predictCompletion({ ...baseSettings, apiKey: '' }, [], '下書き', 'natural')
    ).rejects.toThrow(/未設定/)
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

    const promise = predictCompletion(baseSettings, [], '下書き', 'natural')
    const assertion = expect(promise).rejects.toThrow(/タイムアウト/)
    await vi.advanceTimersByTimeAsync(12_000)
    await assertion
  })

  it('styleSampleが設定されていればsystemプロンプトに文体サンプルとして含める', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody(JSON.stringify({ completion: '続き' })))
    )

    await predictCompletion(
      { ...baseSettings, styleSample: '今日もお疲れ様〜！これから飯食う' },
      [],
      '下書き',
      'natural'
    )

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

    const promise = predictCompletion(baseSettings, [], '下書き', 'natural', controller.signal)
    controller.abort()

    await expect(promise).rejects.toThrow()
  })
})

describe('correctText', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

  it('APIキー未設定ならfetchせずエラーを投げる', async () => {
    await expect(correctText({ ...baseSettings, apiKey: '' }, '下書き', 'natural')).rejects.toThrow(/未設定/)
    expect(fetch).not.toHaveBeenCalled()
  })
})
