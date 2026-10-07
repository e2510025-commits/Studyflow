"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Paintbrush, UserRound } from "lucide-react";
import { useStore } from "@/store/useStore";
import Dialog from "@/components/ui/Dialog";
import ThemePicker from "./ThemePicker";
import DesktopAppActions from "./DesktopAppActions";
import RankingBadge from "@/components/ranking/RankingBadge";
import { secondaryNavigation } from "./navigation";

export default function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const profile = useStore((state) => state.userProfile);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const imageAvatar = profile.avatar.startsWith("data:") || profile.avatar.startsWith("http");

  const logout = async () => {
    setLoggingOut(true);
    try {
      const { signOut } = await import("next-auth/react");
      await signOut({ callbackUrl: "/login" });
    } catch {
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="icon-button profile-trigger"
        aria-label="アカウントメニューを開く" aria-expanded={open} aria-controls="account-menu" aria-haspopup="dialog">
        {imageAvatar ? <img src={profile.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span aria-hidden="true">{profile.avatar || "🎓"}</span>}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="アカウント" id="account-menu">
        <Link href="/my-profile" className="account-profile" onClick={() => setOpen(false)}>
          <span className="more-nav-icon"><UserRound size={23} aria-hidden="true" /></span>
          <span className="min-w-0"><span className="block font-bold truncate">{profile.name || "ユーザー"}</span><span className="block text-sm text-muted">プロフィールを見る</span></span>
        </Link>
        <div className="account-links">
          {secondaryNavigation[2].items.map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className="secondary-nav-item" onClick={() => setOpen(false)}><Icon size={20} aria-hidden="true" />{item.label}</Link>;
          })}
        </div>
        <details className="theme-settings">
          <summary><Paintbrush size={20} aria-hidden="true" />表示テーマ</summary>
          <ThemePicker />
        </details>
        {open && <div className="mt-4"><RankingBadge /></div>}
        <div className="mt-4"><DesktopAppActions /></div>
        <button type="button" className="secondary-nav-item mt-5 w-full text-danger" onClick={() => void logout()} disabled={loggingOut}>
          <LogOut size={20} aria-hidden="true" />{loggingOut ? "ログアウト中…" : "ログアウト"}
        </button>
      </Dialog>
    </>
  );
}
