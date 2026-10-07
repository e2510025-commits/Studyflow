# ログインの運用設定・復旧記録

## 2026-10-07: GoogleログインのPKCEエラー

本番ログで `InvalidCheck: pkceCodeVerifier value could not be parsed` が発生。VercelのLogs画面から、認証開始が `studyflow-lake.vercel.app`、Googleからのコールバックが `studyflow.studio` だったと確認しました。Auth.jsのPKCE Cookieはホストに限定されるため、別ドメインには渡りません。

Vercelの `e2510025-commits-projects / studyflow` のDomains設定で、旧ドメインを **307 → studyflow.studio** に変更しました。アプリを再デプロイせず本番へ反映し、HTTP応答を確認しています。

| 検証 | 結果 |
| --- | --- |
| `https://studyflow-lake.vercel.app/login` | 307、Locationは `https://studyflow.studio/login` |
| `https://studyflow.studio/login` | 200 |
| 正式URLの `/api/auth/providers` | 200、Google・Credentialsが利用可能 |
| GoogleコールバックURL | `https://studyflow.studio/api/auth/callback/google` |
| 利用者によるGoogleログインやり直し | **ログイン成功**の回答を確認 |

認証鍵の変更、Cookieの共有範囲拡張、PKCEの無効化、Firebaseデータ変更は行っていません。GitHubのリポジトリWebsiteも正式URLへ変更済みです。

## 再発を防ぐ設定

- Vercelの旧ドメインへの転送設定を維持してください。アプリ側の `next.config.ts` にも同じホスト限定の307転送を追加しています。Preview・localhost・正式ドメインは転送対象に含めません。
- Google Cloudの認証済みリダイレクトURIは `https://studyflow.studio/api/auth/callback/google` とそろえます。Google認証を途中まで進めた古いタブを再利用せず、正式URLのログイン画面から開始してください。
- `AUTH_URL` または旧 `NEXTAUTH_URL` を指定する場合、本番のホストを正式URLにそろえ、Preview向け設定と区別してください。Auth.js v5では通常リクエストからURLを推定するため、不要な上書きは追加しません。
- `AUTH_SECRET` または旧 `NEXTAUTH_SECRET` は既存の安定した秘密鍵を維持します。単にこのエラーが出たという理由で再生成しません。値をGit・ログ・チャットに出さないでください。
- Googleの設定は既存の `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を優先します。両方そろっていない場合は標準の `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` の完全な組を使用します。異なる設定名のIDとSecretを混ぜません。
- 設定の更新を必要とする場合は、適用環境と対象デプロイを照合してください。今回の本番復旧はドメイン転送のみで、UI改修ブランチは本番へ公開していません。

## 開発での確認

- `npm run test:auth`: Next.jsの実際のリダイレクト判定、旧ホスト限定・パス・クエリの保持、Google設定の組、エラー分類を確認。Auth.jsでPKCE Cookieを生成し、別ホストでCookieがない場合の失敗と同じホストで検証を通過する場合を再現します。Googleへの通信はテスト内の固定応答で、実アカウントやDBには接続しません。
- `UI_TEST_PORT=3107` で隔離サーバー `npm run dev:ui` を起動し、`npm run test:ui:auth` を実行します。ログイン画面の設定取得失敗・再確認、Google未設定、入力間違いとConfigurationの区別、モバイル・iPad・PC幅を検証します。外部通信・アカウント作成は遮断します。

参考: [Auth.js InvalidCheck](https://authjs.dev/reference/core/errors#invalidcheck)、[Auth.js Deployment](https://authjs.dev/getting-started/deployment)。
