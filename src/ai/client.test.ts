import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '@shared/types'
import { processDraft } from './client'

const baseSettings: AppSettings = {
  apiBaseUrl: 'https://example.sakura.ne.jp/v1',
  apiKey: 'test-key',
  model: 'test-model',
  toggleHotkey: 'Alt+Space',
  autoPressEnterAfterInsert: false,
  correctionStyle: 'natural',
  contextHistory: []
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function chatBody(content: string): { choices: Array<{ message: { content: string } }> } {
  return { choices: [{ message: { content } }] }
}

describe('processDraft', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('下書きが空でinclude Suggestionsもfalseならfetchを呼ばない', async () => {
    const result = await processDraft(baseSettings, [], '', false)
    expect(result).toEqual({ corrected: '', changed: false, suggestions: [] })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('下書きが空でも提案が必要なら履歴だけでfetchする', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody(JSON.stringify({ suggestions: ['こんにちは', 'お疲れ様です'] })))
    )

    const result = await processDraft(baseSettings, ['配信主: 今日は寒いですね'], '', true)

    expect(result.corrected).toBe('')
    expect(result.changed).toBe(false)
    expect(result.suggestions).toEqual(['こんにちは', 'お疲れ様です'])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('下書きがあり提案不要なら校正結果のみ返す(送信直前の高速パス)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody(JSON.stringify({ corrected: 'こんにちは、元気ですか？', changed: true })))
    )

    const result = await processDraft(baseSettings, [], 'こんにちわ、元気ですか？', false)

    expect(result.corrected).toBe('こんにちは、元気ですか？')
    expect(result.changed).toBe(true)
    expect(result.suggestions).toEqual([])
  })

  it('校正と提案を1回のfetchで両方取得する', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        chatBody(
          JSON.stringify({
            corrected: '直りました',
            changed: true,
            suggestions: ['候補1', '候補2', '候補3', '候補4']
          })
        )
      )
    )

    const result = await processDraft(baseSettings, ['history'], 'なおりました', true)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.corrected).toBe('直りました')
    expect(result.suggestions).toEqual(['候補1', '候補2', '候補3']) // 3件までに切り詰め
  })

  it('修正なしならchangedはfalseで、correctedはdraftのまま', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody(JSON.stringify({ corrected: 'そのままです', changed: false })))
    )

    const result = await processDraft(baseSettings, [], 'そのままです', false)
    expect(result.changed).toBe(false)
    expect(result.corrected).toBe('そのままです')
  })

  it('前後に説明文が付いたJSONでもパースできる(フォールバック抽出)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(chatBody('了解しました。\n{"corrected": "修正後", "changed": true}\nよろしくお願いします。'))
    )

    const result = await processDraft(baseSettings, [], '修正前', false)
    expect(result.corrected).toBe('修正後')
  })

  it('response_formatが原因と分かる400はフォールバックしてリトライする', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('Unsupported parameter: response_format', { status: 400 }))
      .mockResolvedValueOnce(jsonResponse(chatBody(JSON.stringify({ corrected: '修正後', changed: true }))))

    const result = await processDraft(baseSettings, [], '下書き', false)

    expect(fetch).toHaveBeenCalledTimes(2)
    const secondCallBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))
    expect(secondCallBody.response_format).toBeUndefined()
    expect(result.corrected).toBe('修正後')
  })

  it('response_formatと無関係な400はリトライせず即エラーにする', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('model not found', { status: 400 }))

    await expect(processDraft(baseSettings, [], '下書き', false)).rejects.toThrow(/HTTP 400/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('APIキー未設定ならfetchせずエラーを投げる', async () => {
    await expect(
      processDraft({ ...baseSettings, apiKey: '' }, [], '下書き', false)
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

    const promise = processDraft(baseSettings, [], '下書き', false)
    const assertion = expect(promise).rejects.toThrow(/タイムアウト/)
    await vi.advanceTimersByTimeAsync(12_000)
    await assertion
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

    const promise = processDraft(baseSettings, [], '下書き', false, controller.signal)
    controller.abort()

    await expect(promise).rejects.toThrow()
  })
})
