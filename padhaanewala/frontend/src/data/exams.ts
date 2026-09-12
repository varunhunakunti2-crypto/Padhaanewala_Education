export type Exam = {
  id: string;
  name: string;
  conductingAuthority: string;
  examType: "national" | "state";
  mode: string;
  applicationStart: string;
  applicationDeadline: string;
  applicationDeadlineISO: string;
  examDate: string;
  examDateISO: string;
  resultDate: string;
  status: string;
  officialUrl: string;
  slug: string;
};

export const exams: Exam[] = [
  {
    id: "ex1",
    name: "NEET UG 2026",
    conductingAuthority: "National Testing Agency (NTA)",
    examType: "national",
    mode: "Online",
    applicationStart: "07 Feb 2026",
    applicationDeadline: "07 Mar 2026",
    applicationDeadlineISO: "2026-03-07",
    examDate: "03 May 2026",
    examDateISO: "2026-05-03",
    resultDate: "14 Jun 2026",
    status: "Application Open",
    officialUrl: "https://neet.nta.nic.in",
    slug: "neet-ug-2026",
  },
  {
    id: "ex2",
    name: "JEE Main 2026 Session 1",
    conductingAuthority: "National Testing Agency (NTA)",
    examType: "national",
    mode: "Online",
    applicationStart: "14 Nov 2025",
    applicationDeadline: "02 Dec 2025",
    applicationDeadlineISO: "2025-12-02",
    examDate: "22 Jan 2026",
    examDateISO: "2026-01-22",
    resultDate: "11 Feb 2026",
    status: "Results Out",
    officialUrl: "https://jeemain.nta.nic.in",
    slug: "jee-main-2026-session-1",
  },
  {
    id: "ex3",
    name: "JEE Main 2026 Session 2",
    conductingAuthority: "National Testing Agency (NTA)",
    examType: "national",
    mode: "Online",
    applicationStart: "15 Feb 2026",
    applicationDeadline: "16 Mar 2026",
    applicationDeadlineISO: "2026-03-16",
    examDate: "02 Apr 2026",
    examDateISO: "2026-04-02",
    resultDate: "15 Apr 2026",
    status: "Application Open",
    officialUrl: "https://jeemain.nta.nic.in",
    slug: "jee-main-2026-session-2",
  },
  {
    id: "ex4",
    name: "JEE Advanced 2026",
    conductingAuthority: "IIT Council (IIT Bombay)",
    examType: "national",
    mode: "Online",
    applicationStart: "20 Apr 2026",
    applicationDeadline: "01 May 2026",
    applicationDeadlineISO: "2026-05-01",
    examDate: "17 May 2026",
    examDateISO: "2026-05-17",
    resultDate: "05 Jun 2026",
    status: "Registration Open",
    officialUrl: "https://jeeadv.ac.in",
    slug: "jee-advanced-2026",
  },
  {
    id: "ex5",
    name: "KCET 2026",
    conductingAuthority: "Karnataka Examinations Authority (KEA)",
    examType: "state",
    mode: "Online",
    applicationStart: "01 Feb 2026",
    applicationDeadline: "05 Mar 2026",
    applicationDeadlineISO: "2026-03-05",
    examDate: "20 Apr 2026",
    examDateISO: "2026-04-20",
    resultDate: "30 Jun 2026",
    status: "Registration Open",
    officialUrl: "https://cetonline.karnataka.gov.in",
    slug: "kcet-2026",
  },
  {
    id: "ex6",
    name: "CUET UG 2026",
    conductingAuthority: "National Testing Agency (NTA)",
    examType: "national",
    mode: "Online",
    applicationStart: "01 Mar 2026",
    applicationDeadline: "05 Apr 2026",
    applicationDeadlineISO: "2026-04-05",
    examDate: "15 May 2026",
    examDateISO: "2026-05-15",
    resultDate: "30 Jun 2026",
    status: "Expected",
    officialUrl: "https://cuet.nta.nic.in",
    slug: "cuet-ug-2026",
  },
  {
    id: "ex7",
    name: "CAT 2026",
    conductingAuthority: "Indian Institutes of Management",
    examType: "national",
    mode: "Online",
    applicationStart: "01 Aug 2026",
    applicationDeadline: "15 Sep 2026",
    applicationDeadlineISO: "2026-09-15",
    examDate: "29 Nov 2026",
    examDateISO: "2026-11-29",
    resultDate: "30 Dec 2026",
    status: "Application Open",
    officialUrl: "https://iimcat.ac.in",
    slug: "cat-2026",
  },
  {
    id: "ex8",
    name: "NEET PG 2026",
    conductingAuthority: "National Board of Examinations (NBE)",
    examType: "national",
    mode: "Online",
    applicationStart: "01 Apr 2026",
    applicationDeadline: "30 Apr 2026",
    applicationDeadlineISO: "2026-04-30",
    examDate: "05 Jul 2026",
    examDateISO: "2026-07-05",
    resultDate: "15 Sep 2026",
    status: "Expected",
    officialUrl: "https://nbe.edu.in",
    slug: "neet-pg-2026",
  },
  {
    id: "ex9",
    name: "TS EAMCET 2026",
    conductingAuthority: "JNTU Hyderabad (TSCHE)",
    examType: "state",
    mode: "Online",
    applicationStart: "10 Mar 2026",
    applicationDeadline: "20 Apr 2026",
    applicationDeadlineISO: "2026-04-20",
    examDate: "05 May 2026",
    examDateISO: "2026-05-05",
    resultDate: "10 Jun 2026",
    status: "Expected",
    officialUrl: "https://eamcet.tsche.ac.in",
    slug: "ts-eamcet-2026",
  },
  {
    id: "ex10",
    name: "WBJEE 2026",
    conductingAuthority: "West Bengal Joint Entrance Examinations Board",
    examType: "state",
    mode: "Online",
    applicationStart: "01 Jan 2026",
    applicationDeadline: "05 Feb 2026",
    applicationDeadlineISO: "2026-02-05",
    examDate: "26 Apr 2026",
    examDateISO: "2026-04-26",
    resultDate: "25 May 2026",
    status: "Application Open",
    officialUrl: "https://wbjeeb.nic.in",
    slug: "wbjee-2026",
  },
];

export type ExamStatus = "upcoming" | "open" | "results";

export function examStatus(exam: Exam): ExamStatus {
  const today = new Date();
  if (new Date(`${exam.resultDate} GMT+0530`) < today) return "results";
  if (new Date(`${exam.applicationDeadline} GMT+0530`) >= today) return "open";
  return "upcoming";
}