import type { BlogCategory, BlogPost } from "@/lib/types";

export const BLOG_CATEGORIES: BlogCategory[] = [
  "Admissions",
  "NEET",
  "AYUSH",
  "Nursing",
  "Scholarships",
  "Careers",
  "Exams",
  "College Guides",
  "Education News",
];

export const BLOG_POSTS: BlogPost[] = [
  {
    id: "bl01",
    slug: "jee-main-vs-jee-advanced-difference",
    title: "JEE Main vs JEE Advanced: What's the Real Difference?",
    category: "Exams",
    excerpt:
      "Both tests decide admission to India's top engineering institutes, but they serve different purposes. Here's exactly how they differ and who should take which.",
    content: [
      "Every year, lakhs of students appear for JEE Main hoping to secure a seat in an engineering college. But only a tiny fraction will also sit for JEE Advanced. Understanding the difference between the two is the first step to planning your preparation.",
      "JEE Main is the qualifying and ranking exam for NITs, IIITs and GFTIs. It is conducted twice a year by the NTA in computer-based mode. JEE Advanced, on the other hand, is conducted once a year by an IIT and is the sole route into the 23 IITs.",
      "Only the top 2.5 lakh JEE Main rank holders are eligible to appear for JEE Advanced, and a candidate can attempt it in at most two consecutive years.",
      "The difficulty gap is significant. JEE Main tests your command of the Class 11 and 12 syllabus, while JEE Advanced pushes conceptual depth with multi-skill, matrix-match and integer-type questions that reward problem-solving ability over rote memory.",
      "Your strategy should match your goal. If NITs or IIITs are the target, JEE Main alone is enough. If you want an IIT, treat JEE Main as the gate and spend the intermediate weeks on advanced problem types and speed.",
    ],
    author: "Dr. Ananya Sharma",
    authorRole: "Education Counsellor",
    date: "2026-09-02",
    readTime: "6 min read",
    tags: ["JEE", "Engineering", "Exams"],
    featured: true,
  },
  {
    id: "bl02",
    slug: "neet-ug-2027-eligibility-criteria",
    title: "NEET UG 2027: Complete Eligibility Criteria Explained",
    category: "NEET",
    excerpt:
      "From age limits to qualifying marks and AYUSH courses — everything you must check before filling the NEET UG 2027 form.",
    content: [
      "NEET UG remains the single gateway for MBBS, BDS and AYUSH courses in India. While the exam pattern rarely changes, eligibility criteria are revised from time to time and mistakes here can cost an entire year.",
      "You must have passed Class 12 (or equivalent) with Physics, Chemistry, Biology/Biotechnology and English as core subjects. General candidates need at least 50% in Class 12, while OBC/SC/ST candidates need 40% and PwBD candidates 45%.",
      "There is no upper age limit for NEET UG. For BHMS, BAMS and other AYUSH programs, NEET scores are made available to the respective counselling bodies for allotment.",
      "Keep your documents ready: Aadhaar, Class 10 and 12 marksheets, category certificate (if applicable) and a passport-size photo. Errors in name or date of birth in the OTP form can delay counselling.",
      "Watch the official NTA website for the exact registration window. Early preparation of documents and a checklist for each step reduces the stress that causes most application errors.",
    ],
    author: "Vikram Nair",
    authorRole: "Medical Admissions Expert",
    date: "2026-08-28",
    readTime: "5 min read",
    tags: ["NEET", "Medical", "Admissions"],
    featured: true,
  },
  {
    id: "bl03",
    slug: "bams-vs-bhms-which-ayush-course",
    title: "BAMS vs BHMS: Which AYUSH Course Is Right for You?",
    category: "AYUSH",
    excerpt:
      "Both pathways lead to a rewarding career in alternative medicine, but the philosophies, durations and practice scopes differ. Compare them side by side.",
    content: [
      "AYUSH courses have grown in popularity as more students look toward holistic and preventive healthcare. BAMS (Ayurveda) and BHMS (Homeopathy) are the two most commonly confused programs.",
      "BAMS is a 5.5-year program (4.5 years academics + 1 year internship) teaching Ayurvedic medicine grounded in the principles of Tridosha. BHMS is also 5.5 years but follows Samuel Hahnemann's principle of 'like cures like'.",
      "Both require NEET UG for admission. Career paths diverge: BAMS graduates often work in Ayurvedic hospitals, wellness centres and regulatory labs, while BHMS graduates practise in homeopathy clinics, OPDs and state homeopathy departments.",
      "Scope and expansion: AYUSH departments at the central and state levels have added thousands of posts, and insurance cover for AYUSH treatment has boosted private practice demand.",
      "Choose based on interest, not pressure. Spend time reading the syllabi, speaking to practitioners and understanding which college you can realistically secure with your NEET percentile.",
    ],
    author: "Dr. Meera Pillai",
    authorRole: "AYUSH Admissions Advisor",
    date: "2026-08-15",
    readTime: "7 min read",
    tags: ["AYUSH", "BAMS", "BHMS", "NEET"],
    featured: false,
  },
  {
    id: "bl04",
    slug: "bsc-nursing-colleges-and-courses",
    title: "B.Sc Nursing: Top Colleges, Eligibility and Career Scope",
    category: "Nursing",
    excerpt:
      "Nursing is one of the most stable and globally mobile healthcare careers in India. Here is how to get into a good B.Sc Nursing program.",
    content: [
      "Healthcare staffing gaps in India and abroad have made B.Sc Nursing one of the most employable degrees today. Government hospitals, corporate hospital groups and international recruiters all hire Indian nursing graduates in large numbers.",
      "B.Sc Nursing is a 4-year degree (6 months internship) requiring Class 12 with Physics, Chemistry and Biology, and at least 45% aggregate. Admission is through NEET-based allotment or college-level entrance exams depending on the institution.",
      "Reputed government colleges like AIIMS, JIPMER and state nursing colleges offer the most affordable, high-quality training, while private institutes charge higher fees but offer strong clinical exposure through associated hospitals.",
      "After graduation you can work as a staff nurse, become a nurse educator, specialise in critical care or pursue MSc Nursing. Registered Nurse licensing via the State Nursing Council is mandatory to practise.",
      "Use our college compare tool to weigh hospitals, clinical exposure and fee structures before shortlisting your five nursing colleges.",
    ],
    author: "Sneha Reddy",
    authorRole: "Nursing Education Counsellor",
    date: "2026-08-08",
    readTime: "6 min read",
    tags: ["Nursing", "B.Sc Nursing", "Careers"],
    featured: false,
  },
  {
    id: "bl05",
    slug: "top-scholarships-for-engineering-students",
    title: "Top 10 Scholarships Engineering Students in India Must Not Miss",
    category: "Scholarships",
    excerpt:
      "From central government schemes to corporate foundations, a surprising number of engineering students never apply for scholarships. Here are the ones that matter.",
    content: [
      "Tuition costs for private engineering colleges keep rising, but scholarships remain massively underclaimed. Central schemes, state boards and corporate trusts together fund lakhs of students every year.",
      "The NSP (National Scholarship Portal) is your single gateway to central scholarships like the Central Sector Scheme for SC students, Post-Matric Scholarships for OBC and the Pragati/Saksham scheme for girls.",
      "Corporate foundations — Reliance Foundation, Tata Trusts, Kotak, HDFC Parivartan and others — run merit-cum-means scholarships that can cover up to full tuition. Their deadlines are often earlier than you expect.",
      "A common mistake is ignoring scholarships because 'the amount is small'. A ₹20,000 grant still covers books, accommodation and exam fees, and multiple scholarships can be combined if the rules permit.",
      "Bookmark the scholarship calendar dates on this site, set reminders, and keep scanned copies of income and marks certificates ready so you never miss a deadline.",
    ],
    author: "Rohit Malhotra",
    authorRole: "Financial Aid Specialist",
    date: "2026-07-30",
    readTime: "8 min read",
    tags: ["Scholarships", "Money", "Admissions"],
    featured: true,
  },
  {
    id: "bl06",
    slug: "which-btech-branch-has-best-future",
    title: "Which B.Tech Branch Has the Best Future in 2027?",
    category: "Careers",
    excerpt:
      "CSE vs ECE vs Mechanical vs AI — the right branch depends on your interests, the industry cycle and your placement priorities. We break it down.",
    content: [
      "The branch you choose shapes not just your coursework but your first job, your peer network and even your postgraduate options. So it deserves more than a shortcut answer.",
      "Computer Science remains the largest recruiter magnet with the highest average packages, but it is also the most saturated. ECE straddles hardware and software and feeds exactly the semiconductor and telecom boom India is targeting.",
      "Mechanical and civil are core branches with steady demand in manufacturing, infrastructure and energy, and they face far less IT layoff cyclicality. AI/ML and data science specialisations are new, hot, but still maturing in course quality.",
      "The honest advice: pick CSE only if you enjoy coding, pick core branches if labs and machines excite you, and check the placement history of each branch at the specific colleges you shortlist — college matters as much as branch.",
      "Our college detail pages show branch-wise placements and fees, and the predictor can rank your matches by your branch preference.",
    ],
    author: "Prof. Karthik Subramanian",
    authorRole: "Engineering Faculty & Placement Mentor",
    date: "2026-07-18",
    readTime: "9 min read",
    tags: ["Careers", "B.Tech", "Placements"],
    featured: false,
  },
  {
    id: "bl07",
    slug: "joosa-counselling-process-step-by-step",
    title: "JoSAA Counselling 2027: Step-by-Step Guide",
    category: "Admissions",
    excerpt:
      "Don't let the portal confuse you on the most important days of your admission. Understand registration, choice filling and locking in six clear steps.",
    content: [
      "JoSAA handles seat allotment for JEE Advanced (IITs) and JEE Main (NITs, IIITs, GFTIs). The process happens in multiple rounds, and each round has a fixed sequence.",
      "Step 1: Register on the JoSAA portal with your JEE credentials. Step 2: Fill your choices — order them by true preference, not by expected cutoff.",
      "Step 3: Lock your choices before the deadline; unlocking during later rounds is allowed only per the published schedule. Step 4: After each round, you are allotted the best available choice or floated for the next round.",
      "Step 5: If you are happy with a seat, report to the allotted institute with documents for verification. Step 6: Pay the seat acceptance fee to secure your seat.",
      "The single biggest mistake is not filling enough choices. Fewer choices means a higher chance of being exited from the process. Fill the maximum possible — you can always reject a lower preference later.",
    ],
    author: "Varun Kapoor",
    authorRole: "Engineering Admissions Counsellor",
    date: "2026-07-02",
    readTime: "7 min read",
    tags: ["JoSAA", "Counselling", "Admissions", "IIT", "NIT"],
    featured: false,
  },
  {
    id: "bl08",
    slug: "cuet-vs-nios-vs-board-exam",
    title: "CUET UG vs Class 12 Boards: What Universities Actually Look At",
    category: "College Guides",
    excerpt:
      "With CUET replacing board-based merit in most central universities, which score matters more? Understand the new admission equation for DU and other CUET universities.",
    content: [
      "Until a few years ago, Delhi University admitted on board merit. Now, most prestigious central universities largely admit undergraduate students through CUET UG scores.",
      "CUET is a computer-based test conducted by the NTA covering language, domain subjects and a general test. Your best CUET subject scores (per the program's formula) determine your merit list position.",
      "Class 12 board marks still matter for eligibility — you must pass the qualifying exam — but the CUET score is what puts you on the merit list. A strong board score alone will no longer guarantee a seat.",
      "The implication for preparation: treat CUET as a separate exam with its own pattern and syllabus, and register early to choose the right subject combination for the courses you want.",
      "Use our exam explorer to review CUET dates and pattern, and our blog category filters to find subject-specific preparation guides.",
    ],
    author: "Ishita Gupta",
    authorRole: "University Admissions Expert",
    date: "2026-06-20",
    readTime: "5 min read",
    tags: ["CUET", "DU", "Admissions", "University"],
    featured: false,
  },
  {
    id: "bl09",
    slug: "education-loan-process-india",
    title: "Education Loans in India: A Complete Beginner's Guide",
    category: "Scholarships",
    excerpt:
      "How much can you borrow for a professional degree? What collateral is needed? And how do interest subsidies work? Your loan questions answered.",
    content: [
      "An education loan can bridge the gap between your family budget and the cost of a professional degree. Understanding how banks structure these loans is the first step.",
      "Most public-sector banks offer loans up to ₹20 lakh without collateral for study in India, and up to ₹7.5 lakh for overseas study, with higher limits above that requiring collateral of some kind.",
      "Interest subsidies matter enormously: the Central Sector Interest Subsidy and the new OBC/EWS schemes can waive interest during the moratorium period for eligible students.",
      "Repayment typically starts six months to one year after you complete the course or get a job — whichever is earlier. Longer tenures lower the EMI but increase total interest.",
      "Paperwork is straightforward when you are organised: admission letter, fee structure, proofs of family income, and KYC documents. Compare at least three lenders before choosing.",
    ],
    author: "Anita Deshmukh",
    authorRole: "Education Finance Analyst",
    date: "2026-06-05",
    readTime: "6 min read",
    tags: ["Loans", "Scholarships", "Finance"],
    featured: false,
  },
  {
    id: "bl10",
    slug: "state-colleges-vs-private-universities",
    title: "State Engineering Colleges vs Private Universities: An Honest Comparison",
    category: "College Guides",
    excerpt:
      "Lower fees and legacy brands versus modern campuses and flexible rules — which trade-off makes sense for you? We weigh five crucial dimensions.",
    content: [
      "This is one of the most common dilemmas for engineering aspirants: a government college with a reputed name and low fees, or a private university with a fancy campus and high fees.",
      "Fee: state government colleges can cost 5–10× less than good private universities. But total cost of ownership also includes hostels, coaching and opportunity cost — do the full math.",
      "Placements: the top government institutes (NITs, IIITs, older RECs) post outstanding records. Many private universities match them for a few leading branches but rarely for the whole batch.",
      "Campus life and flexibility: private universities usually offer better infrastructure, attendance flexibility and industry internships; state colleges can feel rigid but build strong peer networks.",
      "Our verdict: shortlist on placement data and your branch's prospects, then compare fee and campus quality. The College Predictor can map your rank against both segments instantly.",
    ],
    author: "Dev Rathore",
    authorRole: "Career Strategist",
    date: "2026-05-22",
    readTime: "7 min read",
    tags: ["College Guides", "Careers", "Fees"],
    featured: false,
  },
  {
    id: "bl11",
    slug: "nail-the-mock-test-strategy",
    title: "How to Use Mock Tests to Boost Your Rank (Not Just Practice)",
    category: "Exams",
    excerpt:
      "Attempting hundreds of mocks with no review burns time. Here is the revision loop that turns every mock into a ranking weapon.",
    content: [
      "Mock tests are the closest thing to exam conditions you can get from your desk. But their real value lies in the analysis you do after the timer stops.",
      "Start with a baseline mock two months before the exam to identify weak chapters. Then set a weekly rhythm: one full-length mock, followed the same evening by a structured review.",
      "Categorise every mistake as a concept gap, a speed gap, a silly error or a guessing error. Concept gaps need syllabus revision; silly errors need a read-it-twice habit; guessing errors need a skip rule.",
      "Track your score, accuracy and time-per-section in a simple table. A rising accuracy with a falling attempt rate means your selection skill is improving — exactly what rank lists reward.",
      "Use the free mocks in this platform, and always match the timer and marking scheme of the real exam you are preparing for.",
    ],
    author: "Karan Mehta",
    authorRole: "Exam Strategy Coach",
    date: "2026-05-10",
    readTime: "5 min read",
    tags: ["Mock Tests", "Exams", "Strategy"],
    featured: false,
  },
  {
    id: "bl12",
    slug: "ayush-courses-list-and-careers",
    title: "Ayush Courses List 2027: AYUSH, BHMS, BUMS and Career Paths",
    category: "Education News",
    excerpt:
      "AYUSH courses have doubled in intake over the last decade. Here's the full list of streams, colleges and the careers that follow.",
    content: [
      "AYUSH is the umbrella term for Ayurveda, Yoga and Naturopathy, Unani, Siddha and Homeopathy. Together they make up one of the fastest-growing segments of healthcare education in India.",
      "The major degree programs are BAMS (Ayurveda), BHMS (Homeopathy), BUMS (Unani), BSMS (Siddha), BNYS (Yoga and Naturopathy), and B.Sc Nursing is often grouped with them for NEET counselling purposes.",
      "Admission to all AYUSH undergraduate programs is through NEET UG, followed by state or central counselling depending on the college's affiliation.",
      "Graduates can work in government AYUSH hospitals, wellness centres, research councils (CCRAS, CCRH), or open private clinics. The Ministry of AYUSH has substantially increased post creation and research funding.",
      "If you are building a medical career and like the philosophy of holistic care, explore AYUSH seriously — the seat-to-demand ratio is far more favourable than MBBS.",
    ],
    author: "Sana Quazi",
    authorRole: "Healthcare Education Researcher",
    date: "2026-04-28",
    readTime: "6 min read",
    tags: ["AYUSH", "NEET", "Careers", "News"],
    featured: false,
  },
];

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