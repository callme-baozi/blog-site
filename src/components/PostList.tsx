"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import PostCard, { type AuthorInfo } from "./PostCard";
import type { PostWithAssets } from "@/lib/types";

interface PostListProps {
  initialPosts: PostWithAssets[];
  author: AuthorInfo;
  pageSize?: number;
}

export default function PostList({ initialPosts, author, pageSize = 10 }: PostListProps) {
  const [posts, setPosts] = useState<PostWithAssets[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length >= pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const last = posts[posts.length - 1];
      const before = last?.created_at;
      const res = await fetch(
        `/api/posts?limit=${pageSize}${before ? `&before=${before}` : ""}`
      );
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { posts: PostWithAssets[] };
      setPosts((prev) => [...prev, ...data.posts]);
      if (data.posts.length < pageSize) setHasMore(false);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, posts, pageSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  if (posts.length === 0) {
    return (
      <div className="px-4 py-20 text-center text-neutral-400">
        <p className="text-base">まだ投稿がありません</p>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} author={author} />
      ))}
      <div ref={sentinelRef} className="py-6 text-center text-sm text-neutral-400">
        {loading ? "読み込み中…" : hasMore ? "スクロールしてもっと読み込む" : "これ以上ありません"}
      </div>
    </div>
  );
}
