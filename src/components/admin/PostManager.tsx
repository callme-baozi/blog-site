"use client";

import { useState, useCallback } from "react";
import type { PostWithAssets } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";

interface PostManagerProps {
  posts: PostWithAssets[];
  onEdit: (post: PostWithAssets) => void;
  onChanged: () => void;
}

// 投稿内容からプレーンテキストを生成
function extractText(html: string, maxLen = 80): string {
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text || "(本文なし)";
}

export default function PostManager({ posts, onEdit, onChanged }: PostManagerProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = useCallback(
    async (id: number) => {
      if (!window.confirm("この投稿を削除しますか？")) return;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "削除に失敗しました");
        }
        onChanged();
      } catch (err) {
        alert(err instanceof Error ? err.message : "削除に失敗しました");
      } finally {
        setDeletingId(null);
      }
    },
    [onChanged]
  );

  if (posts.length === 0) {
    return (
      <div className="px-4 py-20 text-center text-neutral-400">
        <p className="text-base">まだ投稿がありません</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-neutral-200">
      {posts.map((post) => {
        const firstImage =
          post.assets.find((a) => a.type === "image") ||
          post.assets.find((a) => a.type === "video");
        const thumbUrl =
          firstImage?.type === "video" ? firstImage.poster_url : firstImage?.url;

        return (
          <div key={post.id} className="flex gap-3 px-4 py-3">
            {/* サムネイル */}
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
              {thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>

            {/* 本文プレビュー */}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-neutral-900">{extractText(post.content)}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {formatRelativeTime(post.created_at)}
                {post.assets.length > 0 ? ` · ${post.assets.length}件のメディア` : ""}
              </p>
            </div>

            {/* 操作ボタン */}
            <div className="flex flex-shrink-0 flex-col gap-1.5">
              <button
                type="button"
                onClick={() => onEdit(post)}
                className="rounded-lg border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => handleDelete(post.id)}
                disabled={deletingId === post.id}
                className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deletingId === post.id ? "削除中…" : "削除"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
