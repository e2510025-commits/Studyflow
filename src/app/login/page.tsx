"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [verificationCode, setVerificationCode] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
    setInfo("");
    if (mode === "register" && e.target.name === "email") {
      setCodeVerified(false);
      setCodeSentAt(0);
      setVerificationCode("");
    }
  };

  const handleSendCode = async () => {
    if (!form.email || sendingCode) return;
    setSendingCode(true);
    setError("");
    setInfo("");

    try {
      const res = await fetch("/api/auth/register/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "認証コードの送信に失敗しました");
        return;
      }
      setCodeSentAt(Date.now());
      setInfo("認証コードを送信しました。メールを確認してください。");
    } catch {
      setError("認証コード送信中にエラーが発生しました");
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!form.email || !verificationCode || verifyingCode) return;
    setVerifyingCode(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/register/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code: verificationCode }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCodeVerified(false);
        setError(data.error || "認証コードの確認に失敗しました");
        return;
      }
      setCodeVerified(true);
      setInfo("メール認証が完了しました。続けてアカウント作成できます。");
    } catch {
      setError("認証コード確認中にエラーが発生しました");
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "register") {
        if (!codeVerified) {
          setError("先にメール認証コードを確認してください");
          setLoading(false);
          return;
        }
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
        setError("メールアドレスまたはパスワードが間違っています");
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("エラーが発生しました。もう一度お試しください。");
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: string) => {
    setLoading(true);
    try {
      const { signIn } = await import("next-auth/react");
      await signIn(provider, { callbackUrl: "/" });
    } catch {
      setError("認証に失敗しました");
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
          <div className="space-y-3 mb-6">
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
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: "var(--card-border)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              または
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--card-border)" }} />
          </div>

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
                  登録後にアカウント設定ページで「名前・アイコン・自己紹介」を設定できます。
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

            {mode === "register" && (
              <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--muted-bg)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                  1. 認証コードをメールで受け取る
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendingCode || !form.email}
                    className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    {sendingCode ? "送信中..." : "認証コードを送信"}
                  </button>
                  {codeSentAt > 0 && (
                    <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                      送信済み: {new Date(codeSentAt).toLocaleTimeString("ja-JP")}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold mt-2" style={{ color: "var(--foreground)" }}>
                  2. 受け取った6桁コードを入力して確認
                </p>
                <div className="flex items-center gap-2">
                  <input
                    value={verificationCode}
                    onChange={(e) => {
                      setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setCodeVerified(false);
                      setError("");
                      setInfo("");
                    }}
                    placeholder="6桁コード"
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--background)", color: "var(--foreground)" }}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={verifyingCode || verificationCode.length !== 6}
                    className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                    style={{ background: codeVerified ? "#22c55e" : "var(--accent)", color: "#fff" }}
                  >
                    {verifyingCode ? "確認中..." : codeVerified ? "確認済み" : "コード確認"}
                  </button>
                </div>
              </div>
            )}

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
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted)" }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="text-sm font-medium px-3 py-2 rounded-lg"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {info && !error && (
                <motion.div
                  className="text-sm font-medium px-3 py-2 rounded-lg"
                  style={{ background: "rgba(34,197,94,0.12)", color: "#16a34a" }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {info}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading || (mode === "register" && !codeVerified)}
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
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
                setInfo("");
                setCodeVerified(false);
                setCodeSentAt(0);
                setVerificationCode("");
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
