import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ChevronRight,
  Share2,
} from "lucide-react";
import { getRelatedPosts } from "@/lib/data/blog";
import { resolveBlogPost, resolveBlogPosts, resolveSlugs } from "@/lib/content";
import { formatDate } from "@/lib/utils";
import { JsonLd } from "@/components/seo/JsonLd";
import { blogPostingLd, breadcrumbLd, ldGraph, pageMetadata } from "@/lib/seo";
import { Badge } from "@/components/ui/Badge";
import { ArticleCard } from "@/components/blog/BlogExplorer";
import { AdmissionHelpButton } from "@/components/admission/AdmissionForm";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await resolveSlugs("blogs");
  return slugs.map((slug) => ({ slug }));
}

/**
 * The blog's own SEO columns take precedence over the derived defaults.
 *
 * `meta_title`/`meta_description`/`canonical_url` are writable through
 * `POST/PUT /blogs` and are what an editor reaches for to override a headline
 * that reads badly in a search result. They used to be dropped by `mapBlogPost`,
 * so the override existed in the database and nowhere in the HTML.
 *
 * `canonical_url` is passed through as-is when set, because the entire point of
 * an editorial canonical is to point somewhere other than the page's own URL —
 * normally the original source of a syndicated article. When it is absent the
 * page canonicalises to itself.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: post } = await resolveBlogPost(slug);
  if (!post) {
    return pageMetadata({
      title: "Article not found",
      description: "This article is not available on padhaanewala.",
      path: `/blog/${slug}`,
      noindex: true,
    });
  }

  const seo = pageMetadata({
    title: post.metaTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt,
    path: `/blog/${post.slug}`,
    type: "article",
    keywords: post.tags,
    publishedTime: post.date,
    authors: [post.author],
  });

  return post.canonicalUrl
    ? { ...seo, alternates: { canonical: post.canonicalUrl } }
    : seo;
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [{ data: post }, { data: allPosts }] = await Promise.all([
    resolveBlogPost(slug),
    resolveBlogPosts(),
  ]);
  if (!post) notFound();

  const related = getRelatedPosts(post).length
    ? getRelatedPosts(post)
    : allPosts.filter((p) => p.slug !== post.slug).slice(0, 3);

  const jsonLd = ldGraph([
    blogPostingLd(post),
    breadcrumbLd([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: post.title, path: `/blog/${post.slug}` },
    ]),
  ]);

  return (
    <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <JsonLd data={jsonLd} />
      <nav className="mb-5 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/" className="hover:text-purple-700">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/blog" className="hover:text-purple-700">Blog</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="line-clamp-1 font-medium text-purple-700">{post.title}</span>
      </nav>

      <div className="flex items-center gap-2">
        <Badge variant="purple">{post.category}</Badge>
        {post.featured && <Badge variant="yellow">Featured</Badge>}
      </div>
      <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-purple-950 sm:text-4xl">
        {post.title}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-slate-600">{post.excerpt}</p>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-slate-100 py-4 text-sm text-slate-500">
        <span className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
            {post.author.split(" ").map((w) => w[0]).join("").slice(0, 2)}
          </span>
          <span>
            <span className="block text-xs font-semibold text-gray-900">{post.author}</span>
            <span className="block text-xs text-slate-400">{post.authorRole}</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {formatDate(post.date)}</span>
        <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {post.readTime}</span>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-purple-300 hover:text-purple-700"
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>

      {/* `@tailwindcss/typography` is not a dependency, so article typography is
          expressed with real utilities here rather than a dead `prose` class. */}
      <div className="max-w-none text-[1.0625rem] leading-[1.75] text-slate-700 dark:text-slate-300">
        {post.content.map((paragraph, i) => (
          <p key={i} className="mt-5 first:mt-0 [&:first-of-type]:text-lg [&:first-of-type]:font-medium [&:first-of-type]:text-slate-900 dark:[&:first-of-type]:text-white">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {post.tags.map((t) => (
          <Badge key={t} variant="gray">#{t}</Badge>
        ))}
      </div>

      <div className="mt-10 rounded-3xl border border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50 p-6 text-center">
        <h2 className="font-display text-xl font-extrabold text-purple-950">Want personalised admission guidance?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
          Our counsellors can help you shortlist colleges and plan your applications step by step.
        </p>
        <div className="mt-4 flex justify-center">
          <AdmissionHelpButton />
        </div>
      </div>

      <div className="mt-12">
        <SectionHeading eyebrow="Keep reading" title="Related articles" align="left" />
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
          {related.map((p) => (
            <ArticleCard key={p.id} post={p} />
          ))}
        </div>
      </div>

      <Link href="/blog" className="mt-10 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-800">
        <ArrowLeft className="h-4 w-4" /> Back to all articles
      </Link>
    </article>
  );
}