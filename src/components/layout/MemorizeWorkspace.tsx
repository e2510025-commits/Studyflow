"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  { href: "/memorize", label: "単語帳ライブラリ" },
  { href: "/memorize/questions", label: "問題カード一覧" },
  { href: "/memorize/create-question", label: "問題カードを作成" },
  { href: "/memorize/create-deck", label: "単語帳を作成" },
];
export default function MemorizeWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/memorize" || pathname.includes("/review/") || pathname.endsWith("/run")) return children;
  return <div className="study-detail-layout"><div className="study-detail-main">{children}</div>
    <aside className="study-detail-rail"><nav aria-label="暗記の作業メニュー"><h2>暗記メニュー</h2>{links.map((link) => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>{link.label}</Link>)}</nav>
      <div className="study-detail-note"><h2>少しずつ、確実に</h2><p>問題を作り、復習やテストで理解を確認しましょう。</p></div>
    </aside>
  </div>;
}
