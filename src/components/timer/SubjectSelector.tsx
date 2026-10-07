"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";
import {
  Calculator,
  Languages,
  BookOpen,
  FlaskConical,
  Globe,
  Code,
  PenTool,
  Music,
  Palette,
  Dumbbell,
  Brain,
  Lightbulb,
  GraduationCap,
  Library,
  NotebookPen,
  Atom,
  HelpCircle,
} from "lucide-react";
import type { Subject } from "@/types";

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  calculator: Calculator,
  languages: Languages,
  "book-open": BookOpen,
  "flask-conical": FlaskConical,
  globe: Globe,
  code: Code,
  "pen-tool": PenTool,
  music: Music,
  palette: Palette,
  dumbbell: Dumbbell,
  brain: Brain,
  lightbulb: Lightbulb,
  "graduation-cap": GraduationCap,
  library: Library,
  "notebook-pen": NotebookPen,
  atom: Atom,
};

export function SubjectIcon({
  iconName,
  size = 20,
}: {
  iconName: string;
  size?: number;
}) {
  const Icon = iconMap[iconName] || HelpCircle;
  return <Icon size={size} />;
}

interface SubjectSelectorProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function SubjectSelector({
  selectedId,
  onSelect,
}: SubjectSelectorProps) {
  const subjects = useStore((state) => state.subjects);

  return (
    <div className="w-full">
      <h3
        className="text-sm font-medium mb-3"
        style={{ color: "var(--muted)" }}
      >
        教科を選択
      </h3>
      <div className="subject-choice-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {subjects.map((subject: Subject) => {
          const isSelected = selectedId === subject.id;
          return (
            <motion.button
              key={subject.id}
              onClick={() => onSelect(subject.id)}
              aria-pressed={isSelected}
              className="relative flex items-center gap-2 min-h-12 py-2 px-3 rounded-xl transition-all duration-200"
              style={{
                background: isSelected
                  ? `${subject.color}2e`
                  : "var(--muted-bg)",
                border: isSelected
                  ? `2px solid ${subject.color}`
                  : "2px solid transparent",
                color: isSelected ? subject.color : "var(--muted)",
                boxShadow: isSelected
                  ? "none"
                  : "0 0 0 transparent",
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
            >
              <div
                className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
                style={{
                  background: isSelected
                    ? `${subject.color}46`
                    : "var(--card-bg)",
                  color: isSelected ? subject.color : "var(--muted)",
                  border: isSelected ? `2px solid ${subject.color}` : "1px solid transparent",
                }}
              >
                <SubjectIcon iconName={subject.icon} size={20} />
              </div>
              <span className="text-sm font-semibold truncate text-left">
                {subject.name}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
