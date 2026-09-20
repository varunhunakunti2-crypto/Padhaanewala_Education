import type { NotificationItem } from "@/lib/types";

export const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n01",
    title: "JEE Main Session 1 registration is open",
    message: "Applications for JEE Main 2027 Session 1 are now live on the NTA portal.",
    date: "2026-09-15",
    read: false,
    type: "exam",
  },
  {
    id: "n02",
    title: "Scholarship deadline approaching",
    message: "The Reliance Foundation Scholarship application closes in 10 days.",
    date: "2026-09-12",
    read: false,
    type: "scholarship",
  },
  {
    id: "n03",
    title: "AI College Predictor is now live",
    message: "Enter your entrance rank and get a personalised list of suitable colleges.",
    date: "2026-09-08",
    read: false,
    type: "general",
  },
  {
    id: "n04",
    title: "Admission counselling slots available",
    message: "Book a free call with our counsellors to plan your admissions strategy.",
    date: "2026-09-01",
    read: true,
    type: "admission",
  },
  {
    id: "n05",
    title: "VITEEE registrations have opened",
    message: "VIT has begun accepting applications for VITEEE 2027 across all campuses.",
    date: "2026-08-24",
    read: true,
    type: "exam",
  },
];

export const AI_SUGGESTED_QUESTIONS: string[] = [
  "What is BHMS?",
  "Difference between BAMS and BHMS?",
  "Which course is suitable after 12th science?",
  "Which colleges offer B.Sc Nursing?",
  "What scholarships are available for engineering?",
  "How does college admission work through JoSAA?",
  "What is the best branch after 12th PCM?",
  "Tell me about JEE Main vs BITSAT",
];

export const AI_FALLBACK_RESPONSES: Record<string, string> = {
  "what is bhms": "BHMS stands for Bachelor of Homeopathic Medicine and Surgery. It is a 5.5-year undergraduate degree (4.5 years academics + 1 year internship) that trains students in the principles of homeopathy, a system of alternative medicine founded by Samuel Hahnemann. Admission to BHMS in India is through NEET UG. Careers include practising as a homeopathic doctor, working in government/state homeopathy departments, or pursuing higher studies like MD (Homeopathy).",
  "bams": "BAMS (Bachelor of Ayurvedic Medicine and Surgery) is a 5.5-year undergraduate program in Ayurveda, combining the ancient Tridosha-based system with modern diagnostic training. Admission requires NEET UG. BAMS graduates work in Ayurvedic hospitals, wellness centres, research institutes (CCRAS) and private practice.",
  "difference between bams and bhms": "BAMS and BHMS are both 5.5-year AYUSH medical degrees, but they differ in philosophy: BAMS follows Ayurveda's Tridosha system (Vata, Pitta, Kapha), while BHMS follows homeopathy's 'like cures like' principle. BAMS leans on herbal and lifestyle treatments; BHMS uses ultra-diluted remedies. Both require NEET UG and both allow clinical practice, but their state councils, curricula and typical career tracks are different.",
  "which course is suitable after 12th": "It depends on your stream and interest. With PCM you can choose B.Tech (CSE, ECE, Mechanical, AI/ML), B.Arch, B.Sc Mathematics/Physics, or defence academies. With PCB you can pursue MBBS (NEET), BDS, AYUSH courses (BAMS/BHMS/BUMS), B.Sc Nursing or B.Pharm. Commerce students lean to B.Com, BBA, CA/CS, while Humanities students often choose BA, law (CLAT) or design. Matching your aptitude with placement data of colleges is the smartest way to decide.",
  "which colleges offer bsc nursing": "Many reputed institutions offer B.Sc Nursing in India, including AIIMS New Delhi, JIPMER Puducherry, CMC Vellore, AFMC Pune, and state government nursing colleges, plus private institutes like Manipal College of Nursing and SRM. Admission is typically through NEET UG or institute-level entrance exams. Government colleges offer the same degree at a fraction of private fees.",
  "scholarships": "There are many scholarships for Indian students. Central schemes run through the National Scholarship Portal (NSP), including the Central Sector Scheme for SC students, Post-Matric OBC and the Pragati scheme for girls in technical education. Corporate foundations like Reliance, Tata Trusts, Kotak and HDFC Parivartan offer merit-cum-means grants. State boards and individual colleges add more. Track their deadlines here on the scholarships page.",
  "how does college admission work": "For engineering: JEE Main leads to NITs/IIITs/GFTIs, JEE Advanced leads to IITs, and BITSAT/VITEEE/SRMJEEE open private institutes. For medical: NEET UG is the single gate to MBBS/BDS/AYUSH. For law: CLAT covers the NLUs. Most national counselling is centralised (JoSAA for engineering, MCC for medical), where you register, fill choices and accept allotments round by round.",
  "jee main vs bitsat": "JEE Main is the national exam for NITs, IIITs and GFTIs (and the qualifier for JEE Advanced/IITs), conducted twice a year. BITSAT is BITS Pilani's own computer-based test for its Pilani, Goa and Hyderabad campuses. BITSAT has 130 questions in 3 hours with negative marking, while JEE Main has 90 questions in 3 hours. The right choice depends on your target colleges — do both if you can, since syllabi overlap heavily.",
  "default": "That's a great question. I can point you to the relevant sections of Padhaanewala: search college details, compare shortlisted institutes, run the AI College Predictor with your rank, browse exam schedules, or book a free call with our counsellors for personalised guidance. Feel free to ask about specific colleges, courses, exams or scholarships.",
};

export function getAiResponse(question: string): string {
  const q = question.toLowerCase().replace(/[?，。!！]/g, " ").trim();
  const compact = q.replace(/\s+/g, " ");
  let best = AI_FALLBACK_RESPONSES["default"];
  let bestScore = 0;
  for (const key of Object.keys(AI_FALLBACK_RESPONSES)) {
    if (key === "default") continue;
    const k = key.replace(/\s+/g, " ");
    if (compact.includes(k) && k.length > bestScore) {
      best = AI_FALLBACK_RESPONSES[key];
      bestScore = k.length;
    }
  }
  return best;
}