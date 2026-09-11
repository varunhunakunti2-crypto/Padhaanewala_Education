export type College = {
  id: string;
  name: string;
  city: string;
  stateCode: string;
  location: string;
  type: string;
  ownership: string;
  rating: number;
  fees: string;
  placement: string;
  slug: string;
  featured?: boolean;
  verified?: boolean;
  hasHostel?: boolean;
  courses: string[];
};

export type State = {
  code: string;
  name: string;
};

export type CourseOption = {
  slug: string;
  label: string;
  category: string;
};

export const states: State[] = [
  { code: "KA", name: "Karnataka" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TS", name: "Telangana" },
  { code: "MH", name: "Maharashtra" },
  { code: "KL", name: "Kerala" },
  { code: "DL", name: "Delhi" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "GJ", name: "Gujarat" },
  { code: "RJ", name: "Rajasthan" },
  { code: "WB", name: "West Bengal" },
];

export const courseOptions: CourseOption[] = [
  { slug: "mbbs", label: "MBBS", category: "Medical" },
  { slug: "bams", label: "BAMS", category: "Medical" },
  { slug: "bhms", label: "BHMS", category: "Medical" },
  { slug: "bds", label: "BDS", category: "Medical" },
  { slug: "bsc-nursing", label: "B.Sc Nursing", category: "Nursing" },
  { slug: "b-pharm", label: "B.Pharm", category: "Pharmacy" },
  { slug: "b-tech-cse", label: "B.Tech CSE", category: "Engineering" },
  { slug: "bca", label: "BCA", category: "IT" },
  { slug: "mca", label: "MCA", category: "IT" },
  { slug: "bba", label: "BBA", category: "Management" },
  { slug: "mba", label: "MBA", category: "Management" },
  { slug: "b-com", label: "B.Com", category: "Commerce" },
  { slug: "llb", label: "LLB", category: "Law" },
];

export const colleges: College[] = [
  {
    id: "col1",
    name: "Padhaanewala Institute of Medical Sciences",
    city: "Bengaluru",
    stateCode: "KA",
    location: "Bengaluru, Karnataka",
    type: "Private",
    ownership: "Private",
    rating: 4.6,
    fees: "₹8.5 L/year",
    placement: "92% placed",
    slug: "sample-medical-college",
    featured: true,
    verified: true,
    hasHostel: true,
    courses: ["mbbs"],
  },
  {
    id: "col2",
    name: "Padhaanewala National College of Nursing",
    city: "Chennai",
    stateCode: "TN",
    location: "Chennai, Tamil Nadu",
    type: "Private",
    ownership: "Private",
    rating: 4.4,
    fees: "₹1.2 L/year",
    placement: "88% placed",
    slug: "sample-nursing-college",
    verified: true,
    hasHostel: true,
    courses: ["bsc-nursing"],
  },
  {
    id: "col3",
    name: "Padhaanewala College of Pharmacy",
    city: "Hyderabad",
    stateCode: "TS",
    location: "Hyderabad, Telangana",
    type: "Private",
    ownership: "Private",
    rating: 4.2,
    fees: "₹1.5 L/year",
    placement: "85% placed",
    slug: "sample-pharmacy-college",
    verified: true,
    courses: ["b-pharm"],
  },
  {
    id: "col4",
    name: "Padhaanewala Engineering Institute",
    city: "Pune",
    stateCode: "MH",
    location: "Pune, Maharashtra",
    type: "Private",
    ownership: "Private",
    rating: 4.3,
    fees: "₹2.4 L/year",
    placement: "90% placed",
    slug: "sample-engineering-college",
    verified: true,
    hasHostel: true,
    courses: ["b-tech-cse", "mca"],
  },
  {
    id: "col5",
    name: "Padhaanewala Institute of Ayurveda",
    city: "Kochi",
    stateCode: "KL",
    location: "Kochi, Kerala",
    type: "Private",
    ownership: "Private",
    rating: 4.5,
    fees: "₹6.5 L/year",
    placement: "82% placed",
    slug: "sample-ayurveda-college",
    verified: true,
    hasHostel: true,
    courses: ["bams"],
  },
  {
    id: "col6",
    name: "Padhaanewala Homeopathy Medical College",
    city: "Jaipur",
    stateCode: "RJ",
    location: "Jaipur, Rajasthan",
    type: "Private",
    ownership: "Private",
    rating: 4.1,
    fees: "₹5.0 L/year",
    placement: "78% placed",
    slug: "sample-homeopathy-college",
    verified: true,
    courses: ["bhms"],
  },
  {
    id: "col7",
    name: "Padhaanewala Dental College",
    city: "New Delhi",
    stateCode: "DL",
    location: "New Delhi, Delhi",
    type: "Private",
    ownership: "Private",
    rating: 4.4,
    fees: "₹7.2 L/year",
    placement: "80% placed",
    slug: "sample-dental-college",
    verified: true,
    hasHostel: true,
    courses: ["bds"],
  },
  {
    id: "col8",
    name: "Padhaanewala National Law University",
    city: "Bengaluru",
    stateCode: "KA",
    location: "Bengaluru, Karnataka",
    type: "Private",
    ownership: "Private",
    rating: 4.5,
    fees: "₹4.8 L/year",
    placement: "89% placed",
    slug: "sample-law-college",
    featured: true,
    verified: true,
    courses: ["llb"],
  },
  {
    id: "col9",
    name: "Padhaanewala School of Management",
    city: "Ahmedabad",
    stateCode: "GJ",
    location: "Ahmedabad, Gujarat",
    type: "Private",
    ownership: "Private",
    rating: 4.2,
    fees: "₹6.0 L/year",
    placement: "91% placed",
    slug: "sample-management-college",
    verified: true,
    courses: ["bba", "mba"],
  },
  {
    id: "col10",
    name: "Padhaanewala Institute of Commerce",
    city: "Mumbai",
    stateCode: "MH",
    location: "Mumbai, Maharashtra",
    type: "Private",
    ownership: "Private",
    rating: 3.9,
    fees: "₹2.2 L/year",
    placement: "76% placed",
    slug: "sample-commerce-college",
    verified: true,
    courses: ["b-com"],
  },
  {
    id: "col11",
    name: "Padhaanewala Business College",
    city: "Coimbatore",
    stateCode: "TN",
    location: "Coimbatore, Tamil Nadu",
    type: "Private",
    ownership: "Private",
    rating: 4.0,
    fees: "₹3.5 L/year",
    placement: "84% placed",
    slug: "sample-business-college",
    verified: true,
    courses: ["bba"],
  },
  {
    id: "col12",
    name: "Padhaanewala Institute of Computer Applications",
    city: "Noida",
    stateCode: "UP",
    location: "Noida, Uttar Pradesh",
    type: "Private",
    ownership: "Private",
    rating: 4.1,
    fees: "₹1.8 L/year",
    placement: "87% placed",
    slug: "sample-ca-college",
    verified: true,
    hasHostel: true,
    courses: ["bca", "mca"],
  },
];

export const stateName = (code: string): string =>
  states.find((s) => s.code === code)?.name ?? code;

export const courseLabel = (slug: string): string =>
  courseOptions.find((c) => c.slug === slug)?.label ?? slug;