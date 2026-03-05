"use client";

import React, { useMemo } from "react";

interface TileWaveProps {
  /** Progress 0..1 — how full the tile is */
  progress: number;
  /** Liquid color (hex) */
  color: string;
}

/**
 * An inline (non-fullscreen) wave that fills a tile/card from bottom to top.
 * Renders as an absolutely-positioned SVG background inside the parent container.
 * The parent should have `position: relative; overflow: hidden;`.
 */
export default function TileWave({ progress, color }: TileWaveProps) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  // SVG viewBox height
  const vH = 400;
  const vW = 800;
  // The wave baseline — starts at bottom (vH) and rises as progress grows
  const baseY = vH - clamped * vH;

  const paths = useMemo(() => {
    return [
      { yOff: 6, opacity: 0.10, cls: "tile-wave-1" },
      { yOff: 3, opacity: 0.18, cls: "tile-wave-2" },
      { yOff: 0, opacity: 0.30, cls: "tile-wave-3" },
    ];
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <svg
        className="absolute bottom-0 left-0 w-full h-full"
        viewBox={`0 0 ${vW} ${vH}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {paths.map((layer, i) => {
          const y = baseY + layer.yOff * 4;
          return (
            <g key={i} className={layer.cls}>
              <path
                d={buildTileWavePath(y, i, vW, vH)}
                fill={color}
                fillOpacity={layer.opacity}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function buildTileWavePath(
  baseY: number,
  layerIndex: number,
  vW: number,
  vH: number
): string {
  // Double width for seamless loop
  const w = vW * 2;
  const amplitude = 10 + layerIndex * 4; // gentle waves
  const halfPeriod = vW / 2; // 1 full wave period = vW
  const phaseShift = layerIndex * 60;

  let d = `M ${-phaseShift} ${baseY}`;

  for (let x = 0; x < w + halfPeriod; x += halfPeriod) {
    const x1 = x - phaseShift;
    const x2 = x + halfPeriod - phaseShift;
    const cp = halfPeriod * 0.55;
    const direction = (x / halfPeriod) % 2 === 0 ? -1 : 1;
    const peakY = baseY + amplitude * direction;
    d += ` C ${x1 + cp} ${peakY}, ${x2 - cp} ${peakY}, ${x2} ${baseY}`;
  }

  d += ` L ${w + halfPeriod} ${vH} L ${-halfPeriod} ${vH} Z`;
  return d;
}
