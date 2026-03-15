"use client";

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import type { StudyLog } from "@/types";

export function useLiveStudyLogs(): StudyLog[] {
  const { studyLogs, timer, pomodoroState } = useStore();

  return useMemo(() => {
    const running = timer.status === "running";
    const hasSubject = Boolean(timer.selectedSubjectId);
    const isPomodoroBreak =
      timer.mode === "pomodoro" && pomodoroState.phase !== "work";

    if (!running || !hasSubject || isPomodoroBreak) {
      return studyLogs;
    }

    const liveDuration =
      timer.mode === "countdown"
        ? Math.max(0, Math.min(timer.elapsed, timer.countdownTotal))
        : Math.max(0, timer.elapsed);

    if (liveDuration <= 0) {
      return studyLogs;
    }

    const liveLog: StudyLog = {
      id: "__live_running_session__",
      subjectId: timer.selectedSubjectId as string,
      duration: liveDuration,
      memo: "",
      points: Math.floor(liveDuration / 60),
      createdAt: new Date().toISOString(),
    };

    return [...studyLogs, liveLog];
  }, [pomodoroState.phase, studyLogs, timer.countdownTotal, timer.elapsed, timer.mode, timer.selectedSubjectId, timer.status]);
}
