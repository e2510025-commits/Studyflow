"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Users, Plus, X, Check } from "lucide-react";
import { createGroupChat, subscribeMyGroups, type GroupChat } from "@/lib/firestore/groups";
import { markChatMessagesAsRead, subscribeUnreadDirectMessageCounts } from "@/lib/firestore/chat";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";
import QuickProfileCard from "@/components/profile/QuickProfileCard";
import OfficialMark from "@/components/ui/OfficialMark";

function AvatarPill({ avatar }: { avatar: string }) {
  const isImage = avatar.startsWith("http") || avatar.startsWith("data:");
  if (isImage) {
    return <img src={avatar} alt="avatar" className="w-9 h-9 rounded-full object-cover" />;
  }
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--accent-light)" }}>
      {avatar}
    </div>
  );
}

export default function ConversationsPage() {
  const router = useRouter();
  const { userProfile, friends } = useStore();
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const [quickProfileUid, setQuickProfileUid] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyGroups(userProfile.uid, setGroups);
  }, [userProfile.uid]);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeUnreadDirectMessageCounts(userProfile.uid, (counts) => {
      setUnreadByUser(counts.byUser);
    });
  }, [userProfile.uid]);

  const visibleUnreadByUser = userProfile.uid ? unreadByUser : {};

  const selectedFriendObjects = useMemo(
    () => friends.filter((f) => selectedMembers.includes(f.uid)),
    [friends, selectedMembers]
  );

  const dedupedFriends = useMemo(() => {
    const byUid = new Map<string, (typeof friends)[number]>();
    friends.forEach((friend) => {
      const prev = byUid.get(friend.uid);
      if (!prev) {
        byUid.set(friend.uid, friend);
        return;
      }
      const prevAt = new Date(prev.addedAt).getTime();
      const nextAt = new Date(friend.addedAt).getTime();
      if (Number.isNaN(prevAt) || nextAt >= prevAt) {
        byUid.set(friend.uid, friend);
      }
    });
    return Array.from(byUid.values());
  }, [friends]);

  const toggleMember = (uid: string) => {
    setSelectedMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();
    if (!name || !userProfile.uid) return;

    await createGroupChat({
      ownerUid: userProfile.uid,
      name,
      memberUids: selectedMembers,
    });

    setGroupName("");
    setSelectedMembers([]);
    setShowCreateGroup(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black" style={{ color: "var(--foreground)" }}>
            会話
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            DMとグループDMをまとめて管理
          </p>
        </div>
        <button
          onClick={() => setShowCreateGroup(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          <Plus size={16} />
          グループ作成
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={18} style={{ color: "var(--accent)" }} />
            <h2 className="font-bold" style={{ color: "var(--foreground)" }}>
              DM
            </h2>
          </div>

          {dedupedFriends.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              フレンドを追加するとここに表示されます
            </p>
          ) : (
            <div className="space-y-2">
              {dedupedFriends.map((friend) => {
                const safeName = sanitizeDisplayName(friend.name);
                const safeAvatar = sanitizeAvatar(friend.avatar);
                const unreadCount = visibleUnreadByUser[friend.uid] || 0;
                return (
                <div
                  key={friend.uid}
                  onClick={() => {
                    if (!userProfile.uid) return;
                    setUnreadByUser((prev) => ({ ...prev, [friend.uid]: 0 }));
                    void markChatMessagesAsRead(userProfile.uid, friend.uid).catch(() => {});
                    router.push(`/friends/chat/${friend.uid}`);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: "var(--muted-bg)", cursor: "pointer" }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickProfileUid(friend.uid);
                    }}
                    className="rounded-full transition-all"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.06)";
                      e.currentTarget.style.filter = "brightness(0.92)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.filter = "none";
                    }}
                  >
                    <AvatarPill avatar={safeAvatar} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "var(--foreground)" }}>
                        {safeName}
                      </p>
                      <OfficialMark uid={friend.uid} isOfficial={friend.isOfficial} size={13} />
                      {unreadCount > 0 && (
                        <span
                          className="text-[10px] font-bold px-1.5 h-[18px] rounded-full flex items-center justify-center"
                          style={{ background: "#ef4444", color: "#fff" }}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>
                      UID: {friend.uid}
                    </p>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={18} style={{ color: "var(--accent)" }} />
            <h2 className="font-bold" style={{ color: "var(--foreground)" }}>
              グループDM
            </h2>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              まだグループがありません
            </p>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/conversations/group/${group.id}`}
                  className="block px-3 py-3 rounded-xl transition-colors"
                  style={{ background: "var(--muted-bg)" }}
                >
                  <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                    {group.name}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                    メンバー {group.memberUids.length} 人
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                    課題カテゴリ・固定表示・進捗共有に対応
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {showCreateGroup && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => setShowCreateGroup(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-2xl p-5 glass-card"
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  グループDM作成
                </h3>
                <button onClick={() => setShowCreateGroup(false)}>
                  <X size={18} style={{ color: "var(--muted)" }} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                    グループ名
                  </label>
                  <input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="例: 春休み課題チーム"
                    className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                    メンバー選択
                  </label>
                  <div className="mt-2 max-h-52 overflow-y-auto space-y-2">
                    {friends.map((friend) => {
                      const active = selectedMembers.includes(friend.uid);
                      return (
                        <button
                          key={friend.uid}
                          type="button"
                          onClick={() => toggleMember(friend.uid)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg"
                          style={{
                            background: active ? "var(--accent-light)" : "var(--muted-bg)",
                            color: active ? "var(--accent)" : "var(--foreground)",
                          }}
                        >
                          <span className="text-sm">{friend.avatar} {friend.name}</span>
                          {active && <Check size={14} />}
                        </button>
                      );
                    })}
                    {friends.length === 0 && (
                      <p className="text-sm" style={{ color: "var(--muted)" }}>
                        先にフレンドを追加してください
                      </p>
                    )}
                  </div>
                </div>

                {selectedFriendObjects.length > 0 && (
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    選択中: {selectedFriendObjects.map((f) => f.name).join(" / ")}
                  </p>
                )}

                <button
                  onClick={handleCreateGroup}
                  disabled={!groupName.trim()}
                  className="w-full px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: "var(--accent)" }}
                >
                  作成する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuickProfileCard
        open={Boolean(quickProfileUid)}
        uid={quickProfileUid}
        viewerUid={userProfile.uid}
        onClose={() => setQuickProfileUid(null)}
      />
    </div>
  );
}
