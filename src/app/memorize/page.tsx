"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Heart, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import Dialog from "@/components/ui/Dialog";

interface Deck {
  id: string; name: string; description: string; color: string;
  cardCount: number; dueCount: number; masteredCount: number;
  createdAt?: string | null; subjectId?: string | null;
}
interface Subject { id: string; name: string; color: string }
type Scope = "mine" | "favorites" | "recent" | "due";
const FAVORITES_KEY = "memorize-deck-favorites";
const COLORS = ["#7c83ff", "#3b82f6", "#14b8a6", "#f59e0b", "#ec4899", "#ef4444"];

export default function MemorizePage() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalDue, setTotalDue] = useState(0);
  const [scope, setScope] = useState<Scope>("mine");
  const [subject, setSubject] = useState("all");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [now] = useState(() => Date.now());
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [selected, setSelected] = useState<Deck | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const loadDecks = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/memorize/decks", { cache: "no-store" });
      if (!res.ok) throw new Error("単語帳を読み込めませんでした。再読み込みしてください。");
      const data = await res.json();
      if (!Array.isArray(data.decks)) throw new Error("単語帳の応答を確認できませんでした。");
      setDecks(data.decks); setTotalDue(data.totalDue || 0);
    } catch (e) { setError(e instanceof Error ? e.message : "読み込みに失敗しました。"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void loadDecks();
    void fetch("/api/subjects", { cache: "no-store" }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json(); setSubjects(data.subjects || []);
    }).catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
      if (Array.isArray(saved)) setFavorites(saved.filter((id) => typeof id === "string"));
    } catch { /* A malformed preference must not prevent loading decks. */ }
  }, [loadDecks]);

  const persistFavorites = (ids: string[]) => {
    setFavorites(ids);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids)); } catch { /* Optional local preference. */ }
  };
  const visible = useMemo(() => decks.filter((deck) => {
    if (subject !== "all" && deck.subjectId !== subject) return false;
    const query = search.trim().toLowerCase();
    if (query && !`${deck.name} ${deck.description || ""}`.toLowerCase().includes(query)) return false;
    if (scope === "favorites" && !favorites.includes(deck.id)) return false;
    if (scope === "due" && deck.dueCount <= 0) return false;
    if (scope === "recent" && (!deck.createdAt || new Date(deck.createdAt).getTime() < now - 14 * 86400000)) return false;
    return true;
  }), [decks, subject, search, scope, favorites, now]);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setFormError("");
    try {
      const res = await fetch("/api/memorize/decks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: "", color, subjectId: subject !== "all" ? subject : undefined }),
      });
      if (!res.ok) throw new Error("単語帳を作成できませんでした。入力を確認して再試行してください。");
      const data = await res.json();
      if (!data.deckId) throw new Error("作成結果を確認できませんでした。閉じて一覧を再読み込みしてください。");
      setCreateOpen(false); setName(""); setColor(COLORS[0]);
      router.push(`/memorize/deck/${data.deckId}`);
    } catch (e) { setFormError(e instanceof Error ? e.message : "作成に失敗しました。"); }
    finally { setBusy(false); }
  };
  const update = async (remove: boolean) => {
    if (!selected || busy || (!remove && !editingName.trim())) return;
    setBusy(true); setFormError("");
    try {
      const res = await fetch(`/api/memorize/decks/${selected.id}`, remove ? { method: "DELETE" } : {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editingName.trim() }),
      });
      if (!res.ok) throw new Error(remove ? "削除に失敗しました。再試行してください。" : "名前を変更できませんでした。再試行してください。");
      if (remove) persistFavorites(favorites.filter((id) => id !== selected.id));
      setSelected(null); setConfirmDelete(false); await loadDecks();
    } catch (e) { setFormError(e instanceof Error ? e.message : "保存に失敗しました。"); }
    finally { setBusy(false); }
  };

  return <div className="screen-page library-page">
    <div className="page-heading">
      <div><h1 className="text-2xl sm:text-3xl font-bold">暗記</h1><p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>単語帳を開いて、今日の復習を始めましょう。</p></div>
      <button className="primary-button" onClick={() => { setFormError(""); setCreateOpen(true); }}><Plus size={20} />新しい単語帳</button>
    </div>
    <div className="library-workspace"><aside className="library-navigation" aria-label="ライブラリの範囲"><h2 className="section-kicker">ライブラリ</h2><div className="library-totals">
      {[["単語帳", decks.length], ["カード", decks.reduce((sum, deck) => sum + deck.cardCount, 0)], ["復習待ち", totalDue]].map(([label, value]) => <div key={label}><p className="text-xs sm:text-sm" style={{ color: "var(--muted)" }}>{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}
    </div>
    <div className="collection-navigation" aria-label="単語帳の表示範囲">
      {([["mine", "すべて"], ["due", "復習待ち"], ["favorites", "お気に入り"], ["recent", "最近作成"]] as const).map(([id, label]) => <button key={id} onClick={() => setScope(id)} aria-pressed={scope === id} className="min-h-11 px-4 rounded-full text-sm font-semibold" style={{ background: scope === id ? "var(--accent-light)" : "var(--card-bg)", color: scope === id ? "var(--accent)" : "var(--muted)" }}>{label}</button>)}
    </div>
    <Link className="rail-link" href="/memorize/questions">問題カード一覧</Link></aside><div className="library-content">
    <div className="library-toolbar">
      <label className="flex flex-1 items-center gap-3 rounded-xl px-4 min-h-12" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}><Search size={20} aria-hidden="true" /><input className="w-full min-w-0 bg-transparent outline-none" aria-label="単語帳を検索" placeholder="単語帳を検索" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <select aria-label="教科で絞り込む" className="rounded-xl px-4 min-h-12" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }} value={subject} onChange={(e) => setSubject(e.target.value)}><option value="all">すべての教科</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
    </div>

    {loading ? <p role="status" className="py-12 text-center" style={{ color: "var(--muted)" }}>単語帳を読み込み中…</p> : error ? <div className="glass-card p-6 space-y-4"><p role="alert">{error}</p><button className="secondary-button" onClick={() => void loadDecks()}>再読み込み</button></div> : visible.length === 0 ? <div className="glass-card p-8 text-center space-y-3"><BookOpen className="mx-auto" size={36} style={{ color: "var(--accent)" }} /><h2 className="font-bold">{decks.length === 0 ? "最初の単語帳を作りましょう" : "条件に合う単語帳がありません"}</h2><p className="text-sm" style={{ color: "var(--muted)" }}>{decks.length === 0 ? "覚えたい言葉や問題を、自分のペースで復習できます。" : "検索や絞り込みの条件を変えてみてください。"}</p></div> : <div className="deck-library-grid">
      {visible.map((deck) => <article key={deck.id} className="deck-card" style={{ "--deck-color": deck.color } as CSSProperties}>
        <Link href={`/memorize/deck/${deck.id}`} className="deck-cover" aria-label={`${deck.name}の単語帳を開く`}><BookOpen size={34} strokeWidth={1.2} aria-hidden="true" /><span>{deck.cardCount} cards</span></Link>
        <div className="deck-card-body"><div className="flex justify-between gap-2 items-start"><Link href={`/memorize/deck/${deck.id}`} className="flex-1 min-w-0 text-lg font-bold break-words hover:underline">{deck.name}</Link><button className="icon-button shrink-0" aria-label={`${deck.name}のメニュー`} onClick={() => { setSelected(deck); setEditingName(deck.name); setFormError(""); setConfirmDelete(false); }}><MoreHorizontal size={20} /></button></div>
        <p className="text-sm mt-2 break-words line-clamp-2" style={{ color: "var(--muted)" }}>{deck.description || "カードを追加して学習を始めましょう"}</p>
        <div className="deck-progress" role="progressbar" aria-label={`${deck.name}の習得率`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={deck.cardCount ? Math.min(100, Math.round(deck.masteredCount / deck.cardCount * 100)) : 0}><span style={{ width: `${deck.cardCount ? Math.min(100, deck.masteredCount / deck.cardCount * 100) : 0}%` }} /></div><p className="text-sm mt-4">{deck.cardCount} カード <span className="ml-2" style={{ color: "var(--muted)" }}>習得 {deck.masteredCount}</span></p>
        <div className="flex justify-between items-center gap-2 mt-4"><Link href={`/memorize/deck/${deck.id}`} className="secondary-button">{deck.dueCount > 0 ? `${deck.dueCount} 枚を復習` : "単語帳を開く"}</Link><button className="icon-button" aria-label={`${deck.name}をお気に入り`} aria-pressed={favorites.includes(deck.id)} onClick={() => persistFavorites(favorites.includes(deck.id) ? favorites.filter((id) => id !== deck.id) : [...favorites, deck.id])}><Heart size={20} fill={favorites.includes(deck.id) ? "currentColor" : "none"} style={{ color: favorites.includes(deck.id) ? "var(--accent)" : "var(--muted)" }} /></button></div>
        </div>
      </article>)}
    </div>}
    </div></div>
    <Dialog open={createOpen} onClose={() => { if (!busy) setCreateOpen(false); }} title="新しい単語帳">
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <label className="block space-y-2"><span className="font-semibold text-sm">単語帳の名前</span><input autoFocus required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl px-4 min-h-12" style={{ background: "var(--muted-bg)" }} placeholder="例：英検2級の単語" /></label>
        <fieldset><legend className="font-semibold text-sm mb-2">カラー</legend><div className="flex flex-wrap gap-2">{COLORS.map((c, index) => <button type="button" key={c} className="w-11 h-11 rounded-full" aria-label={`カラー ${index + 1}`} aria-pressed={color === c} onClick={() => setColor(c)} style={{ background: c, outline: color === c ? "3px solid var(--foreground)" : undefined, outlineOffset: 2 }} />)}</div></fieldset>
        {formError && <p role="alert" className="text-sm">{formError}</p>}
        <button className="primary-button w-full justify-center" disabled={busy || !name.trim()}>{busy ? "作成中…" : "作成する"}</button>
      </form>
    </Dialog>
    <Dialog open={Boolean(selected)} onClose={() => { if (!busy) setSelected(null); }} title="単語帳の編集">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void update(false); }}>
        <label className="block space-y-2"><span className="text-sm font-semibold">名前</span><input required maxLength={100} value={editingName} onChange={(e) => setEditingName(e.target.value)} className="w-full rounded-xl px-4 min-h-12" style={{ background: "var(--muted-bg)" }} /></label>
        {formError && <p role="alert" className="text-sm">{formError}</p>}
        <button className="primary-button" disabled={busy || !editingName.trim()}>{busy ? "処理中…" : "名前を保存"}</button>
        <div className="pt-4 border-t" style={{ borderColor: "var(--card-border)" }}>{confirmDelete ? <div className="space-y-3"><p className="text-sm">この単語帳とカードを削除します。この操作は取り消せません。</p><button type="button" className="secondary-button" disabled={busy} onClick={() => void update(true)}>削除を確定</button><button type="button" className="secondary-button ml-2" disabled={busy} onClick={() => setConfirmDelete(false)}>戻る</button></div> : <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={18} />単語帳を削除</button>}</div>
      </form>
    </Dialog>
  </div>;
}
