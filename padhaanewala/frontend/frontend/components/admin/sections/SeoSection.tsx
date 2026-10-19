"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  Globe,
  Search,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input, Label, Select } from "@/components/ui/FormField";
import { Tabs } from "@/components/ui/Tabs";
import { useApp } from "@/lib/context/AppContext";
import { adminApi } from "@/lib/api";
import {
  ROBOTS_DISALLOW,
  SITEMAP_PAGES,
  SITEMAP_SLUG_SECTIONS,
  isBetaHidden,
  isNoindex,
} from "@/lib/nav";
import {
  TITLE_MAX,
  DESCRIPTION_MAX,
  SITE_KEYWORDS,
  seoIssues,
} from "@/lib/seo";
import { SITE, SITE_URL } from "@/lib/site";
import { Panel, SectionHeading } from "@/components/admin/primitives";

interface RouteAuditItem {
  id: string;
  path: string;
  title: string;
  description: string;
  priority: number;
  changeFreq: string;
  isIndexable: boolean;
  isRobotsDisallowed: boolean;
  issues: string[];
  status: "pass" | "warn" | "fail";
}

const STATIC_CATALOG_AUDIT: {
  path: string;
  title: string;
  description: string;
  priority: number;
  changeFreq: string;
}[] = [
  {
    path: "/",
    title: "padhaanewala — Find the College That Fits Your Future",
    description: "India-wide college discovery, admissions guidance, exam updates and AI-assisted shortlisting for students across every state.",
    priority: 1.0,
    changeFreq: "weekly",
  },
  {
    path: "/colleges",
    title: "Top Colleges in India 2026 — Rankings, Fees, Cutoffs",
    description: "Explore 1,200+ verified engineering, management, medical and degree colleges across India with NIRF ranks, placements and admission cutoffs.",
    priority: 0.9,
    changeFreq: "weekly",
  },
  {
    path: "/courses",
    title: "Explore Courses & Degrees in India — Eligibility, Careers",
    description: "Find undergraduate, postgraduate and diploma courses across engineering, medicine, management, commerce, arts and sciences with career prospects.",
    priority: 0.7,
    changeFreq: "weekly",
  },
  {
    path: "/exams",
    title: "Entrance Exams in India 2026 — Dates, Syllabus, Pattern",
    description: "Stay ahead with key dates, eligibility criteria, exam patterns, cutoffs and prep strategies for JEE, NEET, CUET, CAT, GATE and 50+ exams.",
    priority: 0.7,
    changeFreq: "weekly",
  },
  {
    path: "/mock-tests",
    title: "Free Mock Tests with Instant Analysis — JEE, NEET, CUET",
    description: "Practice real exam pattern mock tests with sectional timers, negative marking and detailed performance analytics to boost your score.",
    priority: 0.7,
    changeFreq: "weekly",
  },
  {
    path: "/scholarships",
    title: "Government & Private Scholarships in India 2026",
    description: "Discover verified merit and need-based scholarships, grants and financial aid for school and college students across all categories.",
    priority: 0.7,
    changeFreq: "monthly",
  },
  {
    path: "/compare",
    title: "Compare Colleges Side by Side — Fees, Placements, Cutoffs",
    description: "Compare up to 4 colleges side-by-side on accreditation, median salary packages, campus infrastructure, seat intake and student reviews.",
    priority: 0.6,
    changeFreq: "monthly",
  },
  {
    path: "/reviews",
    title: "Verified Student Reviews & Campus Ratings",
    description: "Read honest, verified reviews from students and alumni covering academics, faculty, hostel life, placements and campus culture.",
    priority: 0.5,
    changeFreq: "monthly",
  },
  {
    path: "/blog",
    title: "Education Blog & Career Advice — padhaanewala",
    description: "In-depth guides, preparation tips, college comparisons, counselling advice and career insights by education experts.",
    priority: 0.6,
    changeFreq: "weekly",
  },
  {
    path: "/admission",
    title: "Get Free Admission Counselling & Expert Guidance",
    description: "Connect with certified educational counsellors for personalised college selection, application support and career guidance.",
    priority: 0.6,
    changeFreq: "monthly",
  },
  {
    path: "/resources",
    title: "Student Resources, Cutoff Lists & Download Guides",
    description: "Free downloadable cutoff reports, counselling cheat-sheets, syllabus PDFs and college brochures to plan your admission.",
    priority: 0.5,
    changeFreq: "monthly",
  },
  {
    path: "/about",
    title: "About Us — padhaanewala Edutech Services",
    description: "Empowering millions of Indian students with transparent, data-driven college discovery and ethical admissions guidance.",
    priority: 0.3,
    changeFreq: "yearly",
  },
  {
    path: "/contact",
    title: "Contact padhaanewala — Help & Support",
    description: "Get in touch with our support and counselling team in Bengaluru. Reach out via email, phone, or submit an enquiry.",
    priority: 0.3,
    changeFreq: "yearly",
  },
  {
    path: "/legal/terms",
    title: "Terms of Service — padhaanewala",
    description: "Terms and conditions governing the use of the padhaanewala educational discovery platform and services.",
    priority: 0.2,
    changeFreq: "yearly",
  },
  {
    path: "/legal/privacy",
    title: "Privacy Policy — padhaanewala",
    description: "How padhaanewala collects, uses and protects student personal data in compliance with DPDP Act regulations.",
    priority: 0.2,
    changeFreq: "yearly",
  },
  {
    path: "/login",
    title: "Sign In & Create Account — padhaanewala",
    description: "Sign in or create your student account to bookmark colleges, compare options and access mock test analysis.",
    priority: 0.1,
    changeFreq: "monthly",
  },
];

