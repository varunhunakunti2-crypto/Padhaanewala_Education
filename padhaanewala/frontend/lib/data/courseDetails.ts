import type { Faq } from "@/lib/types";

export interface CourseDetailMeta {
  slug: string;
  eligibility: string[];
  admissionProcedure: string[];
  entranceExams: string[];
  entranceExamNote: string;
  careerOpportunities: string[];
  careerSectors: string[];
  topRecruiters: string[];
  faqs: Faq[];
  relatedSlugs: string[];
}

export const COURSE_DETAILS: Record<string, CourseDetailMeta> = {
  "btech-computer-science": {
    slug: "btech-computer-science",
    eligibility: [
      "Class 12 with Physics, Chemistry and Mathematics (10+2)",
      "Minimum 75% aggregate for NITs / IIITs (65% for reserved categories)",
      "Valid JEE Main / JEE Advanced / BITSAT / state CET rank",
    ],
    admissionProcedure: [
      "Appear for JEE Main (twice a year) for NIT/IIIT/GFTI seats",
      "Top ~2.5 lakh JEE Main rank holders qualify for JEE Advanced (IITs)",
      "Register for JoSAA counselling and fill college + branch choices",
      "Seats allotted round-wise; accept, freeze or float and pay the seat acceptance fee",
    ],
    entranceExams: ["JEE Main", "JEE Advanced", "BITSAT", "VITEEE", "SRMJEEE", "WBJEE", "MHT-CET"],
    entranceExamNote:
      "JEE Main is the primary entrance test. Private institutes also accept BITSAT, VITEEE and SRMJEEE. Admission is almost always through centralised counselling.",
    careerOpportunities: [
      "Software Development Engineer",
      "Data Scientist / ML Engineer",
      "Systems Engineer",
      "DevOps / Cloud Engineer",
      "Full-Stack Developer",
      "Product Engineer at startups & MNCs",
    ],
    careerSectors: ["IT Services", "Product Companies", "Fintech", "Consulting", "Government & PSU", "Research"],
    topRecruiters: ["Google", "Microsoft", "Amazon", "Meta", "Qualcomm", "TCS", "Infosys"],
    faqs: [
      { q: "Is CSE the best engineering branch?", a: "CSE has the highest average packages and the largest recruiter base, but the 'best' branch depends on your interest. Core branches like ECE and Mechanical have steady demand in their industries." },
      { q: "Which exam gives admission to B.Tech CSE?", a: "JEE Main/Advanced for NIT/IIT/IIIT, and BITSAT, VITEEE, SRMJEEE etc. for private institutes." },
      { q: "What is the average fee for CSE?", a: "Government colleges can cost under ₹1.5L per year while top private institutes range from ₹2L to ₹6L per year." },
    ],
    relatedSlugs: ["btech-artificial-intelligence", "btech-electronics", "bsc-computer-science", "mba"],
  },
  "mba": {
    slug: "mba",
    eligibility: [
      "Bachelor's degree in any discipline with 50% aggregate (45% for reserved categories)",
      "Final-year students can apply provisionally",
      "Valid CAT / CMAT / XAT / MAT / GMAT score",
    ],
    admissionProcedure: [
      "Register and appear for CAT (IIMs) or a portfolio of other exams",
      "Meet section-wise percentile cutoffs of your target B-schools",
      "Shortlisted candidates appear for Written Ability Test (WAT) and Personal Interview",
      "Final selection combines entrance score, academics, work experience and interview",
    ],
    entranceExams: ["CAT", "CMAT", "XAT", "MAT", "ATMA", "GMAT"],
    entranceExamNote:
      "CAT is the gateway to IIMs and 1,200+ B-schools. For regional and private institutes, CMAT, MAT and XAT are widely accepted.",
    careerOpportunities: [
      "Management Consultant",
      "Product Manager",
      "Investment Banker",
      "Brand Manager",
      "Operations Lead",
      "Business Analyst",
    ],
    careerSectors: ["Consulting", "Banking & Finance", "Marketing", "Operations", "IT Services", "Startups"],
    topRecruiters: ["McKinsey", "BCG", "Bain", "Goldman Sachs", "Amazon", "HUL", "Flipkart"],
    faqs: [
      { q: "Is CAT required for all MBA colleges?", a: "No. CAT is for IIMs and many top schools, but CMAT, MAT, XAT and ATMA are accepted by many government and private B-schools." },
      { q: "What percentile is needed for a good IIM?", a: "Top IIMs typically call candidates with 98+ percentile (General). Non-engineers and work-experienced candidates benefit from profile-based cutoffs." },
      { q: "Can arts/commerce students do an MBA?", a: "Yes, MBA is open to graduates from any stream. Work experience and CAT/XAT scores matter more than the undergraduate branch." },
    ],
    relatedSlugs: ["bba", "btech-computer-science", "phd"],
  },
  "btech-artificial-intelligence": {
    slug: "btech-artificial-intelligence",
    eligibility: [
      "Class 12 with Physics, Chemistry and Mathematics",
      "75% aggregate for top institutes (65% for reserved categories)",
      "Valid entrance exam rank (JEE Main / VITEEE / SRMJEEE etc.)",
    ],
    admissionProcedure: [
      "Take JEE Main or a private university entrance exam (VITEEE, SRMJEEE, MET)",
      "Apply to institutes offering dedicated AI/ML streams",
      "Allotment through JoSAA or the institute's own counselling",
      "Confirm admission by paying the acceptance fee",
    ],
    entranceExams: ["JEE Main", "VITEEE", "SRMJEEE", "MET", "BITSAT"],
    entranceExamNote:
      "AI/ML is offered as a dedicated branch at many private universities and increasingly at NITs/IIITs.",
    careerOpportunities: [
      "ML Engineer",
      "AI Research Scientist",
      "Data Scientist",
      "NLP Engineer",
      "Computer Vision Engineer",
      "MLOps Engineer",
    ],
    careerSectors: ["Technology", "Healthcare AI", "Finance", "Autonomous Systems", "Robotics", "Research"],
    topRecruiters: ["Google", "Microsoft", "Amazon", "NVIDIA", "Samsung", "TCS"],
    faqs: [
      { q: "Is AI/ML a good branch for placements?", a: "Demand for ML engineers is growing fast with premium packages, but you must build strong maths and coding fundamentals alongside the degree." },
      { q: "Which exams accept B.Tech AI admissions?", a: "JEE Main for NIT/IIIT seats; VITEEE, SRMJEEE, MET and BITSAT for private institutes." },
    ],
    relatedSlugs: ["btech-computer-science", "bsc-computer-science", "btech-electronics"],
  },
  "btech-electronics": {
    slug: "btech-electronics",
    eligibility: [
      "Class 12 with Physics, Chemistry and Mathematics",
      "75% aggregate for NITs/IIITs (65% reserved)",
      "Valid JEE Main / state CET rank",
    ],
    admissionProcedure: [
      "Appear for JEE Main or your state's engineering CET (MHT-CET, WBJEE, KEAM)",
      "Fill ECE preferences during counselling",
      "Seat allotment based on rank and category",
      "Report to the allotted institute for verification",
    ],
    entranceExams: ["JEE Main", "MHT-CET", "WBJEE", "KEAM", "SRMJEEE"],
    entranceExamNote: "ECE admissions mostly run through JEE Main (central counselling) or state-level CETs.",
    careerOpportunities: [
      "VLSI Design Engineer",
      "Embedded Systems Engineer",
      "Signal Processing Engineer",
      "Semiconductor Engineer",
      "Telecom Engineer",
    ],
    careerSectors: ["Semiconductors", "Telecom", "Consumer Electronics", "Automotive", "Defence & Aerospace"],
    topRecruiters: ["Qualcomm", "Intel", "Texas Instruments", "Broadcom", "Samsung", "ISRO"],
    faqs: [
      { q: "ECE vs EEE — what's the difference?", a: "ECE focuses on electronics and communication systems; EEE includes electrical power systems. ECE is closer to the semiconductor and telecom boom." },
      { q: "Is ECE good for software jobs?", a: "Yes, many ECE graduates work in software after picking up programming skills, since their math and logic base is strong." },
    ],
    relatedSlugs: ["btech-computer-science", "btech-mechanical", "btech-artificial-intelligence"],
  },
  "btech-mechanical": {
    slug: "btech-mechanical",
    eligibility: [
      "Class 12 with Physics, Chemistry and Mathematics",
      "Minimum eligibility per the counselling authority (usually 45–75% depending on institute)",
      "Valid JEE Main / MHT-CET / WBJEE / KEAM rank",
    ],
    admissionProcedure: [
      "Take JEE Main or the relevant state CET",
      "Register for counselling and choose Mechanical branch",
      "Seats allotted per rank and category",
      "Complete document verification and fee payment",
    ],
    entranceExams: ["JEE Main", "MHT-CET", "WBJEE", "KEAM", "GATE (PG)"],
    entranceExamNote: "UG admission via JEE Main/state CETs; GATE qualifies you for M.Tech and PSU recruitment.",
    careerOpportunities: [
      "Design Engineer",
      "Manufacturing Engineer",
      "Robotics Engineer",
      "Automotive Engineer",
      "Thermal Engineer",
      "Quality Engineer",
    ],
    careerSectors: ["Automotive", "Manufacturing", "Energy", "Aerospace", "Robotics", "Public Sector (ONGC, NTPC)"],
    topRecruiters: ["Tata Motors", "Maruti Suzuki", "Bosch", "Mahindra", "L&T", "Cummins"],
    faqs: [
      { q: "Is mechanical engineering saturated?", a: "Core mechanical roles are stable rather than explosive, but demand in manufacturing, EVs, energy and robotics keeps growing." },
      { q: "Can mechanical students get software jobs?", a: "Yes, with coding skills mechanical engineers get into IT, analytics and product roles every year." },
    ],
    relatedSlugs: ["btech-electronics", "btech-computer-science", "phd"],
  },
  "bba": {
    slug: "bba",
    eligibility: [
      "Class 12 pass in any stream (Commerce/Science/Arts)",
      "50% aggregate in most institutes; 60%+ for top private universities",
      "Some institutes take DUJAT, IPMAT, SET, NPAT or institute-specific tests",
    ],
    admissionProcedure: [
      "Apply to preferred colleges (DU, IP University, NMIMS, Christ, Symbiosis etc.)",
      "Appear for the entrance test or aptitude test (DUJAT, IPMAT, NPAT, SET)",
      "Shortlisted candidates attend a personal interview",
      "Admission confirmed on the combined merit",
    ],
    entranceExams: ["DUJAT", "IPMAT", "NPAT", "SET", "Christ University Entrance"],
    entranceExamNote: "BBA admissions vary by institute — many are entrance + interview, some are merit-based.",
    careerOpportunities: [
      "Business Analyst",
      "Marketing Executive",
      "HR Associate",
      "Sales Executive",
      "Finance Analyst",
      "Entrepreneur",
    ],
    careerSectors: ["Corporate", "Startups", "Consulting", "Banking", "Retail", "E-commerce"],
    topRecruiters: ["Deloitte", "Amazon", "Flipkart", "HDFC", "Myntra", "Bajaj"],
    faqs: [
      { q: "Is BBA worth it?", a: "Yes, it builds management fundamentals and is a strong base for an MBA or early corporate roles. Placement quality varies widely, so shortlist institutes carefully." },
      { q: "Can a science student do BBA?", a: "Absolutely. BBA is open to all streams and science students often bring strong analytics skills." },
    ],
    relatedSlugs: ["mba", "llb", "bsc-computer-science"],
  },
  "bpharm": {
    slug: "bpharm",
    eligibility: [
      "Class 12 with Physics, Chemistry and Biology or Mathematics",
      "Minimum 45% aggregate (40% reserved)",
      "State CET (MHT-CET PCB) or institute admission for private colleges",
    ],
    admissionProcedure: [
      "Apply for the state pharmacy CET or institute entrance",
      "Appear for counselling for government and aided seats",
      "Private institutes conduct their own merit admission",
      "Complete document verification and fee payment",
    ],
    entranceExams: ["MHT-CET", "AP-EAPCET", "TS-EAMCET", "KEAM", "UPSEE"],
    entranceExamNote: "Pharmacy admissions use the same state CETs as engineering/medical at many states.",
    careerOpportunities: [
      "Pharmacist (Hospital/Retail)",
      "Drug Regulatory Affairs",
      "R&D Scientist",
      "QA/QC Executive",
      "Clinical Research Associate",
      "Medical Representative",
    ],
    careerSectors: ["Pharmaceuticals", "Hospitals", "Clinical Research", "Regulatory Bodies", "Biotech", "Cosmetics"],
    topRecruiters: ["Sun Pharma", "Cipla", "Dr. Reddy's", "Lupin", "Pfizer", "Novartis"],
    faqs: [
      { q: "Is B.Pharm a licensed professional degree?", a: "Yes, you must register with the Pharmacy Council of India / state council to practise as a pharmacist." },
      { q: "Which entrance exam is needed for B.Pharm?", a: "Most states admit through their pharmacy/medical CET; some institutes accept NEET or JEE scores." },
    ],
    relatedSlugs: ["bba", "bsc-computer-science", "phd"],
  },
  "bsc-computer-science": {
    slug: "bsc-computer-science",
    eligibility: [
      "Class 12 (Science) pass; some institutes accept Commerce too",
      "45–60% aggregate depending on the college",
      "Merit-based or entrance (CUET UG for many universities)",
    ],
    admissionProcedure: [
      "For central universities, appear for CUET UG",
      "Other institutes admit on Class 12 merit",
      "Fill counselling/preferences and accept allotment",
      "Complete admission formalities",
    ],
    entranceExams: ["CUET UG", "University-specific admissions"],
    entranceExamNote: "B.Sc CS admissions are largely CUET (central universities) or merit-based at state and private colleges.",
    careerOpportunities: [
      "Software Developer",
      "Data Analyst",
      "Quality Assurance",
      "System Administrator",
      "Research Assistant",
      "Cyber Security Analyst",
    ],
    careerSectors: ["IT Services", "Research", "Education", "Government (UPSC/GATE track)", "Startups"],
    topRecruiters: ["TCS", "Infosys", "Wipro", "Capgemini", "Accenture", "IBM"],
    faqs: [
      { q: "B.Sc CS vs B.Tech CSE — which is better?", a: "B.Tech CSE is engineering-focused with higher fees and placements; B.Sc CS is science-oriented, cheaper, and a great base for M.Sc or an IT career." },
      { q: "Can I do software jobs after B.Sc CS?", a: "Yes, with relevant skills most IT services and product companies hire B.Sc CS graduates as freshers." },
    ],
    relatedSlugs: ["btech-computer-science", "btech-artificial-intelligence", "mba"],
  },
  "b-arch": {
    slug: "b-arch",
    eligibility: [
      "Class 12 with Physics, Chemistry and Mathematics",
      "Minimum 50% aggregate",
      "Qualify NATA or JEE Main Paper 2 (B.Arch)",
    ],
    admissionProcedure: [
      "Appear for NATA (Council of Architecture) or JEE Main Paper 2A",
      "Apply to institutes accepting the score",
      "Seat allotment through the institute/counselling",
      "Portfolio/creative aptitude reviewed where required",
    ],
    entranceExams: ["NATA", "JEE Main Paper 2A"],
    entranceExamNote: "NATA is the primary test. Some institutes admit through JEE Main B.Arch scores.",
    careerOpportunities: [
      "Architect",
      "Urban Planner",
      "Interior Designer",
      "Landscape Architect",
      "Architectural Visualizer",
      "Project Architect",
    ],
    careerSectors: ["Architecture Firms", "Real Estate", "Urban Planning Bodies", "Interior Design", "Construction"],
    topRecruiters: ["Gensler", "Hafeez Contractor", "Krishna Rao", "Foster & Partners", "L&T Construction"],
    faqs: [
      { q: "Is NATA the only exam for B.Arch?", a: "NATA is the main exam; several institutes also accept JEE Main Paper 2A scores." },
      { q: "Is drawing talent necessary for B.Arch?", a: "Yes, creative drawing and design aptitude are central to architecture, though software skills are equally important today." },
    ],
    relatedSlugs: ["btech-mechanical", "bba", "btech-electronics"],
  },
  "integrated-mtech": {
    slug: "integrated-mtech",
    eligibility: [
      "Class 12 with Physics, Chemistry and Mathematics",
      "Strong board scores and JEE Main/CUET as applicable",
      "Admission through institute-specific or national-level entrance",
    ],
    admissionProcedure: [
      "Apply through the institute's admission process",
      "Appear for the entrance/merit admission",
      "Join the integrated 5-year program directly after class 12",
    ],
    entranceExams: ["JEE Main", "CUET", "Institute-specific"],
    entranceExamNote: "Integrated M.Tech programs at NITs/IIITs admit through JEE Main with higher cutoffs.",
    careerOpportunities: ["R&D Engineer", "Research Scientist", "Tech Lead", "Academic Researcher", "Systems Engineer"],
    careerSectors: ["Research", "Academia", "IT Research Labs", "Defence", "Semiconductors"],
    topRecruiters: ["DRDO", "ISRO", "Google Research", "Microsoft Research", "TCS Research"],
    faqs: [
      { q: "Integrated M.Tech vs B.Tech + M.Tech?", a: "Integrated combines both into one 5-year program saving a year, ideal if you are sure about postgraduate education." },
      { q: "Which institutes offer integrated M.Tech?", a: "Several NITs, IIITs and IITs offer integrated M.Tech programs through JEE-based admission." },
    ],
    relatedSlugs: ["btech-computer-science", "phd", "btech-electronics"],
  },
  "llb": {
    slug: "llb",
    eligibility: [
      "Class 12 pass with 45% aggregate for BA-LLB (5-year integrated)",
      "Graduate degree for LLB (3-year program)",
      "Qualify CLAT or state/AILET law entrance",
    ],
    admissionProcedure: [
      "Appear for CLAT (25 NLUs) or AILET/state law CETS",
      "Fill choices and accept seat allotment",
      "Complete document verification",
      "Register with the Bar Council of India on completion",
    ],
    entranceExams: ["CLAT", "AILET", "AILET (NLU Delhi)", "MH-CET Law", "LSAT India"],
    entranceExamNote: "CLAT is the main route to the 25 National Law Universities.",
    careerOpportunities: [
      "Litigation Lawyer",
      "Corporate Counsel",
      "Legal Advisor",
      "Judiciary (Judicial Services)",
      "Legal Researcher",
      "Compliance Officer",
    ],
    careerSectors: ["Law Firms", "Courts & Judiciary", "Corporate Legal", "NGOs", "Policy & Governance"],
    topRecruiters: ["Trilegal", "Khaitan & Co", "AZB & Partners", "Shardul Amarchand", "Cyril Amarchand"],
    faqs: [
      { q: "CLAT or AILET?", a: "CLAT covers the NLU consortium; AILET is for NLU Delhi. Many students take both." },
      { q: "Can I become a judge after law?", a: "Yes, judicial services examinations are the route to the lower judiciary, later to higher courts." },
    ],
    relatedSlugs: ["bba", "btech-computer-science", "phd"],
  },
  "phd": {
    slug: "phd",
    eligibility: [
      "Master's degree with 55-60% in the relevant discipline",
      "Many institutes admit via a written test + interview",
      "UGC-NET/JRF, GATE, CEED or institute scholarship required for funding",
    ],
    admissionProcedure: [
      "Apply for PhD admission in your domain",
      "Appear for the entrance test (e.g., UGC-NET, GATE) and interview",
      "Propose a research area and secure a supervisor",
      "Enrol after provisional admission; complete coursework and thesis",
    ],
    entranceExams: ["UGC-NET", "CSIR-NET", "GATE", "CEED", "Institute entrance"],
    entranceExamNote: "Fellowships (JRF/SRF) from UGC, CSIR, DST or institute funds support most PhD students.",
    careerOpportunities: ["Professor / Researcher", "R&D Scientist", "Data Scientist", "Research Engineer", "Postdoctoral Fellow"],
    careerSectors: ["Academia", "Government R&D", "Corporate R&D", "Think Tanks", "Deep-Tech Startups"],
    topRecruiters: ["IITs & Universities", "ISRO", "DRDO", "CSIR Labs", "Google Research"],
    faqs: [
      { q: "Is a PhD worth it?", a: "It is essential for research and professorships; in industry a PhD accelerates senior R&D roles, but consider the time cost." },
      { q: "How are PhD students funded?", a: "Most doctoral students receive JRF/SRF fellowships or teaching/research assistantships." },
    ],
    relatedSlugs: ["integrated-mtech", "mba", "btech-computer-science"],
  },
};