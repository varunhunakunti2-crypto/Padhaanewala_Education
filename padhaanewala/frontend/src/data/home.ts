export type Course = {
  id: string;
  name: string;
  tag: string;
  colleges: number;
  slug: string;
};

export type College = {
  id: string;
  name: string;
  location: string;
  type: string;
  rating: number;
  fees: string;
  placement: string;
  slug: string;
  featured?: boolean;
  verified?: boolean;
};

export type Scholarship = {
  id: string;
  name: string;
  provider: string;
  amount: string;
  deadline: string;
  slug: string;
};

export type Exam = {
  id: string;
  name: string;
  date: string;
  status: string;
  slug: string;
};

export type MockTest = {
  id: string;
  name: string;
  questions: number;
  duration: number;
  mode: string;
  slug: string;
};

export type Review = {
  id: string;
  name: string;
  course: string;
  college: string;
  rating: number;
  text: string;
  avatar?: string;
  role?: string;
};

export type Article = {
  id: string;
  title: string;
  category: string;
  readTime: string;
  slug: string;
};

export type QuickAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: "buildings" | "compare" | "sparkles" | "award" | "clipboard" | "chat";
};

export const quickActions: QuickAction[] = [
  {
    id: "colleges",
    label: "Find Colleges",
    description: "Explore 1,000+ colleges across India",
    href: "/colleges",
    icon: "buildings",
  },
  {
    id: "compare",
    label: "Compare Colleges",
    description: "Compare 2-4 colleges side by side",
    href: "/compare",
    icon: "compare",
  },
  {
    id: "predictor",
    label: "College Predictor",
    description: "Predict colleges from your exam rank",
    href: "/college-predictor",
    icon: "sparkles",
  },
  {
    id: "scholarships",
    label: "Scholarships",
    description: "Find scholarships you are eligible for",
    href: "/scholarships",
    icon: "award",
  },
  {
    id: "mocks",
    label: "Mock Tests",
    description: "Practice with standard & proctored tests",
    href: "/mock-tests",
    icon: "clipboard",
  },
  {
    id: "help",
    label: "Admission Assistance",
    description: "Talk to a counsellor for free",
    href: "/contact",
    icon: "chat",
  },
];

export const popularCourses: Course[] = [
  { id: "c1", name: "MBBS", tag: "Medicine", colleges: 620, slug: "mbbs" },
  { id: "c2", name: "BDS", tag: "Dental", colleges: 310, slug: "bds" },
  { id: "c3", name: "BAMS", tag: "Ayurveda", colleges: 410, slug: "bams" },
  { id: "c4", name: "BHMS", tag: "Homeopathy", colleges: 210, slug: "bhms" },
  { id: "c5", name: "B.Sc Nursing", tag: "Nursing", colleges: 540, slug: "b-sc-nursing" },
  { id: "c6", name: "B.Pharm", tag: "Pharmacy", colleges: 470, slug: "b-pharm" },
  { id: "c7", name: "BCA", tag: "Computer Applications", colleges: 380, slug: "bca" },
  { id: "c8", name: "B.Tech", tag: "Engineering", colleges: 690, slug: "b-tech" },
  { id: "c9", name: "BBA", tag: "Management", colleges: 420, slug: "bba" },
  { id: "c10", name: "LLB", tag: "Law", colleges: 290, slug: "llb" },
];

