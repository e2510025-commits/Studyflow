"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { loginErrorMessage } from "@/lib/auth/provider-config";

type AuthMode = "login" | "register";
function subscribeLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}
const locationError = () => new URLSearchParams(window.location.search).get("error") || "";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [queryDismissed, setQueryDismissed] = useState(false);
  const errorCode = useSyncExternalStore(subscribeLocation, locationError, () => "");
  const visibleError = error || (!queryDismissed && errorCode ? loginErrorMessage(errorCode) : "");
  const [providerAttempt, setProviderAttempt] = useState(0);
  const [providers, setProviders] = useState<{ status: "loading" | "ready" | "error"; google: boolean; credentials: boolean }>({ status: "loading", google: false, credentials: false });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let active = true;
    async function loadProviders() {
      try {
        const response = await fetch("/api/auth/providers", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Providers unavailable");
        const data = await response.json();
        if (!data || typeof data !== "object" || !data.credentials) throw new Error("Providers unavailable");
        if (active) setProviders({ status: "ready", google: !!data.google, credentials: !!data.credentials });
      } catch {
        if (active) setProviders({ status: "error", google: false, credentials: false });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void loadProviders();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [providerAttempt]);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
    setQueryDismissed(true);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || providers.status !== "ready" || !providers.credentials) return;
    setLoading(true);
    setError("");

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "登録に失敗しました");
          setLoading(false);
          return;
        }
      }

      // Sign in with NextAuth credentials
      const { signIn } = await import("next-auth/react");
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        setError(loginErrorMessage(result.error));
      } else if (!result?.ok) {
        setError("ログイン処理を完了できませんでした。もう一度お試しください。");
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("エラーが発生しました。もう一度お試しください。");
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: string) => {
    if (loading || providers.status !== "ready" || !providers.google) return;
    setLoading(true);
    setError("");
    try {
      const { signIn } = await import("next-auth/react");
      const result = await signIn(provider, {
        callbackUrl: "/",
        redirect: false,
      });

      if (result?.error) {
        setError(loginErrorMessage(result.error));
        return;
      }

      if (result?.url) {
        const destination = new URL(result.url, window.location.origin);
        const code = destination.searchParams.get("error");
        if (destination.origin === window.location.origin && code) {
          setError(loginErrorMessage(code));
          return;
        }
        window.location.assign(result.url);
        return;
      }

      setError("ログインページへの遷移に失敗しました。もう一度お試しください。");
    } catch {
      setError("認証に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--background)" }}>
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #6366f1, transparent)" }}
        />
        <div
          className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #818cf8, transparent)" }}
        />
      </div>

      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--accent)", color: "#fff" }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <GraduationCap size={32} />
          </motion.div>
          <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>
            StudyFlow
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {mode === "login" ? "アカウントにログイン" : "新規アカウント作成"}
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {/* OAuth button (Google credentialsが設定されている場合のみ表示) */}
          {providers.google && <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuth("google")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Googleでログイン
            </button>
          </div>}

          {/* Divider */}
          {providers.google && <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: "var(--card-border)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              または
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--card-border)" }} />
          </div>}

          {providers.status === "loading" && <p role="status" className="text-sm mb-4" style={{ color: "var(--muted)" }}>ログイン方法を確認中…</p>}
          {providers.status === "error" && <div role="alert" className="text-sm mb-4" style={{ color: "var(--danger)" }}>
            <p>現在ログインを利用できません。時間をおいて再確認してください。</p>
            <button type="button" className="min-h-11 underline font-semibold" onClick={() => {
              setProviders({ status: "loading", google: false, credentials: false });
              setProviderAttempt((attempt) => attempt + 1);
            }}>ログイン方法を再確認</button>
          </div>}

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === "register" ? (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: "var(--muted-bg)", color: "var(--muted)" }}
                >
                  登録後、初回プロフィール登録ページに移動します。
                </motion.p>
              ) : null}
            </AnimatePresence>

            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted)" }}
              />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="メールアドレス"
                aria-label="メールアドレス"
                autoComplete="email"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                style={{
                  background: "var(--muted-bg)",
                  color: "var(--foreground)",
                  border: "2px solid transparent",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
                required
              />
            </div>

            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted)" }}
              />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="パスワード"
                aria-label="パスワード"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="w-full pl-10 pr-12 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                style={{
                  background: "var(--muted-bg)",
                  color: "var(--foreground)",
                  border: "2px solid transparent",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
                required
                minLength={6}
              />
              <button
                type="button"
                aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center"
                style={{ color: "var(--muted)" }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {visibleError && (
                <motion.div
                  role="alert"
                  className="text-sm font-medium px-3 py-2 rounded-lg"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {visibleError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading || providers.status !== "ready" || !providers.credentials}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
              style={{ background: "var(--accent)" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "ログイン" : "アカウント作成"}
                  <ArrowRight size={16} />
                </>
              )}
            </motion.button>
          </form>

          {/* Toggle mode */}
          <div className="mt-6 text-center">
            <button
              disabled={loading}
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--accent)" }}
            >
              {mode === "login"
                ? "アカウントをお持ちでない方 → 新規登録"
                : "すでにアカウントをお持ちの方 → ログイン"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
