"use client";

import { useState, useCallback } from "react";
import AdminDashboard from "./AdminDashboard";

export default function AdminClient({ initialAuthed }: { initialAuthed: boolean }) {
  const [authed, setAuthed] = useState(initialAuthed);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (res.ok) {
          setAuthed(true);
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "ログインに失敗しました");
        }
      } catch {
        setError("ネットワークエラー");
      } finally {
        setLoading(false);
      }
    },
    [password]
  );

  if (authed) {
    return <AdminDashboard />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold">ログイン</h1>
        <p className="mb-6 text-sm text-neutral-500">パスワードを入力してください</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            autoFocus
            className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-base outline-none focus:border-neutral-900"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-lg bg-neutral-900 py-2.5 text-base font-medium text-white disabled:opacity-50"
          >
            {loading ? "ログイン中…" : "ログイン"}
          </button>
        </form>
      </div>
    </main>
  );
}
