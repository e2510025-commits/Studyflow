import Link from "next/link";
export default function RetiredPage() {
  return <section className="glass-card p-6 sm:p-10 max-w-xl mx-auto space-y-4">
    <h1 className="text-2xl font-bold">掲示板の提供を終了しました</h1>
    <p style={{ color: "var(--muted)" }}>画面構成の見直しに伴い、この機能の提供を終了しました。</p>
    <Link href="/timeline" className="primary-button inline-flex">タイムラインへ</Link>
  </section>;
}
