"use client";

import React, { useId, useMemo } from "react";
import { motion } from "framer-motion";

interface LiquidCircleProps {
  /** Progress from 0 (empty) to 1 (full) */
  progress: number;
  /** Liquid color (hex) */
  color: string;
  /** SVG viewBox size – rendered size is controlled by parent */
  size?: number;
  /** Content overlay (time display, labels) */
  children?: React.ReactNode;
}

export default function LiquidCircle({
  progress,
  color,
  size = 340,
  children,
}: LiquidCircleProps) {
  const id = useId().replace(/:/g, "");

  const center = size / 2;
  const radius = center - 6;
  const period = 120;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const amplitude =
    clampedProgress > 0.01 && clampedProgress < 0.99 ? 8 : 0;

  // Fill level: 0 = bottom, 1 = top
  const fillY =
    center + radius - clampedProgress * 2 * radius;

  const wavePath1 = useMemo(() => {
    const w = size + period * 3;
    let d = "";
    for (let x = 0; x <= w; x += 4) {
      const y =
        Math.sin((x / period) * 2 * Math.PI) * amplitude;
      d += x === 0 ? `M ${x - period} ${y}` : ` L ${x - period} ${y}`;
    }
    d += ` L ${w - period} ${size * 2} L ${-period} ${size * 2} Z`;
    return d;
  }, [size, period, amplitude]);

  const wavePath2 = useMemo(() => {
    const w = size + period * 3;
    let d = "";
    for (let x = 0; x <= w; x += 4) {
      const y =
        Math.sin((x / period) * 2 * Math.PI + 2.2) *
        (amplitude * 0.7);
      d += x === 0 ? `M ${x - period} ${y}` : ` L ${x - period} ${y}`;
    }
    d += ` L ${w - period} ${size * 2} L ${-period} ${size * 2} Z`;
    return d;
  }, [size, period, amplitude]);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <defs>
          <clipPath id={`${id}-clip`}>
            <circle cx={center} cy={center} r={radius} />
          </clipPath>
          <linearGradient
            id={`${id}-grad`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={color} stopOpacity={0.75} />
            <stop offset="100%" stopColor={color} stopOpacity={0.35} />
          </linearGradient>
          <radialGradient id={`${id}-bg`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor={color} stopOpacity={0.08} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </radialGradient>
        </defs>

        <g clipPath={`url(#${id}-clip)`}>
          {/* Circle background fill */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill={`url(#${id}-bg)`}
          />

          {/* Back wave */}
          <motion.g
            animate={{ y: fillY }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <g className="liquid-wave-back">
              <path d={wavePath2} fill={`${color}30`} />
            </g>
          </motion.g>

          {/* Front wave */}
          <motion.g
            animate={{ y: fillY }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <g className="liquid-wave-front">
              <path d={wavePath1} fill={`url(#${id}-grad)`} />
            </g>
          </motion.g>
        </g>

        {/* Outer ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`${color}35`}
          strokeWidth="4"
        />

        {/* Thin progress arc (optional visual flourish) */}
        {clampedProgress > 0 && (
          <motion.circle
            cx={center}
            cy={center}
            r={radius + 2}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * (radius + 2)}
            animate={{
              strokeDashoffset:
                2 * Math.PI * (radius + 2) * (1 - clampedProgress),
            }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              opacity: 0.5,
              transform: "rotate(-90deg)",
              transformOrigin: "center",
            }}
          />
        )}
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
