export type Article = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  dateISO: string;
  readTime: string;
  author: string;
  featured?: boolean;
  slug: string;
};

export const articles: Article[] = [
  {
    id: "art1",
    title: "NEET UG 2026: Complete Guide to Application, Pattern & Cutoffs",
    excerpt:
      "Everything about NEET UG 2026 — eligibility, syllabus, exam pattern, registration steps and expected cutoff analysis for admission to MBBS, BDS and AYUSH colleges.",
    category: "Exams",
    date: "12 Aug 2026",
    dateISO: "2026-08-12",
    readTime: "8 min read",
    author: "Padhaanewala Desk",
    featured: true,
    slug: "neet-ug-2026-complete-guide",
  },
  {
    id: "art2",
    title: "BAMS vs BHMS vs BUMS: Which AYUSH Course is Right After 12th?",
    excerpt:
      "Compare Ayurveda, Homeopathy and Unani medical courses on fees, career prospects, government job scope and counselling cutoffs to pick the right path.",
    category: "Careers",
    date: "05 Aug 2026",
    dateISO: "2026-08-05",
    readTime: "6 min read",
    author: "Dr. Meera Iyer",
    featured: true,
    slug: "bams-vs-bhms-vs-bums",
  },
  {
    id: "art3",
    title: "How to Read JoSAA Cutoff Rounds for JEE Counselling",
    excerpt:
      "Opening and closing ranks explained — understand the three JoSAA rounds, category-wise cutoffs and how to plan your seat allocation choices.",
    category: "Counselling",
    date: "28 Jul 2026",
    dateISO: "2026-07-28",
    readTime: "5 min read",
    author: "Padhaanewala Desk",
    slug: "how-to-read-josaa-cutoff-rounds",
  },
  {
    id: "art4",
    title: "Top Nursing Colleges in India with Placement Data (2026)",
    excerpt:
      "A state-wise list of leading B.Sc Nursing colleges with fee structure, hostel availability and placement highlights to shortlist wisely.",
    category: "College Guides",
    date: "20 Jul 2026",
    dateISO: "2026-07-20",
    readTime: "10 min read",
    author: "Padhaanewala Desk",
    slug: "top-nursing-colleges-india-2026",
  },
  {
    id: "art5",
    title: "How to Get an MBBS Seat in Karnataka: Cutoffs, Quotas & Fees",
    excerpt:
      "Understand GOVT quota, management quota and NRI quota seats in Karnataka medical colleges along with recent opening and closing ranks.",
    category: "Admissions",
    date: "12 Jul 2026",
    dateISO: "2026-07-12",
    readTime: "7 min read",
    author: "Dr. Meera Iyer",
    slug: "mbbs-seat-karnataka-guide",
  },
  {
    id: "art6",
    title: "JEE Main vs JEE Advanced: Difference, Syllabus & Strategy",
    excerpt:
      "What separates JEE Main from JEE Advanced, how scores are used for NITs, IIITs and GFTIs, and how to structure your preparation.",
    category: "Exams",
    date: "02 Jul 2026",
    dateISO: "2026-07-02",
    readTime: "6 min read",
    author: "Shubham Rao",
    slug: "jee-main-vs-jee-advanced",
  },
  {
    id: "art7",
    title: "Top 12 Scholarships for Class 12 Students: Deadlines Inside",
    excerpt:
      "A round-up of government and private scholarships with eligibility, amounts and application windows so you don't miss a deadline.",
    category: "Scholarships",
    date: "25 Jun 2026",
    dateISO: "2026-06-25",
    readTime: "9 min read",
    author: "Padhaanewala Desk",
    slug: "top-scholarships-class-12",
  },
  {
    id: "art8",
    title: "B.Pharm After 12th: Scope, Colleges and Career Paths",
    excerpt:
      "From D.Pharm to B.Pharm — eligibility, fees, top pharmacy colleges and career options in retail, industry and pharma research in India.",
    category: "Careers",
    date: "18 Jun 2026",
    dateISO: "2026-06-18",
    readTime: "7 min read",
    author: "Shubham Rao",
    featured: true,
    slug: "b-pharm-after-12th-careers",
  },
  {
    id: "art9",
    title: "CUET UG 2026: Exam Pattern, Subjects and Top Universities",
    excerpt:
      "New pattern for CUET UG 2026, how subject selection works, and a list of participating universities accepting CUET scores.",
    category: "Exams",
    date: "10 Jun 2026",
    dateISO: "2026-06-10",
    readTime: "6 min read",
    author: "Padhaanewala Desk",
    slug: "cuet-ug-2026-pattern",
  },
  {
    id: "art10",
    title: "LLB After 12th: 5-Year Integrated Law Colleges in India",
    excerpt:
      "CLAT and CUET pathways to BA LLB and BBA LLB — ranked law colleges, fee structures and what law careers really pay.",
    category: "College Guides",
    date: "02 Jun 2026",
    dateISO: "2026-06-02",
    readTime: "8 min read",
    author: "Padhaanewala Desk",
    slug: "llb-after-12th-colleges",
  },
  {
    id: "art11",
    title: "What is the National Education Policy (NEP) 2020–2026 Impact?",
    excerpt:
      "How NEP changes UG degrees — multiple entry-exit, flexible majors and how it affects your college and course choices from 2026.",
    category: "College Guides",
    date: "25 May 2026",
    dateISO: "2026-05-25",
    readTime: "5 min read",
    author: "Shubham Rao",
    slug: "nep-2026-impact",
  },
  {
    id: "art12",
    title: "How to Apply for Scholarships: A Step-by-Step Guide",
    excerpt:
      "Documents required, portal sign-up, common mistakes and a checklist to successfully apply for NSP and private scholarships.",
    category: "Scholarships",
    date: "18 May 2026",
    dateISO: "2026-05-18",
    readTime: "4 min read",
    author: "Padhaanewala Desk",
    slug: "how-to-apply-scholarships-guide",
  },
];

export const blogCategories = [
  "All",
  "Exams",
  "Careers",
  "Counselling",
  "College Guides",
  "Admissions",
  "Scholarships",
];