# さくらAIコンポーザー

聞き専でTTS配信や会議を眺めているとき、片手間でチャットを打つためのデスクトップアプリです。
ホットキー一発でフローティング入力窓を呼び出し、送信時に誤変換・誤字脱字・文脈的な不自然さを
自動で校正した上で、配信サイトやアプリのチャット欄に自動貼り付けします。

対象OS: Windows / macOS / Linux（Electron）。Android/iOSはElectronでは提供不可のため対象外です。

## セットアップ

```bash
npm install
npm run dev       # 開発起動（ホットリロード）
npm run build     # 本番ビルド (out/ に出力)
npm start         # ビルド後のプレビュー起動
npm test          # 単体テスト
npm run typecheck # 型チェック
```

初回起動後、トレイアイコン → 「コンポーザーを開く」、またはホットキー（デフォルト `Alt+Space`）で
フローティング窓を呼び出し、右上の ⚙ から以下を設定してください。

- **AI Engine エンドポイント**: OpenAI互換の `/chat/completions` を持つベースURL（例: `https://xxx.sakura.ne.jp/v1`）
- **APIキー**
- **モデル名**
- **校正スタイル**（自然な話し言葉 / 丁寧語 / カジュアル）
- **文体サンプル**（普段のチャット履歴などを貼り付けると、その口調に寄せて校正します）
- **貼り付け後にEnterも自動送信するか**（デフォルトOFF。誤爆防止のため、まずは手動Enter推奨）

設定は `electron-store` でOS標準のユーザーデータ領域に保存されます（`.env`は使用しません）。

## 使い方

1. 配信サイトのチャット欄（YouTube Live / ニコニコ生放送 / Twitch / Zoom / Teams 等）に
   フォーカスを合わせた状態で、ホットキーを押す
2. フローティング窓が現れるので文章を入力する
3. `Enter`で送信（`Shift+Enter`で改行、`Esc`で閉じる）
   - 送信時に誤字脱字・文脈的な不自然さの最終校正をかけたテキストが、クリップボード経由で
     元のウィンドウに自動貼り付けされます

## 自動貼り付けの仕組みと制約

OSレベルでフォーカスを戻してから `Ctrl+V` / `Cmd+V` を送出する方式です（サイトのDOM操作はしないため、
「テキスト欄にペーストできる」ものであれば汎用的に動作します）。

| OS | 実装 | 前提条件 |
|---|---|---|
| Windows | PowerShell + Win32 API (SetForegroundWindow / SendKeys) | 追加インストール不要 |
| macOS | AppleScript (System Events) | 初回に「アクセシビリティ」権限の許可が必要（設定 > プライバシーとセキュリティ） |
| Linux (X11) | `xdotool` | `sudo apt install xdotool` などで事前インストールが必要 |
| Linux (Wayland) | `ydotool` (`/dev/uinput`経由のキー送出) | `sudo apt install ydotool` に加え、常駐サービス `ydotoold` の起動が必要（`systemctl --user enable --now ydotool` など） |

Wayland環境では、セキュリティモデル上「特定のウィンドウID」を指定してフォーカスを戻すAPIが無いため、
コンポーザー窓を閉じた際にコンポジタが直前のウィンドウへフォーカスを戻す挙動に頼っています。
そのため、コンポーザーを呼び出す直前に貼り付け先のチャット欄をクリックしてフォーカスしておいてください。

ゲームやゲームエンジン由来のクライアント（VRChat等）への個別対応は行っていません。管理者権限で
起動しているウィンドウには、OSのSendKeys/xdotool/ydotoolが原理的に届かないためです。

## 信頼性・パフォーマンスについて

- AI Engineへのリクエストは12秒でタイムアウトします。
- `response_format`（JSON強制）に対応していないOpenAI互換サーバーでも動作するよう、自動でフォールバックします。
- 二重起動防止（シングルインスタンスロック）を実装済み。誤って多重起動しても既存のウィンドウが呼び出されます。
- ホットキーの変更は保存時に即座に反映されます（再起動不要）。他のアプリと競合して登録に失敗した場合は通知で知らせます
  （その場合もトレイアイコンのクリックでコンポーザーを呼び出せます）。
- 自動貼り付けに失敗した場合、修正済みのテキストはクリップボードに残ります。手動で `Ctrl+V` / `Cmd+V` して貼り付けてください。

## 既知の制限（MVP時点）

- モバイル（Android/iOS）はElectronでは非対応。将来的に別途 React Native 等での実装が必要です。
- Linux の自動貼り付けはX11では`xdotool`、Waylandでは`ydotool`(+`ydotoold`常駐)が必要です。未インストール・未起動の場合はエラーメッセージで案内されますが、テキストは常にクリップボードにコピーされるため手動貼り付け（`Ctrl+V`）でも代替できます。
- アイコンはプレースホルダー（`build/icon.png`）です。配布前に正式なアイコンへ差し替えてください。

## ディレクトリ構成

```
src/
  main/        Electronメインプロセス（ウィンドウ、トレイ、IPC、設定）
    platform/  OS別のウィンドウ操作実装 (win32 / darwin / linux)
  preload/     contextBridge経由でrendererに安全なAPIを公開
  renderer/composer/  フローティング窓のReact UI
  ai/          さくらAI Engine（OpenAI互換）クライアント（送信時の校正）
  shared/      型定義・IPCチャンネル定義
```

## パッケージング

```bash
npm run dist:win    # Windows (nsis)
npm run dist:mac    # macOS (dmg)
npm run dist:linux  # Linux (AppImage)
```

`electron-builder.yml` を参照。