export const featuredColleges: College[] = [
  {
    id: "col1",
    name: "Padhaanewala Institute of Medical Sciences",
    location: "Bengaluru, Karnataka",
    type: "Private",
    rating: 4.6,
    fees: "₹8.5 L/year",
    placement: "92% placed",
    slug: "sample-medical-college",
    featured: true,
    verified: true,
  },
  {
    id: "col2",
    name: "Padhaanewala National College of Nursing",
    location: "Chennai, Tamil Nadu",
    type: "Private",
    rating: 4.4,
    fees: "₹1.2 L/year",
    placement: "88% placed",
    slug: "sample-nursing-college",
    verified: true,
  },
  {
    id: "col3",
    name: "Padhaanewala College of Pharmacy",
    location: "Hyderabad, Telangana",
    type: "Private",
    rating: 4.2,
    fees: "₹1.5 L/year",
    placement: "85% placed",
    slug: "sample-pharmacy-college",
    verified: true,
  },
  {
    id: "col4",
    name: "Padhaanewala Engineering Institute",
    location: "Pune, Maharashtra",
    type: "Private",
    rating: 4.3,
    fees: "₹2.4 L/year",
    placement: "90% placed",
    slug: "sample-engineering-college",
    verified: true,
  },
];

export const scholarships: Scholarship[] = [
  {
    id: "s1",
    name: "National Means-cum-Merit Scholarship",
    provider: "Ministry of Education",
    amount: "₹12,000/year",
    deadline: "31 Oct 2026",
    slug: "nmmss",
  },
  {
    id: "s2",
    name: "Central Sector Scheme (CSS) Top Class",
    provider: "Ministry of Education",
    amount: "Up to ₹2 L/year",
    deadline: "31 Dec 2026",
    slug: "top-class-scholarship",
  },
  {
    id: "s3",
    name: "State Medical & Dental Scholarship",
    provider: "Karnataka Government",
    amount: "₹50,000/year",
    deadline: "30 Nov 2026",
    slug: "karnataka-medical-scholarship",
  },
  {
    id: "s4",
    name: "Merit-cum-Means Engineering Scholarship",
    provider: "AICTE",
    amount: "₹25,000/year",
    deadline: "15 Dec 2026",
    slug: "aicte-merit-cum-means",
  },
];

export const upcomingExams: Exam[] = [
  { id: "e1", name: "NEET UG 2026", date: "03 May 2026", status: "Application Open", slug: "neet-2026" },
  { id: "e2", name: "JEE Main 2026 Session 2", date: "02 Apr 2026", status: "Application Open", slug: "jee-main-2026" },
  { id: "e3", name: "KCET 2026", date: "20 Apr 2026", status: "Registration Open", slug: "kcet-2026" },
  { id: "e4", name: "CUET UG 2026", date: "15 May 2026", status: "Expected", slug: "cuet-2026" },
];

export const mockTests: MockTest[] = [
  { id: "m1", name: "NEET UG Full Mock Test", questions: 200, duration: 180, mode: "Standard", slug: "neet-full-mock" },
  { id: "m2", name: "NEET UG Proctored Mock", questions: 200, duration: 180, mode: "Proctored", slug: "neet-proctored-mock" },
  { id: "m3", name: "JEE Main Sectional Test", questions: 75, duration: 90, mode: "Standard", slug: "jee-sectional-mock" },
  { id: "m4", name: "KCET Full Mock Test", questions: 180, duration: 150, mode: "Standard", slug: "kcet-full-mock" },
];

