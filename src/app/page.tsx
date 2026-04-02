"use client";

import React from "react";
import { motion } from "framer-motion";
import { Responsive, WidthProvider, type LayoutItem, type ResponsiveLayouts } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import StatsCards from "@/components/dashboard/StatsCards";
import DailyPieChart from "@/components/dashboard/DailyPieChart";
import WeeklyBarChart from "@/components/dashboard/WeeklyBarChart";
import HeatMap from "@/components/dashboard/HeatMap";
import MotivationPanel from "@/components/dashboard/MotivationPanel";

const ResponsiveGridLayout = WidthProvider(Responsive);

type WidgetId = "stats" | "trend" | "dailyPie" | "heatMap" | "motivation";

interface WidgetMeta {
  defaultLayout: LayoutItem;
  render: () => React.ReactElement;
}

const WIDGETS: Record<WidgetId, WidgetMeta> = {
  stats: {
    defaultLayout: { i: "stats", x: 0, y: 0, w: 12, h: 6, minW: 6, minH: 4 },
    render: () => <StatsCards />,
  },
  trend: {
    defaultLayout: { i: "trend", x: 0, y: 6, w: 8, h: 12, minW: 4, minH: 8 },
    render: () => <WeeklyBarChart />,
  },
  dailyPie: {
    defaultLayout: { i: "dailyPie", x: 8, y: 6, w: 4, h: 12, minW: 3, minH: 8 },
    render: () => <DailyPieChart />,
  },
  heatMap: {
    defaultLayout: { i: "heatMap", x: 0, y: 18, w: 12, h: 10, minW: 6, minH: 8 },
    render: () => <HeatMap />,
  },
  motivation: {
    defaultLayout: { i: "motivation", x: 0, y: 28, w: 12, h: 8, minW: 6, minH: 6 },
    render: () => <MotivationPanel />,
  },
};

const allWidgetIds = Object.keys(WIDGETS) as WidgetId[];

const buildDefaultLayouts = (): ResponsiveLayouts => {
  const base = allWidgetIds.map((id) => ({ ...WIDGETS[id].defaultLayout }));
  return {
    xl: base,
    lg: base.map((item) => ({ ...item })),
    md: base.map((item, idx) => ({ ...item, x: (idx % 2) * 4, w: 4 })),
    sm: base.map((item, idx) => ({ ...item, x: 0, y: idx * 8, w: 1 })),
  };
};

export default function DashboardPage() {
  const layouts = buildDefaultLayouts();

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black" style={{ color: "var(--foreground)" }}>
              ダッシュボード
            </h1>
            <p className="text-base mt-1 font-medium" style={{ color: "var(--muted)" }}>
              学習の進捗を一覧で確認できます
            </p>
          </div>
        </div>
      </motion.div>

      <ResponsiveGridLayout
        className="dashboard-grid"
        layouts={layouts}
        breakpoints={{ xl: 1280, lg: 1024, md: 768, sm: 0 }}
        cols={{ xl: 12, lg: 12, md: 8, sm: 1 }}
        rowHeight={20}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        compactType="vertical"
        preventCollision={false}
        isBounded
        isDraggable={false}
        isResizable={false}
      >
        {allWidgetIds.map((widgetId) => (
          <div key={widgetId}>{WIDGETS[widgetId].render()}</div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
