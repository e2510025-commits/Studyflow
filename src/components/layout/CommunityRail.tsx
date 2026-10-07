"use client";

import Link from "next/link";
import { ArrowUpRight, MessageCircle, Timer, Users } from "lucide-react";
import { useStore } from "@/store/useStore";
import { sanitizeDisplayName } from "@/lib/identity";

export default function CommunityRail() {
  const profile = useStore((state) => state.userProfile);
  const friends = useStore((state) => state.friends);
  return <aside className="workspace-rail community-rail" aria-label="学習仲間とマイスペース">
    <section className="rail-section"><p className="section-kicker">マイスペース</p><h2>{sanitizeDisplayName(profile.name)}</h2>
      <p className="text-sm text-muted">1日の目標 {Math.round(profile.dailyGoal / 60)}分</p>
      <Link className="rail-link" href="/timer"><Timer size={20} /><span>学習を計測する</span><ArrowUpRight size={17} /></Link>
      <Link className="rail-link" href="/my-profile"><span>自分のプロフィール</span><ArrowUpRight size={17} /></Link>
    </section>
    <section className="rail-section"><h2>学習仲間</h2>
      {friends.slice(0, 4).map((friend) => <Link className="rail-person" key={friend.uid} href={`/profile/${friend.uid}`} aria-label={`${sanitizeDisplayName(friend.name)}のプロフィールを開く`}><span className="person-initial" aria-hidden="true">{Array.from(sanitizeDisplayName(friend.name))[0]}</span><span className="truncate">{sanitizeDisplayName(friend.name)}</span><ArrowUpRight size={16} /></Link>)}
      <Link className="rail-link" href="/friends"><Users size={20} /><span>仲間を探す</span><ArrowUpRight size={17} /></Link>
      <Link className="rail-link" href="/conversations"><MessageCircle size={20} /><span>メッセージを開く</span><ArrowUpRight size={17} /></Link>
    </section>
  </aside>;
}
