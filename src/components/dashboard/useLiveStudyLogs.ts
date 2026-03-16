"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import type { StudyLog } from "@/types";

export function useLiveStudyLogs(): StudyLog[] {
  const { studyLogs } = useStore();

  return useMemo(() => studyLogs, [studyLogs]);
}
