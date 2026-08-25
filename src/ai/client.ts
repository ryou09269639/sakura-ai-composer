import type { AppSettings, CorrectionStyle } from '@shared/types'
import { toErrorMessage } from '@shared/errors'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

const styleGuide: Record<CorrectionStyle, string> = {
  natural: '自然な話し言葉のトーンを保ってください。絵文字や「www」等のネットスラングはそのまま残してください。',
  polite: '丁寧語・敬語に整えてください。',
  casual: 'カジュアルな口語のまま、読みやすさだけ整えてください。'
}

const REQUEST_TIMEOUT_MS = 12_000
// 文体サンプルが長すぎるとプロンプトが肥大化しOSSモデルのコンテキストを圧迫するため、
// 直近（＝より参考になりやすい）部分のみを使う。
const STYLE_SAMPLE_MAX_CHARS = 3000

async function callChatCompletions(
  settings: AppSettings,
  messages: ChatMessage[],
  temperature: number,
  externalSignal?: AbortSignal
): Promise<string> {
  if (!settings.apiBaseUrl || !settings.apiKey) {
    throw new Error('APIエンドポイントまたはAPIキーが未設定です。設定画面から入力してください。')
  }

  const url = settings.apiBaseUrl.replace(/\/+$/, '') + '/chat/completions'
  const body = (withResponseFormat: boolean): string =>
    JSON.stringify({
      model: settings.model || 'gpt-4o-mini',
      messages,
      temperature,
      ...(withResponseFormat ? { response_format: { type: 'json_object' } } : {})
    })

  const doFetch = async (withResponseFormat: boolean): Promise<Response> => {
    const timeoutController = new AbortController()
    if (externalSignal?.aborted) timeoutController.abort()
    const timer = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
    const onExternalAbort = (): void => timeoutController.abort()
    externalSignal?.addEventListener('abort', onExternalAbort)
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
        body: body(withResponseFormat),
        signal: timeoutController.signal
      })
    } catch (err) {
      if (externalSignal?.aborted) throw new DOMException('aborted', 'AbortError')
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('AI Engineへの接続がタイムアウトしました。エンドポイントの設定をご確認ください。')
      }
      throw new Error(
        `AI Engineに接続できませんでした。エンドポイントURLとネットワーク接続をご確認ください。(${toErrorMessage(err)})`
      )
    } finally {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    }
  }

  let res = await doFetch(true)

  if (res.status === 400) {
    const bodyText = await res.text().catch(() => '')
    // 一部のOpenAI互換サーバー（自前ホスト型など）はresponse_format未対応で400を返すことがあるため、
    // それと判別できる場合だけフォールバックしてリトライする。無関係な400（モデル名の誤り等）まで
    // リトライすると、確定した失敗のためにレイテンシが倍になるだけなので避ける。
    if (/response_format|json_object|json_schema/i.test(bodyText)) {
      res = await doFetch(false)
    } else {
      throw new Error(`AI Engine エラー (HTTP ${res.status}): ${bodyText.slice(0, 300)}`)
    }
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`AI Engine エラー (HTTP ${res.status}): ${errBody.slice(0, 300)}`)
  }

  const data = (await res.json()) as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI Engineから空の応答が返されました。')
  return content
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as T
    } catch {
      return null
    }
  }
}

function styleSampleBlock(settings: AppSettings): string {
  const styleSample = settings.styleSample?.trim()
  if (!styleSample) return ''
  return (
    '\n\n参考として、ユーザー本人が過去に書いた文章のサンプルを示します。' +
    '一言一句真似る必要はありませんが、口調・語彙選び・言い回しの癖を汲み取り、' +
    'このユーザーが書いたと自然に思える文章にしてください。\n---\n' +
    styleSample.slice(-STYLE_SAMPLE_MAX_CHARS) +
    '\n---'
  )
}

/**
 * 送信直前に、確定した文章の誤変換・誤字脱字・文脈的な不自然さだけを補正する。
 */
export async function correctText(
  settings: AppSettings,
  draft: string,
  style: CorrectionStyle,
  signal?: AbortSignal
): Promise<{ corrected: string; changed: boolean }> {
  if (!draft.trim()) return { corrected: draft, changed: false }

  const instruction =
    '入力された文章について、日本語の誤変換・誤字脱字・タイプミスに加えて、' +
    '主語の欠落や助詞の誤りなど文脈的に意味が通らない・不自然な箇所があれば、自然に読めるように補正してください。' +
    'ただし、伝えたい内容や言いたいことの趣旨、選んだ語彙・言い回しそのものは尊重し、無関係な書き換えはしないでください。' +
    styleGuide[style] +
    styleSampleBlock(settings) +
    ' 必ず次のJSON形式のみで応答してください（説明文は不要）: {"corrected": "修正後の文章", "changed": true|false}'

  const messages: ChatMessage[] = [
    { role: 'system', content: instruction },
    { role: 'user', content: `文章: ${draft}` }
  ]

  const raw = await callChatCompletions(settings, messages, 0.2, signal)
  const parsed = safeJsonParse<{ corrected?: string; changed?: boolean }>(raw)
  const corrected = parsed?.corrected?.trim() || draft
  return { corrected, changed: corrected !== draft }
}
