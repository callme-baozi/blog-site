"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import VideoPlayer from "./VideoPlayer";
import type { Asset } from "@/lib/types";

// 媒体横向滑动卡片：固定大小、scroll-snap、左右边缘用 CSS mask 渐隐。
// 渐变直接作用在滚动容器上，跟随卡片形状，不会产生覆盖层与圆角之间的缝隙。
const FADE_WIDTH = 28; // px

function buildMask(showLeft: boolean, showRight: boolean): string {
  if (showLeft && showRight) {
    return `linear-gradient(to right, transparent, black ${FADE_WIDTH}px, black calc(100% - ${FADE_WIDTH}px), transparent)`;
  }
  if (showLeft) {
    return `linear-gradient(to right, transparent, black ${FADE_WIDTH}px)`;
  }
  if (showRight) {
    return `linear-gradient(to left, transparent, black ${FADE_WIDTH}px)`;
  }
  return "none";
}

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

  const maskImage = buildMask(showLeftFade, showRightFade);

  return (
    <div className="mt-2 -mx-1">
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto scroll-smooth px-1 pb-1"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          WebkitMaskImage: maskImage,
          maskImage,
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
