"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
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
          {/* OAuth buttons (Google/LINE credentialsが設定されている場合のみ表示) */}
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

            <button
              onClick={() => handleOAuth("line")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-white"
              style={{ background: "#06C755" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              LINEでログイン
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
              {mode === "register" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="relative">
                    <User
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--muted)" }}
                    />
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="ユーザー名"
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
                </motion.div>
              )}
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

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
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
