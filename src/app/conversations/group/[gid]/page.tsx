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
  GroupTask,
  GroupTaskBundle,
  GroupTaskProgress,
  sendGroupTextMessage,
  subscribeGroupMessages,
  subscribeGroupTaskBundles,
  subscribeGroupTaskProgress,
  subscribeGroupTasks,
  subscribeMyGroups,
  upsertGroupTaskProgress,
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

function resolveTaskEndMs(task: GroupTask): number {
  if (!task.endDate) return Number.POSITIVE_INFINITY;
  return new Date(`${task.endDate}T23:59:59`).getTime();
}

export default function GroupConversationPage() {
  const params = useParams<{ gid?: string | string[] }>();
  const gid = Array.isArray(params.gid) ? params.gid[0] : params.gid || "";
  const { userProfile, friends } = useStore();

  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [bundles, setBundles] = useState<GroupTaskBundle[]>([]);
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [progressItems, setProgressItems] = useState<GroupTaskProgress[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Map<string, MemberProfile>>(new Map());

  const [chatInput, setChatInput] = useState("");
  const [taskMenuOpen, setTaskMenuOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskStartDate, setTaskStartDate] = useState("");
  const [taskEndDate, setTaskEndDate] = useState("");
  const [taskDetails, setTaskDetails] = useState("");
  const [taskTotalPages, setTaskTotalPages] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUids, setInviteUids] = useState<string[]>([]);
  const [draftPagesByTask, setDraftPagesByTask] = useState<Record<string, number>>({});

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
    const unsubTasks = subscribeGroupTasks(gid, setTasks);
    const unsubProgress = subscribeGroupTaskProgress(gid, setProgressItems);

    return () => {
      unsubMessages();
      unsubBundles();
      unsubTasks();
      unsubProgress();
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

  const progressMap = useMemo(() => {
    const map = new Map<string, GroupTaskProgress>();
    progressItems.forEach((row) => {
      map.set(`${row.taskId}_${row.userUid}`, row);
    });
    return map;
  }, [progressItems]);

  const myTaskProgress = useMemo(() => {
    const map = new Map<string, GroupTaskProgress>();
    tasks.forEach((task) => {
      const row = progressMap.get(`${task.id}_${userProfile.uid}`);
      if (row) map.set(task.id, row);
    });
    return map;
  }, [tasks, progressMap, userProfile.uid]);

  const inviteCandidates = useMemo(() => {
    if (!currentGroup) return [];
    const memberUidSet = new Set(currentGroup.memberUids);
    return friends.filter((friend) => !memberUidSet.has(friend.uid));
  }, [friends, currentGroup]);

  const nowMs = Date.now();
  const activeTasks = useMemo(
    () => tasks.filter((task) => resolveTaskEndMs(task) >= nowMs),
    [tasks, nowMs]
  );
  const archivedTasks = useMemo(
    () => tasks.filter((task) => resolveTaskEndMs(task) < nowMs),
    [tasks, nowMs]
  );

  const overallProgress = useMemo(() => {
    const totalPages = activeTasks.reduce((sum, task) => sum + (task.totalPages || 0), 0);
    if (totalPages <= 0) return 0;

    const currentPages = activeTasks.reduce((sum, task) => {
      const saved = myTaskProgress.get(task.id)?.completedPages || 0;
      const draft = typeof draftPagesByTask[task.id] === "number" ? draftPagesByTask[task.id] : saved;
      return sum + Math.min(Math.max(draft, 0), task.totalPages || 0);
    }, 0);

    return Math.round((currentPages / totalPages) * 100);
  }, [activeTasks, draftPagesByTask, myTaskProgress]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !userProfile.uid || !gid) return;
    await sendGroupTextMessage(gid, userProfile.uid, text);
    setChatInput("");
  };

  const addTask = async () => {
    const title = taskTitle.trim();
    const startDate = taskStartDate;
    const endDate = taskEndDate;
    const details = taskDetails.trim();
    const totalPages = Number(taskTotalPages || 0);

    if (!gid || !userProfile.uid) return;
    if (!title || !startDate || !endDate || !Number.isFinite(totalPages) || totalPages <= 0) return;
    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      alert("期限の開始日と終了日が正しくありません");
      return;
    }

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

    await createGroupTask({
      groupId: gid,
      bundleId,
      title,
      details,
      totalPages,
      startDate,
      endDate,
      createdBy: userProfile.uid,
    });

    const messageLines = [
      "[課題共有]",
      `課題名: ${title}`,
      `期限: ${startDate} - ${endDate}`,
      details ? `詳細: ${details}` : "",
      `総ページ数: ${totalPages}`,
    ].filter(Boolean);

    await sendGroupTextMessage(gid, userProfile.uid, messageLines.join("\n"));

    setTaskTitle("");
    setTaskStartDate("");
    setTaskEndDate("");
    setTaskDetails("");
    setTaskTotalPages("");
    setTaskDialogOpen(false);
  };

  const reportTaskProgress = async (task: GroupTask) => {
    if (!gid || !userProfile.uid) return;
    const totalPages = task.totalPages || 0;
    if (totalPages <= 0) return;

    const saved = myTaskProgress.get(task.id)?.completedPages || 0;
    const draft = typeof draftPagesByTask[task.id] === "number" ? draftPagesByTask[task.id] : saved;
    const completedPages = Math.min(Math.max(draft, 0), totalPages);

    await upsertGroupTaskProgress({
      groupId: gid,
      bundleId: task.bundleId,
      taskId: task.id,
      userUid: userProfile.uid,
      completedPages,
      completed: completedPages >= totalPages,
    });

    await sendGroupTextMessage(
      gid,
      userProfile.uid,
      `[進捗報告]\n${task.title}\n${completedPages}/${totalPages} (${Math.round((completedPages / totalPages) * 100)}%)`
    );
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
        <div className="flex items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2">
            <MessageSquare size={16} style={{ color: "var(--accent)" }} />
            <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              グループ会話
            </h2>
          </div>
          <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
            全体進捗 {overallProgress}%
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2 min-h-0">
          {(activeTasks.length > 0 || archivedTasks.length > 0) && (
            <div className="rounded-xl p-2" style={{ background: "#ffffff22" }}>
              <p className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>
                課題カード（チャット埋め込み）
              </p>
            </div>
          )}

          {activeTasks.map((task) => {
            const totalPages = task.totalPages || 0;
            const saved = myTaskProgress.get(task.id)?.completedPages || 0;
            const draft = typeof draftPagesByTask[task.id] === "number" ? draftPagesByTask[task.id] : saved;
            const currentPages = Math.min(Math.max(draft, 0), totalPages);
            const percent = totalPages > 0 ? Math.round((currentPages / totalPages) * 100) : 0;
            const endMs = resolveTaskEndMs(task);
            const dueSoon = endMs - nowMs <= 24 * 60 * 60 * 1000;
            const barColor = dueSoon ? "#eab308" : "var(--accent)";
            const pageLocked = endMs < nowMs;

            return (
              <div key={task.id} className="flex justify-start">
                <div className="w-full max-w-[92%] rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "var(--foreground)" }}>
                        {task.title}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                        期限: {task.startDate || "-"} - {task.endDate || "-"}
                      </p>
                    </div>
                    <button
                      onClick={() => void reportTaskProgress(task)}
                      disabled={pageLocked || totalPages <= 0}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                      style={{ background: "var(--accent)" }}
                    >
                      報告
                    </button>
                  </div>

                  <div className="mt-2 h-2 rounded-full" style={{ background: "#ffffff44" }}>
                    <div className="h-2 rounded-full" style={{ width: `${percent}%`, background: barColor }} />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={totalPages}
                      value={currentPages}
                      disabled={pageLocked || totalPages <= 0}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setDraftPagesByTask((prev) => ({ ...prev, [task.id]: value }));
                      }}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min={0}
                      max={totalPages}
                      value={currentPages}
                      disabled={pageLocked || totalPages <= 0}
                      onChange={(e) => {
                        const value = Number(e.target.value || 0);
                        setDraftPagesByTask((prev) => ({ ...prev, [task.id]: value }));
                      }}
                      className="w-24 px-2 py-1 rounded text-xs"
                      style={{ background: "var(--card-bg)", color: "var(--foreground)" }}
                    />
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      / {totalPages}
                    </span>
                  </div>

                  {task.details && (
                    <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                      {task.details}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {archivedTasks.length > 0 && (
            <div className="rounded-xl p-2 mt-1" style={{ background: "#80808022" }}>
              <p className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>
                過去の課題（期限切れ）
              </p>
            </div>
          )}

          {archivedTasks.map((task) => {
            const totalPages = task.totalPages || 0;
            const saved = myTaskProgress.get(task.id)?.completedPages || 0;
            const percent = totalPages > 0 ? Math.round((saved / totalPages) * 100) : 0;
            const incomplete = percent < 100;
            return (
              <div key={task.id} className="flex justify-start">
                <div className="w-full max-w-[92%] rounded-xl p-3" style={{ background: "#80808033", color: "#d1d5db" }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{task.title}</p>
                    {incomplete && (
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "#ef444433", color: "#fecaca" }}>
                        未完了
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1">{saved}/{totalPages} ({percent}%)</p>
                </div>
              </div>
            );
          })}

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

        <div className="pt-3 border-t flex items-center gap-2 relative" style={{ borderColor: "var(--card-border)" }}>
          <button
            onClick={() => setTaskMenuOpen((prev) => !prev)}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--muted-bg)", color: taskMenuOpen ? "var(--accent)" : "var(--muted)" }}
            title="課題メニュー"
          >
            <Plus size={18} />
          </button>

          {taskMenuOpen && (
            <div
              className="absolute bottom-14 left-0 rounded-xl p-2 z-20"
              style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", boxShadow: "var(--shadow)" }}
            >
              <button
                onClick={() => {
                  setTaskMenuOpen(false);
                  setTaskDialogOpen(true);
                }}
                className="px-3 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              >
                課題を追加
              </button>
            </div>
          )}

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

      {taskDialogOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setTaskDialogOpen(false)}
        >
          <div className="w-full max-w-xl rounded-2xl p-5 glass-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4" style={{ color: "var(--foreground)" }}>
              課題を追加
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>課題名</label>
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                  placeholder="例: 数学ワーク"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>開始日</label>
                  <input
                    type="date"
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>終了日</label>
                  <input
                    type="date"
                    value={taskEndDate}
                    onChange={(e) => setTaskEndDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>詳細</label>
                <textarea
                  value={taskDetails}
                  onChange={(e) => setTaskDetails(e.target.value)}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                  placeholder="取り組み内容を入力"
                />
              </div>

              <div>
                <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>総ページ数</label>
                <input
                  type="number"
                  min={1}
                  value={taskTotalPages}
                  onChange={(e) => setTaskTotalPages(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                  placeholder="例: 120"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setTaskDialogOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--muted-bg)", color: "var(--muted)" }}
              >
                キャンセル
              </button>
              <button
                onClick={() => void addTask()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
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
