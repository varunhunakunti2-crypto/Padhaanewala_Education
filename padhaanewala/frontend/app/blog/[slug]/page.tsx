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
import { BLOG_POSTS, getBlogPostBySlug, getRelatedPosts } from "@/lib/data/blog";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { ArticleCard } from "@/components/blog/BlogExplorer";
import { AdmissionHelpButton } from "@/components/admission/AdmissionForm";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return { title: "Article not found" };
  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author }],
    keywords: post.tags,
  };
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post);

  return (
    <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
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

      <div className="prose max-w-none">
        {post.content.map((paragraph, i) => (
          <p key={i} className="mt-5 leading-relaxed text-slate-700 first:mt-8">
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