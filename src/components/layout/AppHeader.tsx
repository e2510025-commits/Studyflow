"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderMenu from "./HeaderMenu";
import NotificationBell from "./NotificationBell";
import DmBell from "./DmBell";
import FriendBell from "./FriendBell";
import { pageTitle } from "./navigation";

export default function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="app-header">
      <Link href="/" className="mobile-brand" aria-label="StudyFlow ホーム">StudyFlow</Link>
      <p className="header-location">{pageTitle(pathname)}</p>
      <div className="header-actions"><FriendBell /><DmBell /><NotificationBell /><HeaderMenu /></div>
    </header>
  );
}
