"use client";

import { useRef, useState, useCallback } from "react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  width?: number;
  height?: number;
  duration?: number;
  /** 親コンテナいっぱいに広げる（メディアカード用） */
  fill?: boolean;
  /** 指定時は内聯再生せず、クリックで外部アクション（図庫ポップアップ等）を呼ぶ */
  onClick?: () => void;
}

// 動画クリックで読み込み：video 要素は常に DOM に存在させ（preload="none"）、
// ユーザージェスチャー内で直接 play() を呼ぶことで iOS Safari でも再生可能にする。
// onClick が指定された場合はプレビューとして扱い、クリックでコールバックを呼ぶ。
export default function VideoPlayer({
  src,
  poster,
  width,
  height,
  duration,
  fill = false,
  onClick,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const aspectStyle = fill
    ? undefined
    : width && height
      ? { aspectRatio: `${width} / ${height}` }
      : { aspectRatio: "16 / 9" };

  const containerClass = fill
    ? "relative h-full w-full overflow-hidden bg-black"
    : "relative w-full overflow-hidden rounded-xl bg-black";

  const handlePlay = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (!video.src) video.src = src;
    video.play().catch(() => {
      // iOS 等で自動再生が拒否された場合、controls を表示してタップを促す
    });
    setStarted(true);
  }, [onClick, src]);

  const containerProps = onClick
    ? {
        onClick,
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
        className: `${containerClass} cursor-pointer`,
        style: aspectStyle,
      }
    : { className: containerClass, style: aspectStyle };

  return (
    <div {...containerProps}>
      <video
        ref={videoRef}
        poster={poster}
        preload="none"
        controls={started}
        className="h-full w-full object-contain"
      />
      {!started ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePlay();
          }}
          className="group absolute inset-0 flex items-center justify-center"
          aria-label="動画を再生"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition-transform group-hover:scale-110">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          {duration ? (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
              {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, "0")}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
