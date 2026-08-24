import { useState } from 'react'
import type { AppSettings, CorrectionStyle } from '@shared/types'

interface Props {
  initial: AppSettings | null
  onClose: () => void
  onSaved: (settings: AppSettings) => void
}

export default function SettingsPanel({ initial, onClose, onSaved }: Props): JSX.Element {
  const [apiBaseUrl, setApiBaseUrl] = useState(initial?.apiBaseUrl ?? '')
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '')
  const [model, setModel] = useState(initial?.model ?? 'gpt-4o-mini')
  const [toggleHotkey, setToggleHotkey] = useState(initial?.toggleHotkey ?? 'Alt+Space')
  const [autoPressEnterAfterInsert, setAutoPressEnterAfterInsert] = useState(
    initial?.autoPressEnterAfterInsert ?? false
  )
  const [correctionStyle, setCorrectionStyle] = useState<CorrectionStyle>(
    initial?.correctionStyle ?? 'natural'
  )
  const [saving, setSaving] = useState(false)

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
      correctionStyle
    })
    setSaving(false)
    onSaved(saved)
  }

  return (
    <div className="composer settings">
      <div className="titlebar">
        <span>設定</span>
        <button className="icon-btn" onClick={onClose} title="閉じる">
          ✕
        </button>
      </div>

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

      <div className="footer">
        <button className="send" onClick={save} disabled={saving || Boolean(hotkeyError)}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
