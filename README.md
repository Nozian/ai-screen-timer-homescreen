# AI Screen Time 6.4

既存のホーム画面・利用統計・ウィジェットを保ちながら、Unsplash公式APIの風景写真とAI休憩リマインダーを追加しました。

## 拡張機能を使う

Chrome 120以降の `chrome://extensions` でデベロッパーモードを有効にして、`ai-timer-v1` を「パッケージ化されていない拡張機能を読み込む」から指定します。更新時は既存の拡張機能を再読み込みし、開いていたAIページも再読み込みしてください。既存の利用統計や表示設定は維持します。

ホーム画面の歯車 → **AIの休憩リマインダー**で有効化します（初期状態はオフ）。上限は1〜480分、初期値30分。ChatGPT・Claude・Gemini・Perplexity・Grok・Google AIの当日合計が対象で、SNS・通常のGoogle検索・YouTubeは対象外です。

- **5分休憩する**：休憩画面を5分間表示。終了後は設定した分数だけ追加で利用してから再通知します。
- **あと5分だけ**：5分後まで画面を解除します。
- **今日は解除**：ローカル日付が変わるまで解除します。
- 休憩画面を出している間はAI時間を加算しません。休憩状態はタブ間で共有され、再起動後も有効です。
- Chromeの製品版のアラーム間隔に合わせ、計測は30秒単位です。ブラウザの遅延やアイドル判定により、厳密なストップウォッチとは異なります。

## Unsplashを接続する（初回設定）

未設定でも拡張機能と休憩機能は使えます。背景には同梱の山のイラストを表示します。**実際のUnsplash写真には、自分のUnsplash APIアプリと接続サーバーの設定が必要です。このリポジトリにAPIキーや稼働済みサーバーは含まれていません。**

1. [Unsplash Developers](https://unsplash.com/developers) でAPIアプリを登録します。
2. `proxy/worker.mjs` をCloudflare Workersに配置します。`proxy/wrangler.toml` の `ALLOWED_ORIGINS` を、拡張機能画面に表示されるIDを使った `chrome-extension://拡張機能ID` に置き換えます。複数IDはカンマ区切りです。
3. Workersのシークレット `UNSPLASH_ACCESS_KEY` にAccess Keyを保存します。Secret Keyは使いません。キーはGitHub・拡張機能・設定画面に記載しないでください。
4. 配置後のHTTPS URL（例：`https://your-worker.workers.dev/`）をホーム画面の歯車 → **Unsplash接続先**に入力して保存します。
5. 自然・森・海・山・秋からテーマを選び、「今すぐ変える」で確認します。

Wranglerを使う場合は `proxy` ディレクトリで `npx wrangler secret put UNSPLASH_ACCESS_KEY` と `npx wrangler deploy` を実行します。Cloudflareへのログイン・Unsplashアプリ登録は利用者側で行います。公開配布前にはUnsplashの本番申請と利用枠の確認、およびサーバー側のアクセス制限・レート制限を設定してください。CORSのOrigin確認はブラウザ向けの制限であり、サーバーへの認証ではありません。

接続先は拡張機能IDを明示的に許可するCORS応答を返します。全HTTPSサイトへのアクセス権限は追加しません。入力した接続先に送るのは写真テーマと写真IDのみで、会話内容や利用統計は送りません。

## 写真の更新・クレジット

- ホームと休憩画面は同じ写真キャッシュを共有します。画像そのものはUnsplashが返した `urls.regular` を直接表示し、`ixid` を維持します。
- 「タブを開くたび」では最短5分、「1時間ごと」では1時間で更新します。「手動のみ」でも初回は1枚取得します。手動更新は10秒間隔までです。
- 撮影者プロフィールとUnsplashへ、紹介用UTM付きのリンクを表示します。外部の文字列はHTMLとして挿入しません。
- 写真を初めて背景として表示できた時点で、サーバーがUnsplashから取得した `links.download_location` を呼びます。同じキャッシュの再表示では重複通知しません。通知失敗時は次回表示時に再試行します。
- 写真取得・画像読込は10秒でタイムアウトします。API失敗時は保存済み写真を維持し、画像も読めない場合は同梱のイラストに戻ります。API再試行は最低1分空けます。
- Picsumの旧キャッシュは利用しません。接続先保存時に旧キャッシュを削除します。統計には影響しません。

参照：[Unsplash API公式ドキュメント](https://unsplash.com/documentation)、[APIガイドライン](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines)、[ChromeアラームAPI](https://developer.chrome.com/docs/extensions/reference/api/alarms)。

## 確認

`node --test tests/services.test.cjs` で、利用上限・延長・日付変更・休憩終了、写真取得の同時実行・キャッシュ・クレジットURL・通知、オフラインと不正URL、接続サーバーのOrigin制限を検証します。

画面プレビューでホーム・設定・休憩画面のレイアウトを確認済みです。実Unsplash APIキーを使った疎通、実拡張機能としての各AIサイトへの表示、長時間計測は未確認です。変更を有効にした後、1分の上限で休憩画面と3つの操作を確認してください。
