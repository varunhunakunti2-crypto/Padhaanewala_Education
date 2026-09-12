import Link from "next/link";

export default function BrowseCollegesButton() {
  return (
    <Link href="/colleges" className="browse-colleges-btn">
      <svg
        className="sparkle h-4.5 w-4.5"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 2 L13.6 10.4 L22 12 L13.6 13.6 L12 22 L10.4 13.6 L2 12 L10.4 10.4 Z" />
        <path d="M19 2 L19.7 5.3 L23 6 L19.7 6.7 L19 10 L18.3 6.7 L15 6 L18.3 5.3 Z" />
      </svg>
      <span className="text">Browse Colleges</span>
    </Link>
  );
}