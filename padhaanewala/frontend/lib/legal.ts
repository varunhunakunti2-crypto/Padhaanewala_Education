/**
 * Legal document content, kept in one typed registry rather than six page files.
 *
 * Why a registry instead of `app/privacy/page.tsx` + `app/terms/page.tsx` + ...:
 * every one of these documents renders through the same layout (title block,
 * section table of contents, prose, cross-links to sibling documents) and the
 * same set of facts about the operator. Duplicating that shell six times is how
 * the footer ends up linking to a page that was never written.
 *
 * The content below is deliberately specific to what this codebase *actually*
 * does today, not generic boilerplate. Before changing a claim here, check the
 * code - a legal page that overstates the product is worse than no page, because
 * it is a written representation to users. The notable current-state facts the
 * copy depends on:
 *
 *  - No cookies are set. Neither by the browser nor by the server. Session state
 *    lives in `localStorage` (the keys are listed verbatim in the cookie
 *    policy). See lib/api.ts:5-7 and lib/context/AppContext.tsx:182-195.
 *  - No analytics, advertising or error-tracking SDK is installed. Not Google
 *    Analytics, not Meta Pixel, not Sentry, not Vercel Analytics.
 *  - No payment gateway is integrated. Every service is currently free.
 *  - There is no file upload anywhere, so no documents or photographs are held.
 *  - Email and mobile are verified: the address by a one-time emailed link, the
 *    mobile by an SMS OTP. Both are stored only as a bcrypt digest of the secret
 *    in the `otp_records` table, never in plaintext. A reset link is a bearer
 *    credential for the account, so it expires (60 min) and is single-use.
 *  - The AI assistant forwards the user's raw message to OpenAI
 *    (app/api/ai/route.ts:25-45) and falls back to canned replies when
 *    OPENAI_API_KEY is unset.
 *  - There is no age gate and no parental-consent mechanism.
 *  - There is no in-product data export or account-deletion flow, so the rights
 *    section describes a manual process rather than claiming a button exists.
 */

import { SITE } from "@/lib/site";

/** Bumped whenever any document below changes substantively. */
export const LEGAL_LAST_UPDATED = "2026-09-27";

/**
 * Named contact for the Grievance Redressal document.
 *
 * The name is deliberately left unfilled. The Information Technology
 * (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 require a
 * grievance officer to be named alongside the address to serve notice on, and a
 * plausible-looking placeholder name on a legal notice could misdirect a real
 * complaint or a regulator's order. Fill this in before the site goes live.
 */
export const GRIEVANCE_OFFICER = {
  name: "To be designated",
  designation: "Grievance Officer",
  email: SITE.email,
  phone: SITE.phone,
  postalAddress: `${SITE.legalName}, ${SITE.address.locality}, ${SITE.address.region} ${SITE.address.postalCode}, India`,
  /** Statutory response window, in days. */
  responseWindowDays: 30,
} as const;

/**
 * Content is an ordered list rather than fixed `paragraphs` / `bullets` /
 * `note` fields. Several sections legitimately read as lead-in, then list, then
 * a closing paragraph, and an earlier version of this file expressed that as two
 * `paragraphs` keys. TypeScript caught it, but only because `paragraphs`
 * happened to be a duplicate: the same mistake with two `bullets` keys, or
 * between a `note` and a `paragraphs`, would have compiled silently and dropped
 * copy from a legal notice. An ordered union makes the sequence explicit.
 */
export type LegalBlock =
  | { readonly kind: "p"; readonly text: string }
  | { readonly kind: "ul"; readonly items: readonly string[] }
  | { readonly kind: "note"; readonly text: string };

const p = (text: string): LegalBlock => ({ kind: "p", text });
const ul = (...items: string[]): LegalBlock => ({ kind: "ul", items });
const note = (text: string): LegalBlock => ({ kind: "note", text });

