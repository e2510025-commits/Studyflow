"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import StatsCards from "@/components/dashboard/StatsCards";
import DailyPieChart from "@/components/dashboard/DailyPieChart";
import WeeklyBarChart from "@/components/dashboard/WeeklyBarChart";
import HeatMap from "@/components/dashboard/HeatMap";
import RecentLogs from "@/components/dashboard/RecentLogs";
import MotivationPanel from "@/components/dashboard/MotivationPanel";
import { motion } from "framer-motion";
import { GripVertical, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

type WidgetId =
  | "stats"
  | "trend"
  | "dailyPie"
  | "heatMap"
  | "recentLogs"
  | "motivation";

interface WidgetMeta {
  title: string;
  defaultLayout: Layout;
  render: () => JSX.Element;
}

interface DashboardConfig {
  enabledWidgets: WidgetId[];
  layouts: Layouts;
}

const STORAGE_KEY = "dashboard-layout-v1";

const WIDGETS: Record<WidgetId, WidgetMeta> = {
  stats: {
    title: "統計カード",
    defaultLayout: { i: "stats", x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
    render: () => <StatsCards />,
  },
  trend: {
    title: "学習時間の推移",
    defaultLayout: { i: "trend", x: 0, y: 6, w: 8, h: 12, minW: 4, minH: 8 },
    render: () => <WeeklyBarChart />,
  },
  dailyPie: {
    title: "本日の学習割合",
    defaultLayout: { i: "dailyPie", x: 8, y: 6, w: 4, h: 12, minW: 3, minH: 8 },
    render: () => <DailyPieChart />,
  },
  heatMap: {
    title: "学習ヒートマップ",
    defaultLayout: { i: "heatMap", x: 0, y: 18, w: 8, h: 12, minW: 4, minH: 8 },
    render: () => <HeatMap />,
  },
  recentLogs: {
    title: "最近の学習記録",
    defaultLayout: { i: "recentLogs", x: 8, y: 18, w: 4, h: 12, minW: 3, minH: 8 },
    render: () => <RecentLogs />,
  },
  motivation: {
    title: "モチベーション",
    defaultLayout: { i: "motivation", x: 0, y: 30, w: 12, h: 8, minW: 6, minH: 6 },
    render: () => <MotivationPanel />,
  },
};

const allWidgetIds = Object.keys(WIDGETS) as WidgetId[];

const buildDefaultLayouts = (enabled: WidgetId[]): Layouts => {
  const base = enabled.map((id) => ({ ...WIDGETS[id].defaultLayout }));

  return {
    xl: base,
    lg: base.map((item) => ({ ...item })),
    md: base.map((item, idx) => ({ ...item, x: (idx % 2) * 4, w: 4 })),
    sm: base.map((item, idx) => ({ ...item, x: 0, y: idx * 8, w: 1 })),
  };
};

const normalizeLayouts = (layouts: Layouts, enabled: WidgetId[]): Layouts => {
  const enabledSet = new Set(enabled);
  const normalized: Layouts = {};

  Object.entries(layouts).forEach(([bp, list]) => {
    normalized[bp] = (list || [])
      .filter((item) => enabledSet.has(item.i as WidgetId))
      .map((item) => ({
        ...item,
        minW: WIDGETS[item.i as WidgetId]?.defaultLayout.minW ?? 2,
        minH: WIDGETS[item.i as WidgetId]?.defaultLayout.minH ?? 4,
      }));
  });

  Object.keys(normalized).forEach((bp) => {
    enabled.forEach((id) => {
      if (!normalized[bp].some((item) => item.i === id)) {
        normalized[bp].push({ ...WIDGETS[id].defaultLayout });
      }
    });
  });

  return normalized;
};

const getDefaultConfig = (): DashboardConfig => ({
  enabledWidgets: allWidgetIds,
  layouts: buildDefaultLayouts(allWidgetIds),
});

const readStoredConfig = (): DashboardConfig => {
  if (typeof window === "undefined") {
    return getDefaultConfig();
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return getDefaultConfig();
  }

  try {
    const parsed = JSON.parse(raw) as { enabledWidgets?: WidgetId[]; layouts?: Layouts };
    const safeEnabled = (parsed.enabledWidgets || []).filter(
      (id): id is WidgetId => allWidgetIds.includes(id as WidgetId)
    );
    const nextEnabled = safeEnabled.length > 0 ? safeEnabled : allWidgetIds;

    return {
      enabledWidgets: nextEnabled,
      layouts: parsed.layouts
        ? normalizeLayouts(parsed.layouts, nextEnabled)
        : buildDefaultLayouts(nextEnabled),
    };
  } catch {
    return getDefaultConfig();
  }
};

export default function DashboardPage() {
  const { userProfile } = useStore();
  const [isEditMode, setIsEditMode] = useState(false);
  const [config, setConfig] = useState<DashboardConfig>(() => readStoredConfig());

  const enabledWidgets = config.enabledWidgets;
  const layouts = config.layouts;

  useEffect(() => {
    const payload = JSON.stringify({ enabledWidgets, layouts });
    localStorage.setItem(STORAGE_KEY, payload);
  }, [enabledWidgets, layouts]);

  const hiddenWidgets = useMemo(
    () => allWidgetIds.filter((id) => !enabledWidgets.includes(id)),
    [enabledWidgets]
  );

  const removeWidget = useCallback((id: WidgetId) => {
    setConfig((prev) => {
      const nextEnabled = prev.enabledWidgets.filter((item) => item !== id);
      const next: Layouts = {};
      Object.entries(prev.layouts).forEach(([bp, list]) => {
        next[bp] = (list || []).filter((l) => l.i !== id);
      });
      return {
        enabledWidgets: nextEnabled,
        layouts: normalizeLayouts(next, nextEnabled),
      };
    });
  }, []);

  const addWidget = useCallback((id: WidgetId) => {
    setConfig((prev) => {
      if (prev.enabledWidgets.includes(id)) {
        return prev;
      }

      const nextEnabled = [...prev.enabledWidgets, id];
      const next: Layouts = { ...prev.layouts };
      Object.keys(next).forEach((bp) => {
        const current = next[bp] || [];
        if (!current.some((layout) => layout.i === id)) {
          next[bp] = [...current, { ...WIDGETS[id].defaultLayout }];
        }
      });
      return {
        enabledWidgets: nextEnabled,
        layouts: normalizeLayouts(next, nextEnabled),
      };
    });
  }, []);

  const resetLayout = useCallback(() => {
    setConfig(getDefaultConfig());
  }, []);

  const alignAllWidths = useCallback(() => {
    setConfig((prev) => {
      const next: Layouts = {};
      Object.entries(prev.layouts).forEach(([bp, list]) => {
        next[bp] = (list || []).map((item) => ({
          ...item,
          w: Math.max(item.minW || 1, item.w >= 8 ? 12 : 6),
        }));
      });
      return {
        ...prev,
        layouts: next,
      };
    });
  }, []);

  const alignAllHeights = useCallback(() => {
    setConfig((prev) => {
      const next: Layouts = {};
      Object.entries(prev.layouts).forEach(([bp, list]) => {
        next[bp] = (list || []).map((item) => ({
          ...item,
          h: Math.max(item.minH || 4, 10),
        }));
      });
      return {
        ...prev,
        layouts: next,
      };
    });
  }, []);

  const rowHeight = isEditMode ? 22 : 20;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1
              className="text-2xl sm:text-4xl font-black"
              style={{ color: "var(--foreground)" }}
            >
              ダッシュボード
            </h1>
            <p className="text-base mt-1 font-medium" style={{ color: "var(--muted)" }}>
              学習の進捗を一覧で確認できます
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode && (
              <>
                <button
                  onClick={alignAllWidths}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
                >
                  幅を揃える
                </button>
                <button
                  onClick={alignAllHeights}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
                >
                  高さを揃える
                </button>
                <button
                  onClick={resetLayout}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5"
                  style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
                >
                  <RotateCcw size={14} />
                  リセット
                </button>
              </>
            )}
            <button
              onClick={() => setIsEditMode((prev) => !prev)}
              className="px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
              style={{
                background: isEditMode ? "var(--accent-light)" : "var(--card-bg)",
                border: "1px solid var(--card-border)",
                color: isEditMode ? "var(--accent)" : "var(--foreground)",
              }}
            >
              <Pencil size={15} />
              {isEditMode ? "編集を終了" : "編集"}
            </button>
          </div>
        </div>
        {(userProfile.equippedBadges || []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {(userProfile.equippedBadges || []).map((badge) => (
              <span key={badge} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#22d3ee22", color: "#22d3ee" }}>
                {badge}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {isEditMode && (
        <div
          className="rounded-2xl p-3 sm:p-4 border"
          style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            編集モード: タイルをドラッグして配置、右下ハンドルでサイズ変更できます
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            レイアウトはグリッドに吸着するため、表示崩れを防ぎます
          </p>

          {hiddenWidgets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {hiddenWidgets.map((id) => (
                <button
                  key={id}
                  onClick={() => addWidget(id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5"
                  style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
                >
                  <Plus size={13} />
                  {WIDGETS[id].title}を追加
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ResponsiveGridLayout
        className="dashboard-grid"
        layouts={normalizeLayouts(layouts, enabledWidgets)}
        breakpoints={{ xl: 1280, lg: 1024, md: 768, sm: 0 }}
        cols={{ xl: 12, lg: 12, md: 8, sm: 1 }}
        rowHeight={rowHeight}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        compactType="vertical"
        preventCollision={false}
        isBounded
        isDraggable={isEditMode}
        isResizable={isEditMode}
        onLayoutChange={(_, allLayouts) =>
          setConfig((prev) => ({
            ...prev,
            layouts: normalizeLayouts(allLayouts, prev.enabledWidgets),
          }))
        }
        draggableHandle=".widget-drag-handle"
      >
        {enabledWidgets.map((widgetId) => (
          <div key={widgetId} className="relative">
            {isEditMode && (
              <div
                className="absolute top-2 left-2 z-20 flex items-center gap-1 rounded-lg px-2 py-1 border"
                style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
              >
                <button
                  className="widget-drag-handle inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--muted)", cursor: "grab" }}
                  aria-label={`${WIDGETS[widgetId].title}を移動`}
                >
                  <GripVertical size={13} />
                  移動
                </button>
                <button
                  onClick={() => removeWidget(widgetId)}
                  className="inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: "#ef4444" }}
                  aria-label={`${WIDGETS[widgetId].title}を削除`}
                >
                  <Trash2 size={13} />
                  削除
                </button>
              </div>
            )}
            <div className={`${isEditMode ? "pt-10" : ""}`}>{WIDGETS[widgetId].render()}</div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