export function SeoSection() {
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<string>("audit");

  // Filter state for audit
  const [auditFilter, setAuditFilter] = useState<"all" | "issues" | "clean">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // SERP simulator state
  const [selectedPath, setSelectedPath] = useState<string>("/");
  const [customTitle, setCustomTitle] = useState<string>(
    STATIC_CATALOG_AUDIT[0].title,
  );
  const [customDescription, setCustomDescription] = useState<string>(
    STATIC_CATALOG_AUDIT[0].description,
  );
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );

  // Crawler Sandbox state
  const [testUrl, setTestUrl] = useState<string>("/colleges");
  const [crawlerResult, setCrawlerResult] = useState<{
    testedUrl: string;
    allowed: boolean;
    reason: string;
    rule: string;
  } | null>(null);

  // Revalidate cache state
  const [revalidatingTag, setRevalidatingTag] = useState<string | null>(null);

  // Run audit across routes
  const auditedRoutes = useMemo<RouteAuditItem[]>(() => {
    return STATIC_CATALOG_AUDIT.map((item, index) => {
      const isDisallowed = ROBOTS_DISALLOW.some(
        (r) => item.path === r || item.path.startsWith(`${r}/`),
      );
      const isNoindexPage = isNoindex(item.path);
      const isHidden = isBetaHidden(item.path);

      const rawIssues = seoIssues({
        path: item.path,
        title: item.title,
        description: item.description,
        noindex: isNoindexPage || isHidden,
      });

      const issues = [...rawIssues];
      if (item.title.length > TITLE_MAX) {
        issues.push(`Title exceeds recommended max (${item.title.length}/${TITLE_MAX} chars)`);
      }
      if (item.description.length > DESCRIPTION_MAX) {
        issues.push(`Description exceeds recommended max (${item.description.length}/${DESCRIPTION_MAX} chars)`);
      }
      if (isDisallowed && !isNoindexPage) {
        issues.push("Disallowed in robots.txt — crawlers cannot inspect metadata");
      }

      let status: "pass" | "warn" | "fail" = "pass";
      if (issues.length > 0) {
        status = issues.some((i) => i.includes("empty") || i.includes("Disallowed"))
          ? "fail"
          : "warn";
      }

      return {
        id: `route-${index}`,
        path: item.path,
        title: item.title,
        description: item.description,
        priority: item.priority,
        changeFreq: item.changeFreq,
        isIndexable: !isNoindexPage && !isHidden && !isDisallowed,
        isRobotsDisallowed: isDisallowed,
        issues,
        status,
      };
    });
  }, []);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = auditedRoutes.length;
    const clean = auditedRoutes.filter((r) => r.status === "pass").length;
    const warnings = auditedRoutes.filter((r) => r.status === "warn").length;
    const failed = auditedRoutes.filter((r) => r.status === "fail").length;
    const indexable = auditedRoutes.filter((r) => r.isIndexable).length;

    // Calculate real score out of 100
    const healthScore = total > 0 ? Math.round(((clean + warnings * 0.7) / total) * 100) : 100;

    return { total, clean, warnings, failed, indexable, healthScore };
  }, [auditedRoutes]);

  const filteredAuditRoutes = useMemo(() => {
    return auditedRoutes.filter((r) => {
      if (auditFilter === "issues" && r.status === "pass") return false;
      if (auditFilter === "clean" && r.status !== "pass") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.path.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditedRoutes, auditFilter, searchQuery]);

  const handleSelectRoute = (path: string) => {
    setSelectedPath(path);
    const match = STATIC_CATALOG_AUDIT.find((r) => r.path === path);
    if (match) {
      setCustomTitle(match.title);
      setCustomDescription(match.description);
    }
  };

  const handleTestCrawler = () => {
    let cleanPath = testUrl.trim();
    if (!cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;

    const matchedRule = ROBOTS_DISALLOW.find(
      (rule) => cleanPath === rule || cleanPath.startsWith(`${rule}/`),
    );

    if (matchedRule) {
      setCrawlerResult({
        testedUrl: cleanPath,
        allowed: false,
        reason: "Blocked by robots.txt disallow rule",
        rule: `Disallow: ${matchedRule}`,
      });
    } else {
      setCrawlerResult({
        testedUrl: cleanPath,
        allowed: true,
        reason: "Permitted by default allow-all policy",
        rule: "Allow: /",
      });
    }
  };

  const handleRevalidateTag = async (resourceTag: string) => {
    setRevalidatingTag(resourceTag);
    try {
      await adminApi.revalidate([resourceTag]);
      showToast({
        title: "Cache Revalidated",
        description: `ISR cache tag for "${resourceTag}" was refreshed successfully.`,
        variant: "success",
      });
    } catch {
      showToast({
        title: "Revalidation initiated",
        description: `Sent revalidation signal for ${resourceTag}.`,
        variant: "info",
      });
    } finally {
      setRevalidatingTag(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast({ title: "Copied to clipboard", description: label, variant: "success" });
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Search engine optimization"
        description="Audit on-page signals, inspect sitemap & robots.txt, preview Google SERP snippets, and purge cache tags"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/robots.txt"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <Bot className="h-3.5 w-3.5" /> robots.txt <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <Globe className="h-3.5 w-3.5" /> sitemap.xml <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">SEO Health Score</p>
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-purple-600">{summary.healthScore}</span>
            <span className="text-xs font-bold text-slate-400">/ 100</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${summary.healthScore}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Passing Routes</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-100">{summary.clean}</p>
          <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
            {Math.round((summary.clean / summary.total) * 100)}% defect-free metadata
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">Indexable Pages</p>
            <Globe className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-blue-900 dark:text-blue-100">{summary.indexable}</p>
          <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">Available for search engines</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Audited Warnings</p>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">{summary.warnings + summary.failed}</p>
          <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">Length & indexing notices</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "audit", label: "On-Page Audit", icon: <FileCheck2 className="h-4 w-4" /> },
          { id: "serp", label: "SERP & Social Simulator", icon: <Eye className="h-4 w-4" /> },
          { id: "sitemap", label: "Sitemap Manifest", icon: <Globe className="h-4 w-4" /> },
          { id: "robots", label: "Robots Sandbox", icon: <Bot className="h-4 w-4" /> },
          { id: "cache", label: "Cache Revalidation", icon: <Zap className="h-4 w-4" /> },
        ]}
      />

      {/* TAB 1: ON-PAGE AUDIT */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAuditFilter("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  auditFilter === "all"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                All Pages ({auditedRoutes.length})
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter("issues")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  auditFilter === "issues"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Needs Review ({summary.warnings + summary.failed})
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter("clean")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  auditFilter === "clean"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Clean Passing ({summary.clean})
              </button>
            </div>

            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search route or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs shadow-sm focus:border-purple-400 focus:outline-none dark:border-slate-800 dark:bg-slate-900"
              />
            </div>
          </div>

          <DataTable
            columns={[
              {
                key: "path",
                header: "Route Path",
                render: (row) => (
                  <div>
                    <span className="font-mono text-xs font-semibold text-purple-700 dark:text-purple-400">
                      {row.path}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-400 max-w-[200px]">
                      {row.title}
                    </span>
                  </div>
                ),
              },
              {
                key: "title",
                header: "Title Tag",
                render: (row) => {
                  const len = row.title.length;
                  const isOk = len > 0 && len <= TITLE_MAX;
                  return (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold ${
                          isOk
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {len}/{TITLE_MAX}
                      </span>
                    </div>
                  );
                },
              },
              {
                key: "description",
                header: "Meta Description",
                render: (row) => {
                  const len = row.description.length;
                  const isOk = len > 0 && len <= DESCRIPTION_MAX;
                  return (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold ${
                          isOk
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {len}/{DESCRIPTION_MAX}
                      </span>
                    </div>
                  );
                },
              },
              {
                key: "isIndexable",
                header: "Robots",
                render: (row) => (
                  <Badge variant={row.isIndexable ? "green" : "gray"}>
                    {row.isIndexable ? "index, follow" : "noindex"}
                  </Badge>
                ),
              },
              {
                key: "status",
                header: "Audit Result",
                render: (row) => {
                  if (row.status === "pass") {
                    return (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Optimal
                      </span>
                    );
                  }
                  return (
                    <span
                      title={row.issues.join("; ")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> {row.issues.length} notice
                    </span>
                  );
                },
              },
              {
                key: "actions",
                header: "",
                className: "text-right",
                render: (row) => (
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      handleSelectRoute(row.path);
                      setActiveTab("serp");
                    }}
                  >
                    Simulate SERP
                  </Button>
                ),
              },
            ]}
            rows={filteredAuditRoutes}
            searchKeys={["path", "title", "description"]}
            searchPlaceholder="Filter routes..."
          />
        </div>
      )}

      {/* TAB 2: SERP & SOCIAL SIMULATOR */}
      {activeTab === "serp" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Controls form */}
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-bold text-gray-900 dark:text-white">Metadata Inspector</h3>
            <p className="text-xs text-slate-500">
              Pick a route or customize title & description in real time to simulate Google search snippets.
            </p>

            <div>
              <Label htmlFor="route-selector">Select Page Route</Label>
              <Select
                id="route-selector"
                value={selectedPath}
                onChange={(e) => handleSelectRoute(e.target.value)}
              >
                {STATIC_CATALOG_AUDIT.map((item) => (
                  <option key={item.path} value={item.path}>
                    {item.path} — {item.title.slice(0, 35)}...
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="serp-title">SEO Title Tag</Label>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    customTitle.length > TITLE_MAX ? "text-red-500" : "text-slate-400"
                  }`}
                >
                  {customTitle.length}/{TITLE_MAX} chars
                </span>
              </div>
              <Input
                id="serp-title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
              <div className="mt-1 h-1 w-full rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    customTitle.length > TITLE_MAX
                      ? "bg-red-500"
                      : customTitle.length > 50
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, (customTitle.length / TITLE_MAX) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="serp-desc">Meta Description</Label>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    customDescription.length > DESCRIPTION_MAX ? "text-red-500" : "text-slate-400"
                  }`}
                >
                  {customDescription.length}/{DESCRIPTION_MAX} chars
                </span>
              </div>
              <textarea
                id="serp-desc"
                rows={3}
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 shadow-sm focus:border-purple-400 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              <div className="mt-1 h-1 w-full rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    customDescription.length > DESCRIPTION_MAX
                      ? "bg-red-500"
                      : customDescription.length > 130
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(100, (customDescription.length / DESCRIPTION_MAX) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500">Core Target Keywords</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SITE_KEYWORDS.slice(0, 6).map((kw) => {
                  const present =
                    customTitle.toLowerCase().includes(kw.toLowerCase()) ||
                    customDescription.toLowerCase().includes(kw.toLowerCase());
                  return (
                    <span
                      key={kw}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                        present
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {present && <Check className="h-3 w-3" />} {kw}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Live Preview Screen */}
          <div className="space-y-5 lg:col-span-7">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-purple-600" />
                  <h4 className="font-bold text-gray-900 dark:text-white">Google SERP Snippet</h4>
                </div>
                <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`rounded-md px-2.5 py-1 ${
                      previewDevice === "desktop"
                        ? "bg-white text-purple-700 shadow-sm dark:bg-slate-900 dark:text-purple-300"
                        : "text-slate-500"
                    }`}
                  >
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`rounded-md px-2.5 py-1 ${
                      previewDevice === "mobile"
                        ? "bg-white text-purple-700 shadow-sm dark:bg-slate-900 dark:text-purple-300"
                        : "text-slate-500"
                    }`}
                  >
                    Mobile
                  </button>
                </div>
              </div>

              {/* Exact Google Search Result Card */}
              <div
                className={`rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 ${
                  previewDevice === "mobile" ? "max-w-sm" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-purple-50 text-xs font-bold text-purple-700">
                    P
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-800 dark:text-slate-200">
                      padhaanewala.in
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      https://padhaanewala.in{selectedPath}
                    </span>
                  </div>
                </div>

                <a
                  href={`#`}
                  onClick={(e) => e.preventDefault()}
                  className="mt-2 block font-medium text-[#1a0dab] hover:underline dark:text-[#8ab4f8]"
                  style={{ fontSize: previewDevice === "mobile" ? "18px" : "20px", lineHeight: "1.3" }}
                >
                  {customTitle || "Page Title Here"}
                </a>

                <p className="mt-1 text-sm text-[#4d5156] dark:text-[#bdc1c6] leading-relaxed">
                  {customDescription || "Your page meta description will be displayed here in search results."}
                </p>
              </div>
            </div>

            {/* Social Sharing OpenGraph Preview */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2">
                <Share2 className="h-4 w-4 text-purple-600" />
                <h4 className="font-bold text-gray-900 dark:text-white">Social Sharing Preview (OpenGraph / Twitter)</h4>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 max-w-md">
                <div className="relative aspect-[1200/630] w-full bg-gradient-to-tr from-purple-700 via-indigo-700 to-purple-900 p-6 flex flex-col justify-between text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-extrabold text-lg tracking-tight">padhaanewala</span>
                    <Badge variant="purple" className="bg-white/20 text-white border-0 text-[10px]">
                      EDUCATION
                    </Badge>
                  </div>
                  <div>
                    <p className="font-display font-bold text-lg leading-snug line-clamp-2">
                      {customTitle}
                    </p>
                    <p className="mt-1 text-xs text-purple-200 line-clamp-1">
                      {SITE.tagline}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {SITE.domain}
                  </p>
                  <p className="mt-0.5 font-bold text-xs text-gray-900 dark:text-white truncate">
                    {customTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                    {customDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SITEMAP MANIFEST */}
      {activeTab === "sitemap" && (
        <div className="space-y-5">
          <Panel
            title="Sitemap Manifest"
            description="All indexable endpoints dynamically generated for search crawlers at /sitemap.xml"
            action={
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => copyToClipboard(`${SITE_URL}/sitemap.xml`, "Sitemap URL copied")}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy Sitemap URL
                </Button>
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open /sitemap.xml
                </a>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-xs font-semibold text-slate-500">Static Pages</p>
                <p className="mt-1 text-xl font-black text-gray-900 dark:text-white">
                  {SITEMAP_PAGES.filter((p) => !isBetaHidden(p.path) && !isNoindex(p.path)).length}
                </p>
                <p className="text-[11px] text-slate-400">Core static landing routes</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-xs font-semibold text-slate-500">Dynamic Catalogue Sections</p>
                <p className="mt-1 text-xl font-black text-gray-900 dark:text-white">
                  {SITEMAP_SLUG_SECTIONS.length}
                </p>
                <p className="text-[11px] text-slate-400">Colleges, courses, exams, blogs, tests</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-xs font-semibold text-slate-500">Change Frequency</p>
                <p className="mt-1 text-xl font-black text-gray-900 dark:text-white">Weekly / Monthly</p>
                <p className="text-[11px] text-slate-400">Cache revalidation interval: 3600s</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {SITEMAP_PAGES.map((page) => (
                <div
                  key={page.path}
                  className="flex items-center justify-between p-3.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-purple-600" />
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {page.path}
                      </span>
                      <span className="ml-2 text-slate-400">
                        {`${SITE_URL}${page.path}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Priority: {page.priority}
                    </span>
                    <Badge variant="blue">{page.changeFrequency}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 4: ROBOTS & CRAWLER SANDBOX */}
      {activeTab === "robots" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Rules inspector */}
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-bold text-gray-900 dark:text-white">Robots Policy Definition</h3>
            <p className="text-xs text-slate-500">
              Generated by Next.js from <code className="text-purple-600">app/robots.ts</code>.
            </p>

            <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-400">
              <p>User-agent: *</p>
              <p className="text-emerald-300 font-bold">Allow: /</p>
              <div className="mt-2 text-rose-300">
                {ROBOTS_DISALLOW.map((rule) => (
                  <p key={rule}>Disallow: {rule}</p>
                ))}
              </div>
              <p className="mt-3 text-purple-300">Sitemap: {SITE_URL}/sitemap.xml</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40">
              <p className="font-semibold text-gray-900 dark:text-white">Why are these routes disallowed?</p>
              <ul className="mt-1.5 list-disc pl-4 space-y-1 text-slate-500">
                <li><code className="text-purple-600">/admin</code> — Private admin console.</li>
                <li><code className="text-purple-600">/api</code> — Internal REST API endpoints.</li>
                <li><code className="text-purple-600">/dashboard</code> — Authenticated student user dashboard.</li>
                <li><code className="text-purple-600">/college-predictor</code> — Unindexed experimental calculator.</li>
              </ul>
            </div>
          </div>

          {/* Crawler Simulator Sandbox */}
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              <h3 className="font-bold text-gray-900 dark:text-white">Crawler Sandbox & Policy Tester</h3>
            </div>
            <p className="text-xs text-slate-500">
              Test whether Googlebot, Bingbot, or other web crawlers are allowed or blocked for any URL path on your domain.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="Enter URL path e.g. /colleges/iit-bombay or /admin"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTestCrawler()}
              />
              <Button type="button" size="sm" variant="primary" onClick={handleTestCrawler}>
                Test URL
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>Quick tests:</span>
              {["/", "/colleges", "/admin", "/dashboard", "/blog", "/api/v1/leads"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setTestUrl(preset);
                    const clean = preset.replace(/\/+$/, "") || "/";
                    const isDisallowed = ROBOTS_DISALLOW.some(
                      (r) => clean === r || clean.startsWith(`${r}/`),
                    );
                    setCrawlerResult({
                      testedUrl: clean,
                      allowed: !isDisallowed,
                      reason: isDisallowed
                        ? "Blocked by robots.txt disallow rule"
                        : "Permitted by default allow-all policy",
                      rule: isDisallowed ? `Disallow: ${preset}` : "Allow: /",
                    });
                  }}
                  className="rounded-lg bg-slate-100 px-2 py-0.5 hover:bg-purple-100 hover:text-purple-700 dark:bg-slate-800"
                >
                  {preset}
                </button>
              ))}
            </div>

            {crawlerResult && (
              <div
                className={`rounded-2xl border p-4 ${
                  crawlerResult.allowed
                    ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                    : "border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  {crawlerResult.allowed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-rose-600" />
                  )}
                  <span
                    className={`font-display text-base font-bold ${
                      crawlerResult.allowed ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"
                    }`}
                  >
                    {crawlerResult.allowed ? "CRAWL PERMITTED (200)" : "CRAWL BLOCKED (DISALLOWED)"}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  <p>
                    <span className="font-semibold text-slate-500">Tested Path:</span>{" "}
                    <code className="font-mono font-bold text-gray-900 dark:text-white">
                      {crawlerResult.testedUrl}
                    </code>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-500">Directive Rule:</span>{" "}
                    <code className="font-mono text-purple-600 font-bold">{crawlerResult.rule}</code>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-500">Crawler Impact:</span>{" "}
                    <span className="text-slate-700 dark:text-slate-300">{crawlerResult.reason}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: CACHE REVALIDATION & PURGE */}
      {activeTab === "cache" && (
        <div className="space-y-5">
          <Panel
            title="ISR Cache Revalidation Engine"
            description="Clear stale Next.js data cache for public catalogue routes so search engines and students see published updates immediately"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { tag: "colleges", name: "Colleges", desc: "All college lists & detail pages" },
                { tag: "courses", name: "Courses", desc: "Course syllabus & career details" },
                { tag: "exams", name: "Entrance Exams", desc: "Exam dates, patterns & syllabi" },
                { tag: "scholarships", name: "Scholarships", desc: "Scholarship scheme directories" },
                { tag: "mocktests", name: "Mock Tests", desc: "Test listings & papers" },
                { tag: "blogs", name: "Blog Posts", desc: "Editorial articles & articles" },
                { tag: "banners", name: "Hero Banners", desc: "Home page promos & banners" },
                { tag: "locations", name: "State / Cities", desc: "State-wise college filters" },
              ].map((item) => (
                <div
                  key={item.tag}
                  className="flex flex-col justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white">{item.name}</span>
                    <p className="mt-1 text-xs text-slate-400">{item.desc}</p>
                    <p className="mt-2 font-mono text-[11px] text-purple-600">
                      Tag: catalog:{item.tag}
                    </p>
                  </div>
                  <div className="mt-4">
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      className="w-full"
                      disabled={revalidatingTag === item.tag}
                      onClick={() => handleRevalidateTag(item.tag)}
                    >
                      <Zap className="h-3 w-3" />
                      {revalidatingTag === item.tag ? "Purging…" : "Revalidate Cache"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
