"use client";

import { useState } from "react";
import VideoPlayer from "./VideoPlayer";
import MediaLightbox from "./MediaLightbox";
import type { Asset } from "@/lib/types";

// 媒体横向滑动卡片：固定大小、scroll-snap。
// クリックで画像は拡大表示、動画はポップアップ再生する（MediaLightbox）。
export default function MediaGallery({ assets }: { assets: Asset[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (assets.length === 0) return null;

  return (
    <div className="mt-2 -mx-1">
      <div
        className="flex gap-1.5 overflow-x-auto scroll-smooth px-1 pb-1"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {assets.map((asset, i) => (
          <div
            key={asset.id}
            role="button"
            tabIndex={0}
            aria-label={asset.type === "image" ? "画像を拡大表示" : "動画を再生"}
            onClick={() => setOpenIndex(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpenIndex(i);
              }
            }}
            className="relative flex-shrink-0 cursor-pointer overflow-hidden rounded-xl bg-neutral-100 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-blue-500"
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
                onClick={() => setOpenIndex(i)}
              />
            )}
          </div>
        ))}
      </div>

      {openIndex !== null ? (
        <MediaLightbox
          assets={assets}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </div>
  );
}
