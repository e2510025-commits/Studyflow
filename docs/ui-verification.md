# UI検証記録

2026-10-07。仕様書を先行コミットした後、共通レイアウトと主要4画面を実装しました。

## 実行結果

| 検証 | 結果・範囲 |
| --- | --- |
| `npm run build` | 成功。Prisma生成、Next.js本番ビルド、60ページの静的生成が完了。テスト用Firebase設定で実行 |
| `npx tsc --noEmit` | 成功 |
| 変更したTS/TSXとUI検証スクリプトのeslint | エラー0。画像・既存依存配列などの警告は残存 |
| `npm run test:ui` | 開発サーバーと本番ビルドのローカルサーバーで成功 |
| レスポンシブ | ホーム・タイマー・暗記・タイムライン × 360/390/430/768/820/1024/1180/1280/1440px。ページ全体の横スクロールなし |
| ダイアログ | その他メニューのフォーカス制限、Escape、呼び出し元への復帰、背景スクロール復帰。アカウント・投稿・単語帳の編集も開閉確認 |
| タイマー | 3モードの切替、教科選択、開始・一時停止・再開・集中モード。メニューのEscapeがタイマーをリセットしない。実行中のタイマーがホームに表示される |
| 暗記 | 検索・お気に入り、空状態と読込失敗の区別、POST/PATCH/DELETEの既存リクエスト形式、失敗時の入力保持、成功後の一覧更新、削除確認 |
| ホーム | 空状態、学習記録あり、長い名前、4期間のグラフ切替。4テーマの切替、正方形1080pxと縦長1080×1920pxのPNG出力 |
| 実績・掲示板 | 共通メニューに表示されない。旧URLの終了案内を確認。新規実績の再計算・獲得通知・掲示板転送を停止。既存データは保持 |
| ブラウザ | テスト中の未処理JavaScript例外0。画面と出力PNGを目視確認 |

## 再現方法

Node.js 20.9以上を使用してください。

```sh
npm ci
npx playwright install chromium
npm run dev:ui
```

別のターミナルで `npm run test:ui` を実行します。`dev:ui` は本番と異なるテスト用Firebase設定をプロセス環境へ設定し、127.0.0.1:3000で起動します。テストの接続先は固定のlocalhostです。

テストはセッションCookie・学習記録・単語帳をローカルに用意します。APIはPlaywrightで応答を代替し、外部HTTP/WebSocketを遮断します。認証コードやDB書込権限をアプリへ追加していません。画像とリクエスト記録はgitignore済みの `artifacts/ui/` に生成します。

本番ビルドでも同じテストを実行しました。ビルド時には `NEXT_PUBLIC_FIREBASE_PROJECT_ID=studyflow-ui-test`、`NEXT_PUBLIC_FIREBASE_API_KEY=local-ui-test`、`NEXT_PUBLIC_FIREBASE_APP_ID=local-ui-test`、`AUTH_SECRET=local-ui-test-only` をプロセス環境へ設定し、`npm run build` の後、同じ設定で `npm run start -- --port 3000` を使用しています。これらはローカル検証専用で、本番の環境変数には設定しません。

## 検証できていない範囲

- APIとFirebase間の実際の保存、ログイン・権限・リアルタイム反映は今回のローカルUIテストでは未検証。既存APIのメソッド、レスポンス、所有者チェック、Firestoreパスをコードで照合し、既存の保存・認証処理を維持しています。
- 実機のiPhone/iPad、Safari、仮想キーボード、セーフエリア、ホーム画面PWA、ブラウザ通知許可の動作は未検証。Chromiumで画面幅を模擬しています。
- Vercelの対象チーム詳細は403のため、本番環境変数とPreviewのDB接続先を確認できていません。本番デプロイ・DB移行・データ削除は実行していません。
- リポジトリ全体のeslintには、変更していない4箇所に既存エラーが残ります：`src/app/api/ranking/route.ts`（prefer-const）、`src/app/preferences/page.tsx`（set-state-in-effect）、`src/components/timer/LiquidCircle.tsx`（purity）、`src/lib/achievements.ts`（no-empty-object-type）。全体49警告。変更ファイルのエラーは0です。
- Next.jsは既存の`middleware.ts`について非推奨警告を出します。認証挙動を変えないため今回のUI改修では移行していません。
