import type { BlogCategory, BlogPost } from "@/lib/types";

export const BLOG_CATEGORIES: BlogCategory[] = [];

export const BLOG_POSTS: BlogPost[] = [];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getPostsByCategory(category: BlogCategory): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.category === category);
}

export function getRelatedPosts(post: BlogPost, limit = 3): BlogPost[] {
  return BLOG_POSTS.filter(
    (p) => p.id !== post.id && (p.category === post.category || p.tags.some((t) => post.tags.includes(t))),
  ).slice(0, limit);
}

export function searchBlogPosts(query: string): BlogPost[] {
  const q = query.toLowerCase().trim();
  if (!q) return BLOG_POSTS;
  return BLOG_POSTS.filter((p) =>
    [p.title, p.excerpt, p.author, p.category, ...p.tags].join(" ").toLowerCase().includes(q),
  );
}