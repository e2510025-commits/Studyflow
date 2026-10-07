"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Users, Plus, Search, Check } from "lucide-react";
import { useStore } from "@/store/useStore";
import { createGroupChat, subscribeMyGroups, type GroupChat } from "@/lib/firestore/groups";
import { markChatMessagesAsRead, subscribeUnreadDirectMessageCounts } from "@/lib/firestore/chat";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import QuickProfileCard from "@/components/profile/QuickProfileCard";
import OfficialMark from "@/components/ui/OfficialMark";
import Dialog from "@/components/ui/Dialog";

function Avatar({ avatar }: { avatar: string }) {
  const safe = sanitizeAvatar(avatar);
  return safe.startsWith("http") || safe.startsWith("data:") ? <img src={safe} alt="" className="w-11 h-11 rounded-full object-cover" /> : <span className="w-11 h-11 rounded-full inline-flex items-center justify-center text-xl" style={{ background: "var(--accent-light)" }}>{safe}</span>;
}
export default function ConversationsPage() {
  const userProfile = useStore((s) => s.userProfile);
  const friends = useStore((s) => s.friends);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [tab, setTab] = useState<"direct" | "groups">("direct");
  const [query, setQuery] = useState("");
  const [groupState, setGroupState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const [quickProfileUid, setQuickProfileUid] = useState<string | null>(null);
  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyGroups(userProfile.uid, (rows) => { setGroups(rows); setGroupState("ready"); }, () => setGroupState("error"));
  }, [userProfile.uid, retry]);
  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeUnreadDirectMessageCounts(userProfile.uid, (counts) => setUnreadByUser(counts.byUser));
  }, [userProfile.uid]);
  const dedupedFriends = useMemo(() => {
    const map = new Map<string, (typeof friends)[number]>();
    for (const friend of friends) { const previous = map.get(friend.uid); if (!previous || new Date(friend.addedAt) >= new Date(previous.addedAt)) map.set(friend.uid, friend); }
    return Array.from(map.values());
  }, [friends]);
  const keyword = query.trim().toLowerCase();
  const visibleFriends = dedupedFriends.filter((friend) => `${sanitizeDisplayName(friend.name)} ${friend.uid}`.toLowerCase().includes(keyword));
  const visibleGroups = groups.filter((group) => group.name.toLowerCase().includes(keyword));
  const unreadTotal = dedupedFriends.reduce((sum, friend) => sum + (unreadByUser[friend.uid] || 0), 0);
  const closeCreate = () => { if (!creating) setShowCreateGroup(false); };
  const create = async () => {
    if (!groupName.trim() || !userProfile.uid || creating) return;
    setCreating(true); setCreateError("");
    try {
      await createGroupChat({ ownerUid: userProfile.uid, name: groupName.trim(), memberUids: selectedMembers });
      setGroupName(""); setSelectedMembers([]); setShowCreateGroup(false); setTab("groups"); setQuery("");
    } catch { setCreateError("グループを作成できませんでした。入力を確認して再試行してください。"); }
    finally { setCreating(false); }
  };
  return <div className="max-w-3xl mx-auto space-y-5">
    <div className="page-heading"><div><h1>メッセージ</h1><p>仲間と話して、学びをつなげましょう。</p></div><button className="primary-button" onClick={() => { setCreateError(""); setShowCreateGroup(true); }}><Plus size={20} />グループ作成</button></div>
    <label className="inbox-search"><Search size={20} aria-hidden="true" /><input aria-label="会話を検索" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名前・UID・グループ名で検索" /></label>
    <div className="segmented-control" aria-label="メッセージの種類">
      <button aria-pressed={tab === "direct"} onClick={() => setTab("direct")}><MessageSquare size={18} />DM{unreadTotal > 0 && <span className="unread-count">{unreadTotal > 99 ? "99+" : unreadTotal}</span>}</button>
      <button aria-pressed={tab === "groups"} onClick={() => setTab("groups")}><Users size={18} />グループ</button>
    </div>
    <section className="glass-card overflow-hidden" aria-label={tab === "direct" ? "DM一覧" : "グループ一覧"}>
      {tab === "direct" ? visibleFriends.length === 0 ? <div className="list-empty"><MessageSquare size={32} /><h2>{keyword ? "条件に合う会話がありません" : "仲間との会話を始めましょう"}</h2><p>{keyword ? "検索条件を変えてみてください。" : "フレンドを追加すると、ここからメッセージを送れます。"}</p>{!keyword && <Link href="/friends" className="secondary-button">フレンドを探す</Link>}</div> : visibleFriends.map((friend) => {
        const name = sanitizeDisplayName(friend.name); const count = unreadByUser[friend.uid] || 0;
        return <div key={friend.uid} className="inbox-row"><button className="icon-button" aria-label={`${name}のプロフィール`} onClick={() => setQuickProfileUid(friend.uid)}><Avatar avatar={friend.avatar} /></button><Link className="inbox-row-link" href={`/friends/chat/${friend.uid}`} onClick={() => { if (!userProfile.uid) return; setUnreadByUser((prev) => ({...prev, [friend.uid]:0})); void markChatMessagesAsRead(userProfile.uid, friend.uid).catch(() => {}); }}><span className="flex gap-2 items-center min-w-0"><span className="font-semibold truncate">{name}</span><OfficialMark uid={friend.uid} isOfficial={friend.isOfficial} size={14} /></span><span className="text-sm text-muted">{count > 0 ? "未読のメッセージがあります" : "メッセージを開く"}</span></Link>{count > 0 && <span className="unread-count" aria-label={`未読 ${count}件`}>{count > 99 ? "99+" : count}</span>}</div>;
      }) : groupState === "loading" ? <p className="list-empty" role="status">グループを読み込み中…</p> : groupState === "error" ? <div className="list-empty"><p role="alert">グループを読み込めませんでした。</p><button className="secondary-button" onClick={() => { setGroupState("loading"); setRetry((n) => n + 1); }}>再読み込み</button></div> : visibleGroups.length === 0 ? <div className="list-empty"><Users size={32} /><h2>{keyword ? "条件に合うグループがありません" : "学びを共有するグループを作ろう"}</h2><p>{keyword ? "検索条件を変えてみてください。" : "会話・課題・進捗を仲間と共有できます。"}</p></div> : visibleGroups.map((group) => <Link key={group.id} href={`/conversations/group/${group.id}`} className="inbox-row"><span className="more-nav-icon"><Users size={22} /></span><span className="flex-1 min-w-0"><span className="block font-semibold break-words">{group.name}</span><span className="block text-sm text-muted">{group.memberUids.length}人のメンバー</span></span></Link>)}
    </section>
    <Dialog open={showCreateGroup} onClose={closeCreate} title="グループ作成"><form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void create(); }}><label className="block space-y-2"><span className="text-sm font-semibold">グループ名</span><input autoFocus className="app-input w-full" required maxLength={100} value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="例：春休みの学習チーム" disabled={creating} /></label><fieldset><legend className="text-sm font-semibold mb-2">メンバーを選択</legend><p className="text-sm text-muted mb-3">あなたは自動的にメンバーになります。</p><div className="max-h-56 overflow-y-auto space-y-1">{dedupedFriends.map((friend) => {const active = selectedMembers.includes(friend.uid);return <button type="button" key={friend.uid} aria-label={`${sanitizeDisplayName(friend.name)}をメンバーに選択`} aria-pressed={active} disabled={creating} className="member-choice" onClick={() => setSelectedMembers((prev) => active ? prev.filter((id) => id !== friend.uid) : [...prev, friend.uid])}><Avatar avatar={friend.avatar} /><span className="flex-1 min-w-0 truncate">{sanitizeDisplayName(friend.name)}</span>{active && <Check size={20} />}</button>;})}{friends.length === 0 && <p className="text-sm text-muted">フレンドを追加するとメンバーを選べます。</p>}</div></fieldset>{createError && <p role="alert" className="text-sm text-danger">{createError}</p>}<button className="primary-button w-full" disabled={creating || !groupName.trim()}>{creating ? "作成中…" : "作成する"}</button></form></Dialog>
    <QuickProfileCard open={Boolean(quickProfileUid)} uid={quickProfileUid} viewerUid={userProfile.uid} onClose={() => setQuickProfileUid(null)} />
  </div>;
}
