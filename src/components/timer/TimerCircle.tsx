"use client";

import React from "react";
import { motion } from "framer-motion";

interface TimerCircleProps {
  /** Progress from 0 (empty) to 1 (full) */
  progress: number;
  /** Accent color (hex) */
  color: string;
  /** Diameter in px */
  size?: number;
  /** Content overlay (time display, labels) */
  children?: React.ReactNode;
}

/**
 * A clean circular timer display with a progress ring —
 * no liquid / wave fill, just a minimal ring + content.
 */
export default function TimerCircle({
  progress,
  color,
  size = 340,
  children,
}: TimerCircleProps) {
  const center = size / 2;
  const strokeWidth = 6;
  const radius = center - strokeWidth - 4;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`${color}15`}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        {clamped > 0 && (
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{
              strokeDashoffset: circumference * (1 - clamped),
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "center",
              opacity: 0.7,
            }}
          />
        )}
        {/* Subtle inner glow */}
        <circle
          cx={center}
          cy={center}
          r={radius - strokeWidth * 2}
          fill={`${color}06`}
        />
      </svg>

      {/* Content overlay */}
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          {children}
        </div>
      )}
    </div>
  );
}
