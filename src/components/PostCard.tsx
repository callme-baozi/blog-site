import RichText from "./RichText";
import MediaGallery from "./MediaGallery";
import { formatRelativeTime } from "@/lib/format";
import type { PostWithAssets } from "@/lib/types";

export interface AuthorInfo {
  name: string;
  avatarUrl: string | null;
}

function Avatar({ name, avatarUrl }: AuthorInfo) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-base font-semibold text-white">
      {initial}
    </div>
  );
}

export default function PostCard({
  post,
  author,
}: {
  post: PostWithAssets;
  author: AuthorInfo;
}) {
  return (
    <article className="px-4 py-4 sm:px-5">
      <div className="flex gap-3">
        <Avatar name={author.name} avatarUrl={author.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold text-neutral-900">{author.name}</span>
            <span className="text-sm text-neutral-500">
              {formatRelativeTime(post.created_at)}
            </span>
          </div>

          {post.content ? (
            <div className="mt-1">
              <RichText html={post.content} />
            </div>
          ) : null}

          {post.assets.length > 0 ? <MediaGallery assets={post.assets} /> : null}
        </div>
      </div>
    </article>
  );
}
