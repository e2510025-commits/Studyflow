"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useStore } from "@/store/useStore";
import { isAdminUid } from "@/lib/admin";
import Dialog from "@/components/ui/Dialog";
import { adminNavigation, isNavigationActive, primaryNavigation, secondaryNavigation } from "./navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const setSidebarOpen = useStore((state) => state.setSidebarOpen);
  const uid = useStore((state) => state.userProfile.uid);
  const isMoreActive = !primaryNavigation.some((item) => isNavigationActive(pathname, item.href));

  const primaryLinks = primaryNavigation.map((item) => {
    const Icon = item.icon;
    const active = isNavigationActive(pathname, item.href);
    return (
      <Link key={item.href} href={item.href} className={`nav-item ${active ? "is-active" : ""}`}
        aria-current={active ? "page" : undefined} onClick={() => setSidebarOpen(false)}>
        <Icon size={23} aria-hidden="true" /><span>{item.label}</span>
      </Link>
    );
  });
  const moreButton = (
    <button type="button" className={`nav-item ${isMoreActive || sidebarOpen ? "is-active" : ""}`}
      onClick={() => setSidebarOpen(true)} aria-expanded={sidebarOpen} aria-controls="more-navigation" aria-haspopup="dialog">
      <MoreHorizontal size={23} aria-hidden="true" /><span>その他</span>
    </button>
  );
  const AdminIcon = adminNavigation.icon;

  return (
    <>
      <aside className="app-sidebar" aria-label="サイドバー">
        <Link href="/" className="app-brand" aria-label="StudyFlow ホーム">
          <span className="brand-short" aria-hidden="true">SF</span>
          <span className="brand-name">StudyFlow</span>
        </Link>
        <nav aria-label="メインナビゲーション" className="primary-navigation">{primaryLinks}{moreButton}</nav>
        <div className="desktop-secondary">
          {secondaryNavigation.slice(0, 2).map((group) => (
            <nav key={group.title} aria-label={group.title} className="secondary-navigation">
              <p className="nav-group-title">{group.title}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavigationActive(pathname, item.href);
                return <Link key={item.href} href={item.href} className={`secondary-nav-item ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}><Icon size={19} aria-hidden="true" />{item.label}</Link>;
              })}
            </nav>
          ))}
          {isAdminUid(uid) && <Link href="/admin" className="secondary-nav-item"><AdminIcon size={19} aria-hidden="true" />管理者</Link>}
        </div>
        <div className="sidebar-footer"><span className="status-dot" />自分のペースで、一歩ずつ。</div>
      </aside>
      <nav className="bottom-navigation" aria-label="モバイルナビゲーション">{primaryLinks}{moreButton}</nav>
      <Dialog open={sidebarOpen} onClose={() => setSidebarOpen(false)} title="その他" id="more-navigation">
        <div className="more-navigation-grid">
          {secondaryNavigation.map((group) => (
            <nav key={group.title} aria-label={`${group.title}のメニュー`}>
              <p className="nav-group-title">{group.title}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavigationActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} className={`more-nav-item ${active ? "is-active" : ""}`}
                    aria-current={active ? "page" : undefined} onClick={() => setSidebarOpen(false)}>
                    <span className="more-nav-icon"><Icon size={21} aria-hidden="true" /></span>
                    <span><span className="block font-semibold">{item.label}</span><span className="block text-sm text-muted">{item.description}</span></span>
                  </Link>
                );
              })}
            </nav>
          ))}
          {isAdminUid(uid) && <Link href="/admin" className="more-nav-item" onClick={() => setSidebarOpen(false)}><AdminIcon size={21} aria-hidden="true" />管理者</Link>}
        </div>
      </Dialog>
    </>
  );
}
