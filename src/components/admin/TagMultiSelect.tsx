"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MAX_KEYWORDS = 50;
const MAX_KEYWORD_LENGTH = 50;

interface TagMultiSelectProps {
  /** 已应用（已引用）的标签，即保存为网站关键词的列表 */
  value: string[];
  onChange: (tags: string[]) => void;
}

// 标签多选下拉组件（管理后台・网站关键词用）：
// - 输入文字后按 Enter（或点击下拉中的「作成」）创建对应的下拉标签选项
// - 下拉列表点击选项即可引用（多选），再次点击取消引用
// - 输入框最右侧的 × 只清空当前输入的文字，已应用的标签不受影响
export default function TagMultiSelect({ value, onChange }: TagMultiSelectProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  // 本次会话中创建但尚未应用的标签（草稿，不落库）
  const [drafts, setDrafts] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  // 下拉选项池 = 已应用标签 + 会话内草稿（去重）
  const pool = useMemo(() => {
    const merged = [...value];
    for (const t of drafts) {
      if (!merged.some((m) => m.toLowerCase() === t.toLowerCase())) {
        merged.push(t);
      }
    }
    return merged;
  }, [value, drafts]);

  // 点击组件外部时关闭下拉
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const isApplied = useCallback(
    (tag: string) => value.some((t) => t.toLowerCase() === tag.toLowerCase()),
    [value]
  );

  // 输入文字创建下拉标签选项（不自动引用，需点击选项引用）
  const createTag = useCallback(
    (raw: string) => {
      const tag = raw.trim();
      if (!tag || tag.length > MAX_KEYWORD_LENGTH) return;
      setDrafts((prev) => {
        const exists =
          prev.some((t) => t.toLowerCase() === tag.toLowerCase()) ||
          value.some((t) => t.toLowerCase() === tag.toLowerCase());
        return exists ? prev : [...prev, tag];
      });
      setInput("");
      setOpen(true);
    },
    [value]
  );

  const toggleTag = useCallback(
    (tag: string) => {
      if (isApplied(tag)) {
        onChange(value.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
      } else {
        if (value.length >= MAX_KEYWORDS) return;
        onChange([...value, tag]);
      }
    },
    [value, onChange, isApplied]
  );

  const showCreate =
    input.trim() !== "" &&
    !pool.some((t) => t.toLowerCase() === input.trim().toLowerCase());

  return (
    <div ref={rootRef} className="relative">
      {/* 输入区：已应用标签 chips + 输入框 + ×（只清空输入文字） */}
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 focus-within:border-neutral-900"
        onClick={() => setOpen(true)}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-sm text-neutral-700"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 fill-emerald-500">
              <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            <span className="truncate">{tag}</span>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              createTag(input);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={value.length === 0 ? "タグを入力して Enter で作成" : "追加…"}
          maxLength={MAX_KEYWORD_LENGTH}
          className="min-w-[100px] flex-1 bg-transparent px-1 py-0.5 text-base outline-none"
        />
        {input ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setInput("");
            }}
            className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="入力内容をクリア（適用済みタグはそのまま）"
            title="入力内容をクリア"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
              <path d="M18.3 5.71 12 12l-6.3-6.29L4.29 7.12 10.59 13.41 4.29 19.7l1.41 1.41 6.3-6.29 6.3 6.29 1.41-1.41-6.3-6.29 6.3-6.29z" />
            </svg>
          </button>
        ) : null}
      </div>

      {/* 下拉选项 */}
      {open ? (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {pool.length === 0 && !showCreate ? (
            <div className="px-3 py-2 text-sm text-neutral-400">
              まだタグがありません。入力して Enter で作成できます
            </div>
          ) : null}
          {showCreate ? (
            <button
              type="button"
              onClick={() => createTag(input)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              「{input.trim()}」を作成
            </button>
          ) : null}
          {pool.map((tag) => {
            const applied = isApplied(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                <span className="truncate">{tag}</span>
                {applied ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-emerald-500">
                    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
