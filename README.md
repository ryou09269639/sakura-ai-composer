# さくらAIコンポーザー

聞き専でTTS配信/会議を見ているときに、ホットキー一発でフローティング入力窓を呼び出し、
さくらのAI Engine（OpenAI互換API）でタイポ修正・次の一言の予測補完を行い、
確定した文章を配信サイトやアプリのチャット欄に自動貼り付けするデスクトップアプリです。

対象OS: Windows / macOS / Linux（Electron）。Android/iOSはElectronでは提供不可のため対象外です（将来的に別途検討）。

## セットアップ

```bash
npm install
npm run dev      # 開発起動（ホットリロード）
npm run build    # 本番ビルド (out/ に出力)
npm start        # ビルド後のプレビュー起動
```

初回起動後、トレイアイコン → 「コンポーザーを開く」、またはホットキー（デフォルト `Alt+Space`）で
フローティング窓を呼び出し、右上の ⚙ から以下を設定してください。

- **AI Engine エンドポイント**: OpenAI互換の `/chat/completions` を持つベースURL（例: `https://xxx.sakura.ne.jp/v1`）
- **APIキー**
- **モデル名**
- **校正スタイル**（自然な話し言葉 / 丁寧語 / カジュアル）
- **貼り付け後にEnterも自動送信するか**（デフォルトOFF。誤爆防止のため、まずは手動Enter推奨）

設定は `electron-store` でOS標準のユーザーデータ領域に保存されます（`.env`は使用しません）。

## 使い方

1. 配信サイトのチャット欄（YouTube Live / ニコニコ生放送 / Twitch / Zoom / Teams / VRChat 等）に
   フォーカスを合わせた状態で、ホットキーを押す
2. フローティング窓が現れるので下書きを入力
   - 入力が止まると自動でAIがタイポ修正案を提示（Tabキーで採用）
   - 直前の会話履歴をもとに「次の一言」候補も自動提示（クリックで下書きに反映）
3. `Enter`で送信（`Shift+Enter`で改行、`Esc`で閉じる）
   - 送信時に最終校正をかけたテキストがクリップボード経由で元のウィンドウに自動貼り付けされます

## 自動貼り付けの仕組みと制約

OSレベルでフォーカスを戻してから `Ctrl+V` / `Cmd+V` を送出する方式です（サイトのDOM操作はしないため、
YouTube/Twitch/ニコニコ/Zoom/Teams/VRChatなど「テキスト欄にペーストできる」ものであれば汎用的に動作します）。

| OS | 実装 | 前提条件 |
|---|---|---|
| Windows | PowerShell + Win32 API (SetForegroundWindow / SendKeys) | 追加インストール不要 |
| macOS | AppleScript (System Events) | 初回に「アクセシビリティ」権限の許可が必要（設定 > プライバシーとセキュリティ） |
| Linux (X11) | `xdotool` | `sudo apt install xdotool` などで事前インストールが必要 |
| Linux (Wayland) | 未対応 | ウィンドウ自動操作ができないため、失敗メッセージを表示（コピー先の手動貼り付けにフォールバック） |

VRChatはデスクトップモードのチャットボックス（Enterでテキスト入力欄が出るもの）を想定した“おまけ”対応です。
ゲームウィンドウが管理者権限で起動している場合、Windowsの `SendKeys` が届かないことがあります
（その場合はさくらAIコンポーザー側も同様に管理者権限で起動してください）。

## 信頼性・パフォーマンスについて

- タイポ修正と「次の一言」候補は1回のAPI呼び出しにまとめて取得します。往復回数を減らしてレスポンスを高速化しつつ、
  修正後の文面をもとに候補を生成するため一貫性（予測精度）も向上します。送信直前の最終校正では候補生成をスキップし、
  さらに高速化します。
- AI Engineへのリクエストは12秒でタイムアウトし、入力中に新しいリクエストが発生すると古いリクエストは自動キャンセルされます。
- `response_format`（JSON強制）に対応していないOpenAI互換サーバーでも動作するよう、自動でフォールバックします。
- 二重起動防止（シングルインスタンスロック）を実装済み。誤って多重起動しても既存のウィンドウが呼び出されます。
- ホットキーの変更は保存時に即座に反映されます（再起動不要）。他のアプリと競合して登録に失敗した場合は通知で知らせます
  （その場合もトレイアイコンのクリックでコンポーザーを呼び出せます）。
- 自動貼り付けに失敗した場合、修正済みのテキストはクリップボードに残ります。手動で `Ctrl+V` / `Cmd+V` して貼り付けてください。

## 既知の制限（MVP時点）

- モバイル（Android/iOS）はElectronでは非対応。将来的に別途 React Native 等での実装が必要です。
- Linux は X11 前提（Wayland非対応）。Wayland環境では自動貼り付けは失敗しますが、テキストはクリップボードにコピーされるため手動貼り付けは可能です。
- アイコンはプレースホルダー（`build/icon.png`）です。配布前に正式なアイコンへ差し替えてください。

## ディレクトリ構成

```
src/
  main/        Electronメインプロセス（ウィンドウ、トレイ、IPC、設定）
    platform/  OS別のウィンドウ操作実装 (win32 / darwin / linux)
  preload/     contextBridge経由でrendererに安全なAPIを公開
  renderer/composer/  フローティング窓のReact UI
  ai/          さくらAI Engine（OpenAI互換）クライアント
  shared/      型定義・IPCチャンネル定義
```

## パッケージング

```bash
npm run dist:win    # Windows (nsis)
npm run dist:mac    # macOS (dmg)
npm run dist:linux  # Linux (AppImage)
```

`electron-builder.yml` を参照。
