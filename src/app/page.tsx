"use client";

import React from "react";
import StatsCards from "@/components/dashboard/StatsCards";
import DailyPieChart from "@/components/dashboard/DailyPieChart";
import WeeklyBarChart from "@/components/dashboard/WeeklyBarChart";
import HeatMap from "@/components/dashboard/HeatMap";
import RecentLogs from "@/components/dashboard/RecentLogs";
import { motion } from "framer-motion";

export default function DashboardPage() {
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
    </div>
  );
}
