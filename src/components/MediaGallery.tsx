"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import VideoPlayer from "./VideoPlayer";
import type { Asset } from "@/lib/types";

// 媒体横向滑动卡片：固定大小、scroll-snap、左右渐变阴影
export default function MediaGallery({ assets }: { assets: Asset[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRightFade, setShowRightFade] = useState(false);
  const [showLeftFade, setShowLeftFade] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    // iOS のサブピクセル誤差を考慮して 2px のマージン
    setShowRightFade(scrollLeft + clientWidth < scrollWidth - 2);
    setShowLeftFade(scrollLeft > 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // 初回は rAF でレイアウト確定後に計算（iOS Safari 対策）
    const raf = requestAnimationFrame(() => updateFades());

    el.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);

    // コンテナサイズ変化を監視（画面回転・動的レイアウト対策）
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateFades());
      resizeObserver.observe(el);
    }

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
      resizeObserver?.disconnect();
    };
  }, [updateFades, assets.length]);

  if (assets.length === 0) return null;

  return (
    <div className="relative mt-2 -mx-1">
      {/* 左側グラデーション（inline style で rgba 明示、iOS Safari 互換） */}
      <div
        className="pointer-events-none absolute left-1 top-0 bottom-0 z-10 w-6 transition-opacity duration-200"
        style={{
          opacity: showLeftFade ? 1 : 0,
          background: "linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))",
        }}
      />
      {/* 右側グラデーション */}
      <div
        className="pointer-events-none absolute right-1 top-0 bottom-0 z-10 w-8 transition-opacity duration-200"
        style={{
          opacity: showRightFade ? 1 : 0,
          background: "linear-gradient(to left, rgba(255,255,255,1), rgba(255,255,255,0))",
        }}
      />

      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto scroll-smooth px-1 pb-1"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="relative flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100"
            style={{
              width: "calc((100% - 3px) / 1.5)",
              aspectRatio: "3 / 2",
              scrollSnapAlign: "start",
            }}
          >
            {asset.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <VideoPlayer
                src={asset.url}
                poster={asset.poster_url || undefined}
                width={asset.width || undefined}
                height={asset.height || undefined}
                duration={asset.duration || undefined}
                fill
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
