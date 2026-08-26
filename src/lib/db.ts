import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type {
  Asset,
  AssetType,
  Post,
  PostListParams,
  PostWithAssets,
  SiteSettings,
} from "./types";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "blog.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const conn = new Database(DB_PATH);
    conn.pragma("busy_timeout = 5000");
    conn.pragma("journal_mode = WAL");
    conn.pragma("foreign_keys = ON");
    conn.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        content    TEXT    NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS post_assets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id    INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        type       TEXT    NOT NULL CHECK(type IN ('image','video')),
        url        TEXT    NOT NULL,
        poster_url TEXT,
        width      INTEGER,
        height     INTEGER,
        duration   REAL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_assets_post_id ON post_assets(post_id);
    `);
    _db = conn;
  }
  return _db;
}

// ---------- Posts ----------

interface PostRow {
  id: number;
  content: string;
  created_at: number;
  updated_at: number;
}

function mapPost(row: PostRow): Post {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createPost(content: string, assetIds: number[] = []): PostWithAssets {
  const db = getDb();
  const now = Date.now();
  const tx = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO posts (content, created_at, updated_at) VALUES (?, ?, ?)")
      .run(content, now, now);
    const postId = Number(info.lastInsertRowid);
    associateAssets(db, postId, assetIds);
    return postId;
  });

  const postId = tx();
  const post = getPostById(postId);
  if (!post) throw new Error("Failed to create post");
  return post;
}

export function updatePost(
  id: number,
  content: string,
  assetIds: number[] = []
): PostWithAssets | null {
  const db = getDb();
  const now = Date.now();
  const tx = db.transaction(() => {
    const result = db
      .prepare("UPDATE posts SET content = ?, updated_at = ? WHERE id = ?")
      .run(content, now, id);
    if (result.changes === 0) return false;
    // 既存のアセットの関連付けを解除
    db.prepare("UPDATE post_assets SET post_id = NULL WHERE post_id = ?").run(id);
    // 新しいアセットを関連付け
    associateAssets(db, id, assetIds);
    return true;
  });

  const ok = tx();
  if (!ok) return null;
  return getPostById(id);
}

export function deletePost(id: number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM posts WHERE id = ?").run(id);
  return result.changes > 0;
}

function associateAssets(db: Database.Database, postId: number, assetIds: number[]) {
  if (assetIds.length === 0) return;
  const placeholders = assetIds.map(() => "?").join(",");
  db.prepare(
    `UPDATE post_assets SET post_id = ?, sort_order = CASE id ${assetIds
      .map((_, i) => `WHEN ? THEN ${i}`)
      .join(" ")} END WHERE id IN (${placeholders})`
  ).run(postId, ...assetIds, ...assetIds);
}

export function getPostById(id: number): PostWithAssets | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as PostRow | undefined;
  if (!row) return null;
  const assets = getAssetsByPostId(id);
  return { ...mapPost(row), assets };
}

export function listPosts(params: PostListParams = {}): PostWithAssets[] {
  const db = getDb();
  const limit = Math.min(params.limit ?? 20, 50);
  const rows = params.before
    ? (db
        .prepare("SELECT * FROM posts WHERE created_at < ? ORDER BY created_at DESC LIMIT ?")
        .all(params.before, limit) as PostRow[])
    : (db
        .prepare("SELECT * FROM posts ORDER BY created_at DESC LIMIT ?")
        .all(limit) as PostRow[]);

  return rows.map((row) => ({
    ...mapPost(row),
    assets: getAssetsByPostId(row.id),
  }));
}

// ---------- Assets ----------

interface AssetRow {
  id: number;
  post_id: number | null;
  type: AssetType;
  url: string;
  poster_url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  sort_order: number;
  created_at: number;
}

function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    post_id: row.post_id,
    type: row.type,
    url: row.url,
    poster_url: row.poster_url,
    width: row.width,
    height: row.height,
    duration: row.duration,
    sort_order: row.sort_order,
    created_at: row.created_at,
  };
}

export function createAsset(asset: {
  type: AssetType;
  url: string;
  posterUrl?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
}): Asset {
  const db = getDb();
  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO post_assets (post_id, type, url, poster_url, width, height, duration, sort_order, created_at)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(
      asset.type,
      asset.url,
      asset.posterUrl ?? null,
      asset.width ?? null,
      asset.height ?? null,
      asset.duration ?? null,
      now
    );
  const row = db
    .prepare("SELECT * FROM post_assets WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as AssetRow;
  return mapAsset(row);
}

export function getAssetsByPostId(postId: number): Asset[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM post_assets WHERE post_id = ? ORDER BY sort_order ASC, id ASC")
    .all(postId) as AssetRow[];
  return rows.map(mapAsset);
}

export function getAssetsByIds(ids: number[]): Asset[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM post_assets WHERE id IN (${placeholders})`)
    .all(...ids) as AssetRow[];
  return rows.map(mapAsset);
}

export function deleteOrphanAssets(olderThanMs: number = 3600_000): number {
  const db = getDb();
  const cutoff = Date.now() - olderThanMs;
  const rows = db
    .prepare("SELECT id FROM post_assets WHERE post_id IS NULL AND created_at < ?")
    .all(cutoff) as Array<{ id: number }>;
  if (rows.length === 0) return 0;

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`DELETE FROM post_assets WHERE id IN (${placeholders})`).run(...ids);
  return rows.length;
}

// ---------- Settings ----------

const DEFAULT_SETTINGS: SiteSettings = {
  site_title: process.env.NEXT_PUBLIC_SITE_NAME || "My Blog",
  site_description: "",
  author_name: process.env.NEXT_PUBLIC_AUTHOR_NAME || "Author",
  author_avatar_url: null,
};

export function getSettings(): SiteSettings {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string | null;
  }>;
  const map: Record<string, string | null> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return {
    site_title: map.site_title ?? DEFAULT_SETTINGS.site_title,
    site_description: map.site_description ?? DEFAULT_SETTINGS.site_description,
    author_name: map.author_name ?? DEFAULT_SETTINGS.author_name,
    author_avatar_url: map.author_avatar_url ?? DEFAULT_SETTINGS.author_avatar_url,
  };
}

export function updateSettings(updates: Partial<SiteSettings>): SiteSettings {
  const db = getDb();
  const tx = db.transaction(() => {
    const stmt = db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    for (const [key, value] of Object.entries(updates)) {
      stmt.run(key, value ?? null);
    }
  });
  tx();
  return getSettings();
}
