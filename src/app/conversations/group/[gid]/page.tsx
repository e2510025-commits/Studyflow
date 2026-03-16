"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/store/useStore";
import {
  addMembersToGroup,
  createGroupTask,
  createGroupTaskBundle,
  GroupChat,
  GroupMessage,
  GroupTaskBundle,
  sendGroupTextMessage,
  subscribeGroupMessages,
  subscribeGroupTaskBundles,
  subscribeMyGroups,
} from "@/lib/firestore/groups";
import { getProfilesBatch } from "@/lib/firestore/ranking";
import { ArrowLeft, MessageSquare, Plus, UserPlus, Check, X } from "lucide-react";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";

interface MemberProfile {
  name: string;
  avatar: string;
}

function InlineAvatar({ avatar }: { avatar: string }) {
  const safeAvatar = sanitizeAvatar(avatar);
  const isImage = safeAvatar.startsWith("http") || safeAvatar.startsWith("data:");
  if (isImage) {
    return <img src={safeAvatar} alt="avatar" className="w-5 h-5 rounded-full object-cover" />;
  }
  return (
    <span
      className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px]"
      style={{ background: "var(--accent-light)" }}
    >
      {safeAvatar}
    </span>
  );
}

export default function GroupConversationPage() {
  const params = useParams<{ gid?: string | string[] }>();
  const gid = Array.isArray(params.gid) ? params.gid[0] : params.gid || "";
  const { userProfile, friends } = useStore();

  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [bundles, setBundles] = useState<GroupTaskBundle[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Map<string, MemberProfile>>(new Map());

  const [chatInput, setChatInput] = useState("");
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDetails, setTaskDetails] = useState("");
  const [taskTotalPages, setTaskTotalPages] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUids, setInviteUids] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyGroups(userProfile.uid, setGroups);
  }, [userProfile.uid]);

  const currentGroup = useMemo(() => groups.find((g) => g.id === gid), [groups, gid]);

  useEffect(() => {
    if (!gid) return;
    const unsubMessages = subscribeGroupMessages(gid, setMessages);
    const unsubBundles = subscribeGroupTaskBundles(gid, setBundles);

    return () => {
      unsubMessages();
      unsubBundles();
    };
  }, [gid]);

  useEffect(() => {
    if (!currentGroup) return;
    void getProfilesBatch(currentGroup.memberUids).then((map) => {
      setMemberProfiles(map);
    });
  }, [currentGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const inviteCandidates = useMemo(() => {
    if (!currentGroup) return [];
    const memberUidSet = new Set(currentGroup.memberUids);
    return friends.filter((friend) => !memberUidSet.has(friend.uid));
  }, [friends, currentGroup]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !userProfile.uid || !gid) return;
    await sendGroupTextMessage(gid, userProfile.uid, text);
    setChatInput("");
  };

  const shareTask = async () => {
    const title = taskTitle.trim();
    if (!gid || !userProfile.uid || !title) return;

    let bundleId = bundles[0]?.id;
    if (!bundleId) {
      bundleId = await createGroupTaskBundle({
        groupId: gid,
        title: "共有課題",
        description: "チャットから追加された課題",
        isPinned: false,
        createdBy: userProfile.uid,
      });
    }

    const details = taskDetails.trim();
    const totalPages = taskTotalPages ? Number(taskTotalPages) : null;

    await createGroupTask({
      groupId: gid,
      bundleId,
      title,
      details,
      totalPages,
      createdBy: userProfile.uid,
    });

    const lines = [
      "[課題共有]",
      `タイトル: ${title}`,
      details ? `詳細: ${details}` : "",
      totalPages ? `総ページ数: ${totalPages}` : "",
    ].filter(Boolean);

    await sendGroupTextMessage(gid, userProfile.uid, lines.join("\n"));

    setTaskTitle("");
    setTaskDetails("");
    setTaskTotalPages("");
    setShowTaskComposer(false);
  };

  const toggleInviteUid = (uid: string) => {
    setInviteUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const inviteMembers = async () => {
    if (!gid || inviteUids.length === 0) return;
    await addMembersToGroup(gid, inviteUids);
    await sendGroupTextMessage(
      gid,
      userProfile.uid,
      `[メンバー招待]\n${inviteUids.length}人をグループに招待しました。`
    );
    setInviteUids([]);
    setShowInviteModal(false);
  };

  if (!currentGroup) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          グループが見つかりません
        </p>
        <Link href="/conversations" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
          会話一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none mx-auto h-[calc(100vh-88px)] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/conversations"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "var(--muted-bg)" }}
          >
            <ArrowLeft size={16} style={{ color: "var(--foreground)" }} />
          </Link>
          <div>
            <h1 className="text-2xl font-black" style={{ color: "var(--foreground)" }}>
              {currentGroup.name}
            </h1>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              メンバー {currentGroup.memberUids.length} 人
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="px-3 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
          style={{ background: "var(--accent-light)", color: "var(--accent)" }}
        >
          <UserPlus size={15} />
          メンバー招待
        </button>
      </div>

      <section className="glass-card p-4 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: "var(--card-border)" }}>
          <MessageSquare size={16} style={{ color: "var(--accent)" }} />
          <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            グループ会話
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2 min-h-0">
          {messages.map((msg) => {
            const me = msg.fromUid === userProfile.uid;
            const profile = memberProfiles.get(msg.fromUid);
            return (
              <div key={msg.id} className={`flex ${me ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] rounded-xl px-3 py-2"
                  style={{
                    background: me ? "var(--accent)" : "var(--muted-bg)",
                    color: me ? "#fff" : "var(--foreground)",
                  }}
                >
                  {!me && (
                    <p className="text-[10px] mb-1" style={{ color: "var(--muted)" }}>
                      <span className="inline-flex items-center gap-1.5">
                        <InlineAvatar avatar={profile?.avatar || "👤"} />
                        {sanitizeDisplayName(profile?.name || msg.fromUid)}
                      </span>
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-[10px] mt-1 opacity-70">
                    {new Date(msg.createdAt).toLocaleTimeString("ja-JP")}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {showTaskComposer && (
          <div className="pt-3 border-t space-y-2" style={{ borderColor: "var(--card-border)" }}>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="課題タイトル"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
            <textarea
              value={taskDetails}
              onChange={(e) => setTaskDetails(e.target.value)}
              placeholder="課題詳細（任意）"
              rows={2}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
            />
            <div className="flex items-center gap-2">
              <input
                value={taskTotalPages}
                onChange={(e) => setTaskTotalPages(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="総ページ数（任意）"
                className="flex-1 px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              />
              <button
                onClick={() => setShowTaskComposer(false)}
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--muted-bg)", color: "var(--muted)" }}
              >
                閉じる
              </button>
              <button
                onClick={shareTask}
                disabled={!taskTitle.trim()}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}
              >
                共有
              </button>
            </div>
          </div>
        )}

        <div className="pt-3 border-t flex items-center gap-2" style={{ borderColor: "var(--card-border)" }}>
          <button
            onClick={() => setShowTaskComposer((prev) => !prev)}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--muted-bg)", color: showTaskComposer ? "var(--accent)" : "var(--muted)" }}
            title="課題を追加"
          >
            <Plus size={18} />
          </button>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="メッセージを入力"
            className="flex-1 px-3 py-2 rounded-xl text-sm"
            style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
          />
          <button
            onClick={sendMessage}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            送信
          </button>
        </div>
      </section>

      {showInviteModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setShowInviteModal(false)}
        >
          <div className="w-full max-w-lg rounded-2xl p-5 glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                メンバー招待
              </h3>
              <button onClick={() => setShowInviteModal(false)}>
                <X size={18} style={{ color: "var(--muted)" }} />
              </button>
            </div>

            {inviteCandidates.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                招待可能なフレンドがいません
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {inviteCandidates.map((friend) => {
                  const active = inviteUids.includes(friend.uid);
                  return (
                    <button
                      key={friend.uid}
                      type="button"
                      onClick={() => toggleInviteUid(friend.uid)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{
                        background: active ? "var(--accent-light)" : "var(--muted-bg)",
                        color: active ? "var(--accent)" : "var(--foreground)",
                      }}
                    >
                      <span className="text-sm inline-flex items-center gap-2">
                        <InlineAvatar avatar={friend.avatar} />
                        {sanitizeDisplayName(friend.name)}
                      </span>
                      {active && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--muted-bg)", color: "var(--muted)" }}
              >
                キャンセル
              </button>
              <button
                onClick={inviteMembers}
                disabled={inviteUids.length === 0}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--accent)" }}
              >
                招待する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
