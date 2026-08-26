import Link from "next/link";
import { notFound } from "next/navigation";
import PostCard from "@/components/PostCard";
import { getPostById, getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PostPage(props: PageProps<"/p/[id]">) {
  const { id } = await props.params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const [post, settings] = await Promise.all([
    Promise.resolve(getPostById(postId)),
    Promise.resolve(getSettings()),
  ]);
  if (!post) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-[600px] border-x border-neutral-200 bg-white">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-neutral-200 bg-white/85 px-4 py-3 backdrop-blur-md sm:px-5">
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100"
          aria-label="戻る"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold">投稿</h1>
      </header>
      <PostCard
        post={post}
        author={{ name: settings.author_name, avatarUrl: settings.author_avatar_url }}
      />
    </main>
  );
}
