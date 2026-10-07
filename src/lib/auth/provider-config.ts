type Environment = Record<string, string | undefined>;

/** Keep each ID/secret pair together; existing deployments keep precedence. */
export function googleCredentials(env: Environment) {
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }
  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
    return { clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET };
  }
  return null;
}

export function loginErrorMessage(code: string) {
  if (code === "CredentialsSignin") return "メールアドレスまたはパスワードが間違っています";
  if (code === "Configuration") return "ログイン処理を完了できませんでした。この画面からもう一度お試しください。繰り返す場合は管理者にお知らせください。";
  if (code === "AccessDenied") return "ログインが許可されませんでした。別のアカウントでお試しください。";
  if (code === "OAuthAccountNotLinked") return "登録時と同じ方法でログインしてください。";
  return "認証に失敗しました。この画面からもう一度お試しください。";
}
