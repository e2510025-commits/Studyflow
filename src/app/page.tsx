"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/store/useStore";
import StatsCards from "@/components/dashboard/StatsCards";
import RecentLogs from "@/components/dashboard/RecentLogs";
import MotivationPanel from "@/components/dashboard/MotivationPanel";
import { motion } from "framer-motion";

const DailyPieChart = dynamic(() => import("@/components/dashboard/DailyPieChart"));
const WeeklyBarChart = dynamic(() => import("@/components/dashboard/WeeklyBarChart"));
const HeatMap = dynamic(() => import("@/components/dashboard/HeatMap"));

export default function DashboardPage() {
  const { userProfile } = useStore();
  return (
    <div className="space-y-5">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1
          className="text-2xl sm:text-4xl font-black"
          style={{ color: "var(--foreground)" }}
        >
          ダッシュボード
        </h1>
        <p className="text-base mt-1 font-medium" style={{ color: "var(--muted)" }}>
          学習の進捗を一覧で確認できます
        </p>
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

      {/* Stats cards */}
      <StatsCards />

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <WeeklyBarChart />
        </div>
        <div>
          <DailyPieChart />
        </div>
      </div>

      {/* Heatmap & Recent logs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <HeatMap />
        </div>
        <div>
          <RecentLogs />
        </div>
      </div>

      <MotivationPanel />
    </div>
  );
}
