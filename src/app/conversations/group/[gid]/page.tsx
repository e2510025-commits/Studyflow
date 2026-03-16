"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  setGroupTaskBundlePinned,
  subscribeGroupMessages,
  subscribeGroupTaskBundles,
  subscribeGroupTaskProgress,
  subscribeGroupTasks,
  subscribeMyGroups,
  upsertGroupTaskProgress,
} from "@/lib/firestore/groups";
import { getProfilesBatch } from "@/lib/firestore/ranking";
import {
  ArrowLeft,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Check,
  X,
} from "lucide-react";
import { sanitizeAvatar, sanitizeDisplayName } from "@/lib/identity";

interface MemberProfile {
  name: string;
  avatar: string;
}

function computeMemberProgress(task: GroupTask, progress?: GroupTaskProgress): number {
  if (!progress) return 0;
  if (task.totalPages && task.totalPages > 0) {
    return Math.min(1, progress.completedPages / task.totalPages);
  }
  return progress.completed ? 1 : 0;
}

function InlineAvatar({ avatar }: { avatar: string }) {
  const safeAvatar = sanitizeAvatar(avatar);
  const isImage = safeAvatar.startsWith("http") || safeAvatar.startsWith("data:");
  if (isImage) {
    return <img src={safeAvatar} alt="avatar" className="w-5 h-5 rounded-full object-cover" />;
  }
  return (
    <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px]" style={{ background: "var(--accent-light)" }}>
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
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [progressItems, setProgressItems] = useState<GroupTaskProgress[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Map<string, MemberProfile>>(new Map());

  const [chatInput, setChatInput] = useState("");
  const [bundleTitle, setBundleTitle] = useState("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDetails, setTaskDetails] = useState("");
  const [taskTotalPages, setTaskTotalPages] = useState("");
  const [selectedBundleId, setSelectedBundleId] = useState<string>("");
  const [collapsedPinned, setCollapsedPinned] = useState<Record<string, boolean>>({});
  const [collapsedCreateBundle, setCollapsedCreateBundle] = useState(true);
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUids, setInviteUids] = useState<string[]>([]);

  useEffect(() => {
    if (!userProfile.uid) return;
    return subscribeMyGroups(userProfile.uid, setGroups);
  }, [userProfile.uid]);

  const currentGroup = useMemo(
    () => groups.find((g) => g.id === gid),
    [groups, gid]
  );

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

  const effectiveSelectedBundleId =
    selectedBundleId || bundles[0]?.id || "";

  const pinnedBundles = useMemo(
    () => bundles.filter((b) => b.isPinned),
    [bundles]
  );

  const tasksByBundle = useMemo(() => {
    const map = new Map<string, GroupTask[]>();
    for (const task of tasks) {
      const arr = map.get(task.bundleId) || [];
      arr.push(task);
      map.set(task.bundleId, arr);
    }
    return map;
  }, [tasks]);

  const progressMap = useMemo(() => {
    const map = new Map<string, GroupTaskProgress>();
    for (const item of progressItems) {
      map.set(`${item.taskId}_${item.userUid}`, item);
    }
    return map;
  }, [progressItems]);

  const inviteCandidates = useMemo(() => {
    if (!currentGroup) return [];
    const memberUidSet = new Set(currentGroup.memberUids);
    return friends.filter((friend) => !memberUidSet.has(friend.uid));
  }, [friends, currentGroup]);

  const togglePinnedCollapse = (bundleId: string) => {
    setCollapsedPinned((prev) => ({
      ...prev,
      [bundleId]: !prev[bundleId],
    }));
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !userProfile.uid || !gid) return;
    await sendGroupTextMessage(gid, userProfile.uid, text);
    setChatInput("");
  };

  const createBundle = async () => {
    if (!gid || !userProfile.uid || !bundleTitle.trim()) return;
    await createGroupTaskBundle({
      groupId: gid,
      title: bundleTitle,
      description: bundleDescription,
      isPinned: true,
      createdBy: userProfile.uid,
    });
    setBundleTitle("");
    setBundleDescription("");
  };

  const createTask = async () => {
    if (!gid || !effectiveSelectedBundleId || !userProfile.uid || !taskTitle.trim()) return;

    const normalizedTitle = taskTitle.trim();
    const normalizedDetails = taskDetails.trim();
    const normalizedTotalPages = taskTotalPages ? Number(taskTotalPages) : null;
    const selectedBundle = bundles.find((bundle) => bundle.id === effectiveSelectedBundleId);

    await createGroupTask({
      groupId: gid,
      bundleId: effectiveSelectedBundleId,
      title: normalizedTitle,
      details: normalizedDetails,
      totalPages: normalizedTotalPages,
      createdBy: userProfile.uid,
    });

    const shareLines = [
      "[課題共有]",
      `カテゴリ: ${selectedBundle?.title || "未分類"}`,
      `タイトル: ${normalizedTitle}`,
      normalizedDetails ? `詳細: ${normalizedDetails}` : "",
      normalizedTotalPages ? `総ページ数: ${normalizedTotalPages}` : "",
    ].filter(Boolean);

    await sendGroupTextMessage(gid, userProfile.uid, shareLines.join("\n"));

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

  const updateMyProgress = async (task: GroupTask, options: { completed?: boolean; completedPages?: number }) => {
    if (!userProfile.uid || !gid) return;
    const current = progressMap.get(`${task.id}_${userProfile.uid}`);
    const completedPages =
      options.completedPages ??
      current?.completedPages ??
      (options.completed ? task.totalPages || 0 : 0);

    await upsertGroupTaskProgress({
      groupId: gid,
      bundleId: task.bundleId,
      taskId: task.id,
      userUid: userProfile.uid,
      completed: options.completed ?? current?.completed ?? false,
      completedPages,
    });
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
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/conversations" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--muted-bg)" }}>
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

      <div className="grid xl:grid-cols-[0.8fr_1.2fr] gap-5">
        <section className="space-y-4 xl:order-2">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Pin size={16} style={{ color: "var(--accent)" }} />
              <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                固定課題カテゴリ
              </h2>
            </div>

            <div className="space-y-3">
              {pinnedBundles.map((bundle) => {
                const bundleTasks = tasksByBundle.get(bundle.id) || [];
                const isCollapsed = Boolean(collapsedPinned[bundle.id]);

                const progressValues = bundleTasks.flatMap((task) =>
                  currentGroup.memberUids.map((uid) =>
                    computeMemberProgress(task, progressMap.get(`${task.id}_${uid}`))
                  )
                );
                const bundlePercent =
                  progressValues.length > 0
                    ? Math.round((progressValues.reduce((s, p) => s + p, 0) / progressValues.length) * 100)
                    : 0;

                return (
                  <div key={bundle.id} className="rounded-xl p-3" style={{ background: "var(--muted-bg)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                          {bundle.title}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                          進捗 {bundlePercent}%
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setGroupTaskBundlePinned(bundle.id, false)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: "var(--card-bg)", color: "var(--muted)" }}
                          title="固定解除"
                        >
                          <PinOff size={14} />
                        </button>
                        <button
                          onClick={() => togglePinnedCollapse(bundle.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: "var(--card-bg)", color: "var(--muted)" }}
                          title="折りたたみ"
                        >
                          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="mt-3 space-y-3">
                        {bundle.description && (
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            {bundle.description}
                          </p>
                        )}

                        {bundleTasks.length === 0 ? (
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            課題がまだ登録されていません
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {bundleTasks.map((task) => {
                              const memberRows = currentGroup.memberUids.map((uid) => {
                                const p = progressMap.get(`${task.id}_${uid}`);
                                const progress = computeMemberProgress(task, p);
                                const member = memberProfiles.get(uid);
                                return {
                                  uid,
                                  name: member?.name || uid,
                                  avatar: member?.avatar || "👤",
                                  progress,
                                  raw: p,
                                };
                              });

                              const taskPercent =
                                Math.round((memberRows.reduce((s, row) => s + row.progress, 0) / memberRows.length) * 100);

                              return (
                                <div key={task.id} className="rounded-lg p-3" style={{ background: "var(--card-bg)" }}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                                        {task.title}
                                      </p>
                                      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                                        {task.details || "詳細なし"}
                                        {task.totalPages ? ` / 全${task.totalPages}ページ` : ""}
                                      </p>
                                    </div>
                                    <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                                      {taskPercent}%
                                    </span>
                                  </div>

                                  <div className="mt-2 h-2 rounded-full" style={{ background: "var(--muted-bg)" }}>
                                    <div
                                      className="h-2 rounded-full"
                                      style={{ background: "var(--accent)", width: `${taskPercent}%` }}
                                    />
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    {memberRows.map((row) => {
                                      const isMe = row.uid === userProfile.uid;
                                      const pageValue = row.raw?.completedPages || 0;

                                      return (
                                        <div key={row.uid} className="rounded-md p-2" style={{ background: "var(--muted-bg)" }}>
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs" style={{ color: "var(--foreground)" }}>
                                              <span className="inline-flex items-center gap-1.5">
                                                <InlineAvatar avatar={row.avatar} />
                                                {sanitizeDisplayName(row.name)}
                                              </span>
                                            </span>
                                            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                                              {Math.round(row.progress * 100)}%
                                            </span>
                                          </div>

                                          {isMe ? (
                                            <div className="mt-2 space-y-2">
                                              {!task.totalPages ? (
                                                <button
                                                  onClick={() => updateMyProgress(task, { completed: !row.raw?.completed })}
                                                  className="text-xs px-2.5 py-1.5 rounded-lg"
                                                  style={{
                                                    background: row.raw?.completed ? "#16a34a" : "var(--card-bg)",
                                                    color: row.raw?.completed ? "#fff" : "var(--foreground)",
                                                  }}
                                                >
                                                  {row.raw?.completed ? "完了済み" : "完了にする"}
                                                </button>
                                              ) : (
                                                <div className="space-y-1">
                                                  <input
                                                    type="range"
                                                    min={0}
                                                    max={task.totalPages}
                                                    value={Math.min(pageValue, task.totalPages)}
                                                    onChange={(e) => {
                                                      const value = Number(e.target.value);
                                                      void updateMyProgress(task, {
                                                        completedPages: value,
                                                        completed: value >= (task.totalPages || 0),
                                                      });
                                                    }}
                                                    className="w-full"
                                                  />
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                                                      {pageValue} / {task.totalPages} ページ
                                                    </span>
                                                    <button
                                                      onClick={() =>
                                                        updateMyProgress(task, {
                                                          completedPages: task.totalPages || 0,
                                                          completed: true,
                                                        })
                                                      }
                                                      className="text-[10px] px-2 py-1 rounded"
                                                      style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                                                    >
                                                      全完了
                                                    </button>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {pinnedBundles.length === 0 && (
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  固定課題はまだありません。下でカテゴリを作成してください。
                </p>
              )}
            </div>
          </div>

          <div className="glass-card p-4 space-y-3">
            <button
              onClick={() => setCollapsedCreateBundle((prev) => !prev)}
              className="w-full flex items-center justify-between"
            >
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  課題カテゴリ作成
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  例: 春休み課題 / 夏休み課題
                </p>
              </div>
              {collapsedCreateBundle ? (
                <ChevronDown size={16} style={{ color: "var(--muted)" }} />
              ) : (
                <ChevronUp size={16} style={{ color: "var(--muted)" }} />
              )}
            </button>

            {!collapsedCreateBundle && (
              <div className="space-y-3">
                <input
                  value={bundleTitle}
                  onChange={(e) => setBundleTitle(e.target.value)}
                  placeholder="カテゴリ名"
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                />
                <textarea
                  value={bundleDescription}
                  onChange={(e) => setBundleDescription(e.target.value)}
                  placeholder="カテゴリ説明（任意）"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
                />
                <button
                  onClick={createBundle}
                  disabled={!bundleTitle.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "var(--accent)" }}
                >
                  <Plus size={14} className="inline mr-1" />
                  カテゴリ追加（固定）
                </button>
              </div>
            )}
          </div>

        </section>

        <section className="glass-card p-4 flex flex-col min-h-[660px] xl:order-1">
          <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: "var(--card-border)" }}>
            <MessageSquare size={16} style={{ color: "var(--accent)" }} />
            <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
              グループ会話
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-2">
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
                      <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>
                        <span className="inline-flex items-center gap-1.5">
                          <InlineAvatar avatar={profile?.avatar || "👤"} />
                          {sanitizeDisplayName(profile?.name || msg.fromUid)}
                        </span>
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-[10px] mt-1 opacity-70">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {showTaskComposer && (
            <div className="pt-3 border-t space-y-2" style={{ borderColor: "var(--card-border)" }}>
              <select
                value={effectiveSelectedBundleId}
                onChange={(e) => setSelectedBundleId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: "var(--muted-bg)", color: "var(--foreground)" }}
              >
                <option value="">カテゴリを選択</option>
                {bundles.map((bundle) => (
                  <option key={bundle.id} value={bundle.id}>
                    {bundle.title}
                  </option>
                ))}
              </select>
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
                  onClick={createTask}
                  disabled={!effectiveSelectedBundleId || !taskTitle.trim()}
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

          <div className="pt-3 mt-3 border-t" style={{ borderColor: "var(--card-border)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>
              メンバー進捗サマリー
            </p>
            <div className="grid grid-cols-2 gap-2">
              {currentGroup.memberUids.map((uid) => {
                const member = memberProfiles.get(uid);
                const memberProgressList = tasks.map((task) =>
                  computeMemberProgress(task, progressMap.get(`${task.id}_${uid}`))
                );
                const summary =
                  memberProgressList.length > 0
                    ? Math.round((memberProgressList.reduce((s, p) => s + p, 0) / memberProgressList.length) * 100)
                    : 0;

                return (
                  <div key={uid} className="rounded-lg p-2" style={{ background: "var(--muted-bg)" }}>
                    <p className="text-xs" style={{ color: "var(--foreground)" }}>
                      <span className="inline-flex items-center gap-1.5">
                        <InlineAvatar avatar={member?.avatar || "👤"} />
                        {sanitizeDisplayName(member?.name || uid)}
                      </span>
                    </p>
                    <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>
                      {summary}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="text-xs" style={{ color: "var(--muted)" }}>
        <Check size={12} className="inline mr-1" />
        完了課題やページ進捗はリアルタイムで共有され、課題全体の進捗率(%)として表示されます。
      </div>

      {showInviteModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-5 glass-card"
            onClick={(e) => e.stopPropagation()}
          >
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
                      <span className="text-sm">{friend.avatar} {sanitizeDisplayName(friend.name)}</span>
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
