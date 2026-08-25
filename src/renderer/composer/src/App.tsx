import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, CorrectionStyle } from '@shared/types'
import SettingsPanel from './SettingsPanel'

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState('')
  const [targetLabel, setTargetLabel] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.sakuraApi.getSettings().then(setSettings)
    const unsubscribe = window.sakuraApi.onComposerShown((label) => {
      setTargetLabel(label)
      setDraft('')
      setStatus(null)
      window.sakuraApi.getSettings().then(setSettings)
      requestAnimationFrame(() => textareaRef.current?.focus())
    })
    return unsubscribe
  }, [])

  const apiReady = Boolean(settings?.apiBaseUrl && settings?.apiKey)

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
    setStatus({ kind: 'info', text: result.message })
  }, [draft, submitting, settings, apiReady])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        window.sakuraApi.hideComposer()
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [submit]
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
        value={draft}
        placeholder="チャットの文章を入力… (Enterで送信、Shift+Enterで改行)"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
      />

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
