"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface FullscreenWaveProps {
  /** 0..1 how full the screen is */
  progress: number;
  /** Main liquid color (hex) */
  color: string;
  /** Whether to render at all */
  active: boolean;
}

/**
 * Smooth layered wave background spanning the full viewport.
 * Uses cubic-bezier SVG paths with lerp-based smooth interpolation.
 */
export default function FullscreenWave({
  progress,
  color,
  active,
}: FullscreenWaveProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  // Smooth interpolation using lerp via rAF
  const [smoothProgress, setSmoothProgress] = useState(clampedProgress);
  const targetRef = useRef(clampedProgress);
  const currentRef = useRef(clampedProgress);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    targetRef.current = clampedProgress;
  }, [clampedProgress]);

  useEffect(() => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1); // cap at 100ms
      lastTime = now;
      // Smooth factor: lower = smoother/slower (0.8 per second → ~2-3s to settle)
      const factor = 1 - Math.pow(0.15, dt);
      currentRef.current = lerp(currentRef.current, targetRef.current, factor);
      setSmoothProgress(currentRef.current);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Wave baseline rises from bottom as progress increases
  const baseY = 100 - smoothProgress * 100; // percent from top

  // Generate smooth bezier wave paths
  const waves = useMemo(() => {
    return [
      { yOff: 5, opacity: 0.08, className: "fullscreen-wave-layer-1" },
      { yOff: 2.5, opacity: 0.14, className: "fullscreen-wave-layer-2" },
      { yOff: 0, opacity: 0.22, className: "fullscreen-wave-layer-3" },
    ];
  }, []);

  if (!active) return null;

  return (
    <motion.div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2 }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {waves.map((wave, i) => {
          const y = (baseY + wave.yOff) * 9; // convert % to viewBox units (900)
          return (
            <g key={i} className={wave.className}>
              <path
                d={buildSmoothWavePath(y, i)}
                fill={color}
                fillOpacity={wave.opacity}
              />
            </g>
          );
        })}
      </svg>
    </motion.div>
  );
}

/**
 * Build a smooth cubic-bezier wave path.
 * Creates 2 full periods across a doubled-width viewport for seamless looping.
 */
function buildSmoothWavePath(baseY: number, layerIndex: number): string {
  // Width is doubled for seamless horizontal scroll animation
  const w = 2880;
  const amplitude = 22 + layerIndex * 8; // gentler waves for smoother look
  const halfPeriod = 720;

  // Phase offset per layer for visual separation
  const phaseShift = layerIndex * 180;

  let d = `M ${-phaseShift} ${baseY}`;

  for (let x = 0; x < w + halfPeriod; x += halfPeriod) {
    const x1 = x - phaseShift;
    const x2 = x + halfPeriod - phaseShift;
    const cp = halfPeriod * 0.55;
    const direction = ((x / halfPeriod) % 2 === 0) ? -1 : 1;
    const peakY = baseY + amplitude * direction;

    d += ` C ${x1 + cp} ${peakY}, ${x2 - cp} ${peakY}, ${x2} ${baseY}`;
  }

  d += ` L ${w + halfPeriod} 900 L ${-halfPeriod} 900 Z`;

  return d;
}
