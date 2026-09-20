import type { College } from "@/lib/types";
import { COLLEGES } from "./colleges";
import { COURSE_DETAILS } from "./courseDetails";

export interface CourseMeta {
  slug: string;
  name: string;
  degree: string;
  level: "UG" | "PG" | "Doctoral" | "Diploma";
  description: string;
  duration: string;
  avgFeeYear: number;
  hot: boolean;
}

export const COURSES: CourseMeta[] = [
  {
    slug: "btech-computer-science",
    name: "B.Tech Computer Science & Engineering",
    degree: "B.Tech",
    level: "UG",
    description:
      "Software engineering, algorithms, AI and systems. The most sought-after engineering branch with the highest placement demand.",
    duration: "4 Years",
    avgFeeYear: 275000,
    hot: true,
  },
  {
    slug: "mba",
    name: "MBA (Master of Business Administration)",
    degree: "MBA",
    level: "PG",
    description:
      "Business strategy, finance, marketing and leadership. Prepare for management and consulting careers across industries.",
    duration: "2 Years",
    avgFeeYear: 420000,
    hot: true,
  },
  {
    slug: "btech-artificial-intelligence",
    name: "B.Tech Artificial Intelligence & Machine Learning",
    degree: "B.Tech",
    level: "UG",
    description:
      "Deep learning, NLP, computer vision and data science. A rapidly growing field with premium placements.",
    duration: "4 Years",
    avgFeeYear: 315000,
    hot: true,
  },
  {
    slug: "btech-electronics",
    name: "B.Tech Electronics & Communication",
    degree: "B.Tech",
    level: "UG",
    description:
      "Circuits, VLSI, communication systems and embedded design. Core jobs in semiconductor and telecom industries.",
    duration: "4 Years",
    avgFeeYear: 240000,
    hot: false,
  },
  {
    slug: "btech-mechanical",
    name: "B.Tech Mechanical Engineering",
    degree: "B.Tech",
    level: "UG",
    description:
      "Design, manufacturing, thermal systems and robotics. The backbone of manufacturing, automotive and energy sectors.",
    duration: "4 Years",
    avgFeeYear: 215000,
    hot: false,
  },
  {
    slug: "bba",
    name: "BBA (Bachelor of Business Administration)",
    degree: "BBA",
    level: "UG",
    description:
      "Foundations of business, marketing, HR and entrepreneurship. An excellent pathway into the MBA or a corporate career.",
    duration: "3 Years",
    avgFeeYear: 210000,
    hot: true,
  },
  {
    slug: "bpharm",
    name: "B.Pharm (Bachelor of Pharmacy)",
    degree: "B.Pharm",
    level: "UG",
    description:
      "Pharmaceutical sciences, drug design and clinical research. Careers in pharma companies, hospitals and research labs.",
    duration: "4 Years",
    avgFeeYear: 185000,
    hot: false,
  },
  {
    slug: "bsc-computer-science",
    name: "B.Sc Computer Science",
    degree: "B.Sc",
    level: "UG",
    description:
      "Programming, mathematics for computing and IT systems. A flexible science pathway into tech careers and research.",
    duration: "3 Years",
    avgFeeYear: 120000,
    hot: true,
  },
  {
    slug: "b-arch",
    name: "B.Arch (Bachelor of Architecture)",
    degree: "B.Arch",
    level: "UG",
    description:
      "Architectural design, urban planning and sustainable building. A five-year program accredited by the Council of Architecture.",
    duration: "5 Years",
    avgFeeYear: 230000,
    hot: false,
  },
  {
    slug: "integrated-mtech",
    name: "Integrated M.Tech",
    degree: "M.Tech",
    level: "PG",
    description:
      "A five-year integrated research-oriented program combining undergraduate science with postgraduate engineering.",
    duration: "5 Years",
    avgFeeYear: 45000,
    hot: false,
  },
  {
    slug: "llb",
    name: "LLB / BA-LLB (Law)",
    degree: "LLB",
    level: "UG",
    description:
      "Constitutional law, criminal law, corporate law and legal practice. For careers in litigation, judiciary and legal counsel.",
    duration: "3–5 Years",
    avgFeeYear: 265000,
    hot: false,
  },
  {
    slug: "phd",
    name: "PhD (Research)",
    degree: "PhD",
    level: "Doctoral",
    description:
      "Deep research in sciences, engineering and humanities with fellowship support, leading to academic and R&D roles.",
    duration: "4–6 Years",
    avgFeeYear: 12000,
    hot: false,
  },
];

export function collegesOffering(courseSlug: string): College[] {
  const meta = COURSES.find((c) => c.slug === courseSlug);
  if (!meta) return [];
  return COLLEGES.filter((c) =>
    c.courses.some(
      (course) =>
        course.degree === meta.degree ||
        course.name.toLowerCase().includes(meta.name.toLowerCase().split("(")[0]!.trim()),
    ),
  );
}

export function searchCourses(query: string): CourseMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) return COURSES;
  return COURSES.filter((c) =>
    `${c.name} ${c.degree} ${c.description} ${c.level}`.toLowerCase().includes(q),
  );
  }

export function getCourseBySlug(slug: string): CourseMeta | undefined {
  return COURSES.find((c) => c.slug === slug);
}

export function getRelatedCourses(slug: string): CourseMeta[] {
  const detail = COURSE_DETAILS[slug];
  if (!detail) return COURSES.filter((c) => c.slug !== slug).slice(0, 3);
  const related = detail.relatedSlugs
    .map((s) => getCourseBySlug(s))
    .filter((c): c is CourseMeta => Boolean(c));
  const extra = COURSES.filter((c) => c.slug !== slug && !detail.relatedSlugs.includes(c.slug)).slice(0, 3);
  return [...related, ...extra].slice(0, 4);
}

export function getCourseDetail(slug: string) {
  return COURSE_DETAILS[slug];
}