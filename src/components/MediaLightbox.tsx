"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Asset } from "@/lib/types";

interface MediaLightboxProps {
  assets: Asset[];
  initialIndex: number;
  onClose: () => void;
}

// 抖音風フルスクリーンメディアビューアー：
// - 上下ドラッグで閉じる（一定以上引くと閉じ、離すとスプリングバック）
// - 左右ドラッグで前後のメディアへ切り替え（矢印ボタンなし）
// - 動画は下部のシークバーをドラッグでシーク、タップで再生/一時停止
export default function MediaLightbox({
  assets,
  initialIndex,
  onClose,
}: MediaLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const asset = assets[index];
  const indexRef = useRef(index);
  const containerRef = useRef<HTMLDivElement>(null);

  // メディアの再生位置を asset.id ごとに保持（切り替えで戻っても続きから再生）
  const timeRef = useRef<Record<number, number>>({});

  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);
  const [fade, setFade] = useState(1);
  const [animating, setAnimating] = useState(false);

  const dragRef = useRef({
    active: false,
    axis: null as "x" | "y" | null,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    moved: false,
  });

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // 背景スクロールをロック
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const goTo = useCallback(
    (target: number) => {
      setIndex((target + assets.length) % assets.length);
    },
    [assets.length]
  );

  // 閉じるアニメーション（少し縮みながらフェードアウト）
  const closingRef = useRef(false);
  const close = useCallback(() => {
    if (closingRef.current) return; // 多重実行ガード
    closingRef.current = true;
    setAnimating(true);
    setFade(0);
    setScale(0.92);
    window.setTimeout(onClose, 180);
  }, [onClose]);

  // キーボード操作（Esc で閉じる、左右矢印で切り替え）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowLeft") {
        goTo(indexRef.current - 1);
      } else if (e.key === "ArrowRight") {
        goTo(indexRef.current + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, goTo]);

  if (!asset) return null;

  const overlayStyle: CSSProperties = {
    opacity: fade,
    transition: animating ? "opacity 0.18s ease" : "none",
    willChange: "opacity",
  };

  const mediaStyle: CSSProperties = {
    transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
    transition: animating
      ? "transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)"
      : "none",
    willChange: "transform",
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const d = dragRef.current;
    d.active = true;
    d.axis = null;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.dx = 0;
    d.dy = 0;
    d.moved = false;
    setAnimating(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    d.dx = dx;
    d.dy = dy;
    if (d.axis === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) d.moved = true;
      if (Math.abs(dx) > Math.abs(dy) + 6) d.axis = "x";
      else if (Math.abs(dy) > Math.abs(dx) + 6) d.axis = "y";
    }
    if (d.axis === "x") {
      setTx(dx);
    } else if (d.axis === "y") {
      setTy(dy);
      setScale(Math.max(0.8, 1 - Math.min(Math.abs(dy), 400) / 600));
      setFade(Math.max(0.35, 1 - Math.min(Math.abs(dy), 320) / 360));
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    const dx = d.dx;
    const dy = d.dy;
    const w = containerRef.current?.clientWidth ?? window.innerWidth;

    if (d.axis === "x") {
      const threshold = w * 0.22;
      if (Math.abs(dx) > threshold && assets.length > 1) {
        const dir = dx < 0 ? 1 : -1;
        const target = -dir * w;
        // 現在のメディアをスライドアウト → 次のメディアを反対側からスライドイン
        setAnimating(true);
        setTx(target);
        window.setTimeout(() => {
          goTo(indexRef.current + dir);
          setAnimating(false);
          setTx(dir * w);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setAnimating(true);
              setTx(0);
              window.setTimeout(() => setAnimating(false), 220);
            });
          });
        }, 200);
      } else {
        // 閾値未満はスプリングバック
        setAnimating(true);
        setTx(0);
        window.setTimeout(() => setAnimating(false), 200);
      }
    } else if (d.axis === "y") {
      if (Math.abs(dy) > 110) {
        close();
      } else {
        setAnimating(true);
        setTy(0);
        setScale(1);
        setFade(1);
        window.setTimeout(() => setAnimating(false), 200);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 touch-none overflow-hidden bg-black"
      style={overlayStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="dialog"
      aria-modal="true"
      aria-label={asset.type === "image" ? "画像プレビュー" : "動画プレビュー"}
    >
      {/* メディア本体（上下ドラッグで追従・縮小、左右ドラッグでスライド） */}
      <div className="flex h-full w-full items-center justify-center" style={mediaStyle}>
        {asset.type === "image" ? (
          <ImageView asset={asset} />
        ) : (
          <VideoView asset={asset} dragRef={dragRef} timeRef={timeRef} />
        )}
      </div>

      {/* 閉じるボタン */}
      <button
        type="button"
        onClick={close}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        aria-label="閉じる"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
          <path d="M18.3 5.71 12 12l-6.3-6.29L4.29 7.12 10.59 13.41 4.29 19.7l1.41 1.41 6.3-6.29 6.3 6.29 1.41-1.41-6.3-6.29 6.3-6.29z" />
        </svg>
      </button>

      {/* 位置インジケータ */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
        {index + 1} / {assets.length}
      </div>
    </div>
  );
}

function ImageView({ asset }: { asset: Asset }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url}
        alt=""
        draggable={false}
        className="max-h-full max-w-full select-none object-contain"
      />
    </div>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// 動画表示：タップで再生/一時停止、下部のシークバーをドラッグでシーク。
function VideoView({
  asset,
  dragRef,
  timeRef,
}: {
  asset: Asset;
  dragRef: { current: { moved: boolean } };
  timeRef: { current: Record<number, number> };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(asset.duration ?? 0);
  const [seeking, setSeeking] = useState(false);
  const [seekRatio, setSeekRatio] = useState(0);

  // マウント時に自動再生（iOS 等で拒否されたら controls の再生ボタンで促す）
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.play().catch(() => {});
  }, []);

  // アンマウント時（切り替え・クローズ）に再生位置を保存
  useEffect(() => {
    const video = videoRef.current;
    const times = timeRef.current;
    return () => {
      if (video) times[asset.id] = video.currentTime;
    };
  }, [asset.id, timeRef]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    if (Number.isFinite(v.duration)) setDuration(v.duration);
    const saved = timeRef.current[asset.id];
    if (saved && saved > 0.3 && saved < v.duration - 0.3) {
      v.currentTime = saved;
    }
  };

  const ratio = seeking
    ? seekRatio
    : duration > 0
      ? Math.min(1, current / duration)
      : 0;

  const getRatio = (clientX: number) => {
    const el = barRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  // ドラッグ後のクリック誤発火を防ぐ（スワイプ操作をタップと誤認しない）
  const handleToggle = () => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    togglePlay();
  };

  // シークバーのドラッグ（親のモーダルドラッグとは切り離す）
  const onBarDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSeeking(true);
    const r = getRatio(e.clientX);
    setSeekRatio(r);
    const total = duration || v.duration || 0;
    setCurrent(r * total);
  };
  const onBarMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!seeking) return;
    const v = videoRef.current;
    if (!v) return;
    const r = getRatio(e.clientX);
    setSeekRatio(r);
    const total = duration || v.duration || 0;
    setCurrent(r * total);
  };
  const onBarUp = () => {
    if (!seeking) return;
    const v = videoRef.current;
    if (!v) return;
    const total = duration || v.duration || 0;
    const target = seekRatio * total;
    v.currentTime = target;
    setCurrent(target);
    setSeeking(false);
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <video
        ref={videoRef}
        src={asset.url}
        poster={asset.poster_url || undefined}
        preload="metadata"
        className="max-h-full max-w-full select-none object-contain"
        onClick={handleToggle}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* 中央の再生アイコン（一時停止中のみ表示） */}
      {!playing ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className="pointer-events-auto absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform hover:scale-110"
          aria-label="再生"
        >
          <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      ) : null}

      {/* 下部コントロール */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-12">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label={playing ? "一時停止" : "再生"}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* ドラッグ可能なシークバー */}
          <div
            ref={barRef}
            onPointerDown={onBarDown}
            onPointerMove={onBarMove}
            onPointerUp={onBarUp}
            onPointerCancel={onBarUp}
            className="relative h-5 flex-1 cursor-pointer touch-none"
            role="slider"
            aria-label="シーク"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
          >
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/30" />
            <div
              className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#fe2c55]"
              style={{ width: `${ratio * 100}%` }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md"
              style={{ left: `${ratio * 100}%` }}
            />
          </div>

          <span className="shrink-0 text-xs tabular-nums text-white/90">
            {formatTime(current)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
