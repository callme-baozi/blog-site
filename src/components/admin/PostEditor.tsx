"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Asset } from "@/lib/types";

const MAX_MEDIA = 20;

interface MediaItem {
  id: number;
  type: "image" | "video";
  url: string;
  posterUrl: string | null;
}

interface PostEditorProps {
  editPostId?: number;
  initialContent?: string;
  initialMedia?: Asset[];
  onDone?: () => void;
}

export default function PostEditor({
  editPostId,
  initialContent = "",
  initialMedia = [],
  onDone,
}: PostEditorProps) {
  const router = useRouter();
  const isEdit = editPostId !== undefined;
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [media, setMedia] = useState<MediaItem[]>(
    initialMedia.map((a) => ({
      id: a.id,
      type: a.type,
      url: a.url,
      posterUrl: a.poster_url,
    }))
  );
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder: "いまどうしてる？" }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        class: "prose-editor px-4 py-3",
      },
    },
  });

  const uploadFile = useCallback(
    async (
      file: File,
      poster?: Blob,
      meta?: { width?: number; height?: number; duration?: number }
    ) => {
      const fd = new FormData();
      fd.append("file", file);
      if (poster) fd.append("poster", poster, "poster.jpg");
      if (meta?.width) fd.append("width", String(meta.width));
      if (meta?.height) fd.append("height", String(meta.height));
      if (meta?.duration) fd.append("duration", String(meta.duration));

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "アップロードに失敗しました");
      }
      return (await res.json()) as MediaItem & {
        posterUrl?: string | null;
        width?: number | null;
        height?: number | null;
        duration?: number | null;
      };
    },
    []
  );

  const handleFiles = useCallback(
    async (files: FileList | null, isVideo: boolean) => {
      if (!files || files.length === 0) return;
      if (media.length + files.length > MAX_MEDIA) {
        setError(`メディアは最大${MAX_MEDIA}個までです`);
        return;
      }

      setUploading(true);
      setError("");
      try {
        for (const file of Array.from(files)) {
          if (isVideo) {
            const frame = await captureVideoFrame(file);
            const asset = await uploadFile(file, frame.poster, {
              width: frame.width,
              height: frame.height,
              duration: frame.duration,
            });
            setMedia((prev) => [
              ...prev,
              {
                id: asset.id,
                type: "video",
                url: asset.url,
                posterUrl: asset.posterUrl || null,
              },
            ]);
          } else {
            const asset = await uploadFile(file);
            setMedia((prev) => [
              ...prev,
              { id: asset.id, type: "image", url: asset.url, posterUrl: null },
            ]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "アップロードに失敗しました");
      } finally {
        setUploading(false);
      }
    },
    [media.length, uploadFile]
  );

  const captureVideoFrame = useCallback(
    (file: File): Promise<{ poster: Blob; width: number; height: number; duration: number }> => {
      return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        const url = URL.createObjectURL(file);
        video.src = url;

        const cleanup = () => URL.revokeObjectURL(url);

        video.addEventListener("loadeddata", () => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            cleanup();
            reject(new Error("canvas を作成できません"));
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              cleanup();
              if (blob) {
                resolve({
                  poster: blob,
                  width: video.videoWidth,
                  height: video.videoHeight,
                  duration: video.duration,
                });
              } else {
                reject(new Error("サムネイルの生成に失敗しました"));
              }
            },
            "image/jpeg",
            0.8
          );
        });

        video.addEventListener("error", () => {
          cleanup();
          reject(new Error("動画の読み込みに失敗しました"));
        });
      });
    },
    []
  );

  const removeMedia = useCallback((id: number) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handlePublish = useCallback(async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const hasText = html.replace(/<[^>]*>/g, "").trim().length > 0;
    if (!hasText && media.length === 0) {
      setError("投稿内容を入力してください");
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const url = isEdit ? `/api/posts/${editPostId}` : "/api/posts";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: html, assetIds: media.map((m) => m.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "投稿に失敗しました");
      }
      if (onDone) {
        onDone();
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿に失敗しました");
      setPublishing(false);
    }
  }, [editor, media, router, isEdit, editPostId, onDone]);

  const handleCancel = useCallback(() => {
    if (onDone) {
      onDone();
    } else {
      router.push("/");
    }
  }, [router, onDone]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("リンクURLを入力", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const setColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      editor?.chain().focus().setColor(e.target.value).run();
    },
    [editor]
  );

  if (!editor) {
    return <div className="p-4 text-neutral-400">読み込み中…</div>;
  }

  const btn = (active: boolean) =>
    `flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition-colors ${
      active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
    }`;

  return (
    <div className="flex min-h-screen flex-col">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-3 py-2 backdrop-blur-md">
        <button
          onClick={handleCancel}
          className="flex h-9 items-center rounded-lg px-3 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          キャンセル
        </button>
        <span className="text-base font-semibold">{isEdit ? "投稿を編集" : "新規投稿"}</span>
        <button
          onClick={handlePublish}
          disabled={publishing || uploading}
          className="flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {publishing ? (isEdit ? "更新中…" : "投稿中…") : isEdit ? "更新する" : "投稿する"}
        </button>
      </header>

      {/* ツールバー */}
      <div className="sticky top-[49px] z-10 flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-white px-2 py-1.5">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))} title="太字">
          <b>B</b>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))} title="斜体">
          <i>I</i>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))} title="下線">
          <u>U</u>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))} title="取り消し線">
          <s>S</s>
        </button>

        <span className="mx-1 h-5 w-px bg-neutral-200" />

        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))} title="見出し1">
          H1
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))} title="見出し2">
          H2
        </button>

        <span className="mx-1 h-5 w-px bg-neutral-200" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))} title="箇条書き">
          •
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))} title="番号付きリスト">
          1.
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))} title="引用">
          &ldquo;
        </button>

        <span className="mx-1 h-5 w-px bg-neutral-200" />

        <button type="button" onClick={setLink} className={btn(editor.isActive("link"))} title="リンク">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
        </button>

        <label className={`${btn(false)} cursor-pointer`} title="文字色">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 3.31-2.69 6-6 6h-1.77c-.28 0-.5.22-.5.5 0 .12.05.23.13.33.41.47.64 1.06.64 1.67A2.5 2.5 0 0112 22zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8c.28 0 .5-.22.5-.5a.54.54 0 00-.14-.35c-.41-.46-.63-1.05-.63-1.65a2.5 2.5 0 012.5-2.5H16c2.21 0 4-1.79 4-4 0-3.86-3.59-7-8-7z"/><circle cx="6.5" cy="11.5" r="1.5"/><circle cx="9.5" cy="7.5" r="1.5"/><circle cx="14.5" cy="7.5" r="1.5"/><circle cx="17.5" cy="11.5" r="1.5"/></svg>
          <input type="color" onChange={setColor} className="h-0 w-0 opacity-0" defaultValue="#000000" />
        </label>

        <span className="mx-1 h-5 w-px bg-neutral-200" />

        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)} title="区切り線">
          —
        </button>
        <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className={btn(false)} title="書式クリア">
          ⌫
        </button>
      </div>

      {/* エディタ */}
      <div className="flex-1">
        <EditorContent editor={editor} />
      </div>

      {/* メディア添付エリア */}
      {media.length > 0 || uploading ? (
        <div className="border-t border-neutral-200 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {media.map((item) => (
              <div
                key={item.id}
                className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100"
              >
                {item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="relative h-full w-full">
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.posterUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-neutral-800" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white/90"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(item.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="削除"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </div>
            ))}
            {uploading ? (
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400">
                送信中…
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* アクションバー */}
      <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading || media.length >= MAX_MEDIA}
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
            title="画像を追加"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={uploading || media.length >= MAX_MEDIA}
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
            title="動画を追加"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files, false)}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={(e) => handleFiles(e.target.files, true)}
            className="hidden"
          />
        </div>
        <span className="text-xs text-neutral-400">{media.length}/{MAX_MEDIA}</span>
      </div>

      {error ? (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
      ) : null}
    </div>
  );
}
