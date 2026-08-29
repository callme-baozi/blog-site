import PostList from "@/components/PostList";
import { listPosts, getSettings } from "@/lib/db";

const PAGE_SIZE = 10;

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [initialPosts, settings] = await Promise.all([
    listPosts({ limit: PAGE_SIZE }),
    Promise.resolve(getSettings()),
  ]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[600px] border-x border-neutral-200 bg-white">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/85 px-4 py-3 backdrop-blur-md sm:px-5">
        <h1 className="text-lg font-bold">{settings.site_title}</h1>
        {settings.site_description ? (
          <p className="mt-0.5 text-sm text-neutral-500">{settings.site_description}</p>
        ) : null}
      </header>
      <PostList
        initialPosts={initialPosts}
        pageSize={PAGE_SIZE}
        author={{ name: settings.author_name, avatarUrl: settings.author_avatar_url }}
      />
    </main>
  );
}
