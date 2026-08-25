import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, CorrectionStyle } from '@shared/types'
import SettingsPanel from './SettingsPanel'

const PROCESS_DEBOUNCE_MS = 450

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState('')
  // draftに続けて提案される「そのまま採用できる続き」。IMEの予測変換候補に相当し、
  // draft末尾に選択状態で表示することで、→キーで確定（採用）、入力を続ければ自然に消える。
  const [completion, setCompletion] = useState('')
  const [processing, setProcessing] = useState(false)
  const [targetLabel, setTargetLabel] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const processSeq = useRef(0)

  useEffect(() => {
    window.sakuraApi.getSettings().then(setSettings)
    const unsubscribe = window.sakuraApi.onComposerShown((label) => {
      setTargetLabel(label)
      setDraft('')
      setCompletion('')
      setStatus(null)
      window.sakuraApi.getSettings().then(setSettings)
      requestAnimationFrame(() => textareaRef.current?.focus())
    })
    return unsubscribe
  }, [])

  const apiReady = Boolean(settings?.apiBaseUrl && settings?.apiKey)

  useEffect(() => {
    if (!apiReady) {
      setCompletion('')
      return
    }
    const seq = ++processSeq.current
    const timer = setTimeout(async () => {
      setProcessing(true)
      try {
        const history = settings?.contextHistory ?? []
        const res = await window.sakuraApi.predictCompletion({
          draft,
          history,
          style: settings!.correctionStyle
        })
        if (seq === processSeq.current) setCompletion(res.completion)
      } catch {
        // 補完はベストエフォート。失敗しても入力は継続できる。
      } finally {
        if (seq === processSeq.current) setProcessing(false)
      }
    }, PROCESS_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, apiReady])

  // 提案（draftの直後〜末尾）を選択状態で表示し、続きの文字として見えるようにする
  useEffect(() => {
    if (!completion) return
    textareaRef.current?.setSelectionRange(draft.length, draft.length + completion.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completion])

  const submit = useCallback(async () => {
    const finalDraft = draft + completion
    if (!finalDraft.trim() || submitting || !settings) return
    setSubmitting(true)
    setStatus({ kind: 'info', text: '送信中…' })
    let finalText = finalDraft
    try {
      if (apiReady) {
        const res = await window.sakuraApi.correctText({ draft: finalDraft, style: settings.correctionStyle })
        finalText = res.corrected || finalDraft
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
    setCompletion('')
    setStatus({ kind: 'info', text: result.message })
  }, [draft, completion, submitting, settings, apiReady])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        window.sakuraApi.hideComposer()
        return
      }
      if (e.key === 'ArrowRight' && completion) {
        const ta = e.currentTarget
        const suggestionSelected =
          ta.selectionStart === draft.length && ta.selectionEnd === draft.length + completion.length
        if (suggestionSelected) {
          e.preventDefault()
          const merged = draft + completion
          setDraft(merged)
          setCompletion('')
          requestAnimationFrame(() => ta.setSelectionRange(merged.length, merged.length))
          return
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [draft, completion, submit]
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
    <div className="composer" onKeyDown={(e) => e.key === 'Escape' && window.sakuraApi.hideComposer()}>
      <div className="titlebar">
        <span className="target">{targetLabel ? `→ ${targetLabel}` : 'さくらAIコンポーザー'}</span>
        <button className="icon-btn" onClick={() => setShowSettings(true)} title="設定">
          ⚙
        </button>
      </div>

      <textarea
        ref={textareaRef}
        className="draft"
        value={draft + completion}
        placeholder="チャットの文章を入力… (続きは→キーで採用、Enterで送信、Shift+Enterで改行)"
        onChange={(e) => {
          setDraft(e.target.value)
          setCompletion('')
        }}
        onKeyDown={onKeyDown}
      />

      {processing && !completion && <div className="hint">考え中…</div>}

      {!apiReady && (
        <div className="hint warn">
          AI Engineが未設定です。⚙設定からAPIエンドポイントとキーを入力してください。
        </div>
      )}

      {status && <div className={`status ${status.kind}`}>{status.text}</div>}

      <div className="footer">
        <button className="send" disabled={!(draft + completion).trim() || submitting} onClick={submit}>
          送信 (Enter)
        </button>
      </div>
    </div>
  )
}

export type { CorrectionStyle }
