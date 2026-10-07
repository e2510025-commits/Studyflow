import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import { Auth, customFetch, skipCSRFCheck, type AuthConfig } from "@auth/core";
import Google from "@auth/core/providers/google";
import { AuthError } from "@auth/core/errors";
import { unstable_doesMiddlewareMatch, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";
import { config as middlewareConfig } from "../../src/middleware";
import { googleCredentials, loginErrorMessage } from "../../src/lib/auth/provider-config";

async function main() {
  for (const path of ["/sw.js", "/logo.png", "/favicon.png", "/manifest.webmanifest", "/login", "/api/auth/session"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config: middlewareConfig, nextConfig, url: `https://studyflow.studio${path}` }), false, path);
  }
  for (const path of ["/", "/timer", "/settings", "/api/support", "/api/memorize/decks", "/sw.js/private"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config: middlewareConfig, nextConfig, url: `https://studyflow.studio${path}` }), true, path);
  }
  // Real Next.js redirect matcher: preserve path/query, isolate the old alias.
  for (const path of ["/", "/login?error=Configuration", "/api/auth/signin/google", "/timer?subject=english"]) {
    const response = await unstable_getResponseFromNextConfig({ url: `https://studyflow-lake.vercel.app${path}`, nextConfig });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), `https://studyflow.studio${path}`);
  }
  for (const host of ["studyflow.studio", "localhost:3107", "studyflow-preview.vercel.app", "studyflow-lakeXvercelYapp"]) {
    const response = await unstable_getResponseFromNextConfig({ url: `https://${host}/login`, nextConfig });
    assert.equal(response.headers.get("location"), null, host);
  }
  assert.equal(googleCredentials({}), null);
  assert.equal(googleCredentials({ GOOGLE_CLIENT_ID: "legacy", AUTH_GOOGLE_SECRET: "standard" }), null);
  assert.deepEqual(googleCredentials({ GOOGLE_CLIENT_ID: "legacy", GOOGLE_CLIENT_SECRET: "legacy-test" }), { clientId: "legacy", clientSecret: "legacy-test" });
  assert.deepEqual(googleCredentials({ AUTH_GOOGLE_ID: "standard", AUTH_GOOGLE_SECRET: "standard-test" }), { clientId: "standard", clientSecret: "standard-test" });
  assert.deepEqual(googleCredentials({ GOOGLE_CLIENT_ID: "legacy", GOOGLE_CLIENT_SECRET: "legacy-test", AUTH_GOOGLE_ID: "standard", AUTH_GOOGLE_SECRET: "standard-test" }), { clientId: "legacy", clientSecret: "legacy-test" });
  assert.match(loginErrorMessage("CredentialsSignin"), /パスワード/);
  assert.doesNotMatch(loginErrorMessage("Configuration"), /パスワード/);

  // Real Auth.js PKCE generation/validation; all provider traffic stays in fixtures.
  const failures: Array<{ type: string; cause: unknown }> = [];
  const causeMessage = (cause: unknown) => cause instanceof Error ? cause.message : cause && typeof cause === "object" && "err" in cause && cause.err instanceof Error ? cause.err.message : "";
  const config: AuthConfig = {
    basePath: "/api/auth", trustHost: true,
    secret: "isolated-auth-regression-secret-32-characters",
    // Test fixture only. Production code retains the normal CSRF check.
    skipCSRFCheck,
    pages: { signIn: "/login", error: "/login" },
    logger: { error(error) { failures.push({ type: error instanceof AuthError ? error.type : error.name, cause: error.cause }); }, warn() {}, debug() {} },
    providers: [Google({
      clientId: "local-test", clientSecret: "local-test",
      [customFetch]: async (input) => {
        const url = String(input);
        if (url === "https://accounts.google.com/.well-known/openid-configuration") return Response.json({
          issuer: "https://accounts.google.com", authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
          token_endpoint: "https://oauth2.googleapis.com/token", jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
          userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
          response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"],
          code_challenge_methods_supported: ["S256"],
        });
        if (url === "https://oauth2.googleapis.com/token") return Response.json({ error: "invalid_grant" }, { status: 400 });
        throw new Error("Unexpected external request in auth fixture");
      },
    })],
  };
  const start = await Auth(new Request("https://studyflow-lake.vercel.app/api/auth/signin/google", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "callbackUrl=%2F",
  }), config);
  assert.equal(start.status, 302);
  const authorization = new URL(start.headers.get("location")!);
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  const pkce = start.headers.getSetCookie().find((cookie) => cookie.startsWith("__Secure-authjs.pkce.code_verifier="));
  assert(pkce);
  assert.match(pkce, /HttpOnly/i); assert.match(pkce, /Secure/i); assert.match(pkce, /SameSite=Lax/i);
  assert.doesNotMatch(pkce, /Domain=/i);
  // A host-only cookie created on the old alias is absent on the canonical host.
  const failed = await Auth(new Request("https://studyflow.studio/api/auth/callback/google?code=local-test-code"), config);
  assert.equal(failed.headers.get("location"), "https://studyflow.studio/login?error=Configuration");
  assert(failures.some((error) => error.type === "InvalidCheck" && causeMessage(error.cause).includes("cookie was missing")), JSON.stringify(failures.map((error) => ({ type: error.type, cause: causeMessage(error.cause) }))));
  failures.length = 0;
  await Auth(new Request("https://studyflow-lake.vercel.app/api/auth/callback/google?code=local-test-code", {
    headers: { Cookie: pkce.split(";")[0] },
  }), config);
  assert(failures.length > 0, "The fixture intentionally rejects the dummy authorization code");
  assert(!failures.some((error) => error.type === "InvalidCheck"), "Same-host cookie must pass PKCE validation");
  console.log("PASS: old-alias redirect isolation/path/query; provider pairs; credential vs configuration messages; real PKCE missing-cookie reproduction and same-host validation");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
