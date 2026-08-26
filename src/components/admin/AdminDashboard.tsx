"use client";

import { useState, useEffect, useCallback } from "react";
import PostEditor from "./PostEditor";
import PostManager from "./PostManager";
import SettingsForm from "./SettingsForm";
import type { PostWithAssets, SiteSettings } from "@/lib/types";

type Tab = "new" | "manage" | "settings";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("new");
  const [posts, setPosts] = useState<PostWithAssets[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [editingPost, setEditingPost] = useState<PostWithAssets | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await fetch("/api/posts?limit=50");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
      }
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (tab === "manage") fetchPosts();
  }, [tab, fetchPosts]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth", { method: "POST" });
    window.location.reload();
  }, []);

  const handleEdit = useCallback((post: PostWithAssets) => {
    setEditingPost(post);
    setTab("new");
  }, []);

  const handleEditorDone = useCallback(() => {
    setEditingPost(null);
    setTab("manage");
    fetchPosts();
  }, [fetchPosts]);

  const handleSettingsSaved = useCallback((s: SiteSettings) => {
    setSettings(s);
  }, []);

  // 編集モード
  if (tab === "new" && editingPost) {
    return (
      <PostEditor
        editPostId={editingPost.id}
        initialContent={editingPost.content}
        initialMedia={editingPost.assets}
        onDone={handleEditorDone}
      />
    );
  }

  const tabBtn = (active: boolean) =>
    `flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
      active
        ? "border-b-2 border-neutral-900 text-neutral-900"
        : "text-neutral-500 hover:text-neutral-700"
    }`;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[600px] flex-col border-x border-neutral-200 bg-white">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-2.5 backdrop-blur-md">
        <span className="text-base font-bold">管理画面</span>
        <button
          onClick={handleLogout}
          className="rounded-lg px-3 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
        >
          ログアウト
        </button>
      </header>

      {/* タブ */}
      <nav className="flex border-b border-neutral-200">
        <button type="button" className={tabBtn(tab === "new")} onClick={() => { setEditingPost(null); setTab("new"); }}>
          新規投稿
        </button>
        <button type="button" className={tabBtn(tab === "manage")} onClick={() => setTab("manage")}>
          投稿管理
        </button>
        <button type="button" className={tabBtn(tab === "settings")} onClick={() => setTab("settings")}>
          設定
        </button>
      </nav>

      {/* コンテンツ */}
      <div className="flex-1">
        {tab === "new" && <PostEditor onDone={() => { setTab("manage"); fetchPosts(); }} />}
        {tab === "manage" && (
          <>
            {loadingPosts ? (
              <div className="py-10 text-center text-sm text-neutral-400">読み込み中…</div>
            ) : (
              <PostManager posts={posts} onEdit={handleEdit} onChanged={fetchPosts} />
            )}
          </>
        )}
        {tab === "settings" && settings && (
          <SettingsForm initial={settings} onSaved={handleSettingsSaved} />
        )}
      </div>
    </div>
  );
}
