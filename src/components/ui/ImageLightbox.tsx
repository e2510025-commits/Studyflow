"use client";

import React, { useMemo, useState } from "react";
import { Download, Minus, Plus, RotateCcw, X } from "lucide-react";

export default function ImageLightbox({
  src,
  open,
  onClose,
  zIndexClass = "z-[120]",
}: {
  src: string | null;
  open: boolean;
  onClose: () => void;
  zIndexClass?: string;
}) {
  const [zoom, setZoom] = useState(1);

  const safeSrc = src || "";
  const zoomPercent = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

  if (!open || !src) return null;

  const updateZoom = (next: number) => {
    setZoom(Math.min(4, Math.max(1, next)));
  };

  const downloadImage = () => {
    const a = document.createElement("a");
    a.href = safeSrc;
    a.download = "image";
    a.target = "_blank";
    a.click();
  };

  return (
    <div className={`fixed inset-0 ${zIndexClass} bg-black/90`} onClick={onClose}>
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); updateZoom(zoom - 0.2); }} className="w-9 h-9 rounded-full grid place-items-center text-white" style={{ background: "rgba(15,23,42,0.72)" }}>
          <Minus size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); updateZoom(zoom + 0.2); }} className="w-9 h-9 rounded-full grid place-items-center text-white" style={{ background: "rgba(15,23,42,0.72)" }}>
          <Plus size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setZoom(1); }} className="w-9 h-9 rounded-full grid place-items-center text-white" style={{ background: "rgba(15,23,42,0.72)" }}>
          <RotateCcw size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); downloadImage(); }} className="px-3 h-9 rounded-full inline-flex items-center gap-1 text-white text-xs font-semibold" style={{ background: "rgba(15,23,42,0.72)" }}>
          <Download size={14} /> 保存
        </button>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-9 h-9 rounded-full grid place-items-center text-white" style={{ background: "rgba(15,23,42,0.72)" }}>
          <X size={16} />
        </button>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(15,23,42,0.72)", color: "#e2e8f0" }}>
        {zoomPercent}
      </div>
      <div className="w-full h-full grid place-items-center p-6" onClick={(e) => e.stopPropagation()}>
        <img
          src={safeSrc}
          alt="preview"
          className="max-w-full max-h-full object-contain"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 120ms ease" }}
          onWheel={(e) => {
            e.preventDefault();
            updateZoom(zoom + (e.deltaY < 0 ? 0.12 : -0.12));
          }}
        />
      </div>
    </div>
  );
}