export interface LegalSection {
  /** Stable anchor id. Written by hand rather than slugified from `heading` so
   *  that existing inbound links and bookmarks do not break when a heading is
   *  reworded. */
  id: string;
  heading: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDoc {
  slug: string;
  /** Browser title and <h1>. */
  title: string;
  /** Compact label for the table of contents and the footer. */
  shortTitle: string;
  /** <meta name="description"> and the intro paragraph under the title. */
  description: string;
  icon: "shield" | "scroll" | "cookie" | "alert" | "gavel" | "wallet";
  sections: readonly LegalSection[];
}

/** Used in contact paragraphs so SITE is never retyped. */
const ADDRESS_LINE = `${SITE.legalName}, ${SITE.address.locality}, ${SITE.address.region} ${SITE.address.postalCode}, India`;

export const LEGAL_DOCS: readonly LegalDoc[] = [
  // ----------------------------------------------------------------- privacy
  {
    slug: "privacy",
    title: "Privacy Policy",
    shortTitle: "Privacy",
    icon: "shield",
    description: `How ${SITE.legalName} collects, uses, shares and protects your personal information, and the rights you have over it under India's Digital Personal Data Protection Act, 2023.`,
    sections: [
      {
        id: "who-we-are",
        heading: "Who we are and what this policy covers",
        blocks: [
          p(
            `${SITE.legalName} ("we", "us", "${SITE.name}") operates the website ${SITE.domain} and its web app. We are the Data Fiduciary under the Digital Personal Data Protection Act, 2023 ("DPDP Act") for the personal data described here.`,
          ),
          p(
            "This policy explains what we collect, why we collect it, who we share it with, how long we keep it, and what you can ask us to do with it. It covers the website, the app, our APIs and any email we send you. It does not cover third-party websites we link to; those have their own policies.",
          ),
        ],
      },
      {
        id: "what-we-collect",
        heading: "What information we collect",
        blocks: [
          p(
            "We deliberately collect as little as possible. We do not run advertising networks, data brokers, third-party trackers or web-analytics scripts, so we cannot build a profile of you across other websites.",
          ),
          ul(
            "Account information you give us: your name, email address, mobile number, and a securely hashed version of your password. We never store or email your password itself.",
            "Verification records: to confirm your email address we store a hashed one-time link token, and to confirm your mobile we store a hashed one-time code, together with whether it has been used, when it expires and how many incorrect attempts were made. We do not store the code or token itself, in any form.",
            "Content you create: admission-enquiry details, college and course shortlists, scholarship bookmarks, comparison lists, reviews you write, mock-test attempts and the answers you give, notifications, and the messages you type to the AI assistant.",
            "Information collected automatically: your IP address, the browser and device you are using, the pages and API endpoints you request, and the time of the request. This is ordinary web-server logging, used to keep the service running and to detect abuse.",
            "Data from our AI assistant: the text of the question you type. It is forwarded to our AI processor (OpenAI) to generate a reply, as described under “AI features and third-party processing” below.",
          ),
          note(
            "We do not ask for, and cannot receive, your date of birth, caste, religion, marks or certificates, Aadhaar number, PAN, bank details or payment-card information. We have no file-upload feature, so we never hold copies of your marksheets or identity documents.",
          ),
        ],
      },
      {
        id: "how-we-use-it",
        heading: "How we use your information",
        blocks: [
          p("We process personal data for the following purposes, and no others:"),
          ul(
            "To create and operate your account, sign you in, and let you use features that need a saved identity: shortlists, mock-test history, reviews and enquiry tracking.",
            "To show you the college, course, exam and scholarship information you have asked for, and to remember your preferences such as dark-mode choice and recently viewed items.",
            "To answer your messages through the AI assistant.",
            "To respond to admission-enquiry and counselling requests you submit to us.",
            "To display the reviews you have chosen to publish, with your name, so that other students can read them.",
            "To detect and prevent abuse: rate-limiting, securing accounts, and investigating abuse or fraud reports. Sends of a one-time code are capped per phone number, so the limit cannot be sidestepped by varying the format of the number.",
            "To send you service messages about your account, such as a password change or a security alert. Marketing email is not sent unless you have asked for it.",
            "To confirm that the email address and mobile number you gave us are really yours, and to let you recover access if you forget your password. These messages are strictly transactional, contain no marketing content, and stop as soon as the address is confirmed.",
          ),
        ],
      },
      {
        id: "legal-grounds",
        heading: "Why we are allowed to process it",
        blocks: [
          p("Under the DPDP Act, each use above rests on a permitted ground:"),
          ul(
            "Consent: you have affirmatively agreed, for example by ticking a box or by submitting an enquiry form.",
            "Performance of a contract, and steps taken at your request prior to entering into one: this covers operating your account and the features it unlocks.",
            "Compliance with a legal obligation: for example, retaining records where Indian law requires it.",
            "Legitimate uses permitted by the Act, including providing a good quality service, preventing fraud, and protecting the security of our systems.",
          ),
        ],
      },
      {
        id: "cookies",
        heading: "Cookies and local storage",
        blocks: [
          p(
            "We set no cookies. Your session is kept in your browser's local storage instead, which never leaves your device except when your browser attaches it to an API request. Our Cookie Policy lists every key we store and explains how to clear it.",
          ),
        ],
      },
      {
        id: "ai-features",
        heading: "AI features and third-party processing",
        blocks: [
          p(
            "When you use the AI assistant, the text you type is sent to OpenAI, our AI infrastructure provider, along with a fixed system prompt, to generate a reply. Your account's name and email are not included in that request, but anything you type is, so please do not enter personal or sensitive details into the assistant.",
          ),
          p(
            "OpenAI processes this data as a subprocess processor under its own API terms and privacy policy, which govern what it does with the request. We use these replies to help you explore options; we do not use your conversations to train our own models. If no AI provider is configured, the assistant returns a fixed set of prepared responses and nothing leaves our servers.",
          ),
        ],
      },
      {
        id: "sharing",
        heading: "Who we share it with",
        blocks: [
          p(
            "We do not sell, rent or trade your personal information, and we have never done so. We share it only with service providers who process it on our instructions, and who are contractually required to protect it:",
          ),
          ul(
            "Our application and API hosting provider, and our database and Redis hosting providers, which store and serve the data described above.",
            "OpenAI, as the processor for AI assistant messages.",
            "MSG91, as the processor for transactional SMS. Your mobile number and the one-time code are sent to them to deliver the message. Indian law also requires every such message to match a template registered with a Distributed Ledger Technology operator, so the operator and template id are part of the send.",
            "Our email delivery provider — either SendGrid or an SMTP relay you configure — as the processor for verification, confirmation and password-reset emails. They receive the recipient address, the message, and a single-use link where applicable.",
            "Professional advisers, auditors or insurers, under a duty of confidence.",
            "Government bodies, courts or law-enforcement agencies, but only where we are legally required to disclose, and we will tell you unless the law prohibits it.",
          ),
          p(
            "If we sell or merge our business, personal data may transfer to the new owner. We will give you notice and let you object before your data moves.",
          ),
        ],
      },
      {
        id: "retention",
        heading: "How long we keep it",
        blocks: [
          p(
            "We keep data for as long as your account is active, because that is what makes shortlists, mock-test history and saved preferences work. When you close your account, we delete or irreversibly anonymise your personal data within 30 days, except where we must keep it longer to comply with a legal obligation or to resolve a dispute.",
          ),
          p(
            "Aggregated, non-identifying usage counts may be retained for longer because they cannot be linked back to you.",
          ),
        ],
      },
      {
        id: "security",
        heading: "How we protect it",
        blocks: [
          p(
            "Passwords are hashed with bcrypt rather than stored, so a breach of our database would not reveal them. One-time codes and email link tokens are hashed the same way, so we never hold a code that would let anyone sign in as you. Traffic is served over HTTPS. Data access is restricted to the people who need it, administrative actions are written to an audit log, and rate limiting helps prevent automated attacks.",
          ),
          p(
            "A password-reset link is a bearer credential for your account: whoever holds it can set a new password. It therefore expires after 60 minutes, can be used exactly once, and is invalidated the moment a new one is issued. Requesting a new link retires the previous one.",
          ),
          p(
            "No system is perfectly secure. If a breach affects your personal data and is likely to cause you harm, we will notify you and the relevant authority as required by law.",
          ),
        ],
      },
      {
        id: "your-rights",
        heading: "Your rights, and how to exercise them",
        blocks: [
          p("The DPDP Act gives you the right to:"),
          ul(
            "Access your information and obtain a description of how it is being used.",
            "Ask us to correct information that is inaccurate or incomplete.",
            "Ask us to complete or update information that is incomplete.",
            "Erase information we no longer have a lawful reason to keep.",
            "Withdraw consent you have given, for any processing that relies on it.",
            "Nominate someone to exercise these rights on your behalf if you are unable to.",
            "Receive a grievance redressal response, and appeal an unsatisfactory one.",
          ),
          p(
            `Email ${SITE.email} with the subject line “Data rights request” and tell us which right you want to exercise. We aim to acknowledge within 7 days and to complete the request within 30 days. We may ask you to confirm that you are the account holder before we act, so that nobody can request your data using your email address alone.`,
          ),
          note(
            "To be straight with you about the current state of the product: there is no in-app button to download or delete your account, and requests are currently handled by our team manually. We would rather tell you that plainly than describe a self-service process that does not exist. We intend to add self-service export and deletion.",
          ),
        ],
      },
      {
        id: "children",
        heading: "Children and teenagers",
        blocks: [
          p(
            "Padhaanewala is built for students preparing for Indian entrance examinations, many of whom are between 16 and 18 years old. We therefore treat under-18 users as a priority rather than an edge case.",
          ),
          p(
            "We require that anyone using the service is either at least 18 years old, or at least 16 years old and using it with the involvement and consent of a parent or legal guardian. We are required to obtain verifiable parental consent before processing the personal data of a user known to be under 18, and to stop processing it if we learn we cannot obtain that consent.",
          ),
          note(
            "We should be candid that as of this version of the policy the product has no age-verification step and no parental-consent record, so we cannot currently demonstrate that this requirement is met in every case. We are building that check. Until it ships, if you are under 16, please do not create an account, and if you are 16 or 17, please ask a parent or guardian to contact us before you do.",
          ),
          p(
            "If you believe a child has given us personal data without valid consent, contact us and we will delete it.",
          ),
        ],
      },
      {
        id: "changes",
        heading: "Changes to this policy",
        blocks: [
          p(
            "If we change what we collect or how we use it, we will update this page and change the “Last updated” date. If a change materially reduces your rights, we will tell you directly by email or on the site before it takes effect.",
          ),
        ],
      },
      {
        id: "contact-us",
        heading: "Contacting us",
        blocks: [
          p(`Questions, complaints or requests about this policy or your data: ${SITE.email}.`),
          p(`Our postal address: ${ADDRESS_LINE}`),
          p(
            "If you are not satisfied with our response, our Grievance Redressal page explains how to escalate, including to the National Consumer Helpline on 1915.",
          ),
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- terms
  {
    slug: "terms",
    title: "Terms of Service",
    shortTitle: "Terms",
    icon: "scroll",
    description: `The terms that govern your use of ${SITE.domain} — your account, acceptable use, ownership of content, mock tests, AI features, liability limits and governing law.`,
    sections: [
      {
        id: "acceptance",
        heading: "Acceptance of these terms",
        blocks: [
          p(
            `These Terms form an agreement between you and ${SITE.legalName} regarding your use of ${SITE.domain}, the app, and the services available on them. By creating an account or using the service you accept these Terms and our Privacy Policy. If you do not accept them, please do not use the service.`,
          ),
          p(
            "We may update these Terms. Material changes will be notified on this page and by email if you have an account, and will take effect 15 days after notice. Continuing to use the service after that means you accept the updated Terms.",
          ),
        ],
      },
      {
        id: "eligibility",
        heading: "Eligibility",
        blocks: [
          p(
            "You must be at least 18 years old to open an account, or at least 16 and using the service with the involvement and consent of a parent or guardian. You must give accurate information and keep it updated; a false or borrowed email or mobile number is a breach of these Terms.",
          ),
          p(
            "If you are under 18, a parent or guardian should read these Terms and our Privacy Policy with you.",
          ),
        ],
      },
      {
        id: "what-we-are",
        heading: "What Padhaanewala is, and is not",
        blocks: [
          p(
            "Padhaanewala is an information, guidance and shortlisting platform. We compile publicly available information about Indian colleges, courses, entrance examinations and scholarships, and we provide tools to compare, shortlist and plan.",
          ),
          p(
            "We are not a college, university, examination authority, education ministry, state examination board or government body, and we are not an agent of any of them. Nothing on this site is an official notification. Where a figure matters to an application, the official source always governs, and it is your responsibility to check it.",
          ),
          note(
            "Using Padhaanewala does not create any relationship of agency, employment or fiduciary duty between you and us, and it does not entitle you to any reserved category of an institution.",
          ),
        ],
      },
      {
        id: "your-account",
        heading: "Your account",
        blocks: [
          p(
            "You are responsible for keeping your password confidential and for all activity that happens under your account. Tell us promptly if you believe your account has been accessed by someone else. You must not share an account, and you must not create accounts in bulk or programmatically.",
          ),
          p(
            "We confirm the email address on your account from a one-time link and the mobile number from a one-time code sent by SMS. You must give us an address and a number you control, and you must not ask for codes to be sent to someone else's number. Signing in may require a confirmed email address; where it does, we will say so and give you a way to resend the confirmation rather than leaving you to guess.",
          ),
          p(
            "A password-reset link lets whoever holds it set a new password, so treat it like a password. It expires after 60 minutes and stops working as soon as a new one is issued or as soon as it is used. If you did not request a reset, you can ignore the message, but you should also change your password and let us know.",
          ),
        ],
      },
      {
        id: "acceptable-use",
        heading: "Acceptable use",
        blocks: [
          p("You must not use the service to:"),
          ul(
            "Upload, publish or request unlawful, defamatory, hateful, or sexually explicit content.",
            "Post a review or comment that is false, is written about someone else, or is intended to damage a college's or a person's reputation. Reviews must describe your own genuine experience.",
            "Scrape, crawl, bulk-download, or systematically extract college or exam data for commercial reuse, resale, or to train a machine-learning model, without our written permission.",
            "Copy, republish or commercially exploit our content, including college profiles, fee tables, cutoff data, editorial articles, our logo and our design.",
            "Reverse-engineer, probe for vulnerabilities, overload, or attempt to gain unauthorised access to the service or its infrastructure.",
            "Use the service to harass, abuse or impersonate another person, or to send unsolicited bulk communications.",
            "Circumvent rate limits, or use multiple accounts to obtain an advantage in mock tests or any other scored feature.",
          ),
          p(
            "We may suspend or close an account that breaches these Terms. Where a breach is serious or unlawful, we may do so without notice. We will restore access where the suspension was mistaken.",
          ),
        ],
      },
      {
        id: "content-ownership",
        heading: "Ownership of content",
        blocks: [
          p(
            `We own the service and its content: the software, design, college and exam information we compile, articles, and the underlying data. Our licence to you is personal, non-exclusive, non-transferable and revocable on closure of your account, and it exists only to let you use the service.`,
          ),
          p(
            "You keep ownership of what you write, such as your reviews and enquiries. By publishing a review you grant us a non-exclusive, worldwide, royalty-free licence to display and distribute it on the service, including your display name, for as long as it is published. You can ask us to remove it at any time, and we will remove it from the service; we may keep a copy only where a law requires it.",
          ),
        ],
      },
      {
        id: "accuracy",
        heading: "Accuracy of information, and our disclaimer",
        blocks: [
          p(
            "Fees, intakes, cutoffs, eligibility, hostel availability, NAAC grades and placement figures change frequently, and official notices are published on short deadlines. We work to keep our data current, but we cannot promise it is complete, current or error-free. Our Disclaimer sets out the full limits of what we can promise about the information on this site.",
          ),
          note(
            "Every figure on Padhaanewala should be verified against the college's or the examination authority's own official notification before you act on it.",
          ),
        ],
      },
      {
        id: "predictions",
        heading: "College predictions and eligibility estimates",
        blocks: [
          p(
            "The college predictor and any eligibility estimate are approximations produced from historical cutoff and seat data. They are not predictions of a real result, not a guarantee of admission, and not an offer of a seat. Admission is decided solely by the relevant examination authority and the institution's own merit list, counselling and eligibility rules. Students have been admitted to colleges the predictor ranked below their reach, and equally have been rejected from colleges it rated as safe.",
          ),
        ],
      },
      {
        id: "mock-tests",
        heading: "Mock tests and proctored sessions",
        blocks: [
          p(
            "Mock tests are practice material provided for revision. They are unofficial, are not past papers unless clearly labelled as such, and are not affiliated with, endorsed by or representative of any examination authority. Where a mock test is offered in a proctored format, the proctoring exists to reduce copying; it is not a recognised examination setting and produces no official result.",
          ),
        ],
      },
      {
        id: "ai-features",
        heading: "AI assistant",
        blocks: [
          p(
            "The AI assistant generates responses using a machine-learning model. It can be wrong, incomplete, out of date, or misleadingly confident, and it does not know your personal circumstances unless you tell it. It is a starting point for your own research, never a substitute for official information or a qualified counsellor. Do not rely on it for a decision that affects money, eligibility or an application deadline.",
          ),
        ],
      },
      {
        id: "counselling",
        heading: "Admissions guidance and counselling",
        blocks: [
          p(
            "Where we offer admissions guidance or counselling, it is educational advice. It is not a guarantee of admission, it does not create a duty to achieve any outcome, and it does not authorise us to submit applications, pay fees, accept offers or sign documents on your behalf. Any application you make is between you and the institution concerned.",
          ),
        ],
      },
      {
        id: "fees-and-refunds",
        heading: "Fees and refunds",
        blocks: [
          p(
            "Padhaanewala is currently free: we do not charge for browsing colleges, using the predictor, taking mock tests, or asking the AI assistant, and we do not sell advertising placement or paid listings to colleges. If we introduce any paid feature, it will be clearly marked as paid before you commit to it, and our Refund Policy will apply.",
          ),
          p(
            "Colleges listed on the platform are not charged for appearing or for their position in any comparison or ranking.",
          ),
        ],
      },
      {
        id: "third-party-links",
        heading: "Third-party links",
        blocks: [
          p(
            "The service links to college websites, examination authority pages, scholarship portals and other external resources. We do not control them and are not responsible for their content, accuracy, availability or privacy practices. Following an external link is at your own risk.",
          ),
        ],
      },
      {
        id: "liability",
        heading: "Limitation of liability",
        blocks: [
          p(
            "To the fullest extent permitted by law, and without excluding liability that cannot lawfully be excluded, Padhaanewala and its team are not liable for any indirect or consequential loss, or for loss of profit, income, opportunity, exam result, admission or placement, arising from your use of the service or your reliance on its content. Nothing in these Terms excludes liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot be excluded by law.",
          ),
          p(
            "Where liability cannot be excluded, our total aggregate liability to you for all claims in any twelve-month period is limited to the greater of the amount you have paid us (which is currently nothing) and INR 1,000.",
          ),
        ],
      },
      {
        id: "indemnity",
        heading: "Indemnity",
        blocks: [
          p(
            "You agree to indemnify Padhaanewala against claims, damages and reasonable costs arising from your breach of these Terms, your unlawful use of the service, or content you publish, to the extent permitted by law.",
          ),
        ],
      },
      {
        id: "law",
        heading: "Governing law and jurisdiction",
        blocks: [
          p(
            "These Terms are governed by the laws of India. Subject to the grievance process in our Grievance Redressal page, the courts at Bengaluru, Karnataka have exclusive jurisdiction over any dispute. Nothing in these Terms limits any right or remedy you have under the Consumer Protection Act, 2019 or any other law, or the right to approach the appropriate consumer forum.",
          ),
        ],
      },
      {
        id: "general",
        heading: "General",
        blocks: [
          p(
            "If any provision of these Terms is found unenforceable, the rest remains in force. Failure to enforce a provision is not a waiver of it. You may not assign your rights under these Terms without our written consent; we may assign ours on notice to you, provided your rights are not reduced. Headings are for convenience only.",
          ),
        ],
      },
      {
        id: "contact",
        heading: "Contacting us",
        blocks: [p(`Questions about these Terms: ${SITE.email}.`), p(ADDRESS_LINE)],
      },
    ],
  },

  // ------------------------------------------------------------ cookie policy
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    shortTitle: "Cookies",
    icon: "cookie",
    description: `${SITE.name} sets no cookies. This page explains what cookies are, what we store in your browser instead, and how to clear it.`,
    sections: [
      {
        id: "short-answer",
        heading: "The short answer",
        blocks: [
          p(
            "We set no cookies. Not one. This is not a rounding of “we only set essential cookies” — our servers issue no Set-Cookie header, our code never calls document.cookie, and there is no advertising or analytics script that could set one.",
          ),
          p(
            "Your session and your preferences live in your browser's local storage instead. We have documented every key we use below so you can see exactly what is stored on your device.",
          ),
          note(
            "If a future release introduces cookies or similar storage, this page will be updated with the purpose, name, type and duration of each one before it ships.",
          ),
        ],
      },
      {
        id: "what-cookies-are",
        heading: "What cookies are",
        blocks: [
          p(
            "A cookie is a small text file a website asks your browser to store and send back with later requests. Cookies are widely used for sign-in sessions and for advertising. They can also be read by other websites, which is how cross-site tracking works.",
          ),
        ],
      },
      {
        id: "what-we-store",
        heading: "What we store in your browser instead",
        blocks: [
          p(
            "Local storage is a similar browser store that is never attached to outgoing requests automatically, and that is not readable by other websites. It holds your session and your preferences, on your device only, until you clear it or close the browser.",
          ),
          ul(
            "cp_access_token, cp_refresh_token, cp_user — your sign-in session and the basic account details the interface needs. These are the equivalent of session cookies, stored where JavaScript can read them so the app can call our API.",
            "cp_theme — whether you chose light or dark mode.",
            "cp_saved, cp_saved_courses, cp_saved_scholarships, cp_compare, cp_profile — your shortlisted colleges, courses, scholarships, comparison list and profile selections.",
            "cp_recent_views, cp_recent_searches, cp_recent_locations, cp_compare_history — recently viewed items and your search history, so the site can show “continue where you left off”.",
            "cp_enquiries, cp_test_history, cp_notifications, cp_reviews — your enquiry records, mock-test attempt history, in-app notifications and drafts of your reviews.",
            "pw-exam-plans — the exam dates and study plan you create in the exam planner.",
          ),
          p(
            "One thing worth being aware of: because the session tokens sit in local storage rather than in an httpOnly cookie, they are readable by any script that runs on our pages. We do not run third-party scripts, but this is a deliberate trade-off for a browser-only app. Signing out clears all three keys on this device.",
          ),
        ],
      },
      {
        id: "server-logs",
        heading: "Server logs",
        blocks: [
          p(
            "When you load a page, our servers record your IP address, user agent, requested URL and timestamp in order to serve the request and to detect abuse. This is log data held on the server, not a cookie, and it is not used to track you across websites.",
          ),
        ],
      },
      {
        id: "third-parties",
        heading: "Third parties",
        blocks: [
          p(
            "No third party sets a cookie or runs a tracking script on our pages. We use no Google Analytics, Meta Pixel, Hotjar, Clarity, Segment, Sentry or advertising network. The only external service that receives data you actively generate is the AI provider that answers assistant messages, as described in our Privacy Policy.",
          ),
          p(
            "Some pages link to external websites such as college and scholarship portals. Those sites are governed by their own cookie policies, which are outside our control.",
          ),
        ],
      },
      {
        id: "managing-storage",
        heading: "How to manage or clear what is stored",
        blocks: [
          p(
            "Use the sign-out button, which clears the session keys immediately. To clear everything, open your browser's site-data settings for this domain and clear it; in Chrome and Edge this is the padlock or tune icon in the address bar, then “Cookies and other site data”. Clearing your browser's data will also reset your theme and shortlisted items on that device, but it will not delete anything stored in your account on our servers.",
          ),
        ],
      },
      {
        id: "contact",
        heading: "Questions",
        blocks: [
          p(
            `If anything on this page does not match what you observe in your browser, tell us at ${SITE.email} and we will investigate. We would rather correct a discrepancy than defend it.`,
          ),
        ],
      },
    ],
  },

  // --------------------------------------------------------------- disclaimer
  {
    slug: "disclaimer",
    title: "Disclaimer",
    shortTitle: "Disclaimer",
    icon: "alert",
    description:
      "The limits of what Padhaanewala can promise: the limits of our college, exam and fee data, our lack of affiliation with any examination authority or institution, and the limits of the predictor and AI features.",
    sections: [
      {
        id: "information-only",
        heading: "Information and guidance only",
        blocks: [
          p(
            "Padhaanewala publishes information and educational guidance for students and their parents. Nothing on this site is professional, legal, financial or admissions advice, and nothing on it is an official notification of any authority or institution.",
          ),
        ],
      },
      {
        id: "no-affiliation",
        heading: "We are not affiliated with any authority or college",
        blocks: [
          p(
            "Padhaanewala is an independent information platform. We are not connected to, endorsed by, sponsored by, or acting on behalf of the National Testing Agency, the National Eligibility cum Entrance Test (UGC-NEET) conducting bodies, the Joint Entrance Board, the Karnataka Common Entrance Test Authority, the University Grants Commission, the All India Council for Technical Education, the National Board of Examinations, any State or Central Government department, any university, or any college listed on the site.",
          ),
          p(
            "The names, logos and identifiers of examinations and institutions belong to their respective owners and are used for identification and factual reference only. Mentioning an institution or an examination does not imply that we have any relationship with it, that it endorses us, or that it has reviewed or approved any content on this site.",
          ),
          note(
            "If you believe any content on Padhaanewala misrepresents an institution or examination authority, contact us and we will investigate and correct it.",
          ),
        ],
      },
      {
        id: "accuracy",
        heading: "Accuracy and currency of information",
        blocks: [
          p(
            "Fees, seat intake, cutoffs, eligibility criteria, hostel availability, accreditation grades and placement figures are published by colleges and examination authorities and change frequently, often at short notice. We collect this information from sources we believe to be reliable and review it, but we do not warrant that it is accurate, complete, current, or free of error.",
          ),
          p(
            "Where information on Padhaanewala conflicts with an official notification, on fees, eligibility, exam dates, results, counselling schedules or admission procedures, the official notification prevails without exception. Always verify before you apply, pay or attend a counselling session.",
          ),
        ],
      },
      {
        id: "predictions",
        heading: "College predictor and eligibility estimates",
        blocks: [
          p(
            "The college predictor and any eligibility indication are estimates derived from historical cutoff, seat and applicant data. They are not predictions of a result, not an assurance of admission, and not an offer of a seat. Admission is decided only by the relevant examination authority through its own merit list, counselling and eligibility rules, and by the institution's own admissions process.",
          ),
        ],
      },
      {
        id: "ai",
        heading: "AI-generated content",
        blocks: [
          p(
            "Responses from the AI assistant, and any automated summary, match or comparison shown on the site, are generated by machine-learning models. They can be inaccurate, incomplete, out of date or confidently wrong, and they do not know your individual circumstances. Treat them as a starting point for your own research and verify anything important against an official source. Do not make a decision affecting money, eligibility or a deadline on the basis of an AI response alone.",
          ),
        ],
      },
      {
        id: "reviews",
        heading: "User-generated content",
        blocks: [
          p(
            "Reviews, comments and ratings on Padhaanewala are submitted by users. We do not guarantee that every review is accurate, current or representative of a typical student's experience, and the views expressed are those of the author, not ours. We moderate content and remove material that breaches our Terms, but we cannot verify every submission. If you believe a review is false or defamatory, contact us.",
          ),
        ],
      },
      {
        id: "external-links",
        heading: "External links",
        blocks: [
          p(
            "Links to college websites, examination portals, scholarship sites and other third-party resources are provided for convenience. We do not control those sites and are not responsible for their content, accuracy, availability, security or privacy practices.",
          ),
        ],
      },
      {
        id: "availability",
        heading: "Availability and changes",
        blocks: [
          p(
            "We do not guarantee that the service will be available or uninterrupted, that any feature will remain unchanged, or that the service will be free of defects. We may modify, suspend or withdraw any feature or the whole service at any time. Features described as being in development or beta may change or be removed without notice.",
          ),
        ],
      },
      {
        id: "liability",
        heading: "Limitation of liability",
        blocks: [
          p(
            "To the fullest extent permitted by law, and without excluding liability that cannot lawfully be excluded, Padhaanewala and its team are not liable for any loss or damage arising from your use of the service or your reliance on its content, including any decision you make or any loss of an exam result, admission, placement, fee or opportunity. Nothing here excludes liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot be excluded by law. Our Terms of Service set out the full position.",
          ),
        ],
      },
    ],
  },

  // --------------------------------------------------------------- grievance
  {
    slug: "grievance",
    title: "Grievance Redressal",
    shortTitle: "Grievance",
    icon: "gavel",
    description: `How to raise a complaint with ${SITE.legalName}, who will handle it, how quickly, and how to escalate it if you are not satisfied.`,
    sections: [
      {
        id: "our-commitment",
        heading: "Our commitment",
        blocks: [
          p(
            "Every complaint is read by a person, acknowledged in writing, and tracked to a conclusion. We do not operate an automated-only complaints process, and we do not make you chase us for a status update more than once.",
          ),
        ],
      },
      {
        id: "officer",
        heading: "Grievance Officer",
        blocks: [
          p(
            `In accordance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the following officer is designated to receive and resolve grievances concerning ${SITE.domain}:`,
          ),
          ul(
            `Name: ${GRIEVANCE_OFFICER.name}`,
            `Designation: ${GRIEVANCE_OFFICER.designation}`,
            `Email: ${GRIEVANCE_OFFICER.email}`,
            `Phone: ${GRIEVANCE_OFFICER.phone}`,
            `Postal address: ${GRIEVANCE_OFFICER.postalAddress}`,
          ),
          note(
            "The officer's name is deliberately left unfilled rather than populated with a placeholder name. A grievance notice sent to the wrong individual can delay resolution and may be treated as not served. This must be completed before the site goes live.",
          ),
        ],
      },
      {
        id: "how-to-file",
        heading: "How to file a complaint",
        blocks: [
          p(`Email ${SITE.email} with the subject line “Grievance” and include:`),
          ul(
            "Your full name, and the email address and mobile number registered with your account if you have one.",
            "A clear description of the issue, including the page URL, and roughly when it happened.",
            "The outcome you are seeking: a correction, an explanation, deletion of content, a refund where one is due, or an account change.",
            "Any screenshots or other evidence you have. Please do not send identity documents, and redact any third-party personal information.",
          ),
          p(
            `You do not have to have an account, and you may submit the complaint in English, Kannada or Hindi. We will acknowledge your complaint in writing within 7 days and will aim to resolve it within ${GRIEVANCE_OFFICER.responseWindowDays} days of receipt. If we need longer, we will tell you why and when to expect an answer.`,
          ),
        ],
      },
      {
        id: "what-we-cover",
        heading: "What you can raise with us",
        blocks: [
          ul(
            "Complaints about inaccurate or misleading content on the site, including college, course, fee, cutoff or scholarship information.",
            "A review, comment or other user content that is false, defamatory, offensive, or infringes your rights.",
            "A claim that content you posted has been removed, altered or restricted in a way you believe is wrong.",
            "Any use of your personal data, or any content, that you believe breaches our Privacy Policy.",
            "Difficulty exercising a right you believe you have under the Digital Personal Data Protection Act, 2023 or the Consumer Protection Act, 2019.",
            "Anything else relating to your use of the service that you believe has been handled unfairly.",
          ),
        ],
      },
      {
        id: "escalation",
        heading: "If you are not satisfied",
        blocks: [
          p(
            "If our response does not resolve your complaint, reply to the same thread asking for a review by a senior member of the team. We will escalate it and respond again within 15 days.",
          ),
          p(
            "You are not required to exhaust this process before approaching a regulator, a consumer forum, or the National Consumer Helpline on 1915. Nothing in these Terms or in this process limits any right or remedy available to you under Indian law.",
          ),
        ],
      },
      {
        id: "records",
        heading: "Records and confidentiality",
        blocks: [
          p(
            "Grievances and our responses are recorded so that recurring problems become visible and can be fixed rather than re-argued. We keep these records for as long as needed to resolve the matter and to meet our legal obligations, and we handle them under the same confidentiality rules as the rest of your personal data.",
          ),
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ refund
  {
    slug: "refund",
    title: "Cancellation and Refund Policy",
    shortTitle: "Refunds",
    icon: "wallet",
    description:
      "Padhaanewala is free and does not process payments. This page sets out that position, and the refund rules that will apply if a paid feature is ever introduced.",
    sections: [
      {
        id: "current-state",
        heading: "Our current position: nothing to refund",
        blocks: [
          p(
            "Padhaanewala is free. We do not charge for browsing colleges, courses, exams and scholarships, using the college predictor, taking mock tests, or asking the AI assistant. We do not sell advertising placement or paid listings to colleges, and we never ask for card, UPI, net-banking or wallet details anywhere on this site.",
          ),
          p(
            "As of this version of the policy we have no payment gateway integrated and have taken no payment from any user, so there is no charge to cancel and no refund to process. If you believe you have been charged by something claiming to be Padhaanewala, contact us immediately at the address below and we will investigate; that would be an impersonation attempt, and we will treat it as such.",
          ),
          note(
            "This section exists because a refund policy is a transparency expectation, not a description of a payment system. It is written to state plainly that no money changes hands today, rather than to describe terms for a system that does not exist.",
          ),
        ],
      },
      {
        id: "if-a-paid-feature-launches",
        heading: "If we introduce a paid feature",
        blocks: [
          p(
            "If we launch anything paid, we will publish a separate, specific pricing and cancellation policy for that feature before taking any payment. That policy will replace this page for that feature, and will state the price, the exact start and end of the paid period, and the refund windows below. Nothing on this page is a commitment to launch a paid product.",
          ),
          ul(
            "Full refund if you cancel before the paid period begins.",
            "Pro-rata refund if you cancel part-way through a subscription period, calculated on whole unused days, less any non-refundable items listed at the point of purchase.",
            "No refund for a session or test you have already started and completed, because the service has already been delivered to you.",
            "A full refund where we cancel a feature you bought, or where a paid feature is materially broken and we cannot fix it within a reasonable time.",
          ),
        ],
      },
      {
        id: "how-to-request",
        heading: "How to request a refund",
        blocks: [
          p(
            `Email ${SITE.email} with the subject line “Refund request” and include the email address or mobile number linked to the purchase, the date of the transaction, the amount, and the reason for the request. If you have a payment reference from the gateway, please include that too.`,
          ),
          p(
            "We aim to acknowledge refund requests within 7 days. Approved refunds are initiated within 10 days of approval. If you paid by UPI or card, the amount is returned to the same instrument and usually reaches your account within 5 to 7 working days, depending on your bank. We do not charge a processing fee on refunds.",
          ),
        ],
      },
      {
        id: "disputes",
        heading: "If a refund is declined",
        blocks: [
          p(
            "If we decline a refund, we will tell you in writing and give the specific reason. If you disagree, reply to ask for a review. You can escalate through the process on our Grievance Redressal page, approach the National Consumer Helpline on 1915, or file a complaint with the relevant consumer forum. We would rather resolve a dispute directly than have you take it elsewhere.",
          ),
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        blocks: [
          p(`Questions about payments or refunds: ${SITE.email}.`),
          p(`${ADDRESS_LINE} Phone: ${SITE.phone}.`),
        ],
      },
    ],
  },
];

export const LEGAL_SLUGS = LEGAL_DOCS.map((doc) => doc.slug);

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}

export const legalHref = (slug: string): string => `/legal/${slug}`;

/** Ordered list for the table of contents, the footer row and the sitemap. */
export const LEGAL_NAV = LEGAL_DOCS.map(({ slug, shortTitle, title }) => ({
  slug,
  href: legalHref(slug),
  label: shortTitle,
  title,
}));
