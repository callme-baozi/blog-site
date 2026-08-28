"use client";

import { useState, useRef, useCallback } from "react";
import type { SiteSettings } from "@/lib/types";
import TagMultiSelect from "./TagMultiSelect";

export default function SettingsForm({
  initial,
  onSaved,
}: {
  initial: SiteSettings;
  onSaved?: (settings: SiteSettings) => void;
}) {
  const [siteTitle, setSiteTitle] = useState(initial.site_title);
  const [siteDescription, setSiteDescription] = useState(initial.site_description);
  const [authorName, setAuthorName] = useState(initial.author_name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.author_avatar_url);
  const [keywords, setKeywords] = useState<string[]>(initial.keywords);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingAvatar(true);
      setError("");
      try {
        const fd = new FormData();
        fd.append("avatar", file);
        const res = await fetch("/api/settings", { method: "PUT", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "アバターの更新に失敗しました");
        }
        const data = (await res.json()) as SiteSettings;
        setAvatarUrl(data.author_avatar_url);
        onSaved?.(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "アバターの更新に失敗しました");
      } finally {
        setUploadingAvatar(false);
        e.target.value = "";
      }
    },
    [onSaved]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_title: siteTitle,
          site_description: siteDescription,
          author_name: authorName,
          keywords,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "保存に失敗しました");
      }
      const data = (await res.json()) as SiteSettings;
      setMessage("保存しました");
      onSaved?.(data);
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [siteTitle, siteDescription, authorName, keywords, onSaved]);

  return (
    <div className="space-y-6 px-4 py-5">
      {/* アバター */}
      <div className="flex flex-col items-center gap-3">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-neutral-200">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-2xl font-semibold text-white">
              {authorName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadingAvatar}
          className="rounded-lg border border-neutral-300 px-4 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {uploadingAvatar ? "アップロード中…" : "アバターを変更"}
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
      </div>

      {/* フォーム */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">サイト名</label>
          <input
            type="text"
            value={siteTitle}
            onChange={(e) => setSiteTitle(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            placeholder="My Blog"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            サイトの説明
          </label>
          <textarea
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            placeholder="ブログの説明（任意）"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">作者名</label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            placeholder="Author"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            网站关键词（タグ）
          </label>
          <TagMultiSelect value={keywords} onChange={setKeywords} />
        </div>
      </div>

      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-neutral-900 py-2.5 text-base font-medium text-white disabled:opacity-50"
      >
        {saving ? "保存中…" : "設定を保存"}
      </button>
    </div>
  );
}
