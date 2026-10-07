import Link from "next/link";

export default function SettingsNavigation({ sections, other }: {
  sections: Array<{ id: string; label: string }>;
  other: { href: string; label: string };
}) {
  return <aside className="settings-navigation"><nav aria-label="このページの設定"><p className="section-kicker">設定項目</p>
    {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
  </nav><Link className="settings-other" href={other.href}>{other.label} →</Link></aside>;
}
