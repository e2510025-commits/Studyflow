"use client";

import React from "react";
import { BadgeCheck } from "lucide-react";

export default function VerifiedBadge({
  show,
  size = 14,
  className,
}: {
  show?: boolean;
  size?: number;
  className?: string;
}) {
  if (!show) return null;
  return <BadgeCheck size={size} className={className} style={{ color: "#38bdf8" }} aria-label="公式" />;
}