export const reviews: Review[] = [
  {
    id: "r1",
    name: "Ananya Sharma",
    course: "B.Sc Nursing",
    college: "AIIMS Delhi",
    rating: 4.8,
    text: "The college predictor helped me shortlist nursing colleges within budget. Placement data made the decision easy.",
    role: "Nursing Student",
  },
  {
    id: "r2",
    name: "Parth Gupta",
    course: "B.Tech CSE",
    college: "IIT Bombay",
    rating: 4.7,
    text: "Mock tests with the proctored mode feel like the real exam. Auto-save meant I never lost answers even on a weak network.",
    role: "Frontend Developer",
  },
  {
    id: "r3",
    name: "Priya Mishra",
    course: "BAMS",
    college: "State Ayurveda College",
    rating: 4.9,
    text: "AI assistant answered every admission question with sources. Felt like talking to an expert counsellor 24x7.",
    role: "AYUSH Aspirant",
  },
  {
    id: "r4",
    name: "Akshat Sahu",
    course: "B.Tech IT",
    college: "NIT Bhopal",
    rating: 4.6,
    text: "The best institute & platform guidance. I have learnt a lot by coming here and gained deep technical confidence.",
    role: "Software Developer",
  },
  {
    id: "r5",
    name: "Om Singhal",
    course: "B.Tech CSE",
    college: "IIIT Hyderabad",
    rating: 4.4,
    text: "Padhaanewala is the best place to learn online! I am currently learning advanced backend development & system design.",
    role: "Backend Developer",
  },
  {
    id: "r6",
    name: "Aditya Kumar",
    course: "B.Pharm",
    college: "BIT Mesra",
    rating: 4.5,
    text: "We proudly share our teaching and learning journey with Padhaanewala. Verified fee and cutoff data saved us from wrong info.",
    role: "Coding Mentor",
  },
  {
    id: "r7",
    name: "Honey Atalkar",
    course: "Software Engineering",
    college: "Sheryians Coding School",
    rating: 4.8,
    text: "Padhaanewala is the best place to learn coding! The mentors explain every single concept step-by-step with real projects.",
    role: "Software Engineering Student",
  },
  {
    id: "r8",
    name: "Sneha Verma",
    course: "MBBS",
    college: "Maulana Azad Medical College",
    rating: 4.9,
    text: "The NEET score calculator and state counselling cutoffs were spot on. Got my dream medical college seat smoothly!",
    role: "Medical Intern",
  },
  {
    id: "r9",
    name: "Rohan Mehta",
    course: "B.Arch",
    college: "SPA Delhi",
    rating: 4.7,
    text: "Finding accurate portfolio requirements and NATA cutoffs was effortless. The guidance saved me months of confusion.",
    role: "Architecture Student",
  },
  {
    id: "r10",
    name: "Kavya Reddy",
    course: "BDS",
    college: "Manipal Dental Sciences",
    rating: 4.8,
    text: "Scholarship finder helped me secure financial assistance for my tuition fees. Truly a lifesaver for students!",
    role: "Dental Aspirant",
  },
  {
    id: "r11",
    name: "Devansh Joshi",
    course: "B.Tech ECE",
    college: "DTU New Delhi",
    rating: 4.6,
    text: "Interactive mock tests and real-time performance analytics helped me pinpoint weaknesses right before JEE Main.",
    role: "Electronics Student",
  },
  {
    id: "r12",
    name: "Ishita Kapoor",
    course: "BA LL.B",
    college: "NLSIU Bengaluru",
    rating: 4.9,
    text: "Comprehensive CLAT preparation strategies and verified college rankings helped me rank in the top 100 nationwide.",
    role: "Law Scholar",
  },
];

export const articles: Article[] = [
  {
    id: "a1",
    title: "NEET UG 2026: Complete Guide to Application, Pattern & Cutoffs",
    category: "Exams",
    readTime: "8 min read",
    slug: "neet-ug-2026-complete-guide",
  },
  {
    id: "a2",
    title: "BAMS vs BHMS vs BUMS: Which AYUSH Course is Right After 12th?",
    category: "Careers",
    readTime: "6 min read",
    slug: "bams-vs-bhms-vs-bums",
  },
  {
    id: "a3",
    title: "How to Read JoSAA Cutoff Rounds for JEE Counselling",
    category: "Counselling",
    readTime: "5 min read",
    slug: "how-to-read-josaa-cutoff-rounds",
  },
  {
    id: "a4",
    title: "Top Nursing Colleges in India with Placement Data (2026)",
    category: "College Guides",
    readTime: "10 min read",
    slug: "top-nursing-colleges-india-2026",
  },
];

export const heroExamples = [
  "BHMS",
  "BAMS",
  "MBBS",
  "BDS",
  "B.Sc Nursing",
  "B.Pharm",
  "BCA",
  "Engineering",
];