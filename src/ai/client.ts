import type { AppSettings, CorrectionStyle } from '@shared/types'

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

async function callChatCompletions(
  settings: AppSettings,
  messages: ChatMessage[],
  temperature: number
): Promise<string> {
  if (!settings.apiBaseUrl || !settings.apiKey) {
    throw new Error('APIエンドポイントまたはAPIキーが未設定です。設定画面から入力してください。')
  }

  const url = settings.apiBaseUrl.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o-mini',
      messages,
      temperature,
      response_format: { type: 'json_object' }
    })
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`AI Engine エラー (HTTP ${res.status}): ${body.slice(0, 300)}`)
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

export async function correctText(
  settings: AppSettings,
  draft: string
): Promise<{ corrected: string; changed: boolean }> {
  if (!draft.trim()) return { corrected: '', changed: false }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'あなたは配信・会議のライブチャット入力を校正するアシスタントです。' +
        '日本語の誤変換・誤字脱字・タイプミスだけを修正し、文意や語彙、文体は変えないでください。' +
        styleGuide[settings.correctionStyle] +
        ' 必ず次のJSON形式のみで応答してください: {"corrected": "修正後の文章", "changed": true|false}'
    },
    { role: 'user', content: draft }
  ]

  const raw = await callChatCompletions(settings, messages, 0.2)
  const parsed = safeJsonParse<{ corrected?: string; changed?: boolean }>(raw)
  const corrected = parsed?.corrected?.trim() || draft
  return { corrected, changed: corrected !== draft }
}

export async function suggestNext(
  settings: AppSettings,
  history: string[],
  draft: string
): Promise<string[]> {
  const recentHistory = history.slice(-10)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'あなたは配信・会議のライブチャットで、聞き専のユーザーが次に打ちそうな一言を提案するアシスタントです。' +
        '直前の会話の流れを踏まえ、自然に続く短いチャット向けの返信候補を3つ提案してください。' +
        '入力中の下書きがあれば、それを完成させる形の候補も含めてください。' +
        '必ず次のJSON形式のみで応答してください: {"suggestions": ["候補1", "候補2", "候補3"]}'
    },
    {
      role: 'user',
      content:
        (recentHistory.length ? `直近の会話:\n${recentHistory.join('\n')}\n\n` : '') +
        `下書き: ${draft || '(空)'}`
    }
  ]

  const raw = await callChatCompletions(settings, messages, 0.7)
  const parsed = safeJsonParse<{ suggestions?: string[] }>(raw)
  return (parsed?.suggestions || []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 3)
}
