// 帖子与资源的共享类型定义

export interface Post {
  id: number;
  content: string; // sanitized HTML
  created_at: number; // millisecond timestamp
  updated_at: number;
}

export interface PostWithAssets extends Post {
  assets: Asset[];
}

export type AssetType = "image" | "video";

export interface Asset {
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

export interface UploadResult {
  id: number;
  type: AssetType;
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
}

export interface PostListParams {
  limit?: number;
  before?: number;
}

export interface SiteSettings {
  site_title: string;
  site_description: string;
  author_name: string;
  author_avatar_url: string | null;
}
