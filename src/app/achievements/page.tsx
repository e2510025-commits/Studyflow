"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { ACHIEVEMENTS, getAchievementMeta, type AchievementDefinition } from "@/lib/achievements";
import { fetchPublicProfile, updateEquippedBadges } from "@/lib/firestore/profile";

type ArchiveTab = "total" | "streak" | "subject" | "special";

function rarityGlow(rarity: AchievementDefinition["rarity"]): string {
  if (rarity === "legendary") return "0 0 22px #22d3ee88";
  if (rarity === "epic") return "0 0 16px #a78bfa77";
  if (rarity === "rare") return "0 0 12px #38bdf866";
  return "0 0 8px #94a3b855";
}

export default function AchievementsPage() {
  const { userProfile, updateUserProfile } = useStore();
  const [tab, setTab] = useState<ArchiveTab>("total");
  const [owned, setOwned] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<string[]>([]);
  const [unlockMap, setUnlockMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userProfile.uid) return;
    void fetchPublicProfile(userProfile.uid)
      .then((profile) => {
        setOwned(profile?.badges || []);
        setEquipped((profile?.equippedBadges || []).slice(0, 3));
        setUnlockMap((profile?.achievementUnlockedAt || {}) as Record<string, string>);
      })
      .catch(() => {
        setOwned([]);
        setEquipped([]);
        setUnlockMap({});
      });
  }, [userProfile.uid]);

  const tabs = useMemo(() => {
    const keys: ArchiveTab[] = ["total", "streak", "subject", "special"];
    return keys.map((key) => {
      const all = ACHIEVEMENTS.filter((a) => a.category === key).length;
      const done = ACHIEVEMENTS.filter((a) => a.category === key && owned.includes(a.id)).length;
      return { key, all, done, rate: all > 0 ? Math.round((done / all) * 100) : 0 };
    });
  }, [owned]);

  const rows = useMemo(() => ACHIEVEMENTS.filter((row) => row.category === tab), [tab]);

  const toggleEquip = async (id: string) => {
    if (!owned.includes(id)) return;
    const isEquipped = equipped.includes(id);
    let next = equipped;
    if (isEquipped) {
      next = equipped.filter((x) => x !== id);
    } else {
      if (equipped.length >= 3) return;
      next = [...equipped, id];
    }
    setEquipped(next);
    updateUserProfile({ equippedBadges: next });
    await updateEquippedBadges(userProfile.uid, next).catch(() => {});
  };

  return (
    <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-[260px_1fr] gap-4">
      <aside className="glass-card p-3 h-fit sticky top-4">
        <h2 className="text-sm font-black mb-2" style={{ color: "var(--foreground)" }}>ACHIEVEMENT ARCHIVE</h2>
        <div className="space-y-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="w-full text-left px-3 py-2.5 rounded-xl"
              style={{
                background: tab === t.key ? "var(--accent-light)" : "var(--muted-bg)",
                color: tab === t.key ? "var(--accent)" : "var(--foreground)",
                border: tab === t.key ? "1px solid var(--accent)" : "1px solid transparent",
                boxShadow: tab === t.key ? "inset 0 0 0 1px #ffffff22" : "none",
              }}
            >
              <p className="text-sm font-bold">
                {t.key === "total" ? "総学習時間" : t.key === "streak" ? "継続記録" : t.key === "subject" ? "科目別熟練度" : "特殊任務"}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                達成率 {t.rate}% ({t.done}/{t.all})
              </p>
            </button>
          ))}
        </div>
        <p className="text-[11px] mt-3" style={{ color: "var(--muted)" }}>勲章は最大3つまで装備できます。</p>
      </aside>

      <section className="space-y-3">
        {rows.map((row) => {
          const ownedFlag = owned.includes(row.id);
          const equippedFlag = equipped.includes(row.id);
          const date = unlockMap[row.id] ? new Date(unlockMap[row.id]).toLocaleDateString("ja-JP") : "----/--/--";
          return (
            <div key={row.id} className="glass-card p-4 flex items-center gap-4">
              <div
                className="w-20 h-20 flex items-center justify-center text-xs font-black"
                style={{
                  clipPath: "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)",
                  background: ownedFlag ? "linear-gradient(145deg,#334155,#0ea5e9)" : "#33415555",
                  color: ownedFlag ? "#e2e8f0" : "#94a3b8",
                  boxShadow: ownedFlag ? rarityGlow(row.rarity) : "none",
                  border: "1px solid #ffffff30",
                  opacity: ownedFlag ? 1 : 0.5,
                }}
              >
                {row.rarity.toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-black" style={{ color: "var(--foreground)" }}>
                  {ownedFlag || !row.secret ? row.title : "??? SECRET MEDAL ???"}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  {ownedFlag || !row.secret ? row.description : "条件は不明です"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--muted-bg)", color: "var(--muted)" }}>
                    入手日 {date}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--muted-bg)", color: "var(--muted)" }}>
                    {row.rarity}
                  </span>
                </div>
              </div>

              <button
                onClick={() => void toggleEquip(row.id)}
                disabled={!ownedFlag || (!equippedFlag && equipped.length >= 3)}
                className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                style={{ background: equippedFlag ? "#22c55e22" : "var(--muted-bg)", color: equippedFlag ? "#16a34a" : "var(--foreground)" }}
              >
                {equippedFlag ? "装備中" : "装備"}
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
