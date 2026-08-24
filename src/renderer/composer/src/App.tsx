import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, CorrectionStyle } from '@shared/types'
import SettingsPanel from './SettingsPanel'

const CORRECTION_DEBOUNCE_MS = 700
const SUGGEST_DEBOUNCE_MS = 900

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState('')
  const [corrected, setCorrected] = useState<string | null>(null)
  const [correcting, setCorrecting] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [targetLabel, setTargetLabel] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const correctionSeq = useRef(0)
  const suggestSeq = useRef(0)

  useEffect(() => {
    window.sakuraApi.getSettings().then(setSettings)
    const unsubscribe = window.sakuraApi.onComposerShown((label) => {
      setTargetLabel(label)
      setDraft('')
      setCorrected(null)
      setSuggestions([])
      setStatus(null)
      window.sakuraApi.getSettings().then(setSettings)
      requestAnimationFrame(() => textareaRef.current?.focus())
    })
    return unsubscribe
  }, [])

  const apiReady = Boolean(settings?.apiBaseUrl && settings?.apiKey)

  useEffect(() => {
    if (!apiReady || !draft.trim()) {
      setCorrected(null)
      return
    }
    const seq = ++correctionSeq.current
    const timer = setTimeout(async () => {
      setCorrecting(true)
      try {
        const res = await window.sakuraApi.correctText({
          draft,
          style: settings!.correctionStyle
        })
        if (seq === correctionSeq.current) {
          setCorrected(res.changed ? res.corrected : null)
        }
      } catch {
        // 校正はベストエフォート。失敗しても入力は継続できる。
      } finally {
        if (seq === correctionSeq.current) setCorrecting(false)
      }
    }, CORRECTION_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, apiReady])

  useEffect(() => {
    if (!apiReady) {
      setSuggestions([])
      return
    }
    const seq = ++suggestSeq.current
    const timer = setTimeout(async () => {
      setSuggesting(true)
      try {
        const history = settings?.contextHistory ?? []
        const res = await window.sakuraApi.suggestNext({ history, draft })
        if (seq === suggestSeq.current) setSuggestions(res.suggestions)
      } catch {
        // 提案もベストエフォート。
      } finally {
        if (seq === suggestSeq.current) setSuggesting(false)
      }
    }, SUGGEST_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, apiReady])

  const acceptCorrection = useCallback(() => {
    if (corrected) {
      setDraft(corrected)
      setCorrected(null)
    }
  }, [corrected])

  const applySuggestion = useCallback((text: string) => {
    setDraft(text)
    setCorrected(null)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(text.length, text.length)
    })
  }, [])

  const submit = useCallback(async () => {
    if (!draft.trim() || submitting || !settings) return
    setSubmitting(true)
    setStatus({ kind: 'info', text: '送信中…' })
    let finalText = draft
    try {
      if (apiReady) {
        const res = await window.sakuraApi.correctText({ draft, style: settings.correctionStyle })
        finalText = res.corrected || draft
      }
    } catch {
      setStatus({ kind: 'error', text: '校正に失敗したため、未校正のテキストで送信します。' })
    }

    const result = await window.sakuraApi.insertText({
      text: finalText,
      pressEnter: settings.autoPressEnterAfterInsert
    })

    setSubmitting(false)
    if (!result.ok) {
      setStatus({ kind: 'error', text: result.message })
      return
    }
    setDraft('')
    setCorrected(null)
    setStatus({ kind: 'info', text: result.message })
  }, [draft, submitting, settings, apiReady])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        window.sakuraApi.hideComposer()
        return
      }
      if (e.key === 'Tab' && corrected) {
        e.preventDefault()
        acceptCorrection()
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [corrected, acceptCorrection, submit]
  )

  if (showSettings || !settings) {
    return (
      <SettingsPanel
        initial={settings}
        onClose={() => setShowSettings(false)}
        onSaved={(s) => {
          setSettings(s)
          setShowSettings(false)
        }}
      />
    )
  }

  return (
    <div className="composer">
      <div className="titlebar">
        <span className="target">{targetLabel ? `→ ${targetLabel}` : 'さくらAIコンポーザー'}</span>
        <button className="icon-btn" onClick={() => setShowSettings(true)} title="設定">
          ⚙
        </button>
      </div>

      <textarea
        ref={textareaRef}
        className="draft"
        value={draft}
        placeholder="チャットの下書きを入力… (Enterで送信 / Shift+Enterで改行)"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
      />

      {corrected && (
        <button className="correction" onClick={acceptCorrection} title="Tabキーでも適用できます">
          <span className="label">AI修正案</span>
          <span className="text">{corrected}</span>
        </button>
      )}
      {correcting && !corrected && <div className="hint">校正中…</div>}

      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((s, i) => (
            <button key={i} className="chip" onClick={() => applySuggestion(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {suggesting && suggestions.length === 0 && <div className="hint">次の一言を考え中…</div>}

      {!apiReady && (
        <div className="hint warn">
          AI Engineが未設定です。⚙設定からAPIエンドポイントとキーを入力してください。
        </div>
      )}

      {status && <div className={`status ${status.kind}`}>{status.text}</div>}

      <div className="footer">
        <button className="send" disabled={!draft.trim() || submitting} onClick={submit}>
          送信 (Enter)
        </button>
      </div>
    </div>
  )
}

export type { CorrectionStyle }
