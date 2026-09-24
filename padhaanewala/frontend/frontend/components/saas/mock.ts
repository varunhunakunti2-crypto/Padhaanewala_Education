export interface Kpi {
  key: string;
  label: string;
  num: number;
  max?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  delta: string;
  up: boolean;
  note: string;
  color: string;
  soft: string;
  spark: number[];
}

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  data: number[];
}

export interface PeriodData {
  revenue: number[];
  transactions: number[];
  customers: number[];
  labels: string[];
  full: string[];
  unit: "$";
}

export type RevenuePeriod = "daily" | "weekly" | "monthly";

export const REVENUE: Record<RevenuePeriod, PeriodData> = {
  daily: {
    revenue: [6, 11, 8, 9, 13, 10, 12, 9.5, 14, 11, 13, 10.5, 15, 12, 13.5, 11, 16, 13, 12, 17, 14],
    transactions: [420, 610, 540, 580, 730, 640, 690, 560, 780, 660, 720, 590, 860, 700, 770, 620, 910, 740, 660, 980, 820],
    customers: [8, 12, 10, 11, 14, 13, 15, 12, 16, 15, 17, 13, 19, 16, 18, 14, 20, 17, 15, 22, 19],
    labels: ["13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "01", "02"],
    full: [
      "Sun, Sep 13", "Mon, Sep 14", "Tue, Sep 15", "Wed, Sep 16", "Thu, Sep 17", "Fri, Sep 18", "Sat, Sep 19",
      "Sun, Sep 20", "Mon, Sep 21", "Tue, Sep 22", "Wed, Sep 23", "Thu, Sep 24", "Fri, Sep 25", "Sat, Sep 26",
      "Sun, Sep 27", "Mon, Sep 28", "Tue, Sep 29", "Wed, Sep 30", "Thu, Oct 01", "Fri, Oct 02", "Sat, Oct 03",
    ],
    unit: "$",
  },
  weekly: {
    revenue: [28, 33, 30, 38, 35, 43, 40, 48, 45, 52, 49, 57],
    transactions: [2400, 2850, 2600, 3200, 2950, 3600, 3350, 4000, 3800, 4400, 4150, 4800],
    customers: [60, 71, 66, 78, 90, 103, 95, 118, 132, 141, 156, 168],
    labels: ["W26", "W27", "W28", "W29", "W30", "W31", "W32", "W33", "W34", "W35", "W36", "W37"],
    full: ["Jun 22–28", "Jun 29–Jul 05", "Jul 06–12", "Jul 13–19", "Jul 20–26", "Jul 27–Aug 02", "Aug 03–09", "Aug 10–16", "Aug 17–23", "Aug 24–30", "Aug 31–Sep 06", "Sep 07–13"],
    unit: "$",
  },
  monthly: {
    revenue: [112, 128, 120, 145, 138, 162, 155, 178, 168, 192, 184, 212],
    transactions: [9800, 11200, 10600, 12500, 11800, 13600, 12900, 15000, 14200, 16400, 15600, 17800],
    customers: [210, 238, 230, 258, 275, 305, 292, 335, 352, 378, 395, 428],
    labels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    full: ["Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026"],
    unit: "$",
  },
};

export const VOLUME = [
  { label: "Online Payments", pct: 78, value: "68%", color: "#2563eb" },
  { label: "Subscriptions", pct: 54, value: "47%", color: "#7c3aed" },
  { label: "In-Store Sales", pct: 32, value: "28%", color: "#10b981" },
];

export const RETENTION = [38, 41, 39, 43, 42, 40, 44, 42, 41, 43, 42, 44, 43, 45, 44];

export const ACTIVITY_WEEKS = [
  [0, 1, 2, 1, 3, 4, 2],
  [1, 2, 4, 2, 3, 4, 3],
  [2, 3, 4, 3, 4, 4, 3],
  [1, 3, 4, 4, 3, 4, 4],
  [3, 4, 4, 3, 4, 4, 4],
];
export const ACTIVITY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface Txn {
  id: string;
  tx: string;
  customer: string;
  date: string;
  amount: string;
  status: "Successful" | "Pending" | "Failed";
}

export const TRANSACTIONS: Txn[] = [
  { id: "t1", tx: "Payment #PAY-10231", customer: "John Smith", date: "Sep 24, 2026", amount: "$2,450", status: "Successful" },
  { id: "t2", tx: "Payment #PAY-10230", customer: "Sarah Wilson", date: "Sep 24, 2026", amount: "$1,280", status: "Pending" },
  { id: "t3", tx: "Payment #PAY-10229", customer: "Alex Johnson", date: "Sep 23, 2026", amount: "$890", status: "Successful" },
  { id: "t4", tx: "Payment #PAY-10228", customer: "Maria Garcia", date: "Sep 23, 2026", amount: "$2,030", status: "Successful" },
  { id: "t5", tx: "Payment #PAY-10227", customer: "David Kim", date: "Sep 22, 2026", amount: "$3,410", status: "Failed" },
  { id: "t6", tx: "Payment #PAY-10226", customer: "Emily Anderson", date: "Sep 22, 2026", amount: "$1,760", status: "Successful" },
  { id: "t7", tx: "Payment #PAY-10225", customer: "Marcus Lee", date: "Sep 22, 2026", amount: "$640", status: "Successful" },
  { id: "t8", tx: "Payment #PAY-10224", customer: "Priya Sharma", date: "Sep 21, 2026", amount: "$2,150", status: "Successful" },
];

export const NOTIFS = [
  { id: "n1", title: "Quarterly report ready", body: "Your Q3 performance summary is ready to view.", time: "12 min ago", read: false },
  { id: "n2", title: "New transaction received", body: "Payment of $2,450 from John Smith completed.", time: "26 min ago", read: false },
  { id: "n3", title: "Low success rate alert", body: "Transactions dropped below 62% over the last hour.", time: "1 hr ago", read: true },
  { id: "n4", title: "New signups", body: "142 new customers joined in the last 24 hours.", time: "3 hrs ago", read: true },
];

export const NAV = [
  { label: "Dashboard", tone: "bg-[#6dd6a8]/90" },
  { label: "Analytics", tone: "bg-[#8ab8ff]/90" },
  { label: "Customers", tone: "bg-[#ffd3e2]/90" },
  { label: "Products", tone: "bg-[#ffdd9f]/90" },
  { label: "Transactions", tone: "bg-[#d3ccff]/90" },
  { label: "Reports", tone: "bg-[#b3ecff]/90" },
];

/* Shared premium design tokens (light, deterministic — no JS random) */
export const SURFACE = "bg-white";
export const SHADOW = "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_44px_-24px_rgba(15,23,42,0.14)]";
export const RING = "ring-1 ring-black/[0.05]";
export const PREMIUM_CARD = `${SURFACE} rounded-3xl ${RING} ${SHADOW}`;
export const LIFT = "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_28px_56px_-20px_rgba(15,23,42,0.22)]";
export const INK = "#111111";
export const MUTED = "#7f7f87";
