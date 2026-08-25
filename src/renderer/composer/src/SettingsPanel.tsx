import { useRef, useState } from 'react'
import type { AppSettings, CorrectionStyle } from '@shared/types'
import { DEFAULT_AI_ENGINE_BASE_URL, DEFAULT_AI_ENGINE_MODEL } from '@shared/default-settings'

interface Props {
  initial: AppSettings | null
  onClose: () => void
  onSaved: (settings: AppSettings) => void
}

export default function SettingsPanel({ initial, onClose, onSaved }: Props): JSX.Element {
  const [apiBaseUrl, setApiBaseUrl] = useState(initial?.apiBaseUrl ?? DEFAULT_AI_ENGINE_BASE_URL)
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '')
  const [model, setModel] = useState(initial?.model ?? DEFAULT_AI_ENGINE_MODEL)
  const [toggleHotkey, setToggleHotkey] = useState(initial?.toggleHotkey ?? 'Alt+Space')
  const [autoPressEnterAfterInsert, setAutoPressEnterAfterInsert] = useState(
    initial?.autoPressEnterAfterInsert ?? false
  )
  const [correctionStyle, setCorrectionStyle] = useState<CorrectionStyle>(
    initial?.correctionStyle ?? 'natural'
  )
  const [styleSample, setStyleSample] = useState(initial?.styleSample ?? '')
  const [saving, setSaving] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const hotkeyError = toggleHotkey.trim() ? null : 'ホットキーを入力してください'

  const save = async (): Promise<void> => {
    if (hotkeyError) return
    setSaving(true)
    const saved = await window.sakuraApi.saveSettings({
      apiBaseUrl: apiBaseUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
      toggleHotkey: toggleHotkey.trim(),
      autoPressEnterAfterInsert,
      correctionStyle,
      styleSample: styleSample.trim()
    })
    setSaving(false)
    onSaved(saved)
  }

  // Enterキーで次の項目へ移動し、最後の項目でEnterを押すと保存して次の画面（コンポーザー）へ進む。
  // textarea内のEnterは改行として使うため対象外にする。
  const onBodyKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Enter' || e.shiftKey) return
    const target = e.target as HTMLElement
    if (target.tagName === 'TEXTAREA') return
    e.preventDefault()

    const focusable = Array.from(
      bodyRef.current?.querySelectorAll<HTMLElement>('input, select, textarea') ?? []
    )
    const index = focusable.indexOf(target)
    const next = index >= 0 ? focusable[index + 1] : undefined
    if (next) {
      next.focus()
      if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
        const len = next.value.length
        next.setSelectionRange?.(len, len)
      }
    } else {
      save()
    }
  }

  return (
    <div className="composer settings">
      <div className="titlebar">
        <span>設定</span>
        <button className="close-pill" onClick={onClose} title="閉じる">
          閉じる
        </button>
      </div>

      <div className="settings-body" ref={bodyRef} onKeyDown={onBodyKeyDown}>
        <label className="field">
          <span>AI Engine エンドポイント (OpenAI互換, /v1 まで)</span>
          <input
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://example.sakura.ne.jp/v1"
          />
        </label>

        <label className="field">
          <span>APIキー</span>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </label>

        <label className="field">
          <span>モデル名</span>
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        </label>

        <label className="field">
          <span>校正スタイル</span>
          <select
            value={correctionStyle}
            onChange={(e) => setCorrectionStyle(e.target.value as CorrectionStyle)}
          >
            <option value="natural">自然な話し言葉</option>
            <option value="polite">丁寧語</option>
            <option value="casual">カジュアル</option>
          </select>
        </label>

        <label className="field">
          <span>文体サンプル（普段のチャット履歴などを貼り付けると、その口調に寄せて生成します）</span>
          <textarea
            className="style-sample"
            value={styleSample}
            onChange={(e) => setStyleSample(e.target.value)}
            placeholder={'例:\nそれな〜わかる\n今日も一日お疲れ様でした！\nまた明日〜'}
            rows={4}
          />
        </label>

        <label className="field">
          <span>呼び出しホットキー（保存すると即座に反映されます）</span>
          <input value={toggleHotkey} onChange={(e) => setToggleHotkey(e.target.value)} />
          {hotkeyError && <span className="field-error">{hotkeyError}</span>}
        </label>

        <label className="field checkbox">
          <input
            type="checkbox"
            checked={autoPressEnterAfterInsert}
            onChange={(e) => setAutoPressEnterAfterInsert(e.target.checked)}
          />
          <span>貼り付け後にEnterキーも自動送信する（誤爆注意）</span>
        </label>
      </div>

      <div className="footer">
        <button className="send" onClick={save} disabled={saving || Boolean(hotkeyError)}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
