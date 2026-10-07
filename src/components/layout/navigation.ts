import { Bell, BookMarked, Brain, ClipboardList, Home, LifeBuoy, MessageCircle, Settings, Shield, SlidersHorizontal, Timer, Trophy, Users, Waves } from "lucide-react";

export const primaryNavigation = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/timer", label: "タイマー", icon: Timer },
  { href: "/timeline", label: "タイムライン", icon: Waves },
  { href: "/memorize", label: "暗記", icon: Brain },
];

export const secondaryNavigation = [
  { title: "学習", items: [
    { href: "/subjects", label: "教科管理", description: "学習する教科を整理", icon: BookMarked },
    { href: "/missions", label: "ミッション", description: "目標に向かって取り組む", icon: ClipboardList },
    { href: "/ranking", label: "ランキング", description: "仲間と学習の積み重ねを比較", icon: Trophy },
  ] },
  { title: "交流", items: [
    { href: "/conversations", label: "メッセージ", description: "DMとグループの会話", icon: MessageCircle },
    { href: "/friends", label: "フレンド", description: "学習仲間を見つける", icon: Users },
    { href: "/global-chat", label: "全体チャット", description: "みんなで話す", icon: Waves },
  ] },
  { title: "アカウント", items: [
    { href: "/announcements", label: "お知らせ", description: "運営からのお知らせ", icon: Bell },
    { href: "/settings", label: "アカウント設定", description: "ログイン・アカウントの管理", icon: Settings },
    { href: "/preferences", label: "アプリ設定", description: "学習目標・通知・表示", icon: SlidersHorizontal },
    { href: "/support", label: "お問い合わせ", description: "困ったときはこちら", icon: LifeBuoy },
  ] },
];

export const adminNavigation = { href: "/admin", label: "管理者", icon: Shield };

export function isNavigationActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function pageTitle(pathname: string) {
  const route = [...primaryNavigation, ...secondaryNavigation.flatMap((group) => group.items), adminNavigation]
    .find((item) => isNavigationActive(pathname, item.href));
  if (route) return route.label;
  if (pathname.startsWith("/profile") || pathname === "/my-profile") return "プロフィール";
  return "StudyFlow";
}
