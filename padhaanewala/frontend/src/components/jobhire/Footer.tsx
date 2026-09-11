import {
  contactInfo,
  footerCandidateLinks,
  footerEmployerLinks,
} from "./data";
import NewsletterForm from "./NewsletterForm";

function FooterLogo() {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#55C99A] to-[#FFE65C] text-sm font-bold text-white"
        aria-hidden="true"
      >
        J
      </span>
      <span className="text-xl font-bold tracking-tight text-white">Jobhire</span>
    </div>
  );
}

export default function Footer() {
  return (
    <footer id="contact" className="bg-jh-navy text-white">
      <div className="mx-auto grid w-full max-w-[1160px] gap-10 px-4 py-16 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <FooterLogo />
          <ul className="mt-5 space-y-2 text-sm text-jh-muted">
            <li>Email: <a href={`mailto:${contactInfo.email}`} className="text-white/80 transition-colors hover:text-white">{contactInfo.email}</a></li>
            <li>Call: <a href={`tel:+1852134567`} className="text-white/80 transition-colors hover:text-white">{contactInfo.phone}</a></li>
          </ul>
        </div>

        <nav aria-label="For Candidates">
          <h3 className="text-sm font-bold uppercase tracking-wide text-white">For Candidates</h3>
          <ul className="mt-5 space-y-3">
            {footerCandidateLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="text-sm text-jh-muted transition-colors hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="For Employers">
          <h3 className="text-sm font-bold uppercase tracking-wide text-white">For Employers</h3>
          <ul className="mt-5 space-y-3">
            {footerEmployerLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="text-sm text-jh-muted transition-colors hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-white">Newsletter</h3>
          <p className="mt-5 text-sm leading-6 text-jh-muted">
            Subscribe to our newsletter and never miss latest job alert and news
          </p>
          <NewsletterForm />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-[1160px] flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-white/40 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Jobhire. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <a href="#" className="transition-colors hover:text-white">Privacy</a>
            <a href="#" className="transition-colors hover:text-white">Terms</a>
            <a href="#" className="transition-colors hover:text-white">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}