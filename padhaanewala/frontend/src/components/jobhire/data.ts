export type NavLink = { label: string; href: string; hasDropdown?: boolean };

export const navLinks: NavLink[] = [
  { label: "Find Jobs", href: "#jobs" },
  { label: "Employers", href: "#categories" },
  { label: "Pricing", href: "#app" },
  { label: "Blog", href: "#news" },
  { label: "Contact", href: "#contact" },
  { label: "Pages", href: "#", hasDropdown: true },
];

export const popularSearches = ["Designer", "Developer", "iOS"];

export type Category = {
  id: string;
  name: string;
  positions: string;
  icon: "design" | "education" | "code" | "marketing";
};

export const categories: Category[] = [
  { id: "design", name: "Design & Art", positions: "643 open positions", icon: "design" },
  { id: "education", name: "Education", positions: "109 open positions", icon: "education" },
  { id: "web", name: "Web development", positions: "870 open positions", icon: "code" },
  { id: "marketing", name: "Digital Marketing", positions: "360 open positions", icon: "marketing" },
];

export type Job = {
  id: string;
  title: string;
  company: string;
  type: "Contract" | "Remote";
  location: string;
  salary: string;
};

export const jobs: Job[] = [
  { id: "j1", title: "Web Developer", company: "The Simpsons", type: "Contract", location: "San Francisco", salary: "$1500-$3600" },
  { id: "j2", title: "Graphic Designer", company: "Acme Corporation", type: "Remote", location: "Herzegovina", salary: "$800-$2000" },
  { id: "j3", title: "UI/UX Designer", company: "Sylent Corp", type: "Contract", location: "Luxembourg", salary: "$1250-$3000" },
  { id: "j4", title: "Content Writer", company: "Umbrella Corporation", type: "Remote", location: "New York, NY", salary: "$3500-$4800" },
  { id: "j5", title: "Product Designer", company: "Massive Dynamic", type: "Remote", location: "Silicon Valley", salary: "$2000-$3600" },
  { id: "j6", title: "SEO Specialist", company: "Capital Partners", type: "Remote", location: "Bay Area", salary: "$3500-$4500" },
];

export const jobFilters = ["Contract", "Remote", "Popular"] as const;

export const careerFeatures = [
  "100% Verified Jobs",
  "One profile Unlimited job Opening",
  "Get Personalized Job Recommendations",
  "Find Your Perfect Job Match",
];

export type Stat = { value: string; label: string; icon: "users" | "briefcase" | "share" };

export const stats: Stat[] = [
  { value: "35,000+", label: "daily active users", icon: "users" },
  { value: "69,000+", label: "open job positions", icon: "briefcase" },
  { value: "68,500+", label: "stories shared", icon: "share" },
];

export const testimonial = {
  heading: "Client Reviews",
  quote:
    "I was impressed by the quality of this job board website template. We were able to launch a full stack web application with this front-end template within days. I only had to manage backend. Highly recommended. You can purchase it without any question.",
  name: "Daniyel Martin",
  role: "Developer",
};

export type Article = { id: string; title: string; date: string; image: string; category: string };

export const articles: Article[] = [
  {
    id: "a1",
    title:
      "Top American Companies that Promote Gender Diversity in the Workplace",
    date: "23 SEPTEMBER, 2022",
    image: "team-work",
    category: "Culture",
  },
  {
    id: "a2",
    title: "How to Identify Diversity & Inclusivity at Workplace?",
    date: "17 AUGUST, 2022",
    image: "meeting",
    category: "Workplace",
  },
  {
    id: "a3",
    title:
      "The Rise of Remote Jobs & How to Write a Resume to Get a Perfect Remote Job?",
    date: "19 JULY, 2022",
    image: "remote",
    category: "Remote",
  },
];

export const footerCandidateLinks = [
  { label: "Browse all Jobs", href: "#jobs" },
  { label: "Candidate Dashboard", href: "#" },
  { label: "Latest News", href: "#news" },
  { label: "Job Alerts", href: "#" },
];

export const footerEmployerLinks = [
  { label: "Browse Candidates", href: "#" },
  { label: "Employer Dashboard", href: "#" },
  { label: "Submit a Job", href: "#" },
  { label: "Pricing & Plans", href: "#app" },
];

export const contactInfo = {
  email: "support@jobhire.com",
  phone: "+1 (852) 134 567",
};