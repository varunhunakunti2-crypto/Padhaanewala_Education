# PADHAANEWALA EDUTECH SERVICES
# BENGALURU - 560100

---

# COMPLETE UNIFIED MASTER DOCUMENT
# Product Specification + Technical Architecture + Legal Compliance + India Scale + Gap Analysis + Implementation Phases

| Field | Detail |
|---|---|
| **Project** | Padhaanewala Education Technology Platform |
| **Website** | padhaanewala.in |
| **Document** | Complete Unified Master Document - Single Source of Truth |
| **Version** | 5.0 FINAL |
| **Scale** | India-Wide (50-100 million+ users) |
| **Status** | Developer-Ready / AI-Coding-Agent-Ready |

---

# HOW TO USE THIS DOCUMENT

## Legend

| Symbol | Meaning |
|---|---|
| **[YOU]** | Manual task - YOU must do this personally |
| **[DEV]** | Developer/AI task - developer or AI coding agent does this |
| **[BOTH]** | Both you and developer involved |
| **[DEPLOY]** | Infrastructure/deployment task |
| **[VERIFY]** | You must verify/test this works |

## Reading Order

1. **Start with YOUR TASKS section below** - do all [YOU] tasks first
2. **Then follow the phases in order** - each phase tells developer what to build
3. **After each phase** - do the [VERIFY] tasks to confirm it works
4. **Don't skip phases** - they are in dependency order

---

# YOUR MANUAL TASKS - DO THESE FIRST

**Before any development begins, you must complete these tasks. Nothing can start until you do.**

---

## STEP 1: CREATE ACCOUNTS [YOU]

**Do this NOW. Takes 1-2 hours.**

| Service | Why | Where | What to Get |
|---|---|---|---|
| GitHub | Code repository | github.com | Account + create private repo `padhaanewala` |
| AWS Account | Servers, database, storage | aws.amazon.com | Root account, enable MFA, set billing alerts |
| OpenAI or Anthropic | AI for chat + predictor | platform.openai.com | API key, set $100/month budget limit |
| MSG91 | SMS/OTP for Indian mobiles | msg91.com | Account, API key, sender ID, DLT registration |
| SendGrid or AWS SES | Email sending | sendgrid.com or AWS SES | Account, API key, verify sender domain |
| Sentry | Error tracking | sentry.io | Account, create project, get DSN |
| Cloudflare | CDN + DNS + WAF | cloudflare.com | Account, add padhaanewala.in domain |
| Google Analytics | Website analytics | analytics.google.com | Create GA4 property, get Measurement ID |
| Google Search Console | SEO monitoring | searchconsole.google.com | Verify padhaanewala.in domain |

**After creating each account, save the credentials in a password manager (NOT in any file).**

---

## STEP 2: BUY/CONFIGURE DOMAIN [YOU]

**Do this NOW. Takes 30 minutes.**

1. Go to your domain registrar (GoDaddy/Namecheap)
2. Ensure `padhaanewala.in` is purchased
3. Point nameservers to Cloudflare
4. In Cloudflare, add DNS records:
   - A record: `padhaanewala.in` → (leave blank for now, add after server is ready)
   - CNAME: `www.padhaanewala.in` → `padhaanewala.in`
   - CNAME: `staging.padhaanewala.in` → (add after staging is ready)

**Don't worry about final DNS until deployment. Just own the domain.**

---

## STEP 3: HIRE/ENGAGE DEVELOPER [YOU]

**Do this NOW. Takes 1-2 weeks.**

1. Give developer this ONE file: `padhaanewala-complete.md`
2. Tell developer to start at **Phase 1** and work sequentially
3. Tell developer to show you progress after every phase
4. Set up weekly review meetings

**What to tell the developer:**
- "Start at Phase 1, follow all phases in order"
- "Every phase: do the work, run tests, show me it works"
- "Don't skip ahead without my approval"
- "Ask me when you need credentials or access"

---

## STEP 4: COMPILE COLLEGE DATA [YOU + DEVELOPER]

**Start during Phase 56-65. Takes 4-8 weeks.**

You need to research and compile:

| Data | Quantity | Source | Format |
|---|---|---|---|
| Colleges | 1000+ | College websites, NIRF, AISHE | CSV spreadsheet |
| Courses | 50+ | Manual research | CSV spreadsheet |
| Scholarships | 100+ | Government portals, scholarship websites | CSV spreadsheet |
| Exams | 50+ | Exam websites (JEE, NEET, etc.) | CSV spreadsheet |
| Placement data | Top 500 colleges | NIRF reports (nirfindia.org) | CSV spreadsheet |
| Cutoff data | Top 500 colleges | JoSAA (josaa.nic.in), MCC (mcc.nic.in) | CSV spreadsheet |
| Blog articles | 20+ | Write yourself or hire content writer | Text files |
| Legal pages | 4-5 | Hire a lawyer | Text files |

**CSV columns for colleges:**
```
College Name, State, District, City, University, Type, Ownership, Website, Phone, Email, Address, Established Year, NAAC Grade, NIRF Rank, Courses Offered, Total Fees, Hostel Available
```

**CSV columns for cutoffs:**
```
College Name, Course, Branch, Exam, Year, Round, Quota, Category, Opening Rank, Closing Rank, Source URL
```

---

## STEP 5: WRITE LEGAL PAGES [YOU]

**Do during Phase 65. Takes 1-2 weeks.**

You need to create (or hire a lawyer to create):

1. **Privacy Policy** - must include:
   - What data you collect
   - How you use it
   - Children's data protection (verifiable parental consent)
   - Grievance Officer details
   - Data stored in India
   - How to request data deletion
   - Available in English AND Hindi

2. **Terms & Conditions** - platform usage terms

3. **Disclaimer** - Padhaanewala is an information platform, not a college, not guaranteeing admissions

4. **Cookie Policy** - what cookies are used

**IMPORTANT: Include Grievance Officer name, email, and phone number in Privacy Policy.**

---

## STEP 6: APPOINT GRIEVANCE OFFICER [YOU]

**Do this before launch. Legally required under IT Rules 2021.**

1. Appoint a person as Grievance Officer (can be you or a team member)
2. Get their name, email, phone number
3. This will be published on the website
4. This person must:
   - Acknowledge complaints within 24 hours
   - Resolve complaints within 15 days
   - Be reachable via published email/phone

---

## STEP 7: CONFIGURE SERVICES [YOU - during development]

**As developer reaches relevant phases, you configure:**

| When Developer Reaches | You Must Configure |
|---|---|
| Phase 3 (SMS/OTP) | MSG91 API key → give to developer |
| Phase 3 (Email) | SendGrid/SES API key → give to developer |
| Phase 9 (AI) | OpenAI API key → give to developer |
| Phase 32 (Storage) | AWS S3 bucket → create and give credentials |
| Phase 83 (Analytics) | GA4 Measurement ID → give to developer |
| Phase 84 (SEO) | Search Console verification → do DNS TXT record |
| Phase 85 (WAF) | Cloudflare WAF rules → configure with developer |

---

## STEP 8: PREPARE CONTENT [YOU - during development]

**While developer builds, you prepare:**

| Content | When Needed | Quantity |
|---|---|---|
| College data CSV | Phase 59 | 1000+ colleges |
| Course data CSV | Phase 60 | 50+ courses |
| Scholarship data CSV | Phase 60 | 100+ scholarships |
| Exam data CSV | Phase 60 | 50+ exams |
| Question bank CSV | Phase 61 | 500+ questions |
| Placement data CSV | Phase 62 | NIRF data for top 500 |
| Cutoff data CSV | Phase 63 | JoSAA/MCC data |
| Blog articles | Phase 65 | 20+ articles |
| Legal pages | Phase 65 | 4-5 pages |
| College photos | Phase 35 | Campus photos for top colleges |
| College logos | Phase 35 | Logos for top colleges |

---

## STEP 9: VERIFY EACH PHASE [YOU - ongoing]

**After every phase, developer shows you:**

1. **Demo** - live working feature on their screen
2. **Tests pass** - all automated tests green
3. **Mobile check** - works on phone
4. **Your approval** - you say "move to next phase"

**Don't let developer skip phases without your verification.**

---

## STEP 10: LAUNCH PREPARATION [YOU - before launch]

**2-4 weeks before launch:**

- [ ] All legal pages published
- [ ] Grievance Officer details on website
- [ ] Privacy Policy in English and Hindi
- [ ] Domain pointing to production server
- [ ] SSL certificate working (HTTPS)
- [ ] Google Analytics tracking
- [ ] Google Search Console verified
- [ ] Sitemap submitted to Google
- [ ] Test on your own phone
- [ ] Test on your own laptop
- [ ] Have 5 friends test the platform
- [ ] All content reviewed for accuracy
- [ ] Backup working
- [ ] Developer gives you all passwords/credentials
- [ ] You have access to: AWS, Cloudflare, GitHub, database, admin panel

---

## STEP 11: POST-LAUNCH [YOU - after launch]

**First 2 weeks:**
- Monitor daily for errors (developer shows Sentry)
- Check analytics daily
- Respond to any user complaints
- Fix critical bugs immediately
- Monitor Google Search Console for indexing

**Monthly:**
- Review analytics report
- Review lead/conversion data
- Add new content (blog, colleges, scholarships)
- Verify data accuracy
- Review user feedback

---

## COMPLETE STEP-BY-STEP TIMELINE

| Week | Your Tasks | Developer Tasks |
|---|---|---|
| **Week 1** | Create all accounts, buy domain, engage developer | Phase 1-2: Project setup, user schema |
| **Week 2** | Configure MSG91, SendGrid credentials | Phase 3-4: Locations, colleges schema |
| **Week 3-4** | Start compiling college data CSV | Phase 5-10: All database schemas |
| **Week 5-6** | Continue data compilation | Phase 11-16: Backend APIs, search, homepage |
| **Week 7-8** | Review college data, start blog content | Phase 17-26: All frontend pages |
| **Week 9-10** | Provide API keys (OpenAI, S3) | Phase 27-35: Admin panel, RBAC, monitoring |
| **Week 11-12** | Write legal pages, appoint grievance officer | Phase 36-44: Notifications, email, placement APIs |
| **Week 13-14** | Finalize college/course/scholarship data | Phase 45-55: AI/RAG, mock tests, proctoring |
| **Week 15-16** | Import data via admin, verify accuracy | Phase 56-65: Data import, verification |
| **Week 17-18** | Review imported data, test all features | Phase 66-75: Security, performance, testing |
| **Week 19-20** | Configure WAF, SSL, DNS | Phase 76-85: Legal compliance, monitoring |
| **Week 21-22** | UAT with 5+ real users | Phase 86-95: CI/CD, staging, production |
| **Week 23-24** | Final checks, launch approval | Phase 96-105: Deployment, smoke tests |
| **Week 25+** | Monitor, fix bugs, add content | Bug fixes, optimization |

---

## WHAT YOU PAY FOR

| Item | Estimated Cost | Who Pays |
|---|---|---|
| Domain (padhaanewala.in) | ₹500-1000/year | You |
| AWS hosting (Year 1) | ₹5-8 lakh/year | You |
| OpenAI API | ₹4-6 lakh/year | You |
| MSG91 SMS | ₹10-20K/month | You |
| SendGrid/SES Email | ₹4-5K/month | You |
| Sentry | ₹5-10K/month | You |
| Cloudflare | Free-₹5K/month | You |
| Developer/team | As per agreement | You |
| Content writer (blog) | ₹10-20K/article | You |
| Lawyer (legal pages) | ₹10-30K one-time | You |

---

---

# ============================================================
# SECTION A: MASTER SPECIFICATION (129 Sections - Full Detail)
# ============================================================
# PADHAANEWALA EDUTECH SERVICES
# BENGALURU â€" 560100

---

# MASTER SPECIFICATION V4
# Complete Product, Feature, Technology, Architecture, Security, Data, AI, Examination, Proctoring, DevOps & Operations Specification

| Field | Detail |
|---|---|
| **Assigned Role** | Website Engineering & Product Development Team |
| **Project** | Padhaanewala Education Technology Platform |
| **Website** | padhaanewala.in |
| **Document** | Complete Product, Technical & Development Requirements |
| **Version** | 4.0 |
| **Scale Target** | India-Wide (50-100 million+ users, millions concurrent during exam season) |
| **Status** | Developer-Ready / AI-Coding-Agent-Ready |

---

# TABLE OF CONTENTS

1. Product Overview
2. Core Business Purpose
3. Technology Stack
4. Domain and Development Environment
5. Website Navigation
6. Homepage
7. College Database
8. College Page
9. Course Database
10. Course Page
11. College Search
12. Natural Language Search
13. College Comparison
14. AI College Predictor
15. AI Architecture
16. AI Education Assistant / AI Chat (RAG-Based)
17. RAG Knowledge Pipeline
18. AI Cost and Abuse Management
19. Scholarship Database
20. Scholarship Page
21. Examination Database
22. Mock Test System
23. Secure Proctored Examination Mode
24. Proctoring Event System
25. Proctoring Risk Engine
26. Proctoring Evidence System
27. Proctoring Consent and Privacy
28. Proctoring Recovery
29. Lockdown / Kiosk Mode
30. Auto-Submission Engine
31. Mock Test Results
32. Question Bank
33. Test Autosave and Concurrency
34. Server-Authoritative Exam Timer
35. Student Registration and Authentication
36. Student Profile and Dashboard
37. Save College / Save Course
38. Admission Enquiry
39. Lead Management / CRM
40. Counsellor System
41. Admin Panel
42. Admin User Management and RBAC
43. Admin User Activity Monitoring
44. CMS
45. Blog / Resources
46. Reviews
47. Media / Gallery
48. WhatsApp Integration
49. Contact Page
50. About Page
51. Legal Pages
52. SEO Infrastructure
53. Programmatic SEO
54. URL and Slug Management
55. Analytics and Event Tracking
56. UTM Tracking
57. Google Services
58. Notification Engine
59. Email, SMS and OTP System
60. Database Architecture
61. Database Engineering
62. API Architecture
63. Search Architecture
64. Cache Architecture
65. Background Job System
66. Scheduled Jobs
67. Media Processing Pipeline
68. Security Architecture
69. WAF / DDoS / Bot Protection
70. Vulnerability Management
71. Observability
72. Performance
73. Mobile Responsiveness
74. Accessibility
75. Error Handling
76. Logging and Monitoring
77. Backup and Disaster Recovery
78. Cloud Architecture
79. Load Balancing and Autoscaling
80. Secret Management
81. Environments
82. CI/CD Pipeline
83. Git and Version Control
84. Third-Party Integration Resilience
85. Internationalization Foundation
86. Offline / Connectivity Handling
87. Payment-Ready Architecture
88. Data Import and Ingestion
89. Data Verification Workflow
90. Duplicate Detection
91. College Data Verification
92. Fees Data
93. Testing Architecture
94. Documentation and Handover
95. Data and Account Ownership
96. Phased Development
97. Final System Architecture
98. Most Important Development Rules
99. Definition of Ready for Launch
100. Future Expansion

---

# 1. PRODUCT OVERVIEW

Padhaanewala should be developed as a **full-stack education discovery, AI assistance, examination, counselling and lead-management platform**, rather than a conventional content website.

### Core Products

```
                    PADHAANEWALA
                         |
       +-----------------+-----------------+
       |                 |                 |
       v                 v                 v
 COLLEGE PLATFORM    AI PLATFORM      EXAM PLATFORM
       |                 |                 |
 Colleges             AI Assistant       Mock Tests
 Courses              RAG                Results
 Scholarships         Predictor          Proctoring
 Exams                AI Search          Performance
 Comparison           Recommendations    Question Bank
       |                 |                 |
       +-----------------+-----------------+
                         v
                  BUSINESS PLATFORM
                         |
             Admin / CMS / CRM / Leads
             Counsellors / Analytics
             User Activity Monitoring
             Sub-User Management
                         |
                         v
                 INFRASTRUCTURE
        Cloud / Database / Storage / Security
        Search / Queue / Monitoring / Backup
```

### System Components

| Category | Components |
|---|---|
| **Student-facing** | Website, search, college pages, course pages, predictor, AI chat, mock tests, scholarships, exams, reviews, blog, comparison |
| **Student accounts** | Registration, profiles, saved colleges, test history, enquiries, activity tracking |
| **AI/ML** | RAG-based AI assistant, college predictor, AI proctoring, NLP search |
| **Mock Tests** | Standard tests + secure proctored exams with camera/screen monitoring |
| **Admin** | Full CMS, content management, lead management, proctoring dashboard, settings, sub-user management, user activity monitoring |
| **CRM** | Lead management, counsellor dashboard, follow-ups, attribution |
| **Infrastructure** | Dev + Staging + Production, CI/CD, monitoring, backups, WAF, job queue |

---

# 2. CORE BUSINESS PURPOSE

Padhaanewala should help students:

- Discover colleges
- Search courses
- Compare colleges
- Understand eligibility
- Check fees
- Understand admission procedures
- Find scholarships
- Find examination information
- Take mock tests (standard and proctored)
- Use an AI college predictor
- Ask education-related questions via AI Chat
- Save colleges
- Submit admission enquiries
- Receive counselling assistance

The platform should simultaneously generate and manage admission leads for Padhaanewala.

---

# 3. TECHNOLOGY STACK

| Component | Technology |
|---|---|
| **Frontend** | Next.js 14+ (App Router), React 18+, TypeScript, Tailwind CSS, responsive/mobile-first |
| **Backend** | Python 3.11+, FastAPI, Pydantic, REST API, API versioning |
| **Database** | PostgreSQL 15+ |
| **Vector Database** | pgvector (initial), Pinecone/Weaviate (scale) |
| **Cache / Queue** | Redis 7+ (cache + Celery broker) |
| **Background Jobs** | Celery + Redis |
| **Search** | PostgreSQL full-text (initial), Elasticsearch/OpenSearch (scale) |
| **Storage** | AWS S3 / Cloudflare R2 (S3-compatible) |
| **AI/LLM** | OpenAI / Anthropic / Google (via backend, never frontend) |
| **ML Proctoring** | Separate microservice (camera/screen analysis, MediaPipe/OpenCV) |
| **Auth** | JWT + refresh tokens, bcrypt password hashing |
| **Email** | AWS SES / SendGrid |
| **SMS/OTP** | MSG91 / Twilio |
| **Analytics** | Google Analytics 4, Google Tag Manager, Google Search Console |
| **CDN** | CloudFront / Cloudflare |
| **WAF** | Cloudflare WAF / AWS WAF |
| **Error Tracking** | Sentry |
| **Monitoring** | CloudWatch / Datadog + UptimeRobot |
| **CI/CD** | GitHub Actions |
| **Secrets** | AWS Secrets Manager / Parameter Store |

---

# 4. DOMAIN AND DEVELOPMENT ENVIRONMENT

- Development may use localhost and staging before production domain is configured.
- **Production domain:** padhaanewala.in
- Maintain separate Development, Staging and Production environments.
- Never test major experimental changes directly on production.
- Each environment has independent database, Redis, storage, API keys, secrets.

---

# 5. WEBSITE NAVIGATION

**Main navigation:** Home, Colleges, Courses, College Predictor, Scholarships, Mock Tests, Exams, Reviews, Blog/Resources, About, Contact.

**Also provide:** Login, Register and Get Admission Help.

---

# 6. HOMEPAGE

The homepage must look like a modern education technology platform and NOT like a generic coaching-centre website.

**Hero:**
- "Find the Right College for Your Future"
- Large search bar: "Search colleges, courses, exams or locations"
- Examples: BHMS, BAMS, BUMS, MBBS, BDS, B.Sc Nursing, B.Pharm, D.Pharm, BCA, MBA, Engineering
- Buttons: Search; AI College Predictor

**Quick-action cards:**
- Find Colleges; Compare Colleges; College Predictor; Scholarships; Mock Tests; Admission Assistance

**Homepage sections:**
- Popular courses; Featured colleges; Popular college searches; Scholarships; Upcoming examinations; Mock tests; Why Padhaanewala; Student reviews; Latest education articles; Admission assistance CTA

**Homepage personalization (future-ready):**
- Recently viewed colleges
- Recommended colleges based on profile
- Recently searched courses
- Relevant scholarships
- Predictor CTA based on user profile

All homepage content must be manageable from the admin panel.

---

# 7. COLLEGE DATABASE

Create a structured college database. Every college must have a unique ID, e.g. `COLLEGE000001`.

**Fields:**
- College ID; College name; Short name; Official name
- College type (engineering/medical/arts/commerce/law/pharmacy/nursing/management/paramedical/other)
- Government/private/semi-government
- University; Affiliation
- Accreditation (NAAC grade, NBA, AICTE, MCI/NMC, DCI, CCIM, PCI, INC)
- Recognition
- State; District; City; Address; Pincode
- Latitude; Longitude
- Website; Email; Phone
- Established year
- Campus information
- Overview / description
- Hostel (available, boys, girls, capacity, fee, mess, wifi, AC)
- Facilities (library, lab, computer lab, auditorium, sports, gym, hospital, canteen, transport, wifi, swimming pool, bank/ATM, placement cell)
- Courses (many-to-many)
- Fees (structured: tuition, hostel, examination, other, total, period)
- Eligibility (structured: education, subjects, percentages, age, entrance exam, domicile)
- Admission information
- Admission status
- Entrance examination
- Cutoff (previous years, by category, by round)
- Scholarships
- Reviews; Ratings (count, average)
- Images; Logo; Gallery
- Documents
- FAQs
- SEO metadata

**Data Verification Fields:**
- Data source
- Source URL
- Last verified date
- Next verification date
- Verified by
- Verification status (unverified/pending/verified/rejected)
- Source type

---

# 8. COLLEGE PAGE

Every college must have an individual SEO-friendly page, e.g. `/college/college-name`.

**Header:** College name; Location; College type; Rating/reviews; Apply/Get Admission Help; Compare; Save College.

**Sections:** Overview; Courses; Fees; Eligibility; Admission; Cutoff; Facilities; Hostel; Scholarships; Reviews; Gallery; FAQs; Similar Colleges; Enquiry CTA; WhatsApp CTA.

Each important factual field should display verification status:
```
Annual Fees: â‚¹8,50,000
Source: Official College Website
Verified: 10 September 2026
Status: Verified
```

---

# 9. COURSE DATABASE

Courses must be separate database entities.

**Examples:** MBBS; BDS; BAMS; BHMS; BUMS; B.Sc Nursing; D.Pharm; B.Pharm; BCA; BBA; MBA; Engineering; Paramedical courses; Skill courses.

Each course should have:
- Name; Degree; Category; Duration; Mode
- Eligibility; Entrance requirement; Subjects
- Fees; Average fees
- Admission procedure; Career information
- Colleges offering the course (many-to-many)
- Scholarships; Exams; Cutoffs
- Overview/description; FAQs; SEO metadata
- Official sources

---

# 10. COURSE PAGE

Example: `/courses/bhms`

**Sections:** Overview; Duration; Eligibility; Admission; Entrance exam; Fees; Colleges offering; Career opportunities; FAQs; Related courses.

**CTA:** "Need help choosing a college?" â†' Get Admission Assistance.

---

# 11. COLLEGE SEARCH

Create advanced college search with structured filters:

- Course; State; District; City
- College type; Government/private; University
- Fees range; Hostel; Rating
- Admission status; Accreditation
- Course duration; Entrance exam; Facilities

**Search features:**
- Search suggestions and autocomplete
- Typo tolerance
- Filters with clearing
- Sorting (relevance, rating, fees, name)
- Pagination with result count
- Save search; Share search
- Mobile filters (drawer/bottom sheet)
- Recent searches
- URL-based filters (bookmarkable)

Example: BHMS + Karnataka + Private returns matching colleges.

---

# 12. NATURAL LANGUAGE SEARCH

Allow users to search naturally, for example:
- "BHMS colleges in Karnataka"
- "BAMS colleges near Bangalore"
- "Nursing colleges under 5 lakh"
- "Private BHMS colleges with hostel"

**Architecture:**
```
Natural Language Query
       â†"
AI Query Understanding
       â†"
Intent Classification
       â†"
Filter Extraction + Entity Extraction
       â†"
Structured Filters
       â†"
Search Engine
       â†"
Results (with fallback to normal search)
```

**Additional requirements:**
- Query logging and analytics
- Failed-query analytics
- Fallback to standard search when NLP fails
- Search ranking

---

# 13. COLLEGE COMPARISON

Students should be able to select 2-4 colleges.

**Comparison should show:** Location; Type; University; Course; Duration; Fees; Eligibility; Admission; Hostel; Facilities; Scholarships; Ranking; Rating; Reviews; Establishment year; Accreditation; Placement information.

**Features:** Add/remove; Side-by-side comparison; Highlight differences; Save comparison; Share comparison (WhatsApp, copy link); Mobile comparison (horizontal scroll or cards).

Include: **"Ask AI: Which college is better for me?"** â€" AI recommendations based on verified database information with disclaimer.

---

# 14. AI COLLEGE PREDICTOR

This should be one of the main Padhaanewala features.

**Inputs:** Course; Entrance exam; Rank/score; Category; State; Preferred city; Budget; Government/private preference; Hostel requirement; Other preferences.

**Engine (not just LLM guessing):**
```
Student Profile + College Data + Eligibility + Historical Data + Preferences
       â†"
Prediction Rules Engine (configurable rules, not hard-coded)
       â†"
Ranking Engine
       â†"
AI Explanation Layer
```

**Output:** Highly Suitable; Possible; Reach; Not eligible. Each with reason and confidence basis.

The predictor must clearly state that results are estimates and not guaranteed admissions.

**Required: A formal Prediction Rules Engine** with configurable rules rather than hard-coded logic.

---

# 15. AI ARCHITECTURE

**Recommended flow:**
```
Student â†' Frontend â†' FastAPI â†' Database/Search Engine â†' Relevant verified data â†' AI processing â†' Response
```

- Do NOT allow the AI model to independently invent factual college information.
- The AI should use database information for factual information.
- Where current information is uncertain, the system should indicate that the information needs verification.

---

# 16. AI EDUCATION ASSISTANT / AI CHAT (RAG-BASED)

Add a dedicated **"Ask Padhaanewala AI"** education assistant with conversational chat interface.

### Supported Question Types

- What is BHMS?
- What is the difference between BAMS and BHMS?
- Which course is suitable after 12th?
- Which colleges offer B.Sc Nursing?
- What scholarships are available?
- How does admission work?
- Which colleges match my requirements?
- What is the eligibility for a particular course?
- What are the approximate fees for a course?

### RAG-Based Architecture

```
Student â†' AI Chat Interface â†' FastAPI Backend â†' Intent Detection â†' Query Processing
  â†' RAG Retrieval Layer â†' Verified Padhaanewala Knowledge Base â†' Relevant Context
  â†' LLM â†' Citation / Source Attribution â†' Response
```

**The RAG system must retrieve from:**
- College database; Course database; Scholarship database; Examination database
- Mock-test information; FAQs; Admission information
- Verified educational content; Blogs/resources

**Core rules:**
- The AI must use retrieved information as the primary factual context.
- The AI must **not independently invent** college names, fees, dates, eligibility.
- If relevant information cannot be found, clearly state "I could not verify this information" and recommend checking the official institution.
- Never guarantee admission, scholarships, ranks or outcomes.
- Clearly distinguish verified information from general guidance.
- Provide disclaimer when information may change.
- Log AI errors/failures for administrator review.
- Never expose AI API keys to the frontend.

---

# 17. RAG KNOWLEDGE PIPELINE

### Complete Pipeline

```
Source (DB entities, documents, blogs)
  â†"
Ingestion
  â†"
Cleaning
  â†"
Normalization
  â†"
Chunking (500-1000 tokens, with overlap)
  â†"
Metadata Creation
  â†"
Embedding Generation (OpenAI ada-002 or similar)
  â†"
Vector Database (pgvector)
  â†"
Retrieval (cosine similarity, top-K, score threshold)
  â†"
Metadata Filtering (entity_type, verification_status, date)
  â†"
Reranking
  â†"
Context Construction
  â†"
Prompt Construction (system prompt + context + user question)
  â†"
LLM Response Generation
  â†"
Source Attribution
  â†"
Confidence/Reliability Handling
  â†"
Response Post-Processing (disclaimers, citations)
  â†"
Log for Monitoring
```

### Metadata per Chunk

- Entity type; Entity ID
- Source; Source URL
- Content type; Version
- Created date; Updated date
- Verified date; Language
- Authority; Status

### Re-Indexing

- On entity update (college, course, etc.)
- On admin manual trigger
- Scheduled full reindex (weekly)

### RAG Evaluation System (Required)

Test:
- Retrieval precision and recall
- Citation accuracy
- Answer correctness
- Hallucination rate
- Outdated information detection
- Regression testing

---

# 18. AI COST AND ABUSE MANAGEMENT

**Controls (Required):**
- Per-user rate limit (20 requests/minute)
- Daily request limit per user
- Token limit per request
- IP throttling
- Model selection (GPT-4 for quality, GPT-3.5 for speed)
- Model fallback on provider failure
- Usage tracking per user
- Cost tracking per query
- Admin dashboard for AI usage
- Prompt-injection detection
- Sensitive-data filtering on inputs
- Abuse detection
- Input/output length limits

---

# 19. SCHOLARSHIP DATABASE

Create a separate scholarship database.

**Fields:** Scholarship name; Provider; Government/private; Eligibility; State; Course; Category; Income criteria; Amount; Application deadline; Documents required; Application procedure; Official website/source; Status; Last verified date; Next verification date.

**Filters:** Course; State; Student category; Income; Government/private; Deadline.

**Features:** Search; Filters; Eligibility checker; Save scholarship; Deadline reminder; Related scholarships; Application CTA.

---

# 20. SCHOLARSHIP PAGE

Each scholarship should have: Scholarship name; Provider; Amount; Eligibility; Deadline; Required documents; Application process; Official application link; FAQs.

Clearly distinguish **Official** scholarship application from Padhaanewala counselling/admission assistance.

---

# 21. EXAMINATION DATABASE

Create `/exams`. Each exam should include: Exam name; Conducting authority; Exam type; Eligibility; Application start date; Application deadline; Exam date; Admit card date; Result date; Official website; Official notification; Syllabus; FAQs; Related courses; Related colleges.

**Features:** Exam search; Upcoming exams; Exam calendar; Deadline alerts; Save exam; Exam reminders.

All dates must be editable through the admin panel.

---

# 22. MOCK TEST SYSTEM

Create a dedicated full-screen **Mock Test Platform** under `/mock-tests`.

### Test Creation (Admin)

Admin can configure: Exam; Course; Subject; Difficulty; Number of questions; Duration; Question type; Marks; Negative marking; Attempts allowed; Question randomization; Option randomization; Instructions; Result visibility.

### Test Selection

The Mock Test landing page should allow students to select: Examination; Course/subject; Mock test; Difficulty level; Number of questions; Test duration; Test type (Standard / Proctored).

### Test Interface

**Platform Restriction: The mock test/exam portal must open ONLY on web browsers on laptops or desktop computers. Mobile phones and tablets are NOT supported for taking mock tests.**

**Reason:** Exam integrity requires a proper screen size, stable camera position, full-screen mode, and a controlled environment that mobile devices cannot reliably provide. Proctoring (camera monitoring, screen recording, fullscreen enforcement) does not work effectively on mobile browsers.

**Implementation:**
- On page load, detect device type via User-Agent
- If mobile or tablet detected, show message: "Mock tests are available on laptop/desktop only. Please open on a computer browser."
- Block test start on mobile devices
- Allow browsing test listings and instructions on mobile (for discovery)
- Only the actual test-taking interface (`/mock-tests/{slug}/attempt`) is blocked on mobile
- Standard (non-proctored) tests: also desktop-only for consistency
- Future: if mobile proctoring solution is developed, this restriction may be revisited

**Supported browsers for test-taking:**
- Chrome (latest 2 versions) â€" recommended
- Firefox (latest 2 versions)
- Edge (latest 2 versions)
- Safari (latest version) â€" on macOS only

**Minimum desktop requirements:**
- Screen resolution: 1024x768 minimum, 1366x768+ recommended
- Stable internet connection (5+ Mbps recommended for proctored tests)
- Working webcam (for proctored tests)
- Modern browser with JavaScript enabled

The test interface should provide: Full-screen examination view; Countdown timer; Question number; Question navigation; Previous/Next controls; Answer selection; Mark for review; Answered/unanswered indicators; Remaining time; Submit Test button; Auto-submit when timer ends.

The student should not be required to navigate through unrelated website pages while taking the test.

---

# 23. SECURE PROCTORED EXAMINATION MODE

Mock tests configured as **Proctored Tests** operate in secure examination mode.

**Device Restriction: Proctored tests are ONLY available on desktop/laptop computers (Windows, macOS, Linux). Mobile phones and tablets are completely blocked from starting proctored tests. The pre-test checks will first verify the device is a desktop/laptop before proceeding.**

### Pre-Test Checks

Before starting a proctored test:
- **Device check: verify desktop/laptop (block mobile/tablet immediately)**
- Camera access request and verification
- Microphone access (if required)
- Screen sharing permission (if required)
- Browser capability check
- Full-screen mode entry
- Permission status verification
- Network check
- Device information capture
- Explicit consent recording

The student must be clearly informed about what is being recorded, why, how long retained, and how data is handled.

### Full-Screen Mode

- Request browser full-screen mode before examination starts.
- Detect when student exits full-screen mode.
- Strict enforcement: exiting generates violation event and may trigger auto-submission per policy.

---

# 24. PROCTORING EVENT SYSTEM

During proctored tests, monitor and record:

| Event Code | Description |
|---|---|
| `FACE_NOT_DETECTED` | Student face not visible |
| `MULTIPLE_FACES` | More than one face detected |
| `LOOKING_AWAY` | Prolonged gaze away from screen |
| `CAMERA_DISABLED` | Camera turned off or blocked |
| `SCREEN_SHARE_STOPPED` | Screen sharing ended |
| `TAB_SWITCH` | Browser tab switched |
| `WINDOW_BLUR` | Examination window lost focus |
| `FULLSCREEN_EXIT` | Exited full-screen mode |
| `COPY_ATTEMPT` | Copy action attempted |
| `PASTE_ATTEMPT` | Paste action attempted |
| `PROCTORING_PERMISSION_REVOKED` | Required permission withdrawn |

Each event records: Timestamp; Severity; Confidence score; Action taken; Evidence reference; Attempt ID; Session ID.

---

# 25. PROCTORING RISK ENGINE

Do NOT use simplistic "look away = cheating" logic.

```
Detection â†' Confidence â†' Event â†' Severity â†' Risk Score â†' Policy â†' Action
```

**Risk levels:**
```
Normal â†' Low Risk â†' Warning â†' High Risk â†' Critical Violation
```

The final action is controlled by the examination policy. AI-generated detection is treated as an **assistive signal**, with configurable human review for high-impact cases.

---

# 26. PROCTORING EVIDENCE SYSTEM

```
Exam Attempt â†' Proctoring Session â†' Events â†' Evidence â†' Encrypted Object Storage â†' Retention Policy â†' Automatic Deletion
```

**Requirements:**
- Encryption at rest and in transit
- Access control (authorized admins only, presigned URLs with short expiry)
- Evidence references in event logs
- Configurable retention period
- Automatic deletion after retention
- Admin review permissions
- Download restrictions
- Audit logging on all evidence access
- Private S3 bucket (NOT public)

---

# 27. PROCTORING CONSENT AND PRIVACY

Do not store only `consent = true`. Store:
- Student ID; Test ID
- Consent version; Privacy policy version
- Timestamp; IP address
- Device information
- Permissions granted (camera, microphone, screen)
- Consent type
- What is collected; Purpose; Retention period; Who may access
- Consequences of refusing mandatory proctoring

Obtain required consent BEFORE activating proctoring.

---

# 28. PROCTORING RECOVERY

Handle gracefully:
- Internet disconnection
- Camera disconnection
- Screen-share interruption
- Browser refresh
- Browser crash
- Laptop sleep
- Server interruption

```
Disconnect â†' Reconnect â†' Restore session â†' Synchronize answers â†' Resume or terminate per policy
```

---

# 29. LOCKDOWN / KIOSK MODE

**Critical technical limitation:** A normal browser **cannot guarantee OS-level blocking of every extension, application or external activity.**

| Capability | Browser-Based (Best Effort) | Lockdown/Kiosk Browser |
|---|---|---|
| Tab switching detection | Yes (visibility API) | Yes (prevented) |
| Window blur detection | Yes | Yes (prevented) |
| Full-screen exit detection | Yes | Yes (prevented) |
| Copy/paste prevention | Partial (JS events) | Yes (blocked) |
| Context menu blocking | Yes | Yes |
| Keyboard shortcuts | Partial (detect, not block) | Yes (blocked) |
| Disable browser extensions | **No** | Yes |
| Disable other applications | **No** | Yes |
| Disable additional tabs | **No** | Yes |
| System-level monitoring | **No** | Yes |

For high-security examinations, use approved **lockdown/kiosk browser** (Safe Exam Browser, Respondus LockDown Browser, or custom Electron kiosk app).

---

# 30. AUTO-SUBMISSION ENGINE

**Triggers:**
1. Timer reaches zero
2. Student manually submits
3. Student switches tab/window (strict policy)
4. Student exits full-screen (strict policy)
5. Mandatory screen monitoring disabled
6. Mandatory camera access disabled
7. Critical proctoring violation detected
8. Configured violation threshold reached

**When auto-submission occurs:**
- Save all current answers
- Save exact submission timestamp
- Save submission reason (e.g. `AUTO_SUBMITTED_PROCTORING_VIOLATION`)
- Save proctoring events
- Prevent further modification
- Generate result according to test rules

**Server must remain the authoritative source for test timing and submission state.**

---

# 31. MOCK TEST RESULT

After submission, show:
- Score; Percentage
- Correct answers; Incorrect answers; Unattempted questions
- Time taken
- Topic-wise performance
- Rank/percentile where meaningful
- Test completion status
- Submission reason (if auto-submitted)

**For proctored tests, additionally show:**
- Proctoring status; Number of violations; Violation types; Violation timestamps
- AI risk score; Auto-submission reason

**Buttons:** Practice Again; View Solutions; Review Performance.

---

# 32. QUESTION BANK

### Question Types

| Type | Description | Answer Format |
|---|---|---|
| Single Choice (MCQ) | One correct from 4 options | Single option ID |
| Multiple Choice | One or more correct from 4+ options | Array of option IDs |
| True/False | Statement true or false | Boolean |
| Assertion-Reason | Assertion + Reason relationship | Single option ID |

### Question Schema

- Question ID; Subject; Topic; Sub-topic
- Difficulty (Easy/Medium/Hard/Expert)
- Question type; Question text (supports images, LaTeX)
- Options (with optional images)
- Correct answer(s); Explanation
- Positive marks; Negative marks
- Time estimate; Source/reference
- Status (Active/Inactive/Under Review)

### Question Security

- Server-side answer validation
- No answer leakage to client before submission
- Question randomization per attempt
- Option randomization per attempt
- Attempt-specific question selection
- Anti-replay protection

---

# 33. TEST AUTOSAVE AND CONCURRENCY

```
Answer selected â†' Client state â†' Server autosave â†' Acknowledgement
```

**Handle:**
- Network failure and retry
- Duplicate request prevention
- Conflict resolution (last-write protection)
- Attempt locking
- Server synchronization
- Offline answer buffering with reconnect sync

---

# 34. SERVER-AUTHORITATIVE EXAM TIMER

**This is critical. The browser timer must NEVER be the authority.**

```
Server Start Time â†' Attempt Created â†' Server Expiry Timestamp â†' Browser Countdown (display only)
```

The server records started_at and submitted_at. Client-side timer is for display only.

---

# 35. STUDENT REGISTRATION AND AUTHENTICATION

Students should be able to register using Mobile OTP and/or Email/Password.

**Registration:** Name; Mobile; Email; Password. Do not store passwords as plain text. Use secure password hashing (bcrypt, 12 rounds).

**Authentication:** Login; Logout; Forgot password; Reset password; Session management; Device/session management; Account email verification; Mobile OTP verification.

**Future-ready:** Social login (Google, etc.).

---

# 36. STUDENT PROFILE AND DASHBOARD

**Profile:** Name; Mobile; Email; Education; Course interest; Preferred state; Preferred city; Budget; Saved colleges; Test history; Scholarship interests; Enquiries.

**Dashboard sections:**
```
My Dashboard
â"œâ"€â"€ Profile
â"œâ"€â"€ Saved Colleges
â"œâ"€â"€ Saved Courses
â"œâ"€â"€ Comparisons
â"œâ"€â"€ Enquiries
â"œâ"€â"€ Lead Status
â"œâ"€â"€ Mock Tests
â"œâ"€â"€ Results
â"œâ"€â"€ Performance Analytics
â"œâ"€â"€ Predictor History
â"œâ"€â"€ AI Chat History
â"œâ"€â"€ Scholarship Interests
â"œâ"€â"€ Exam Notifications
â"œâ"€â"€ Notifications
â""â"€â"€ Account Settings
```

---

# 37. SAVE COLLEGE / SAVE COURSE

Students should be able to save colleges and courses. Saved items appear under My Colleges / My Courses. Students can compare saved items.

---

# 38. ADMISSION ENQUIRY

Every important page should have **Get Admission Assistance**.

**Form:** Name; Mobile; Email; Course; Preferred college; State; City; Qualification; Message.

After submission: "Thank you. Our counsellor will contact you."

The enquiry must immediately enter the admin/CRM system with: Source page URL; UTM parameters; Timestamp; Device type; IP address (for analytics, not exposed publicly).

---

# 39. LEAD MANAGEMENT / CRM

### Lead Fields

Lead ID; Student name; Mobile; Email; Course; College; Source; Landing page; UTM parameters; Date; IP/device; Assigned counsellor; Status; Notes; Follow-up date; Outcome.

**Statuses:** New; Contacted; Interested; Application Started; Admission Completed; Not Interested; Closed.

**Lead Flow:**
```
Student â†' Enquiry â†' Lead â†' Assignment â†' Counsellor â†' Follow-up â†' Outcome
```

**Assignment algorithms:** Round robin; Course-based; Geography-based; Availability-based; Manual; Overflow to admin.

---

# 40. COUNSELLOR SYSTEM

**Counsellor dashboard:** Assigned leads; New leads; Pending follow-ups; Today's follow-ups; Contacted; Interested; Converted; Lost; Notes; Call history; Enquiry history.

Use role-based access so counsellors cannot access information they are not authorized to see.

---

# 41. ADMIN PANEL

Admin must be able to manage the entire platform.

**Modules:**
- Dashboard
- Colleges
- Courses
- Scholarships
- Exams
- Mock Tests (including proctoring configuration)
- Question Bank
- Students
- Reviews
- Leads
- Counsellors
- Blogs
- FAQs
- Media
- Banners
- Notifications
- SEO
- Settings
- Audit Logs
- Proctoring Dashboard
- AI/RAG Knowledge Base
- User Activity Monitoring
- Sub-User Management
- Analytics
- Data Import
- Data Verification
- Legal Compliance

---

# 42. ADMIN USER MANAGEMENT AND RBAC

### Sub-User Creation

The Super Admin / Admin must be able to create additional admin-level users with **granular, limited permissions**. Each sub-user can access ONLY the modules and actions that the Admin explicitly grants.

**Permission Structure:**
```
Role
  â†"
Module Permission (which modules can they access)
  â†"
Action Permission (what can they do within each module)
```

**Pre-defined Roles (configurable):**

| Role | Description |
|---|---|
| **Super Admin** | Full access to everything including user management |
| **Admin** | Full access except user management |
| **Content Manager** | Colleges, courses, scholarships, exams, blogs, FAQs |
| **SEO Manager** | SEO metadata, sitemaps, programmatic SEO |
| **Data Manager** | Data import, verification, bulk operations |
| **Test Admin** | Mock tests, questions, proctoring configuration |
| **Proctor** | Proctoring dashboard, session review |
| **Counsellor Manager** | Lead assignment, counsellor management |
| **Counsellor** | Assigned leads only |
| **Reviewer** | Review moderation |
| **Support** | Enquiries, student support |
| **Analytics** | Analytics dashboard, reports (read-only) |

**Available Actions per Module:**
- View; Create; Edit; Publish; Unpublish; Delete; Export; Import; Approve; Reject; Assign; Review; Moderate

**Sub-User Management Features:**
- Create sub-user (Admin selects role + custom permissions)
- Edit permissions (add/remove module access, change actions)
- Deactivate/activate sub-user
- View sub-user activity logs
- Reset sub-user password
- View last login time and IP
- Audit log of all permission changes

**Each sub-user has:**
- Unique login credentials
- Role assignment
- Custom permission overrides
- Activity tracked and logged
- Cannot grant permissions beyond their own level
- Cannot access modules they don't have permission for

---

# 43. ADMIN USER ACTIVITY MONITORING

### Complete User Activity Tracking

The Admin panel must provide comprehensive visibility into **everything users do on the platform**. This is essential for quality assurance, lead management, and platform governance.

**What Admin Can See:**

#### Student Profile Data
- Full name; Mobile; Email
- Education level; Course interests
- Preferred state; City; Budget
- Registration date; Last login; Login count
- Device information; Browser; OS
- Account status (active/inactive)

#### User Search Activity
- All past searches (query text, filters used, results count, timestamp)
- Search frequency per student
- Most searched courses/states by student
- Search patterns over time
- Failed searches (no results)
- Searches that led to college views
- Searches that led to enquiries

#### User Browsing Activity
- Colleges viewed (with timestamps, duration)
- Courses viewed
- Scholarships viewed
- Exams viewed
- Blog articles read
- Pages visited (session recordings optional)
- Time spent on each page
- Navigation path through site

#### User Interaction Activity
- Colleges saved / unsaved
- Courses saved / unsaved
- Comparisons created
- Reviews submitted (including rejected)
- AI chat conversations (queries and responses)
- AI predictor usage (inputs and results)
- Mock tests taken (test, score, time, violations)
- WhatsApp clicks (with context)
- Phone clicks
- CTA clicks

#### Enquiry and Lead Activity
- Enquiries submitted (source, page, UTM, timestamp)
- Lead status history
- Counsellor notes and follow-ups
- Communication history

#### User Search History Detail
For each student, Admin can view a complete search history:
```
Student: Rahul Kumar
Date: 10 September 2026, 14:32
Search: "BHMS colleges in Karnataka"
Filters: State=Karnataka, Type=Private, Hostel=Yes
Results: 12 colleges
Action: Viewed 3 colleges, Saved 1

Date: 10 September 2026, 14:45
Search: "BHMS colleges in Bangalore"
Filters: City=Bangalore
Results: 5 colleges
Action: Viewed all 5, Enquiry submitted
```

### Admin Activity Monitoring Dashboard

**Dashboard shows:**
- Active users right now
- Users active today / this week / this month
- Total registered users
- New registrations today
- Most active students
- Most viewed colleges (real-time)
- Most searched courses (real-time)
- Recent enquiries
- Recent AI queries
- Recent mock test completions

**Student detail view in Admin:**
- Click on any student â†' full profile + complete activity timeline
- Search history tab
- Browsing history tab
- Interactions tab
- Enquiries tab
- Test history tab
- AI chat history tab
- Saved items tab
- Notes (admin can add private notes about student)

### Privacy and Compliance

- Activity data is internal to Padhaanewala admin only
- Never expose individual user activity to other students
- Activity data follows data retention policies
- Students should be informed in Privacy Policy that activity is tracked
- Admin activity (who viewed what student data) is itself logged
- Sensitive data access is audit-logged

---

# 44. CMS

Non-technical administrators must be able to update website content. Admin should be able to Add, Edit, Delete, Publish, Unpublish and Schedule content.

**Content types:** Colleges; Courses; Scholarships; Exams; Blogs; FAQs; Homepage content; Banners; Menus; Footer links; SEO metadata; Notification templates.

**Workflow:**
```
Draft â†' Review â†' Approved â†' Published â†' Updated â†' Re-verification
```

---

# 45. BLOG / RESOURCES

Create `/blog`.

**Categories:** Admissions; NEET; AYUSH; Nursing; Scholarships; Careers; Exams; College guides; Education news.

Each article needs: Title; Slug; Content (rich text editor); Featured image; Category; Author; Meta title; Meta description; Canonical URL; Publish status; Schedule publish.

---

# 46. REVIEWS

Students can submit: College; Course; Year; Rating (1-5); Review text; Optional images.

**Reviews must go through moderation:** Submitted â†' Moderation â†' Approved â†' Published.

Admin should be able to reject spam, abusive or inappropriate content with notes.

One review per student per college (update allowed). College average_rating and total_reviews auto-updated.

---

# 47. MEDIA / GALLERY

### Upload Pipeline
```
Upload â†' MIME Validation â†' Size Validation â†' Malware Scan â†' Image Processing â†' Resize â†' Compress â†' WebP/AVIF â†' Object Storage â†' CDN
```

### Image Variants

| Variant | Size | Purpose |
|---|---|---|
| Original | Original | Archive |
| Large | Max 1200px width | Desktop detail |
| Medium | Max 800px width | Listing pages |
| Small | Max 400px width | Cards, thumbnails |
| WebP | Same dimensions | Optimized delivery |

### File Constraints

| Type | Max Size | Formats |
|---|---|---|
| College/Blog images | 5 MB | JPG, PNG, WebP |
| Profile avatar | 1 MB | JPG, PNG, WebP |
| Review images | 2 MB | JPG, PNG, WebP |
| CSV import | 10 MB | CSV, XLSX |

### Media Library (Admin)
Grid view; Filter by type; Search; Upload (drag and drop); Bulk delete; Image details; Replace image; Alt text management.

---

# 48. WHATSAPP INTEGRATION

Add WhatsApp CTA where appropriate with dynamic contextual messages:

| Context | Message |
|---|---|
| College page | "Hello Padhaanewala, I am interested in admission at [College Name]." |
| Course page | "Hello Padhaanewala, I am interested in [Course Name] course." |
| General | "Hello Padhaanewala, I need guidance about education options." |

The WhatsApp number must be configurable from admin/settings panel. Track WhatsApp click analytics.

---

# 49. CONTACT PAGE

Include: Company information; Phone; Email; WhatsApp; Working hours; Contact form (submits to enquiry API); Location/map; Social links.

---

# 50. ABOUT PAGE

Explain: Padhaanewala; Mission; Vision; Services; College discovery; Student support; Counselling.

Avoid legally risky or unverifiable claims.

---

# 51. LEGAL PAGES

Create: Privacy Policy; Terms & Conditions; Disclaimer; Cookie Policy; Refund/Cancellation Policy (if payments introduced). All editable from admin CMS.

---

# 52. SEO INFRASTRUCTURE

Every important page must have: SEO title; Meta description; Canonical URL; Open Graph metadata; Structured data (JSON-LD); Sitemap; Robots.txt; Clean URL.

**Structured data types:**
- WebSite (homepage)
- Organization (homepage)
- CollegeOrUniversity (college pages)
- Course (course pages)
- Scholarship (scholarship pages)
- Event (exam pages)
- Article (blog pages)
- FAQPage (pages with FAQs)
- BreadcrumbList (all pages)

Example: `/colleges/bhms-colleges-in-karnataka` is preferable to `/page?id=123`.

---

# 53. PROGRAMMATIC SEO

The platform may automatically create useful pages such as BHMS colleges in Karnataka, BAMS colleges in Karnataka, Nursing colleges in Bihar.

**Rules:**
- Only generate pages with sufficient content (>= 3 colleges)
- Unique, informative content per page (not thin content)
- Include in sitemap
- Mark low-quality pages as noindex
- Do NOT generate thousands of low-quality duplicate pages

---

# 54. URL AND SLUG MANAGEMENT

### Slug Rules
- Lowercase only; spaces to hyphens; remove special characters
- Maximum 80 characters
- Auto-generate from title, allow manual override
- Check uniqueness before saving
- Old slugs redirect to new slug (301)

### Redirect Management
Maintain redirects table: old_url â†' new_url â†' redirect_type (301/302) â†' created_at â†' expires_at. Admin can add manual redirects. System auto-creates redirects when slugs change.

---

# 55. ANALYTICS AND EVENT TRACKING

### Event Taxonomy

| Event | Properties |
|---|---|
| `page_view` | page, referrer |
| `college_view` | college_id, duration |
| `course_view` | course_id, duration |
| `scholarship_view` | scholarship_id |
| `exam_view` | exam_id |
| `search` | query, filters, result_count |
| `predictor_use` | inputs, result_count |
| `enquiry_submit` | source, page |
| `register` | method |
| `login` | method |
| `whatsapp_click` | context, entity |
| `phone_click` | context |
| `mock_test_start` | test_id |
| `mock_test_submit` | test_id, score |
| `ai_chat_message` | query_length, response_time |
| `save_college` | college_id |
| `compare_colleges` | college_ids |
| `blog_view` | blog_id |
| `review_submit` | college_id, rating |

---

# 56. UTM TRACKING

Support `utm_source`, `utm_medium`, `utm_campaign` and `utm_content`. Associate campaign information with leads and enquiries.

---

# 57. GOOGLE SERVICES

Configure: Google Analytics 4; Google Tag Manager (optional); Google Search Console.

Track: searches; college views; predictor usage; enquiries; registrations; WhatsApp clicks; phone clicks; scholarship clicks; mock test events.

Set up conversion tracking for: enquiry submissions; registrations.

---

# 58. NOTIFICATION ENGINE

Create one central notification service supporting multiple channels:

```
Notification Service
â"œâ"€â"€ In-app notifications
â"œâ"€â"€ Email notifications
â"œâ"€â"€ SMS notifications
â"œâ"€â"€ WhatsApp notifications
â""â"€â"€ Push notifications (future)
```

**Features:** Templates with variables; Delivery status tracking; Retry on failure; Notification preferences per user; Transactional notifications; Admin broadcasts; Scheduled notifications.

**Notification types:** Enquiry received; Lead assigned; Follow-up reminder; Review approved/rejected; New scholarship; Exam date updated; Test result ready; Proctoring violation; System alert.

---

# 59. EMAIL, SMS AND OTP SYSTEM

### Email Service

Provider: AWS SES or SendGrid.

**Required email types:** Registration verification; Password reset; OTP; Enquiry confirmation; New lead notification; Lead assignment; Weekly/monthly reports.

Requirements: HTML templates with plain-text fallback; Unsubscribe link for non-transactional; Bounce handling; Sending logs.

### SMS / OTP Service

Provider: MSG91 or Twilio.

**OTP requirements:** 6-digit numeric; 5-minute expiry; Max 3 sends per 10 minutes per mobile; Max 5 verification attempts per OTP; OTP stored hashed; Separate records for registration/login/reset; Rate limit 1 OTP per 60 seconds.

---

# 60. DATABASE ARCHITECTURE

### Entity Domains

```
Identity Domain:
  users, student_profiles, admins, counsellors, roles, user_roles,
  sub_user_permissions, activity_logs

Education Domain:
  states, districts, cities, universities, colleges, college_courses,
  courses, fees, admissions, eligibility

Content Domain:
  scholarships, exams, exam_dates, faqs, blogs, categories,
  banners, seo_metadata, media, pages

Engagement Domain:
  reviews, saved_colleges, saved_courses, comparisons, notifications

AI Domain:
  knowledge_sources, knowledge_documents, document_chunks,
  embeddings, rag_queries, ai_conversations, ai_messages, ai_feedback

Examination Domain:
  mock_tests, test_configurations, questions, question_options,
  test_questions, test_attempts, test_answers, test_submission_events

Proctoring Domain:
  proctoring_sessions, proctoring_events, proctoring_policies,
  proctoring_evidence, violation_logs, consent_records

CRM Domain:
  enquiries, leads, lead_notes, lead_status_history, follow_ups

Operations Domain:
  audit_logs, settings, email_logs, sms_logs, analytics_events,
  redirects, data_imports, data_verification_records
```

---

# 61. DATABASE ENGINEERING

Use SQLAlchemy ORM with:
- Alembic for migrations
- Foreign keys on all relationships
- Unique constraints where required
- Check constraints for data integrity
- Indexes on all frequently queried columns
- Composite indexes for multi-column queries
- Full-text search indexes (GIN)
- pgvector extension for embeddings
- Soft delete for important data (colleges, courses)
- Created_at / updated_at on all tables
- Audit fields
- Connection pooling (asyncpg)
- Transaction management
- UUID primary keys

---

# 62. API ARCHITECTURE

Use versioned APIs: `/api/v1/...`

**Required:** Request validation (Pydantic); Response schemas; Standard error format; Authentication (JWT); Authorization (RBAC); Pagination; Filtering; Sorting; Rate limiting; Request IDs for tracing; OpenAPI/Swagger documentation.

**Error format:**
```json
{
  "success": false,
  "error": {"code": "ERROR_CODE", "message": "Human readable", "details": null},
  "request_id": "req_xxx"
}
```

---

# 63. SEARCH ARCHITECTURE

### Initial: PostgreSQL Full-Text Search
- `to_tsvector` / `to_tsquery` for text search
- `pg_trgm` for typo tolerance and similarity
- GIN indexes for performance

### Scale: Elasticsearch / OpenSearch
- Dedicated search cluster
- Real-time indexing from database changes
- Faceted search
- Advanced ranking

### Search Indexing Pipeline
```
Admin Update â†' PostgreSQL â†' Domain Event â†' Background Worker â†' Search Index
```

---

# 64. CACHE ARCHITECTURE

### Cache Rules

| Data | TTL | Invalidation |
|---|---|---|
| Homepage | 5 min | Admin update triggers |
| College list | 5 min | College update triggers |
| College detail | 5 min | College update triggers |
| Course list/detail | 5 min | Course update triggers |
| Scholarship list | 10 min | Scholarship update triggers |
| Exam list | 10 min | Exam update triggers |
| Blog list | 10 min | Blog publish triggers |
| Static lookups | 1 hour | Admin update triggers |
| SEO metadata | 1 hour | SEO update triggers |

### Invalidation Flow
```
Entity Update â†' Database â†' Invalidate Entity Cache â†' Invalidate Related List Caches â†' Update Search Index
```

Use Redis pub/sub for multi-instance cache invalidation.

---

# 65. BACKGROUND JOB SYSTEM

Use **Celery + Redis** for background processing.

```
FastAPI â†' Job Queue (Redis) â†' Celery Worker â†' Task Execution
```

**Required background jobs:**
- Email sending
- SMS/OTP sending
- WhatsApp notifications
- AI processing (embedding generation, RAG indexing)
- Data import processing
- Sitemap generation
- Image processing (resize, compress, WebP)
- Analytics aggregation
- Notification delivery
- Report generation
- Verification reminders
- Search index updates

---

# 66. SCHEDULED JOBS

| Frequency | Jobs |
|---|---|
| **Hourly** | Failed job retry, Queue monitoring |
| **Daily** | Sitemap updates, Deadline checks (scholarships/exams), RAG re-indexing, Verification reminders, Data freshness checks |
| **Weekly** | Full RAG reindex, Backup verification, Data-quality reports |
| **Monthly** | Analytics reports, Expired-content review |

---

# 67. MEDIA PROCESSING PIPELINE

```
Upload â†' MIME Validation â†' Size Validation â†' Malware Scan â†' Image Processing â†' Resize (large/medium/small) â†' Compress â†' Generate WebP/AVIF â†' Store in Object Storage â†' Serve via CDN
```

---

# 68. SECURITY ARCHITECTURE

**Mandatory:**
- HTTPS everywhere; HSTS
- Security headers (CSP, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy)
- Password hashing (bcrypt, 12 rounds)
- JWT with httpOnly cookies; Refresh token rotation
- RBAC on all endpoints
- Admin 2FA
- Rate limiting on all endpoints
- Input validation (Pydantic) on all requests
- SQL injection protection (SQLAlchemy ORM)
- XSS protection (output escaping)
- CSRF protection (SameSite cookies)
- CORS policy (allow only frontend domain)
- File upload validation (type, size)
- Secure cookie attributes
- Origin/Referer header validation
- Never store passwords in plain text
- Never expose API keys in frontend code
- Audit logs on all sensitive operations

---

# 69. WAF / DDOS / BOT PROTECTION

```
Internet â†' Cloudflare â†' WAF â†' DDoS Protection â†' Bot Protection â†' Load Balancer â†' Application
```

Additional: IP throttling; API rate limiting; Suspicious traffic detection; Login abuse protection; OTP abuse protection.

---

# 70. VULNERABILITY MANAGEMENT

CI/CD should run: Dependabot/Renovate; npm audit; pip-audit; Trivy container scanning; Secret scanning; SAST; Dependency scanning.

Pipeline: Git Push â†' Security Scan â†' Tests â†' Build â†' Deploy.

---

# 71. OBSERVABILITY

### Three Pillars: Logs, Metrics, Traces

**Monitor:** API latency (p50, p95, p99); Database latency; Redis; Search latency; AI latency; RAG latency; Queue length; Worker failures; Upload failures; CPU/RAM/Disk; DB connections; Error rate.

**Alerts:** API down; High error rate; Database unavailable; Queue backlog; Disk near full; AI provider failure; Search failure; High latency; SSL certificate expiry.

**Logging:** Structured JSON; Include request_id in all logs; Do NOT log passwords/API keys/tokens/PII; Daily rotation; 30-day retention; Centralized aggregation.

---

# 72. PERFORMANCE

**Targets:** Lighthouse score > 90; LCP < 2.5s; FID < 100ms; CLS < 0.1; INP < 200ms; API p95 < 500ms.

**Optimization:** SSR/ISR where appropriate; Image optimization (next/image); Lazy loading; Code splitting; CDN; Database indexing; Query optimization; Redis caching; Dynamic imports.

---

# 73. MOBILE RESPONSIVENESS

The website must work properly on Android, iPhone, tablets, laptops and desktop. Mobile should not simply be a scaled-down desktop interface. Touch targets >= 44px. Important actions easy to use with touch.

**Exception: The mock test/exam portal (`/mock-tests/{slug}/attempt`) is desktop/laptop ONLY.** Students can browse test listings, view instructions, and check results on mobile, but the actual test-taking interface is blocked on mobile devices. This is for exam integrity â€" proctoring, fullscreen mode, and camera monitoring require a desktop/laptop environment.

---

# 74. ACCESSIBILITY

Implement WCAG 2.1 AA: Proper heading hierarchy; Alt text on all images; Form labels; Keyboard navigation; Focus visible states; Color contrast (4.5:1 minimum); Screen-reader-friendly structure; Skip navigation link; ARIA where necessary.

---

# 75. ERROR HANDLING

Do not expose technical errors to users. Show: "Something went wrong. Please try again." Technical details in server logs only. Consistent error response format across all APIs.

---

# 76. LOGGING AND MONITORING

Maintain application logs for: API errors; Authentication failures; Admin changes; AI failures; Database errors; Proctoring events; Payment errors (future); Background job failures.

Set up monitoring/alerts for critical production failures.

---

# 77. BACKUP AND DISASTER RECOVERY

- Automated daily backups; 30-day retention
- Point-in-time recovery enabled
- Off-site backup (cross-region)
- **RPO:** 1 hour (maximum data loss)
- **RTO:** 4 hours (maximum downtime)
- Periodic restoration testing (monthly)
- Backup encryption
- Disaster runbook documented

---

# 78. CLOUD ARCHITECTURE

```
                   Internet
                      |
                      v
                 Cloudflare (DNS / CDN / WAF)
                      |
                      v
               Load Balancer
                      |
              +-------+-------+
              v               v
          Next.js          FastAPI (multiple instances)
                              |
       +----------+----------+----------+
       v          v          v          v
 PostgreSQL    Redis    Search      Object Storage
 (RDS)                   (OpenSearch)  (S3/R2)
    |
    v
  pgvector

              FastAPI
                 |
         +-------+-------+
         v               v
     Job Workers    ML Proctoring
     (Celery)       (separate service)
         |               |
         v               v
    External APIs    CV/ML Models
```

---

# 79. LOAD BALANCING AND AUTOSCALING

- Application load balancer with health checks
- Multiple API instances behind load balancer
- Horizontal autoscaling based on CPU/request count
- Rolling deployments (zero downtime)
- Worker scaling based on queue depth
- ML proctoring service independent scaling

---

# 80. SECRET MANAGEMENT

Never keep production secrets in Git. Use AWS Secrets Manager or Parameter Store.

**Managed secrets:** Database credentials; Redis credentials; JWT secrets; AI API keys; S3 credentials; Email API keys; SMS API keys; WhatsApp credentials; Encryption keys.

---

# 81. ENVIRONMENTS

```
Development â†' Staging â†' Production
```

Each with independent: Database; Redis; Storage; API keys; AI configuration; Email/SMS providers; Secrets; Domain; Analytics configuration.

---

# 82. CI/CD PIPELINE

```
Developer â†' Git â†' Pull Request â†' Lint â†' Type Check â†' Unit Tests â†' Integration Tests
  â†' Security Scan â†' Build â†' Staging Deploy â†' QA â†' Approval â†' Production Deploy
```

- Staging auto-deploys on develop branch merge
- Production deploys require approval
- Database migrations run on deploy
- Health check verification after deploy
- Automatic rollback on failure

---

# 83. GIT AND VERSION CONTROL

**Branches:** main; develop; feature/*; bugfix/*; hotfix/*.

**Rules:** Pull requests required; Code review; Branch protection; Required CI pass; No direct production commits; No secrets in repository; Conventional commit messages; Release tags (v1.0.0).

---

# 84. THIRD-PARTY INTEGRATION RESILIENCE

Every external API call should implement:
```
Request â†' Failure? â†' Retry (exponential backoff) â†' Retry â†' Retry â†' Circuit Breaker â†' Fallback
```

Include: Maximum retry count (3); Timeout; Circuit breaker pattern; Provider fallback where possible; Error logging; API health status dashboard.

---

# 85. INTERNATIONALIZATION FOUNDATION

Even if multilingual is future: Unicode everywhere; Extractable UI strings; Locale-aware dates; Currency codes (INR); Language field on content; Unicode-safe slugs; Translation-ready CMS.

---

# 86. OFFLINE / CONNECTIVITY HANDLING

- Offline detection and connection status
- Graceful degradation (no blank screens)
- Retry on reconnect
- For mock tests: local answer buffering, server sync on reconnect, conflict resolution

---

# 87. PAYMENT-READY ARCHITECTURE

Not V1, but design for it: Payment â†' Order â†' Transaction â†' Invoice â†' Webhook â†' Reconciliation.

Future: Paid counselling; Premium membership; Subscriptions; Coupons; Refunds; Payment history.

---

# 88. DATA IMPORT AND INGESTION

### Import Pipeline
```
Upload (CSV/Excel) â†' File Validation â†' Schema Validation â†' Normalization â†' Duplicate Detection â†' Preview â†' User Confirmation â†' Import â†' Indexing â†' Audit Log
```

### Requirements
- Import history with ID
- Error report (row number, field, error message)
- Duplicate report
- Rollback capability
- Source tracking
- Field mapping
- Validation rules per column
- Preview before confirm

---

# 89. DATA VERIFICATION WORKFLOW

Education data changes frequently.

```
Draft â†' Verification â†' Review â†' Publish â†' Periodic Re-verification
```

**Verification dashboard shows:** Data needing verification; Expired verification; Upcoming verification; Source; Last verified; Assigned reviewer; Status.

---

# 90. DUPLICATE DETECTION

The import system should detect possible duplicate colleges using fuzzy name matching. Do not create duplicate records because names differ slightly (e.g. "St. John's Medical College" vs "Saint Johns Medical College").

---

# 91. COLLEGE DATA VERIFICATION

Every important college record contains: Data source; Source URL; Last verified date; Next verification date; Verified by; Verification status; Source type.

**Possible sources:** Official college website; Official government source; Regulatory authority; University; Verified institutional communication.

---

# 92. PLACEMENT DATA AND SALARY INFORMATION

### Why This Is Critical

Placement data is the **#1 factor** students use to compare colleges. Every major Indian education platform (CollegeDunia, Shiksha, Careers360) prominently displays placement statistics. Without placement data, Padhaanewala will not be competitive.

### Placement Database Fields

Each college-course-branch combination must store:

- Academic year (e.g. "2024-25")
- Total graduating students
- Total placed students
- Placement percentage
- Students going for higher studies
- Median salary package (LPA)
- Average salary package (LPA)
- Highest salary package (LPA)
- Lowest salary package (LPA)
- Total participating recruiters
- Top recruiting companies (JSON array)
- Branch-specific data (CSE, ECE, Mechanical, etc.)
- Data source (NIRF / College Website / Verified)
- Source URL
- Verified date

### Placement Display on College Page

```
College Detail â†' Placement Section
â"œâ"€â"€ Overall Placement Stats (current year)
â"‚   â"œâ"€â"€ Placement %: 92%
â"‚   â"œâ"€â"€ Median Salary: â‚¹8.5 LPA
â"‚   â"œâ"€â"€ Highest Salary: â‚¹45 LPA
â"‚   â""â"€â"€ Top Recruiters: TCS, Infosys, Wipro, Accenture
â"œâ"€â"€ Year-wise Trend (graph: 3-5 years)
â"œâ"€â"€ Branch-wise Placement Table
â"‚   â"œâ"€â"€ CSE: 98% placed, â‚¹12 LPA median
â"‚   â"œâ"€â"€ ECE: 90% placed, â‚¹8 LPA median
â"‚   â"œâ"€â"€ Mechanical: 78% placed, â‚¹5 LPA median
â"‚   â""â"€â"€ Civil: 70% placed, â‚¹4 LPA median
â"œâ"€â"€ Salary Distribution Graph
â""â"€â"€ ROI Calculator
```

### ROI (Return on Investment) Feature

```
ROI = (Average Salary Ã- 30 career years) / Total College Cost

College A: â‚¹8L fees, â‚¹12 LPA placement â†' 45x ROI
College B: â‚¹25L fees, â‚¹15 LPA placement â†' 18x ROI
â†' College A has better ROI despite lower salary
```

### Placement in Search and Comparison

- Search filter: "Minimum placement %"
- Search filter: "Minimum median salary"
- Comparison: side-by-side placement stats
- Sorting: by placement %, by salary, by ROI

### Data Sources

Primary: NIRF official reports (nirfindia.org)
Secondary: College websites, verified college submissions

---

# 93. NIRF RANKINGS AND ACCREDITATION DATA

### NIRF Rankings

Every college must display NIRF rankings when available:

- NIRF rank (overall, engineering, medical, management, law, pharmacy, etc.)
- NIRF score (out of 100)
- Rank year
- Rank change vs previous year (â†' or â†")
- State rank
- Category rank

### Other Rankings and Accreditation

- NAAC Grade (A++, A+, A, B++, B+, B, C, D)
- NBA Accreditation (yes/no, valid until)
- AICTE approval
- UGC recognition
- MCI/NMC recognition (medical)
- DCI recognition (dental)
- CCIM recognition (AYUSH)
- PCI recognition (pharmacy)
- INC recognition (nursing)
- India Today ranking
- The Week ranking
- Outlook ranking
- QS ranking (top institutions)
- Times Higher Education (top institutions)

### NIRF Display

College header should show:
```
NIRF Rank: #42 (Engineering, 2025)
NIRF Score: 68.5/100
Rank Change: â†'5 from last year
NAAC Grade: A+
```

### NIRF in Search

- Filter by NIRF rank range
- Sort by NIRF rank
- Display NIRF badge on college cards

---

# 94. COMPREHENSIVE CUTOFF DATA SYSTEM

### Why This Is Critical

Cutoff data is the **#2 most important feature** after placement data. Students with specific ranks need to know which colleges they can get. Platforms like CutoffBaba, Coladex, and JEEPredictor are built entirely around cutoff data.

### Cutoff Database Fields

Each record must store:
- College ID
- Course ID
- Branch (e.g. "Computer Science Engineering")
- Exam name (JEE Main, NEET, KCET, etc.)
- Year (2023, 2024, 2025, 2026)
- Round (Round 1, Round 2, Round 3, Mop-Up, CSAB Special)
- Quota (All India / State / Home State)
- Category (General, OBC, SC, ST, EWS, PwD)
- Opening rank
- Closing rank
- Opening score (if applicable)
- Closing score (if applicable)
- Seat type (General / Female / PwD)
- Source (JoSAA Official / MCC Official / State Counselling)
- Source URL
- Verified date

### Major Exams to Cover

**National Level:**
- JEE Main â†' IITs, NITs, IIITs, GFTIs (via JoSAA)
- JEE Advanced â†' IITs
- NEET UG â†' Medical colleges (via MCC + State)
- CAT â†' IIMs and B-Schools
- CLAT â†' National Law Universities
- CUET â†' Central Universities
- XAT, SNAP, MAT, CMAT â†' MBA colleges
- GATE â†' M.Tech
- GPAT â†' Pharmacy

**State Level:**
- KCET (Karnataka)
- MHT-CET (Maharashtra)
- TNEA (Tamil Nadu)
- AP EAMCET (Andhra Pradesh)
- TS EAMCET (Telangana)
- WBJEE (West Bengal)
- UPSEE (Uttar Pradesh)
- BCECE (Bihar)
- JEE Main State Quota (all states)

### Cutoff Display

College page should show:
```
Cutoff Section:
â"œâ"€â"€ JEE Main 2025
â"‚   â"œâ"€â"€ Round 1: Opening 1234, Closing 5678 (General)
â"‚   â"œâ"€â"€ Round 2: Opening 1500, Closing 6200 (General)
â"‚   â""â"€â"€ Historical trend graph (3-5 years)
â"œâ"€â"€ NEET 2025
â"‚   â"œâ"€â"€ Round 1: Score 650+ (General)
â"‚   â""â"€â"€ Category-wise breakdown
â""â"€â"€ State Exam Cutoffs
    â"œâ"€â"€ KCET 2025: Rank 500-2500
    â""â"€â"€ ...
```

### Cutoff in Predictor

The AI predictor must use actual cutoff data, not just AI guessing:
- Student enters rank â†' system matches against historical cutoffs
- Shows Dream / Safe / Moderate categorization
- Shows round-wise prediction
- Shows category-wise prediction

---

# 95. SEAT MATRIX DATA

### Fields

- College ID
- Course ID
- Branch
- Exam
- Total seats
- General seats
- OBC seats
- SC seats
- ST seats
- EWS seats
- PwD seats
- Female supernumerary
- Home state quota
- All India quota
- Management quota
- Year
- Source

---

# 96. COLLEGE CLAIMING AND PROFILE MANAGEMENT

### College Claiming Flow

1. College representative visits `/claim-college`
2. Selects college from existing database
3. Provides official college email (@collegename.edu)
4. Uploads verification documents (registration certificate, AICTE/UGC approval, NAAC/NBA, official letter)
5. Platform verifies (manual review, 24-48 hours)
6. On approval: "Claimed by College" badge, college gets admin dashboard

### College Dashboard

- Profile management (edit details, update courses/fees, upload photos)
- Placement data management
- Review management (view, respond, report)
- Analytics (views, enquiries, comparisons)
- Admission updates (post announcements, deadlines)
- Enquiry management (view, download leads)

---

# 97. ENHANCED COMPARISON TOOL

### Comparison Must Include (Side-by-Side)

- College name and location
- NIRF rank and NAAC grade
- Established year
- Course offered
- Total fees (4/5 year)
- Placement percentage
- Average/Median salary
- Highest salary
- Top recruiters
- Cutoff (for student's specific rank)
- Hostel fees
- Campus area
- Student strength
- Faculty count
- Key facilities
- Student reviews rating
- ROI calculation

### Features

- Compare up to 4 colleges
- Add/remove colleges
- Share comparison link (WhatsApp, copy)
- Export as PDF (future)
- "Ask AI: Which is better?" (already specified)

---

# 98. ENHANCED COLLEGE PREDICTOR

### Must Use Actual Cutoff Data

Not just AI guessing. The predictor must:
1. Take student's exam, rank/score, category, state, preferences
2. Match against actual historical cutoff data
3. Categorize results: Dream / Safe / Moderate / Not Eligible
4. Show round-wise prediction
5. Show category-wise prediction
6. Show state quota vs All India quota
7. Show branch-wise prediction
8. Show "chance" percentage based on cutoff trends
9. Include disclaimer: "Based on previous year cutoffs. Actual admissions may vary."

---

# 99. STRUCTURED STUDENT REVIEWS

### Category-Wise Ratings

Each review must include ratings (1-5) for:
- Placements
- Faculty
- Infrastructure
- Campus Life
- Value for Money

### Review Features

- Verified student badge (verified via college email or student ID)
- Helpful votes on reviews
- Review photos
- Review sorting (most recent, highest rated, most helpful)
- Review filtering by course, year

---

# 100. NEWS AND UPDATES SECTION

### Dedicated /news Section

Separate from blog. Categories:
- Exam News (dates, results, answer keys)
- Admission News (deadlines, counselling schedules)
- Counselling News (JoSAA rounds, state counselling)
- Scholarship News (deadlines, new scholarships)
- College News (new colleges, campus events)

### Features

- Live updates during exam season
- Deadline countdown timers
- Personalized news feed based on student interests
- News alerts via email/SMS

---

# 101. CAMPUS PHOTOS AND MEDIA

### Photo Galleries

Organized by category:
- Campus overview
- Hostel
- Laboratories
- Library
- Sports facilities
- Auditorium
- Cafeteria

### Media Features

- College video embed (YouTube)
- Photo upload from claimed college admin
- Photo verification by platform
- Image optimization (WebP, responsive)

---

# 102. COUNSELLING GUIDES

### JoSAA Counselling

- Complete JoSAA guide
- Choice filling order generator
- Freeze/Float/Slide decision helper
- Document checklist
- Counselling timeline
- Round-wise strategy

### State Counselling

- State-specific counselling guides
- State quota explanation
- Home state advantage explanation
- State counselling schedule

---

# 103. FEES DATA

Fees should be structured: Tuition fee; Hostel fee; Examination fee; Other charges; Total approximate fee; Fee period (annual/semester/total); Academic year; Is approximate flag.

Display "Approximate fee" when exact/current fee cannot be guaranteed. Include: "Fees should be verified with the institution before admission."

---

# 104. TESTING ARCHITECTURE

### Backend Tests
- Unit tests (functions, services)
- Integration tests (API endpoints, database)
- API tests (request/response, validation, auth)

### Frontend Tests
- Component tests
- UI tests
- Responsive tests
- Accessibility tests

### End-to-End Tests
- Student: Register â†' Search â†' College â†' Enquiry
- Student: Predictor â†' Results â†' Enquiry
- Student: Mock Test â†' Submit â†' Result
- Student: Proctored Test â†' Camera/Screen â†' Submit â†' Proctoring Report
- Student: Scholarship â†' Official application info
- Admin: Add College â†' Publish â†' Public page
- Admin: Configure Proctored Test â†' Student Attempt â†' Proctoring Review
- Admin: Import CSV â†' Validate â†' Import â†' Verify
- Admin: Create Sub-User â†' Set Permissions â†' Verify Limited Access

### Special Tests
- AI/RAG: Hallucination rate, citation accuracy, retrieval precision
- Predictor: Rule engine accuracy
- Proctoring: Camera, screen, auto-submit, recovery
- Security: OWASP ZAP, penetration testing
- Load: Concurrent users, response times
- SEO: Structured data validation, sitemap

---

# 105. DOCUMENTATION AND HANDOVER

**Developer must provide:**
- Complete source code (frontend + backend)
- Database schema and ERD
- API documentation (OpenAPI/Swagger)
- Admin credentials
- Deployment documentation
- Environment variable documentation
- Database backup procedure
- Git repository
- Testing report
- Production deployment
- Staging deployment
- Domain/DNS documentation
- Third-party service documentation
- Proctoring integration documentation
- Admin panel user guide
- CMS guide
- AI/RAG guide
- Mock test creation guide
- Proctoring configuration guide
- CRM guide
- Security documentation
- Monitoring guide
- Incident response guide
- DR runbook

---

# 106. DATA AND ACCOUNT OWNERSHIP

Padhaanewala must control/own access to: Domain; Hosting; Cloud account; Database; Source code; Git repository; Object storage; AI accounts; Email account; SMS account; WhatsApp account; Analytics; Search Console; DNS; SSL; Deployment; Documentation.

No critical infrastructure should depend solely on a developer's personal account.

---

# 107. PHASED DEVELOPMENT

### Phase 1 - Core Platform
Homepage; College database; College search; College pages; Course pages; Admin panel; CMS; Enquiry system; Authentication; Basic SEO.

### Phase 2 - Student Features
Student dashboard; Saved colleges; College comparison; Scholarship finder; Exam notifications; Reviews.

### Phase 3 - AI
AI College Predictor; AI Education Assistant (RAG-based); AI college comparison.

### Phase 4 - Mock Tests
Question bank; Test engine; Timer; Autosave; Results; Performance analytics. Standard mock tests.

### Phase 4A - Proctored Exams
Secure test mode; Camera-based AI proctoring; Screen monitoring; Tab/window detection; Copy/paste restrictions; Auto-submission rules; Proctoring dashboard; Consent workflow.

### Phase 5 - Business/CRM
Counsellor dashboard; Lead assignment; Follow-ups; CRM; Marketing attribution; Advanced analytics; Automated communication.

### Phase 6 - Operations
Background jobs; Scheduled tasks; Data import; Data verification; Sub-user management; User activity monitoring; WAF; Monitoring; Backups.

---

# 108. FINAL SYSTEM ARCHITECTURE

```
Students/Admin â†' Next.js Frontend/Admin Dashboard â†' REST APIs â†' FastAPI
  â†' PostgreSQL / Redis / pgvector / AI / Storage / Search / Celery Workers

Database: Colleges, Courses, Scholarships, Exams, Students, Reviews,
  Mock Tests (with proctoring), Leads, Content, AI/RAG, Activity Logs

RAG Pipeline: Query â†' Retrieval Layer â†' Verified Knowledge Base â†' Context â†' LLM â†' Response

Proctoring: Camera/Screen â†' ML Service â†' Events â†' Risk Engine â†' Policy â†' Action
```

Architecture must be scalable and maintainable.

---

# 109. MOST IMPORTANT DEVELOPMENT RULES

1. Do not hard-code college/course/fee/scholarship data into React components.
2. All major content must be database-driven.
3. Admin must be able to update content without modifying source code.
4. Frontend and backend must communicate through documented APIs.
5. AI must not be allowed to freely invent factual college information.
6. Security must be implemented from the beginning, not added at the end.
7. Mobile responsiveness must be built from the beginning.
8. SEO must be considered during architecture, not after development.
9. All important data should have a source and verification date where applicable.
10. The platform must be designed so additional colleges, courses, states, users and features can be added without redesigning.
11. Proctoring settings must never be hard-coded into the frontend.
12. Server must be the authoritative source for test timing and submission state.
13. Background jobs must be used for all non-urgent operations (email, SMS, AI, imports).
14. Admin must be able to create sub-users with limited, granular permissions.
15. Admin must be able to see complete user activity data including search history.
16. All user activity must be tracked and queryable by authorized admins.
17. Architecture must support India-wide scale (millions of users, thousands concurrent).
18. Mobile-first design is non-negotiable (85%+ Indian users are mobile-only).
19. All infrastructure must be deployed within India (ap-south-1 region) for latency and compliance.
20. AI costs must be managed at India scale (caching, model selection, rate limiting).

---

# 110. DEFINITION OF READY FOR LAUNCH

The website is considered ready for production only when:
- Homepage works
- College search works (text + filters + NLP)
- College pages work
- Course pages work
- Admin works
- Sub-user management works with RBAC
- User activity monitoring works
- Content can be edited without code
- Enquiries reach admin
- Authentication works
- Mobile version works
- SEO basics configured (sitemap, robots, structured data)
- HTTPS works
- Database backup works
- Security testing completed
- Major APIs tested
- Error handling works
- Analytics configured
- Sitemap available
- Production deployment stable
- AI Chat (RAG) works with verified data
- Standard mock tests work end-to-end
- Proctored tests work with camera/screen monitoring
- Proctoring dashboard functional
- Background jobs running
- Scheduled jobs configured
- WAF configured
- Monitoring and alerting active
- Documentation complete
- Load tested at India scale (50K concurrent)
- CDN configured with Indian PoPs
- Database deployed in ap-south-1 with read replicas
- Redis cluster configured for scale
- Auto-scaling tested
- Mobile tested on low-end Android devices
- SMS/OTP tested with Indian provider (MSG91)
- WhatsApp integration tested
- Indian currency format working (â‚¹, lakhs)
- Data localization verified (all data in India)
- Mock test blocked on mobile devices (desktop-only enforced)
- Mock test works correctly on Chrome, Firefox, Edge (desktop)
- Proctoring works on desktop with camera and fullscreen
- Grievance Officer appointed and details published on website
- Grievance Officer contact mechanism working (24-hour ack, 15-day resolution)
- Privacy Policy available in English and Hindi
- Privacy Policy includes children's data protection section
- Parental consent flow working for users under 18
- No tracking/targeted advertising on minor users
- DPDP Act compliance verified
- IT Rules 2021 intermediary compliance verified
- ASCI advertising guidelines followed (no guaranteed admission/placement claims)
- Content takedown mechanism working (3-hour response for government orders)
- User notification system working (3-month periodic reminders)
- POCSO reporting mechanism in place
- Legal pages (Privacy Policy, Terms, Disclaimer) published

---

# 111. FUTURE EXPANSION

The architecture should allow future features such as:
- Online counselling / Paid counselling
- Application tracking
- Student document management
- Online payments
- Premium memberships
- College advertising / Sponsored listings
- College CRM / Partner college dashboard
- Student application dashboard
- Scholarship application tracking
- AI career counselling
- Personalized course recommendations
- Mobile application (React Native)
- Push notifications
- Multilingual support
- Live human proctoring / Remote invigilator console
- Advanced ML proctoring models
- Automated data ingestion
- Automated verification
- Advanced analytics and reporting

These features do not necessarily need to be built in Version 1, but the architecture must not prevent them from being added later.

---

# 112. INDIA-SCALE ARCHITECTURE OVERVIEW

## Scale Context

Padhaanewala must be built to serve **all of India simultaneously**. This is not a small startup website â€" it is a national education platform.

**India context:**
- Population: ~1.4 billion
- Internet users: ~800 million
- Students appearing for competitive exams: ~20 million/year (NEET alone: ~2 million)
- Peak exam season traffic: millions of concurrent users
- Primary device: Mobile (85%+ of Indian internet usage)
- Primary network: Mobile data (4G/5G, variable quality)
- Primary language: Hindi + regional languages
- Primary messaging: WhatsApp
- Primary payment (future): UPI

### Scale Targets

| Metric | Target |
|---|---|
| Total registered users (Year 1) | 5-10 million |
| Total registered users (Year 3) | 20-50 million |
| Daily active users (normal) | 100,000-500,000 |
| Daily active users (exam season) | 1-5 million |
| Concurrent users (normal) | 5,000-20,000 |
| Concurrent users (peak exam day) | 50,000-200,000+ |
| Concurrent mock test takers | 10,000-50,000 |
| API requests per second (normal) | 1,000-5,000 |
| API requests per second (peak) | 10,000-50,000+ |
| Data storage (Year 1) | 500 GB - 1 TB |
| Data storage (Year 3) | 5-10 TB |
| Proctoring evidence storage | 10-50 TB |

### Critical Peak Periods

| Period | Traffic Impact | Duration |
|---|---|---|
| NEET UG exam season | Extreme (millions) | March-June |
| JEE exam season | Extreme (millions) | January-May |
| Board result season | Very High | March-June |
| Admission season | Very High | May-September |
| Scholarship deadlines | High | Various |
| Weekly mock test peaks | High (Saturday/Sunday) | Weekly |
| Daily evening peak | Moderate-High | 7 PM - 11 PM IST |

---

# 113. INDIA-WIDE CDN AND EDGE INFRASTRUCTURE

## CDN Strategy

Use **Cloudflare** (preferred for India) or **AWS CloudFront** with PoPs across India.

### Required Indian PoPs (Points of Presence)

The CDN MUST have edge nodes in or near these cities:

**Tier 1 (Critical â€" must have local PoP):**
- Mumbai
- Delhi/NCR
- Bangalore
- Chennai
- Hyderabad
- Kolkata
- Pune
- Ahmedabad

**Tier 2 (Important â€" must have regional PoP):**
- Jaipur
- Lucknow
- Chandigarh
- Bhopal
- Indore
- Nagpur
- Coimbatore
- Kochi
- Visakhapatnam
- Patna
- Bhubaneswar
- Guwahati

**Tier 3 (Desirable â€" served from nearest Tier 1/2):**
- All other state capitals and major cities

### CDN Configuration

- Cache static assets (JS, CSS, images) aggressively (1 year, versioned URLs)
- Cache API responses at edge where possible (college lists, course pages)
- Edge-side rendering for frequently accessed pages
- Brotli compression (better than gzip for Indian mobile networks)
- HTTP/3 support
- Early hints (103) for critical resources
- Image optimization at edge (format conversion, resizing)

### Edge Caching for India

Specifically cache at Indian edge nodes:
- Homepage (most accessed page)
- College listing pages (most searched)
- Course listing pages
- Popular college detail pages (top 500 colleges)
- Popular course pages (top 50 courses)
- State/college listing programmatic SEO pages

---

# 114. APPLICATION ARCHITECTURE FOR INDIA SCALE

## Multi-Region Deployment

```
                        Global CDN (Cloudflare)
                               |
                    +----------+----------+
                    |                     |
              India-West Region      India-South Region
              (Mumbai)              (Bangalore)
                    |                     |
              +-----+-----+         +-----+-----+
              |           |         |           |
          Next.js     FastAPI    Next.js     FastAPI
          (Vercel/     (ECS)     (Vercel/     (ECS)
           Docker)               Docker)
              |           |         |           |
              +-----+-----+         +-----+-----+
                    |                     |
              PostgreSQL            PostgreSQL
              Primary               Read Replica
              (Mumbai RDS)          (Bangalore RDS)
                    |                     |
                    +----------+----------+
                               |
                          Redis Cluster
                          (ElastiCache)
                               |
                    +----------+----------+
                    |                     |
              Job Workers           Job Workers
              (Mumbai ECS)          (Bangalore ECS)
```

### Why Multi-Region

- **Latency:** Users in South India get faster response from Bangalore region; users in North/West from Mumbai region
- **Reliability:** If one region fails, the other continues
- **Compliance:** Data stays within India (important for future regulations)
- **Exam capacity:** Proctored exams can be distributed across regions

### Database Architecture at Scale

```
PostgreSQL Primary (Mumbai RDS - db.r6g.xlarge or larger)
  â"œâ"€â"€ Read Replica 1 (Mumbai) â€" for read-heavy operations
  â"œâ"€â"€ Read Replica 2 (Bangalore) â€" for South India reads
  â""â"€â"€ Read Replica 3 (Delhi) â€" for North India reads (when scale requires)

Connection Pooling: PgBouncer or RDS Proxy
  â"œâ"€â"€ Application connections: 200 per region
  â"œâ"€â"€ Idle connection timeout: 300 seconds
  â""â"€â"€ Transaction pooling mode
```

### Redis Architecture at Scale

```
Redis Cluster (ElastiCache)
  â"œâ"€â"€ Shard 1: Session data, auth tokens
  â"œâ"€â"€ Shard 2: Cache (college, course data)
  â"œâ"€â"€ Shard 3: Rate limiting, counters
  â"œâ"€â"€ Shard 4: Job queue (Celery broker)
  â""â"€â"€ Shard 5: Real-time data (online users, active tests)
```

---

# 115. DATABASE SCALING FOR INDIA

## Read Replicas

- All public read operations (college listing, course pages, search) go through read replicas
- Only write operations (enquiry submission, review, test attempt) hit primary
- Connection routing via application-level read/write split

## Connection Management

```python
# Application should use connection pooling
# Recommended: asyncpg with pool
# Pool size: 20-50 connections per application instance
# Max overflow: 10-20 additional connections
# Connection timeout: 5 seconds
# Command timeout: 30 seconds for reads, 60 seconds for writes
```

## Query Optimization at Scale

- All list queries must use pagination (never return all records)
- College listing: cursor-based pagination preferred over offset (better for large datasets)
- Search queries: use GIN indexes, limit result count
- Avoid N+1 queries (use joinedload/subqueryload)
- Add covering indexes for frequently accessed patterns
- Monitor slow query log (> 500ms in production)

## Partitioning (When Required)

When data exceeds manageable size:
- Partition `analytics_events` by month
- Partition `audit_logs` by month
- Partition `proctoring_evidence` references by month
- Archive old partitions to cold storage

## Connection Pool Monitoring

- Track active connections per instance
- Alert if connection pool utilization > 80%
- Track connection wait time
- Track query execution time percentiles

---

# 116. CACHING AT INDIA SCALE

## Multi-Layer Cache

```
User Request
  â†"
CDN Edge Cache (Cloudflare) â€" 90%+ hit rate target for static pages
  â†" (miss)
Next.js ISR Cache â€" serves stale-while-revalidate
  â†" (miss)
Application Redis Cache â€" fast, in-memory
  â†" (miss)
Database (PostgreSQL with read replicas)
```

## Cache Sizing

| Cache Layer | Size | Purpose |
|---|---|---|
| CDN Edge | Unlimited (managed) | Static assets, public pages |
| Next.js ISR | Per-instance memory | Page-level cache |
| Redis | 16-64 GB cluster | API response cache, sessions, queues |

## Redis Memory Budget (India Scale)

```
Sessions:              ~2 GB (500K active sessions x 4KB)
Auth tokens:           ~1 GB
College/course cache:  ~4 GB (full college list + popular pages)
Rate limit counters:   ~1 GB
Search cache:          ~2 GB (popular searches)
Celery job queue:      ~2 GB
Real-time data:        ~2 GB (active users, active tests)
Buffer:                ~2 GB
Total:                 ~16 GB minimum, 32-64 GB recommended
```

## Cache Warming

On deploy or cache invalidation:
- Pre-warm homepage cache
- Pre-warm top 500 college pages
- Pre-warm top 50 course pages
- Pre-warm popular search results
- Pre-warm static lookup data (states, districts)

---

# 117. SEARCH SCALING FOR INDIA

### Stage 1: PostgreSQL Full-Text Search

Handle up to ~50,000 colleges with PostgreSQL:
- GIN indexes on tsvector columns
- Trigram indexes for fuzzy matching
- Materialized views for common search patterns
- Search result caching in Redis

### Stage 2: Elasticsearch/OpenSearch (When Required)

Migrate when:
- Search latency > 200ms p95
- Full-text search becomes bottleneck
- Complex faceted search needed
- Autocomplete performance degrades

**OpenSearch Cluster for India:**
```
OpenSearch Cluster (3+ nodes)
  â"œâ"€â"€ Master nodes: 3 (dedicated)
  â"œâ"€â"€ Data nodes: 3-6 (m5.xlarge or larger)
  â"œâ"€â"€ Coordinating nodes: 2
  â""â"€â"€ Index: colleges, courses, scholarships, exams
```

## Search Performance Targets

| Metric | Target |
|---|---|
| Search response time (p50) | < 50ms |
| Search response time (p95) | < 200ms |
| Autocomplete response | < 100ms |
| Index refresh lag | < 5 seconds |

---

# 118. API SCALING FOR INDIA

## FastAPI Application Scaling

```
Minimum Production Setup:
  - 4+ FastAPI instances (ECS/Fargate or EC2)
  - 2 vCPU, 4 GB RAM per instance
  - Auto-scaling: 4-20 instances based on CPU/request count
  - Target: 70% CPU utilization triggers scale-up

Load Balancer:
  - Application Load Balancer (ALB)
  - Health check every 10 seconds
  - Sticky sessions NOT required (stateless API)
  - Connection draining: 30 seconds
```

## API Response Time Targets

| Endpoint Type | p50 Target | p95 Target | p99 Target |
|---|---|---|---|
| Homepage data | < 100ms | < 300ms | < 500ms |
| College listing | < 100ms | < 300ms | < 500ms |
| College detail | < 80ms | < 200ms | < 400ms |
| Search | < 80ms | < 200ms | < 400ms |
| Auth (login) | < 200ms | < 500ms | < 1000ms |
| OTP send | < 500ms | < 2000ms | < 5000ms |
| Enquiry submit | < 200ms | < 500ms | < 1000ms |
| AI Chat | < 3000ms | < 8000ms | < 15000ms |
| Mock test start | < 200ms | < 500ms | < 1000ms |
| Answer save | < 100ms | < 300ms | < 500ms |
| Test submit | < 500ms | < 2000ms | < 5000ms |
| Proctoring event | < 100ms | < 300ms | < 500ms |

## Rate Limiting at India Scale

```
Normal traffic:
  - Public API: 200 requests/minute per IP
  - Search: 60 requests/minute per IP
  - Auth: 10 requests/minute per IP
  - AI Chat: 30 requests/minute per user
  - Enquiry: 5 requests/10 minutes per IP

Exam season traffic:
  - Increase rate limits by 2x for authenticated users
  - Maintain strict limits for unauthenticated
  - Implement graduated rate limiting (soft warn before block)
  - Prioritize authenticated users over anonymous
```

---

# 119. MOCK TEST AND PROCTORING AT INDIA SCALE

## Concurrent Test Capacity

During peak exam season (NEET/JEE mock test days):
- Expected concurrent test takers: 10,000-50,000
- Each test requires: active WebSocket/SSE connection, server-side timer, answer autosave
- Answer autosave frequency: every 30 seconds per student
- At 50,000 concurrent: 1,667 saves/second

## Architecture for Concurrent Tests

```
Student Browser
  â†" (WebSocket or polling every 30s)
Load Balancer
  â†"
FastAPI (stateless, autoscaling)
  â†"
Redis (answer buffer â€" fast writes)
  â†" (batch write every 30s)
PostgreSQL (persistent storage)
```

**Key design decisions:**
- Answers buffered in Redis (fast write), batch-flushed to PostgreSQL every 30 seconds
- On test submit: flush all Redis answers to PostgreSQL immediately
- Server timestamp is authoritative (not client timer)
- Test state tracked in Redis for fast access

## Proctoring at Scale

- Camera snapshots: compress before upload (JPEG quality 60-70)
- Upload to S3 via presigned URLs (bypass backend for upload)
- ML analysis: queue-based, process asynchronously
- Evidence storage: S3 Intelligent-Tiering (move to Glacier after 90 days)
- Proctoring event processing: can be slightly delayed (seconds, not milliseconds)

---

# 120. AI/RAG AT INDIA SCALE

## AI Request Management

At India scale, AI costs become significant:

**Cost estimation (per month):**
- 100,000 AI chat queries x avg 2000 tokens x $0.03/1K tokens = ~$6,000/month
- Embedding generation for full knowledge base: ~$500 one-time
- Predictor AI calls: ~$1,000/month

**Cost controls:**
- Cache AI responses for repeated/similar queries
- Use cheaper model (GPT-3.5-turbo) for simple questions, GPT-4 for complex
- Implement daily per-user limits
- Track cost per query in admin dashboard
- Set monthly budget alerts

## RAG at Scale

- Vector index: pgvector handles up to ~1 million embeddings efficiently
- Beyond that: migrate to dedicated vector database (Pinecone/Weaviate)
- Re-indexing: background job, not real-time
- Embedding model: OpenAI ada-002 (1536 dimensions) or open-source alternative for cost savings

## AI Response Caching

- Cache AI responses for identical/similar queries (Redis, 1 hour TTL)
- Use semantic similarity to detect similar questions
- Cache hit rate target: 30-40% (reduces cost proportionally)

---

# 121. WHATSAPP AND SMS AT INDIA SCALE

## WhatsApp (Primary Communication Channel in India)

**WhatsApp is how most Indian students communicate.** This must be a first-class channel.

- Use WhatsApp Business API (official, not unofficial)
- Provider: AiSensy, WATI, or official Meta API
- Template messages for: enquiry confirmation, lead follow-up, exam reminders, result notifications
- Interactive messages: quick replies, buttons
- Bulk messaging for: exam announcements, scholarship deadlines (within WhatsApp policy)
- Track delivery and read rates

## SMS at India Scale

- Provider: MSG91 (India-specific, best deliverability) or Gupshup
- Volume: 100,000+ OTPs/month during exam season
- DLT registration required (Indian regulation for bulk SMS)
- Sender ID registration with DLT platform
- Transactional route for OTPs (higher priority, better delivery)
- Cost: ~â‚¹0.10-0.20 per SMS in India

## Email at India Scale

- Provider: AWS SES (cheapest at scale) or SendGrid
- Volume: 500,000+ emails/month
- SES pricing in ap-south-1: $0.10 per 1,000 emails
- Warm up SES gradually (start with 50/day, increase over 2-4 weeks)
- Monitor bounce rate (keep < 5%)
- Dedicated IP for reputation

---

# 122. INDIAN MARKET SPECIFIC REQUIREMENTS

## Language Support (Foundation)

While multilingual is future, the foundation must support it:

- All UI text extractable (i18n-ready)
- Support Devanagari script (Hindi) in database fields
- Unicode throughout (UTF-8 encoding)
- Hindi content on key pages (homepage, about, contact) in Phase 2
- Regional language support in Phase 3 (Tamil, Telugu, Kannada, Bengali, Marathi)

## Indian Education System Specifics

- Support for Indian state boards, CBSE, ICSE, NEET, JEE, CUET
- Category system: General, OBC, SC, ST, EWS, PwD
- Indian currency format: â‚¹8,50,000 (lakhs/crores)
- Indian date format support
- Indian phone number format: +91 XXXXX XXXXX
- Indian pincode: 6 digits
- State/District/City hierarchy matching Census of India

## Indian Payment (Future)

When payments are introduced:
- UPI (Google Pay, PhonePe, Paytm) â€" 70%+ of Indian digital payments
- Razorpay (supports UPI, cards, netbanking, wallets)
- No international payment gateways (Stripe) â€" use India-specific

## Indian Compliance

- IT Act 2000 compliance
- Data localization (store user data in India)
- IT (Intermediary Guidelines) 2021 â€" due diligence for platforms
- Consumer Protection Act compliance
- Education regulatory compliance (UGC, AICTE, MCI/NMC where applicable)
- DLT registration for SMS
- DPDP Act 2023 (Digital Personal Data Protection) compliance

---

# 123. MOBILE-FIRST ARCHITECTURE FOR INDIA

## Why Mobile-First is Non-Negotiable

- 85%+ of Indian internet users are mobile-only
- Average Indian mobile connection: 4G (variable speed, often 1-10 Mbps)
- Average Indian mobile device: 4-6 GB RAM, mid-range processor
- Data is expensive for many users (optimize payload sizes)
- Screen sizes: 5.5" to 6.7" primary, tablets secondary

## Mobile Optimization Requirements

### Payload Sizes
- Homepage HTML: < 50 KB (compressed)
- Homepage JS: < 200 KB (compressed)
- College card image: < 30 KB (WebP, 400px width)
- College detail page total: < 500 KB
- API response: < 50 KB typical, < 500 KB max

### Performance on Slow Networks
- Critical CSS inline (above-the-fold renders without external CSS)
- Non-critical JS loaded async
- Images lazy-loaded with placeholder blur
- Service worker for offline caching of visited pages (future)
- Prefetch next likely pages
- Reduce server round-trips

### Touch Optimization
- Touch targets: minimum 48px x 48px
- Swipe gestures for carousels
- Bottom navigation for key actions on mobile
- Pull-to-refresh on listing pages
- Sticky footer CTA on mobile

### Mobile-Specific Features
- Click-to-call (phone numbers)
- Click-to-WhatsApp
- Share via WhatsApp (most common sharing method in India)
- Add to home screen prompt
- Offline page caching (future)

---

# 124. PEAK TRAFFIC MANAGEMENT

## Auto-Scaling Rules

```
Normal Mode (default):
  - 4 FastAPI instances
  - 2 Next.js instances
  - Standard Redis cluster

Exam Season Mode (triggered manually or by metrics):
  - 8-16 FastAPI instances
  - 4-8 Next.js instances
  - Expanded Redis cluster
  - Additional read replicas

Emergency Mode (manual trigger):
  - Maximum instances (20+)
  - Enable aggressive caching
  - Reduce AI availability (queue requests)
  - Reduce non-critical features
  - Enable static fallback pages
```

## Traffic Shedding Strategy

When under extreme load:
1. Serve static cached pages (bypass API)
2. Disable AI chat temporarily (queue responses)
3. Disable non-critical features (blog, reviews)
4. Reduce search freshness (serve cached results)
5. Queue enquiry submissions (process later)
6. Priority: Mock test > Search > College pages > Everything else

## CDN-Only Mode

For extreme scenarios, entire site can be served from CDN cache:
- All public pages cached at edge
- API responses cached at edge
- Only mutations require origin
- Graceful degradation to read-only

---

# 125. MONITORING AT INDIA SCALE

## Metrics Dashboard

Real-time monitoring of:

**Traffic:**
- Requests per second (by region, endpoint)
- Active users (by region)
- Error rate (by endpoint)
- Response time percentiles (p50, p95, p99)

**Infrastructure:**
- CPU utilization per instance
- Memory utilization per instance
- Database connections (active/idle/waiting)
- Redis memory and hit rate
- Queue depth (Celery)
- Disk usage

**Business:**
- Registrations per hour
- Enquiries per hour
- Mock test starts per hour
- AI queries per hour
- Search queries per hour
- Most popular colleges (real-time)
- Most popular courses (real-time)

## Alerting for India Scale

| Condition | Severity | Action |
|---|---|---|
| API error rate > 1% for 5 min | Warning | Email + Slack |
| API error rate > 5% for 2 min | Critical | Page on-call |
| p95 response > 1s for 5 min | Warning | Email |
| p95 response > 3s for 2 min | Critical | Page on-call |
| Database CPU > 70% for 10 min | Warning | Email |
| Database connections > 80% pool | Critical | Page on-call |
| Redis memory > 80% | Warning | Email |
| Queue depth > 10,000 | Warning | Email |
| Queue depth > 50,000 | Critical | Page on-call |
| Concurrent test users > 20,000 | Info | Notification |
| Concurrent test users > 50,000 | Warning | Auto-scale |
| SSL cert expires in 14 days | Warning | Email |

---

# 126. COST ESTIMATION (INDIA SCALE)

## Monthly Infrastructure Cost Estimate (India, AWS ap-south-1)

### Year 1 (Growing)

| Service | Configuration | Monthly Cost (â‚¹) |
|---|---|---|
| ECS/Fargate (Backend) | 4 instances, 2vCPU/4GB | â‚¹30,000-50,000 |
| RDS PostgreSQL | db.r6g.large, Multi-AZ | â‚¹25,000-40,000 |
| ElastiCache Redis | cache.r6g.large, cluster | â‚¹20,000-30,000 |
| S3 Storage | 500 GB | â‚¹1,000-2,000 |
| CloudFront/Cloudflare | 2 TB transfer | â‚¹10,000-20,000 |
| SES (Email) | 500K emails | â‚¹4,000-5,000 |
| MSG91 (SMS/OTP) | 100K SMS | â‚¹10,000-20,000 |
| OpenAI API | 100K queries | â‚¹4,00,000-6,00,000 |
| Sentry | Team plan | â‚¹5,000-10,000 |
| Domain + SSL | | â‚¹2,000-5,000 |
| **Total Year 1** | | **â‚¹5,00,000-8,00,000/month** |
| | | **(~$6,000-10,000 USD)** |

### Year 3 (Scale)

| Service | Configuration | Monthly Cost (â‚¹) |
|---|---|---|
| ECS (Backend, autoscaling) | 8-16 instances | â‚¹80,000-1,50,000 |
| RDS PostgreSQL | db.r6g.xlarge, 3 replicas | â‚¹80,000-1,20,000 |
| ElastiCache Redis | 32-64 GB cluster | â‚¹50,000-1,00,000 |
| OpenSearch | 3-node cluster | â‚¹40,000-60,000 |
| S3 Storage | 5 TB | â‚¹10,000-20,000 |
| CDN | 20 TB transfer | â‚¹50,000-1,00,000 |
| Email/SMS/WhatsApp | Higher volume | â‚¹50,000-1,00,000 |
| AI API | 1M queries | â‚¹30,00,000-50,00,000 |
| Monitoring/Tools | | â‚¹20,000-50,000 |
| **Total Year 3** | | **â‚¹45,00,000-80,00,000/month** |
| | | **(~$55,000-95,000 USD)** |

### Cost Optimization Strategies

- Use reserved instances (40-60% savings) for predictable workloads
- Use spot instances for background workers (60-70% savings)
- Use S3 Intelligent-Tiering for proctoring evidence
- Cache AI responses (30-40% cost reduction)
- Use cheaper AI models where possible (GPT-3.5 vs GPT-4)
- Use open-source embedding models to reduce embedding costs
- Monitor and alert on cost anomalies

---

# 127. DATA LOCALIZATION AND COMPLIANCE

## Data Residency

- All user data stored within India (ap-south-1 region)
- Database: AWS RDS ap-south-1 (Mumbai) primary, read replicas in India
- Storage: S3 ap-south-1
- CDN: Indian PoPs
- AI API calls: data may go to US/EU (check provider policy)
- Proctoring evidence: stored in India, encrypted

## DPDP Act 2023 Compliance

**CRITICAL: Many Padhaanewala users are under 18 (students appearing for Class 12, NEET, JEE). The DPDP Act requires special protections for children.**

### Child Data Protection (Mandatory â€" DPDP Act Section 9)

- **Age verification:** Implement age-gating at registration. If user is under 18, trigger parental consent flow.
- **Verifiable parental consent:** Before processing personal data of any user under 18:
  - Obtain consent from parent/lawful guardian
  - Verify parent identity (OTP to parent mobile, or email verification)
  - Store consent record with: parent ID, child ID, consent text, timestamp, IP, verification method
  - Consent must be withdrawable by parent at any time
- **No tracking of children:** DPDP Act PROHIBITS tracking, behavioural monitoring, and targeted advertising directed at children. Padhaanewala must NOT:
  - Track browsing behaviour of users under 18 for advertising
  - Use behavioural analytics on minors
  - Show targeted ads to minors
  - Use gamification mechanics that exploit children's vulnerabilities
- **Notice requirements:** Privacy notice must be in language the child/parent can understand (not just English legal text)

### General DPDP Compliance

- Obtain explicit consent before collecting personal data
- Purpose limitation: collect only what's needed
- Data minimization: don't collect excess data
- Right to access: user can request their data (provide download/export)
- Right to erasure: user can request deletion (implement account deletion flow)
- Data breach notification: notify Data Protection Board of India AND affected users within 72 hours
- Data Protection Officer (DPO): designate for organization (mandatory for Significant Data Fiduciaries)
- Cross-border transfer restrictions: keep data in India where possible
- Consent records: maintain auditable consent logs
- Data retention: delete data when purpose is served or consent withdrawn

### Penalties for Non-Compliance

| Violation | Maximum Penalty |
|---|---|
| Failure to take reasonable security safeguards | â‚¹250 crore |
| Failure to notify breach | â‚¹200 crore |
| Failure to comply with Board directions | â‚¹50 crore |
| Non-compliance with obligations regarding children | â‚¹200 crore |

---

## IT Act 2000 + IT Rules 2021 Compliance (Mandatory for Intermediaries)

Padhaanewala is an "intermediary" under the IT Act. Non-compliance loses safe-harbour protection (Section 79), making Padhaanewala directly liable for all user-generated content.

### Grievance Officer (Mandatory â€" Rule 3(2))

- **Appoint a Grievance Officer** â€" this is a HARD legal requirement
- **Publish on website:** Name, email, phone number of Grievance Officer
- **Acknowledge complaints within 24 hours**
- **Resolve complaints within 15 days**
- Contact details must be prominently displayed on website (not hidden in footer)

### Content Takedown (Mandatory â€" Rule 3(1)(d))

- Upon receiving **court order** or **reasoned intimation from authorised government officer**: remove/disable access to specified content **within 3 hours**
- Maintain internal content moderation system
- Preserve records of takedown requests and actions taken

### User Notifications (Mandatory â€" Rule 3(1)(c))

- **Periodically inform users at least once every 3 months** about:
  - Platform rules and privacy policy
  - Right to terminate/suspend non-compliant users
  - User liability for unlawful content
  - Mandatory reporting obligations under BNSS 2023 and POCSO 2012

### Safe Harbour

- Comply with all due diligence requirements to maintain Section 79 safe-harbour protection
- Without safe-harbour, Padhaanewala becomes directly liable for all user-generated content (reviews, comments, AI chat outputs, etc.)

---

## Consumer Protection Act 2019 + E-Commerce Rules 2020

- **Grievance Officer:** Same as IT Rules requirement (one officer serves both)
- **Refund policy:** If any paid services are introduced, display refund/cancellation policy prominently
- **No dark patterns:** Do not use manipulative design to trick users into actions
- **Transparent pricing:** All fees must be clearly displayed (no hidden charges)
- **E-commerce disclosures:** If acting as e-commerce entity, display: legal name, GSTIN, contact details, country of origin

---

## ASCI Guidelines for Education Advertising (Mandatory)

If Padhaanewala displays any advertisements (including college advertisements, sponsored listings):

### Prohibited Claims

- **No guaranteed admissions:** Cannot state or imply that using Padhaanewala guarantees admission to any college
- **No guaranteed placements:** Cannot claim "100% placement" or guarantee jobs/salary
- **No fake rankings:** Cannot claim ranking unless substantiated with evidence
- **No misleading recognition:** Cannot claim college is "officially recognized" without evidence
- **Disclaimer required:** All placement/ranking claims must carry disclaimer: "Past record is no guarantee of future prospects"
- **No 100% claims:** Cannot claim "100% placement" for abstract/non-quantifiable claims
- **Latest data only:** Placement/salary claims must be from latest completed academic year
- **Full disclosure:** When showing placement numbers, must also show total students who graduated

### Student Well-being (2023 Update)

- Ads must not show students compromising sleep/meals to study
- Ads must not portray average/poor scorers as failures
- Ads must not create false urgency or fear of missing out
- Ads must not stereotype subjects by gender
- Ads must not exploit student/parental vulnerability

---

## POCSO Act 2012 (If Minors Use Platform)

- **Mandatory reporting:** If Padhaanewala becomes aware of any child sexual abuse material or conduct, it MUST report to appropriate authority
- **No private communication channels** between adults and minors on platform
- **Age-appropriate design:** Platform must not expose minors to inappropriate content
- **AI chat safety:** AI assistant must not generate content inappropriate for minors

---

## Guidelines for Regulation of Coaching Centres 2024

If Padhaanewala offers any coaching/test preparation services (mock tests count):

- **No misleading advertisements** about coaching services
- **Refund policy** must be displayed
- **No guarantee of results** in advertisements
- **Registration with appropriate authority** if offering coaching services

---

## Privacy Policy Must Include

- What data is collected and why
- How data is used (including AI training â€" disclose if applicable)
- Who data is shared with (third-party services)
- How long data is retained
- How to request data deletion
- Cookie policy
- Proctoring data policy (what's recorded, how long kept)
- **Children's data protection** (verifiable parental consent, no tracking, no targeted ads)
- **Grievance Officer details** (name, email, phone)
- **Complaint resolution process** (24-hour ack, 15-day resolution)
- **Data localization** (data stored in India)
- Language: must be available in English AND Hindi (at minimum)

---

# 128. DISASTER RECOVERY AT INDIA SCALE

## RPO and RTO

| Metric | Target | Implementation |
|---|---|---|
| **RPO** (Recovery Point) | 5 minutes | Automated snapshots every 5 min, continuous WAL archiving |
| **RTO** (Recovery Time) | 30 minutes | Multi-AZ RDS, automated failover, pre-configured standby |

## Multi-AZ Deployment

- RDS Multi-AZ: automatic failover to standby (1-2 minutes)
- Application: multiple instances across AZs
- Redis: Multi-AZ with automatic failover
- S3: inherently multi-AZ

## Regional Failover

If entire Mumbai region fails:
- Route traffic to Bangalore region
- Bangalore has read replica promoted to primary
- Application instances already running in Bangalore
- DNS failover (Route 53 health checks)
- Estimated failover time: 5-15 minutes

## Backup Strategy

- RDS automated backups: 35-day retention
- Daily snapshots to S3
- Weekly cross-region backup copy
- Monthly restoration test
- Proctoring evidence: S3 versioning + lifecycle policies
- Runbook for every failure scenario

---

# 129. INDIA-SPECIFIC TESTING REQUIREMENTS

## Load Testing with Indian Traffic Patterns

Simulate:
- Normal weekday: 100K daily active users
- Exam season weekday: 500K daily active users
- NEET mock test Saturday: 50K concurrent test takers
- Evening peak (7-11 PM): 3x normal traffic
- Mobile network conditions: 3G/4G variable speed

## Device Testing

Must work on:
- Low-end Android (2GB RAM, slow processor)
- Mid-range Android (4GB RAM) â€" primary target
- High-end Android
- iPhone (all recent models)
- Budget tablets
- Desktop/laptop (secondary)

## Network Testing

Must work on:
- 2G (EDGE) â€" degraded but functional
- 3G (slow but usable)
- 4G LTE (standard)
- 5G (fast)
- WiFi (variable)
- Intermittent connectivity (auto-retry)

## Regional Testing

Test with content for:
- Hindi-speaking states (UP, MP, Rajasthan, Bihar, CG, Jharkhand)
- South Indian states (TN, KA, AP, TS, KL)
- East India (WB, OD, NE states)
- West India (MH, GJ, Goa)
- North India (DL, PB, HR, HP, UK, JK)

---

## ASSIGNED ROLE STATEMENT

As the assigned Website Engineering & Product Development Team of Padhaanewala Edutech Services, Bengaluru 560100, the engineering team is responsible for translating this specification into a secure, scalable, maintainable and production-ready education technology platform.

Any architectural deviation that materially affects scalability, SEO, security, data ownership, admin control, user monitoring or future expansion should be discussed and approved before implementation.

---

**PADHAANEWALA EDUTECH SERVICES**
**BENGALURU - 560100**

*End of Master Specification V4 - Complete Product, Feature, Technology, Architecture, Security, Data, AI, Examination, Proctoring, DevOps & Operations Specification*

---

# ============================================================
# SECTION B: GAP ANALYSIS (What Competitors Have)
# ============================================================
# PADHAANEWALA â€" GAP ANALYSIS
## What Competitors Have That We Need to Add

Based on analysis of India's top education platforms (CollegeDunia, Shiksha, Careers360, CollegeFynder, CutoffBaba, Coladex, CollegeGo, JEEPredictor, CollegePIPE, Shortlisted, CampusConnect), here are the critical features MISSING from our current specification.

---

## CRITICAL GAPS (Must Add to V4)

### 1. PLACEMENT DATA AND SALARY INFORMATION

**Why this is critical:** This is THE #1 feature students use to compare colleges. Every major Indian platform prominently displays placement data. Students choosing between colleges almost always compare placement percentages and salary packages.

**What competitors show:**
- Placement percentage (year-wise: 2022-23, 2023-24, 2024-25)
- Median salary package (LPA)
- Average salary package (LPA)
- Highest salary package (LPA)
- Number of students placed
- Number of students graduating
- Number going for higher studies
- Top recruiting companies
- Branch-wise placement data (CSE vs ECE vs Mechanical)
- ROI (Return on Investment) calculation

**What we need to add:**

#### Placement Database Fields (per college-course-branch)
```
placement_records:
  id
  college_id
  course_id
  branch (e.g. "Computer Science", "Mechanical")
  academic_year (e.g. "2024-25")
  total_graduating_students
  total_placed_students
  placement_percentage
  students_for_higher_studies
  median_salary_lpa
  average_salary_lpa
  highest_salary_lpa
  lowest_salary_lpa
  total_recruiters
  top_recruiters (JSON array)
  source (NIRF / College Website / Verified)
  source_url
  verified_date
  data_year
```

#### Placement Page on College Detail
```
College Detail Page
  â†"
Placement Section
  â"œâ"€â"€ Overall Placement Stats (current year)
  â"œâ"€â"€ Year-wise Trend (3-5 years graph)
  â"œâ"€â"€ Branch-wise Placement Table
  â"‚   â"œâ"€â"€ CSE: 95% placed, â‚¹12 LPA median
  â"‚   â"œâ"€â"€ ECE: 88% placed, â‚¹8 LPA median
  â"‚   â"œâ"€â"€ Mechanical: 75% placed, â‚¹5 LPA median
  â"‚   â""â"€â"€ ...
  â"œâ"€â"€ Top Recruiters (company logos)
  â"œâ"€â"€ Salary Distribution Graph
  â"œâ"€â"€ Highest Package Highlight
  â""â"€â"€ ROI Calculator (Total Fees vs Average Salary)
```

#### Placement Data in Search/Comparison
- Search filter: "Minimum placement %"
- Search filter: "Minimum median salary"
- Comparison: side-by-side placement stats
- Sorting: sort by placement %, by salary

#### ROI (Return on Investment) Feature
```
ROI = (Average Salary Ã- Career Years) / Total College Cost

Example:
  College A: â‚¹8L fees, â‚¹12 LPA placement
  ROI = (12 Ã- 30) / 8 = 45x return

  College B: â‚¹25L fees, â‚¹15 LPA placement
  ROI = (15 Ã- 30) / 25 = 18x return

â†' College A has better ROI despite lower salary
```

---

### 2. NIRF RANKINGS INTEGRATION

**Why this is critical:** NIRF (National Institutional Ranking Framework) is India's official college ranking system by the Ministry of Education. Every platform displays it prominently. Students and parents trust NIRF rankings.

**What competitors show:**
- NIRF rank (overall, engineering, medical, management, law, etc.)
- NIRF score (out of 100)
- NIRF rank year
- Rank change year-over-year
- NIRF rank within state
- NIRF rank within category

**What we need to add:**

#### NIRF Database Fields
```
nirf_rankings:
  id
  college_id
  ranking_body ("NIRF")
  category ("Engineering" / "Medical" / "Management" / "Overall" / "Law" / "Pharmacy" / etc.)
  year (2023, 2024, 2025, 2026)
  rank (integer)
  score (numeric, out of 100)
  rank_change (vs previous year)
  data_source ("NIRF Official")
  source_url
```

#### NIRF Display on College Page
```
College Detail Header
  â"œâ"€â"€ NIRF Rank: #42 (Engineering, 2025)
  â"œâ"€â"€ NIRF Score: 68.5/100
  â"œâ"€â"€ Rank Change: â†'5 from last year
  â"œâ"€â"€ State Rank: #8 in Karnataka
  â""â"€â"€ Category Rank: #42 out of 200 Engineering colleges
```

#### NIRF in Search
- Filter by NIRF rank range
- Sort by NIRF rank
- Display NIRF badge on college cards

#### Other Rankings to Include
- NIRF (primary)
- NAAC Grade (A++, A+, A, B++, B+, B)
- NBA Accreditation
- India Today rankings
- The Week rankings
- Outlook rankings
- QS World Rankings (for top institutions)
- Times Higher Education (for top institutions)

---

### 3. COMPREHENSIVE CUTOFF DATA SYSTEM

**Why this is critical:** Cutoff data is the SECOND most important feature after placement data. Students with specific ranks/scores need to know which colleges they can get into. Platforms like CutoffBaba, Coladex, and JEEPredictor are built entirely around cutoff data.

**What competitors show:**
- Opening rank and closing rank (year-wise)
- Round-wise cutoffs (Round 1, Round 2, Round 3, Mop-Up)
- Category-wise (General, OBC, SC, ST, EWS, PwD)
- Quota-wise (All India Quota 15%, State Quota 85%)
- Branch-wise cutoffs (not just college-level)
- Historical trends (3-5 years)
- Graph visualization of cutoff movement

**What we need to add:**

#### Cutoff Database Fields
```
cutoffs:
  id
  college_id
  course_id
  branch (e.g. "Computer Science Engineering")
  exam_name (e.g. "JEE Main", "NEET", "KCET", "MHT-CET")
  year (2023, 2024, 2025, 2026)
  round (Round 1, Round 2, Round 3, Mop-Up, CSAB Special)
  quota ("All India" / "State" / "Home State")
  category ("General" / "OBC" / "SC" / "ST" / "EWS" / "PwD")
  opening_rank (integer)
  closing_rank (integer)
  opening_score (numeric, if applicable)
  closing_score (numeric, if applicable)
  seat_type ("General" / "Female" / "PWD")
  source ("JoSAA Official" / "MCC Official" / "State Counselling")
  source_url
  verified_date
```

#### Cutoff Display on College Page
```
College Detail â†' Cutoff Section
  â"œâ"€â"€ JEE Main Cutoffs (2025)
  â"‚   â"œâ"€â"€ Round 1: Opening 1234, Closing 5678 (General)
  â"‚   â"œâ"€â"€ Round 2: Opening 1500, Closing 6200 (General)
  â"‚   â""â"€â"€ Round 3: Opening 1800, Closing 6800 (General)
  â"œâ"€â"€ NEET Cutoffs (2025)
  â"‚   â"œâ"€â"€ Round 1: Score 650+ (General)
  â"‚   â""â"€â"€ Round 2: Score 640+ (General)
  â"œâ"€â"€ Historical Trend Graph (3-5 years)
  â""â"€â"€ Category-wise Breakdown
```

#### Major Exams to Cover
**National Level:**
- JEE Main â†' IITs, NITs, IIITs, GFTIs (via JoSAA)
- JEE Advanced â†' IITs
- NEET UG â†' Medical colleges (via MCC + State)
- CAT â†' IIMs and B-Schools
- CLAT â†' National Law Universities
- CUET â†' Central Universities
- XAT, SNAP, MAT, CMAT â†' MBA colleges
- GATE â†' M.Tech admissions
- GPAT â†' Pharmacy

**State Level:**
- KCET â†' Karnataka engineering/medical
- MHT-CET â†' Maharashtra
- TNEA â†' Tamil Nadu engineering
- AP EAMCET â†' Andhra Pradesh
- TS EAMCET â†' Telangana
- WBJEE â†' West Bengal
- UPSEE â†' Uttar Pradesh
- BCECE â†' Bihar
- JEE Main (State Quota) â†' All states

---

### 4. SEAT MATRIX DATA

**Why this is critical:** Students need to know how many seats are available, in which category, under which quota.

**What we need to add:**

#### Seat Matrix Fields
```
seat_matrix:
  id
  college_id
  course_id
  branch
  exam (e.g. "JEE Main", "NEET")
  total_seats
  general_seats
  obc_seats
  sc_seats
  st_seats
  ews_seats
  pwd_seats
  female_supernumerary
  home_state_quota
  all_india_quota
  management_quota
  year
  source
```

---

### 5. COLLEGE CLAIMING AND PROFILE MANAGEMENT

**Why this is critical:** CollegeDunia, Shiksha, AdmissionSeason all allow colleges to claim and manage their profiles. This gives colleges ownership of their data and provides verified, accurate information to students.

**What competitors do:**
- College registers with official email
- Platform verifies college identity
- College gets a dashboard to manage their profile
- College can update: courses, fees, placements, photos, contact info
- College gets a "Verified" badge
- College can respond to reviews
- College can post admission updates

**What we need to add:**

#### College Claiming System
```
College Claiming Flow:
1. College representative visits /claim-college
2. Selects their college from existing database
3. Provides official college email (@collegename.edu)
4. Uploads verification documents:
   - College registration certificate
   - AICTE/UGC approval letter
   - NAAC/NBA accreditation
   - Official letter from Principal/Registrar
5. Platform verifies (manual review, 24-48 hours)
6. On approval:
   - "Claimed by College" badge
   - College gets admin dashboard
   - Can edit college profile
   - Can respond to reviews
   - Can post admission updates
   - Can upload placement data
```

#### College Dashboard (for claimed colleges)
```
College Admin Dashboard:
â"œâ"€â"€ Profile Management
â"‚   â"œâ"€â"€ Edit college details
â"‚   â"œâ"€â"€ Update courses and fees
â"‚   â"œâ"€â"€ Upload photos and videos
â"‚   â"œâ"€â"€ Update placement data
â"‚   â""â"€â"€ Update contact information
â"œâ"€â"€ Reviews
â"‚   â"œâ"€â"€ View all reviews
â"‚   â"œâ"€â"€ Respond to reviews
â"‚   â""â"€â"€ Report inappropriate reviews
â"œâ"€â"€ Analytics
â"‚   â"œâ"€â"€ Profile views
â"‚   â"œâ"€â"€ Enquiry count
â"‚   â"œâ"€â"€ Comparison count
â"‚   â""â"€â"€ Search appearances
â"œâ"€â"€ Admission Updates
â"‚   â"œâ"€â"€ Post admission announcements
â"‚   â"œâ"€â"€ Update application deadlines
â"‚   â""â"€â"€ Post cutoff information
â""â"€â"€ enquiries
    â"œâ"€â"€ View enquiries received
    â""â"€â"€ Download enquiry leads
```

---

### 6. STATE-LEVEL EXAM DATA

**Why this is critical:** India has 28+ state-level entrance exams. Students in each state primarily use state exams for admissions. Without state-level data, we miss 70%+ of the Indian student market.

**What we need to add:**

#### State Exam Database
```
exams:
  - KCET (Karnataka)
  - MHT-CET (Maharashtra)
  - TNEA (Tamil Nadu)
  - AP EAMCET (Andhra Pradesh)
  - TS EAMCET (Telangana)
  - WBJEE (West Bengal)
  - UPSEE (Uttar Pradesh)
  - BCECE (Bihar)
  - JEECUP (Uttar Pradesh - Polytechnic)
  - HSTES (Haryana)
  - REAP (Rajasthan)
  - DTE MP (Madhya Pradesh)
  - OJEE (Odisha)
  - TS EAMCET (Telangana)
  - Goa CET
  - HP CET (Himachal Pradesh)
  - JKCET (Jammu & Kashmir)
  - CUSAT (Kerala)
  - KEAM (Kerala)
  - Assam CEE
  - Nagaland CET
  - Mizoram CET
  - Manipur CET
  - Tripura Board
  - Meghalaya Board
  - Arunachal Board
  - Sikkim Board

Each exam needs:
  - Exam name
  - Conducting authority
  - State
  - Exam type (Engineering / Medical / Both)
  - Application dates
  - Exam dates
  - Result dates
  - Counselling dates
  - Official website
  - Official cutoff data source
```

---

### 7. BRANCH/COURSE-SPECIFIC DATA

**Why this is critical:** Students don't just choose a college â€" they choose a specific branch/course within a college. Placement, cutoff, and fee data varies dramatically by branch.

**Example:**
```
IIT Bombay:
  Computer Science: 95% placed, â‚¹25 LPA median
  Electrical: 90% placed, â‚¹18 LPA median
  Mechanical: 80% placed, â‚¹12 LPA median
  Civil: 70% placed, â‚¹8 LPA median
  Metallurgy: 65% placed, â‚¹7 LPA median
```

**What we need to add:**
- Branch-wise placement data
- Branch-wise cutoff data
- Branch-wise fee data
- Branch-wise seat count
- Branch comparison tool

---

### 8. COMPREHENSIVE COMPARISON TOOL

**Why this is critical:** CollegeDunia allows comparing up to 4 colleges. Dial4College allows up to 6. This is a core feature.

**What competitors show in comparison:**
- College name and location
- NIRF rank
- NAAC grade
- Established year
- Course offered
- Total fees (4-year/5-year)
- Placement percentage
- Average/Median salary
- Highest salary
- Top recruiters
- Cutoff (for student's rank)
- Hostel fees
- Campus area
- Student strength
- Faculty count
- Student-faculty ratio
- Accreditation
- Key facilities
- Student reviews rating

**What we need to add:**
- Comparison up to 4 colleges (we already have this)
- Add placement data to comparison
- Add NIRF rank to comparison
- Add branch-specific comparison
- Add ROI comparison
- Add cutoff comparison for student's rank
- Share comparison link
- Export comparison as PDF

---

### 9. RANK/COLLEGE PREDICTOR (Enhanced)

**Why this is critical:** Careers360, CollegeDunia, JEEPredictor, CollegePIPE, Admittance Edutech â€" every platform has a predictor. It's the #1 tool students use during admission season.

**What competitors offer:**
- Enter exam + rank/score â†' get list of colleges you can get
- Round-wise prediction (Round 1, Round 2, Round 3)
- Category-wise prediction
- State quota vs All India quota
- Branch-wise prediction
- Dream / Safe / Moderate categorization
- Historical cutoff comparison
- AI-powered recommendations

**What we need to enhance:**
- Our current predictor is too basic
- Add round-wise prediction
- Add category-wise prediction
- Add state quota prediction
- Add branch-wise prediction
- Add Dream/Safe/Moderate categorization
- Use actual cutoff data, not just AI guessing
- Add "chance" percentage

---

### 10. STRUCTURED STUDENT REVIEWS

**Why this is critical:** Shiksha has 4 lakh+ verified reviews. CollegeDunia has millions. Reviews are trusted by students.

**What competitors show:**
- Overall rating (1-5 stars)
- Category-wise ratings:
  - Placements (1-5)
  - Faculty (1-5)
  - Infrastructure (1-5)
  - Campus Life (1-5)
  - Value for Money (1-5)
- Written review
- Reviewer info (course, year of study, verified status)
- Helpful votes on reviews
- Photos in reviews
- Review sorting (most recent, highest rated, most helpful)

**What we need to add:**
- Category-wise rating breakdown
- Verified student badge
- Helpful votes on reviews
- Review photos
- Review sorting options
- Review filtering by course/year

---

### 11. NEWS AND UPDATES SECTION

**Why this is critical:** Shiksha has a dedicated news portal. Careers360 publishes regular updates. Students need real-time information about:
- Exam dates and results
- Admission deadlines
- Counselling schedules
- Scholarship deadlines
- Policy changes
- College news

**What we need to add:**
- Dedicated /news section (separate from /blog)
- Categories: Exam News, Admission News, Counselling News, Scholarship News, College News
- News alerts/notifications
- Live updates during exam season
- Deadline countdown timers

---

### 12. CAMPUS PHOTOS AND VIRTUAL TOURS

**Why this is critical:** Students want to see the campus before applying. Visual content drives engagement.

**What competitors show:**
- Campus photos (gallery)
- Hostel photos
- Lab photos
- Library photos
- Sports facilities photos
- Campus video tours (YouTube embeds)
- 360Â- virtual tours (premium colleges)

**What we need to add:**
- Organized photo galleries by category
- Campus video embed support
- Photo upload from college admin (claimed colleges)
- Photo verification by platform

---

### 13. COUNSELLING INTEGRATION

**Why this is critical:** Shortlisted.live, OGcollege, Admittance Edutech â€" new platforms are emerging specifically for counselling support. This is a HUGE business opportunity.

**What competitors offer:**
- JoSAA choice filling assistance
- Round-wise guidance (freeze/float/slide)
- Document checklist for counselling
- Counselling schedule and deadlines
- Personalized counselling from experts
- Paid counselling services

**What we need to add:**
- JoSAA counselling guide
- State counselling guides
- Document checklist generator
- Counselling timeline/calculator
- Choice filling order generator (based on rank + preferences)
- Freeze/Float/Slide decision helper
- Counselling expert directory (future: paid service)

---

### 14. PARENT-FOCUSED FEATURES

**Why this is critical:** Parents are often the decision-makers in Indian education. They need:
- Fee comparison tools
- ROI calculator
- Safety/security information
- Hostel quality data
- Distance from home calculator
- Parent reviews/testimonials

---

### 15. COMMON APPLICATION FORM

**Why this is critical:** Shiksha offers a Common Application Form that allows students to apply to multiple colleges with one form. This is a major lead generation tool.

**What we need to add:**
- Single application form
- Apply to multiple colleges at once
- Application status tracking
- Application fee management (future)
- Document upload once, apply everywhere

---

### 16. WHATSAPP COUNSELLING

**Why this is critical:** CampusConnect and other platforms offer WhatsApp-based counselling. WhatsApp is India's #1 messaging app.

**What we need to add:**
- WhatsApp chatbot for basic queries
- WhatsApp counselling service
- WhatsApp admission updates
- WhatsApp deadline reminders
- WhatsApp scholarship alerts

---

### 17. STUDENT COMMUNITY / Q&A

**Why this is critical:** Shiksha has "Ask and Answer" community. Students ask questions, experts and other students answer. This builds engagement and SEO.

**What we need to add:**
- Student Q&A section
- Expert answers
- Community voting on answers
- College-specific Q&A
- Course-specific Q&A
- SEO-optimized Q&A pages

---

## IMPORTANT GAPS (Should Add)

### 18. SCHOLARSHIP TRACKING AND ALERTS
- Deadline countdown
- Email/SMS reminders before deadline
- Application status tracking
- Document checklist for each scholarship

### 19. EXAM CALENDAR
- Comprehensive exam calendar view
- Personalized exam calendar based on student interests
- Deadline alerts
- Application reminders

### 20. STUDY ABROAD SECTION (Future)
- International university listings
- Country-wise comparison
- Application guidance
- Scholarship for study abroad

### 21. COACHING CENTER DIRECTORY (Future)
- Coaching centers by city
- Course offered
- Fee structure
- Results track record

### 22. ONLINE COURSE INTEGRATION
- Partnerships with Coursera, Udemy, etc.
- Course recommendations based on college/course
- Free course listings

### 23. CAREER GUIDANCE
- Career paths after each course
- Salary expectations by career
- Industry growth data
- Skill requirements

---

## SUMMARY: PRIORITY ORDER

### Must Add (V4.1 - Before Launch)
1. Placement data system (database + UI)
2. NIRF rankings integration
3. Comprehensive cutoff data system
4. Seat matrix data
5. Enhanced comparison tool (with placement/NIRF)
6. Enhanced predictor (with cutoff data)
7. Branch-specific data

### Should Add (V4.2 - After Launch)
8. College claiming/profile management
9. State-level exam data (all 28 states)
10. Structured reviews (category-wise ratings)
11. News/updates section
12. Campus photo galleries
13. Counselling guides

### Nice to Have (V5.0 - Future)
14. WhatsApp counselling chatbot
15. Student Q&A community
16. Common application form
17. Parent-focused features
18. Study abroad section
19. Coaching center directory
20. Career guidance

---

## DATA SOURCES FOR NEW FEATURES

| Feature | Primary Data Source | Secondary Source |
|---|---|---|
| Placement Data | NIRF reports | College websites, verified submissions |
| NIRF Rankings | nirfindia.org | Official NIRF PDFs |
| Cutoff Data | JoSAA (josaa.nic.in), MCC (mcc.nic.in) | State counselling portals |
| Seat Matrix | JoSAA, MCC, State counselling | College websites |
| State Exams | State counselling websites | College websites |
| College Verification | College official documents | AISHE portal |
| Reviews | Student submissions | Verified alumni |

---

## ESTIMATED ADDITIONAL EFFORT

| Feature | Development Effort | Data Collection Effort |
|---|---|---|
| Placement system | 2-3 weeks | 4-6 weeks (NIRF data) |
| NIRF integration | 1-2 weeks | 1-2 weeks |
| Cutoff system | 3-4 weeks | 6-8 weeks (multi-year data) |
| Seat matrix | 1-2 weeks | 2-4 weeks |
| Enhanced predictor | 2-3 weeks | 1 week |
| College claiming | 2-3 weeks | Ongoing |
| State exam data | 2-3 weeks | 4-6 weeks |
| Structured reviews | 1 week | N/A |
| News section | 1 week | Ongoing |

**Total additional effort: ~15-20 weeks development + ~20-30 weeks data collection**

---

*Analysis completed: September 2026*
*Based on: CollegeDunia, Shiksha.com, Careers360, CollegeFynder, CutoffBaba, Coladex, CollegeGo, JEEPredictor, CollegePIPE, Shortlisted, CampusConnect, AdmissionSeason*

---

# ============================================================

# ============================================================
# SECTION C: IMPLEMENTATION PHASES (STEP-BY-STEP BUILD ORDER)
# ============================================================
---

# SECTION C: IMPLEMENTATION PHASES (STEP-BY-STEP)

**How to read these phases:**
- Each phase is in strict build order â€" start at Phase 1, don't skip
- **[DEV]** = Developer/AI builds this
- **[YOU]** = You must do this manually
- **[VERIFY]** = You must test it works before moving on
- Each phase has: Steps, Files, Security, Testing, Completion gate

---

## PHASE 1 â€" SETUP ENVIRONMENT [BOTH]

**Goal:** Get your computer and accounts ready so development can start.

### [YOU] Do These First
1. Install Node.js 18+ â†' https://nodejs.org (click LTS version)
2. Install Python 3.11+ â†' https://python.org (installer, tick "Add to PATH")
3. Install Docker Desktop â†' https://docker.com (sign up, install, start it)
4. Install Git â†' https://git-scm.com (installer, default options)
5. Install VS Code â†' https://code.visualstudio.com
6. Create GitHub account â†' https://github.com (create private repo named `padhaanewala`)
7. Verify all installed:
   - Open CMD/Terminal, type: `node -v` â†' should show v18+ 
   - Type: `python --version` â†' should show 3.11+
   - Type: `git --version` â†' should show version
   - Type: `docker --version` â†' should show version

### [DEV] Then Build
1. Clone GitHub repo locally: `git clone https://github.com/YOURNAME/padhaanewala.git`
2. Create folder structure:
   ```
   padhaanewala/
   â"œâ"€â"€ frontend/          â†' Next.js app
   â"œâ"€â"€ backend/           â†' FastAPI app
   â"œâ"€â"€ proctoring-service/ â†' ML proctoring (added later)
   â"œâ"€â"€ docs/              â†' documentation
   â"œâ"€â"€ scripts/           â†' helper scripts
   â""â"€â"€ .github/workflows/ â†' CI/CD (added later)
   ```
3. Create `docker-compose.dev.yml` â€" runs PostgreSQL and Redis locally:
   ```yaml
   version: '3.8'
   services:
     db:
       image: postgres:15
       environment:
         POSTGRES_DB: padhaanewala_dev
         POSTGRES_USER: padhaanewala
         POSTGRES_PASSWORD: dev_password_123
       ports: ["5432:5432"]
       volumes: [pgdata:/var/lib/postgresql/data]
     redis:
       image: redis:7-alpine
       ports: ["6379:6379"]
   volumes:
     pgdata:
   ```
4. Create `.env.example` and `.env.development` with all environment variable names
5. Create `.gitignore` (must include: `.env*`, `node_modules/`, `venv/`, `__pycache__/`)
6. Create root `README.md` with setup instructions
7. Scaffold frontend:
   ```
   cd frontend
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
   ```
8. Scaffold backend:
   ```
   cd backend
   python -m venv venv
   venv\Scripts\activate   (Windows)
   pip install fastapi uvicorn sqlalchemy alembic pydantic python-jose[cryptography] passlib[bcrypt] python-multipart redis httpx psycopg2-binary
   pip freeze > requirements.txt
   ```
9. Create `backend/app/main.py` with health check endpoint
10. Create `backend/app/config.py` (reads from .env)
11. Create `backend/app/database.py` (PostgreSQL connection)
12. Init Alembic: `alembic init alembic`
13. Create branches: `main` (production), `develop` (development)
14. Commit all code to `develop` branch and push to GitHub

### [VERIFY] Check It Works
| Test | How | Expected |
|---|---|---|
| Docker running | `docker compose up -d` | PostgreSQL + Redis containers start |
| Backend starts | `cd backend && uvicorn app.main:app --reload` | Server at localhost:8000 |
| Health check | Visit `http://localhost:8000/health` | Shows JSON `{"status":"ok"}` |
| Frontend starts | `cd frontend && npm run dev` | Website at localhost:3000 |
| Database connects | `cd backend && alembic current` | No errors |

### Completion Gate (ALL must be true)
- [ ] All software installed and verified on your machine
- [ ] GitHub repo exists and is private
- [ ] Docker starts PostgreSQL + Redis
- [ ] Backend returns health OK
- [ ] Frontend loads at localhost:3000
- [ ] Code pushed to `develop` branch

**PHASE 1 COMPLETE â†' YES / NO**

---

## PHASE 2 â€" DATABASE: USERS, AUTH, ROLES [DEV]

**Goal:** Create the user and login system database tables.

### [DEV] Steps
1. Create `backend/app/models/user.py` â€" 6 tables:
   - `users`: id, email, mobile, password_hash, is_active, is_email_verified, is_mobile_verified, created_at, updated_at, last_login_at
   - `student_profiles`: user_id, name, education_level, course_interest, preferred_state, preferred_city, budget_min, budget_max
   - `admins`: user_id, name, department
   - `counsellors`: user_id, name, specialization, max_leads, is_active
   - `roles`: name (super_admin, admin, content_manager, seo_manager, data_manager, test_admin, proctor, counsellor_manager, counsellor, reviewer, support, analytics)
   - `user_roles`: user_id, role_id
2. Create `backend/app/schemas/auth.py` â€" Pydantic validation models
3. Run migration: `alembic revision --autogenerate -m "create_users"` then `alembic upgrade head`
4. Create `backend/app/utils/security.py`:
   - `hash_password()` â€" bcrypt 12 rounds
   - `verify_password()`
   - `create_access_token()` â€" JWT, 24-hour expiry
   - `create_refresh_token()` â€" 30-day expiry
   - `decode_token()`
5. Create `backend/app/dependencies.py`:
   - `get_db()` â€" database session
   - `get_current_user(token)` â€" verify JWT
   - `require_role(role)` â€" check user role
6. Create `backend/app/routers/auth.py` endpoints:
   - `POST /api/v1/auth/register` â€" create student
   - `POST /api/v1/auth/login` â€" login, returns tokens
   - `POST /api/v1/auth/refresh` â€" get new access token
   - `POST /api/v1/auth/logout` â€" invalidate token
7. Create `backend/app/routers/users.py`:
   - `GET /api/v1/users/me` â€" get own profile
   - `PUT /api/v1/users/me` â€" update profile
   - `PUT /api/v1/users/me/password` â€" change password
8. Add rate limiting middleware (5 requests/minute on auth)
9. Add error handling middleware (consistent error format)
10. Add request logging middleware
11. Write tests `backend/tests/test_auth.py` and run them

### [VERIFY] Manual Check
| Test | How | Expected |
|---|---|---|
| Register | POST /register with email, password | 201 + tokens returned |
| Login | POST /login with same credentials | 200 + tokens |
| Wrong password | POST /login with wrong password | 401 error |
| Get profile | GET /users/me with token | Your profile info |
| No token | GET /users/me without token | 401 error |

### [YOU] Nothing needed in this phase â€" all developer work.

### Completion Gate
- [ ] 6 user tables created
- [ ] Register/login/refresh/logout work
- [ ] Password is hashed (not visible in database)
- [ ] All tests pass
- [ ] Code on `develop` branch

**PHASE 2 COMPLETE â†' YES / NO**

---

## PHASE 3 â€" EMAIL, SMS, OTP VERIFICATION [BOTH]

**Goal:** Students can verify their mobile (OTP) and email. Password reset works.

### [YOU] Create SMS Account (MUST DO â€" before developer starts)
1. Go to https://msg91.com â†' Sign up
2. Verify your email and mobile
3. Create a new project â†' "Padhaanewala OTP"
4. Note the API key â†' give to developer, add as `SMS_API_KEY` in `.env`
5. Note the sender ID â†' add as `SMS_SENDER_ID`
6. Complete DLT registration (required for India) â€" follow MSG91's instructions

**[YOU] Create Email Account (MUST DO)**
1. Go to https://sendgrid.com or AWS SES
2. Create account, verify sender domain (padhaanewala.in)
3. Get API key â†' add as `EMAIL_API_KEY` in `.env`
4. For local testing: you can use Mailtrap or Ethereal (free email testing)

### [DEV] Steps
1. Create `backend/app/services/sms_service.py`:
   - `send_otp(mobile, otp)` â€" sends 6-digit OTP
   - OTP expired after 5 minutes
   - Max 3 sends per 10 minutes per mobile
   - Max 5 verification attempts per OTP
   - Store OTP hashed in database
2. Create `backend/app/services/email_service.py`:
   - `send_verification_email()` â€" verification link
   - `send_password_reset_email()` â€" reset link
   - Log all sends to database
3. Create `otp_records` table migration
4. Add endpoints:
   - `POST /api/v1/auth/verify-email`
   - `POST /api/v1/auth/login/otp/send`
   - `POST /api/v1/auth/login/otp/verify`
   - `POST /api/v1/auth/forgot-password`
   - `POST /api/v1/auth/reset-password`
5. Write tests for all OTP flows

### [VERIFY] Manual Check
| Test | How | Expected |
|---|---|---|
| OTP sent | POST /otp/send with your mobile | SMS arrives on your phone |
| OTP correct | Enter OTP | Login succeeds |
| OTP wrong | Enter wrong OTP | Error + attempt counted |
| Email verification | Click link in email | Email verified message |

### Completion Gate
- [ ] SMS OTP arrives on real phone (not simulator)
- [ ] Email verification works
- [ ] Password reset works
- [ ] All rate limits enforced

**PHASE 3 COMPLETE â†' YES / NO**

---

## PHASE 4 â€" DATABASE: STATES, DISTRICTS, UNIVERSITIES [DEV]

**Goal:** Geographic data (states, districts, cities) and universities.

### [DEV] Steps
1. Create `backend/app/models/location.py`:
   - `states`: id, name, code, is_active
   - `districts`: id, name, code, state_id
   - `cities`: id, name, district_id, is_metropolitan
2. Create `backend/app/models/university.py`
3. Create `scripts/seed_states.py`:
   - Import all 28 states + 8 union territories
   - Import ~780 districts (Census of India data)
   - Import major cities
4. Create `scripts/seed_universities.py` â€" import 100-200 universities
5. Create API endpoints:
   - `GET /api/v1/locations/states`
   - `GET /api/v1/locations/states/{id}/districts`
   - `GET /api/v1/universities`
6. Run seed scripts
7. Tests

### [YOU] Verify data completeness
- After seeding, check: Are all states present? (28 states + 8 UTs)
- Check your own state: Does it have all districts?

### Completion Gate
- [ ] 36 states/UTs in database
- [ ] ~780 districts in database
- [ ] Universities loaded
- [ ] API endpoints return correct data

**PHASE 4 COMPLETE â†' YES / NO**

---

## PHASE 5 â€" DATABASE: COLLEGES, COURSES, FEES [DEV]

**Goal:** Core content tables â€" the heart of the platform.

### [DEV] Steps
1. Create `backend/app/models/college.py`:
   - id, college_id (COLLEGE000001 format), name, official_name, slug, college_type, ownership, university_id, state_id, district_id, city, address, pincode, lat, lng, website, email, phone, established_year, accreditation_naac, accreditation_nba, overview, facilities (JSONB), hostel fields, total_reviews, average_rating, is_featured, is_active, verification_status, last_verified_date
2. Create `backend/app/models/course.py`: name, slug, degree, duration, category, overview, eligibility, career_information
3. Create `backend/app/models/college_course.py`: college_id, course_id, annual_fee, total_fee, intake_seats, admission_mode, entrance_exam, is_active (unique on college_id+course_id)
4. Create `backend/app/models/fee.py`: tuition_fee, hostel_fee, examination_fee, other_charges, total_approximate, fee_period, academic_year, is_approximate
5. Create `backend/app/models/admission.py`: admission_information, eligibility_details, entrance_exam, application_start_date, application_end_date
6. Create migration with indexes (GIN for full-text search, trigram for fuzzy match)
7. Tests

### [YOU] Prepare college data CSV (start now, takes weeks)
Create a CSV file with columns:
```
College Name, State, District, City, University, Type, Ownership, Website, Phone, Email, Established Year
```
Start with 10 colleges first (test data), expand to 1000+ later.

### Completion Gate
- [ ] College/course/fee tables created
- [ ] Indexes in place
- [ ] Sample college data ready (your side)

**PHASE 5 COMPLETE â†' YES / NO**

---

## PHASE 6 â€" DATABASE: SCHOLARSHIPS, EXAMS [DEV]

**Goal:** Scholarship and exam tables.

### [DEV] Steps
1. Create `backend/app/models/scholarship.py`: name, slug, provider, provider_type, eligibility, state_id, course_category, income_criteria, amount, deadline, documents_required (JSONB), application_procedure, official_link, status, verification_status
2. Create `backend/app/models/exam.py`: name, slug, conducting_authority, eligibility, official_website, official_notification_url
3. Create `exam_dates`: exam_id, year, application_start_date, application_end_date, exam_date, admit_card_date, result_date
4. Migration with indexes
5. Tests

### [YOU] Prepare scholarship + exam data (start now)
- Research 10 scholarships to test
- Research 10 exams to test
- Later expand to 100+ and 50+

### Completion Gate
- [ ] Scholarship and exam tables created
- [ ] Sample data ready

**PHASE 6 COMPLETE â†' YES / NO**

---

## PHASE 7 â€" DATABASE: MOCK TESTS, QUESTIONS [DEV]

**Goal:** Test engine tables.

### [DEV] Steps
1. Create `backend/app/models/mock_test.py`:
   - `mock_tests`: name, slug, exam_id, course_id, subject, difficulty, total_questions, duration_minutes, negative_marking, is_proctored, is_active
   - `test_configurations`: mock_test_id, mode (standard/proctored), camera_required, microphone_required, screen_sharing_required, fullscreen_required, copy_paste_restricted, tab_switch_detection, warning_threshold, violation_threshold, auto_submit_on_violation, evidence_retention_days, allowed_attempts, result_visibility
   - `questions`: question_text, question_type, subject, topic, difficulty, explanation, positive_marks, negative_marks, is_active
   - `question_options`: question_id, option_text, is_correct, display_order
   - `test_questions`: mock_test_id, question_id, display_order, marks
   - `test_attempts`: mock_test_id, student_id, started_at, submitted_at, status, total_score, correct_count, incorrect_count, unattempted_count, percentage, submission_reason, attempt_number
   - `test_answers`: test_attempt_id, question_id, selected_option_ids (JSONB), is_correct, time_spent_seconds, marked_for_review
2. Migration, indexes, tests

### Completion Gate
- [ ] All mock test tables created
- [ ] Relationships correct

**PHASE 7 COMPLETE â†' YES / NO**

---

## PHASE 8 â€" DATABASE: REVIEWS, BLOGS, FAQs, MEDIA, SEO, NOTIFICATIONS, AUDIT [DEV]

**Goal:** Content and engagement tables.

### [DEV] Steps
1. `reviews`: college_id, course_id, student_id, rating, review_text, year_of_study, status (submitted/approved/rejected), moderation_notes
2. `categories` + `blogs`: title, slug, content, excerpt, featured_image_url, category_id, author_id, status (draft/published), published_at, meta_title, meta_description, canonical_url
3. `faqs`: question, answer, entity_type, entity_id, display_order
4. `media`: url, file_name, file_type, file_size, alt_text, entity_type, entity_id, image_type, display_order
5. `seo_metadata`: entity_type, entity_id, meta_title, meta_description, og_title, og_image_url, structured_data (JSONB)
6. `notifications`: user_id, type, title, message, data, is_read, channel
7. `audit_logs`: user_id, action, entity_type, entity_id, old_value (JSONB), new_value (JSONB), ip_address, created_at
8. `banners`: title, image_url, link_url, position, display_order, is_active, start_date, end_date
9. Migration, tests

### Completion Gate
- [ ] All content tables created
- [ ] Basic CRUD works

**PHASE 8 COMPLETE â†' YES / NO**

---

## PHASE 9 â€" DATABASE: ENQUIRIES, LEADS, SAVED COLLEGES, CONSENT [DEV]

**Goal:** Business/lead tables.

### [DEV] Steps
1. `enquiries`: student_id, name, mobile, email, course_id, college_id, state_id, city, qualification, message, source, source_url, utm_source, utm_medium, utm_campaign, utm_content, ip_address, device_type, status (new/contacted/interested/application_started/admission_completed/not_interested/closed), assigned_counsellor_id, follow_up_date
2. `lead_notes`: enquiry_id, user_id, note
3. `lead_status_history`: enquiry_id, old_status, new_status, changed_by
4. `saved_colleges`: student_id, college_id (unique pair)
5. `consent_records`: user_id, consent_type, consent_text, granted, ip_address (for DPDP compliance)
6. Migration, tests

### Completion Gate
- [ ] Lead management tables created
- [ ] Enquiry submission works at API level

**PHASE 9 COMPLETE â†' YES / NO**

---

## PHASE 10 â€" DATABASE: PLACEMENT, NIRF, CUTOFF, SEAT MATRIX [DEV]

**Goal:** Placement/ranking tables (core differentiator).

### [DEV] Steps
1. `placement_records`: college_id, course_id, branch, academic_year, total_graduating, total_placed, placement_percentage, students_higher_studies, median_salary_lpa, average_salary_lpa, highest_salary_lpa, total_recruiters, top_recruiters (JSONB), source, source_url, verified_date
2. `nirf_rankings`: college_id, category, year, rank, score, rank_change, state_rank
3. `other_rankings`: college_id, ranking_body, category, year, rank
4. `cutoffs`: college_id, course_id, branch, exam_name, year, round, quota, category, opening_rank, closing_rank, opening_score, closing_score, source, source_url
5. `seat_matrix`: college_id, course_id, branch, exam, total_seats, general_seats, obc_seats, sc_seats, st_seats, ews_seats, pwd_seats, home_state_quota, all_india_quota, management_quota, year
6. Migration, indexes, tests

### Completion Gate
- [ ] Placement/NIRF/cutoff/seat matrix tables created
- [ ] Sample data can be inserted

**PHASE 10 COMPLETE â†' YES / NO**

---

## PHASE 11 â€" BACKEND: COLLEGE CRUD API [DEV]

**Goal:** Admins can create/edit/delete colleges. Public can view/search.

### [DEV] Steps
1. Create `backend/app/schemas/college.py` (validation)
2. Create `backend/app/services/college_service.py`:
   - `create_college()` â€" slug generation, audit log
   - `update_college()` â€" audit log
   - `get_college_by_slug()` â€" public
   - `list_colleges(filters, page, limit)` â€" paginated
   - `delete_college()` â€" soft delete
   - `generate_college_id()` â€" creates COLLEGE000001 format
   - `generate_slug()` â€" handles duplicates
3. Create `backend/app/routers/colleges.py`:
   - `GET /api/v1/colleges` â€" public, filters (course, state, city, type, ownership, fees, rating)
   - `GET /api/v1/colleges/{slug}` â€" public detail
   - `GET /api/v1/colleges/{id}/courses` â€" public
   - `POST /api/v1/colleges` â€" admin only
   - `PUT /api/v1/colleges/{id}` â€" admin only
   - `DELETE /api/v1/colleges/{id}` â€" super_admin only
4. Pagination (default 20, max 100), sorting, filtering
5. Audit logging on all writes
6. Comprehensive tests

### Completion Gate
- [ ] College create works (admin)
- [ ] College list/search works (public)
- [ ] Pagination correct

**PHASE 11 COMPLETE â†' YES / NO**

---

## PHASE 12 â€" BACKEND: COURSE, SCHOLARSHIP, EXAM APIs [DEV]

**Goal:** CRUD APIs for courses, scholarships, exams.

### [DEV] Steps
1. `schemas/course.py`, `services/course_service.py`, `routers/courses.py`
2. `schemas/scholarship.py`, `services/scholarship_service.py`, `routers/scholarships.py`
3. `schemas/exam.py`, `services/exam_service.py`, `routers/exams.py`
4. Each: GET list (filtered), GET by slug, POST/PUT/DELETE (admin)
5. Scholarship status auto-updates based on deadline
6. Exam upcoming/past filtering
7. Tests

### Completion Gate
- [ ] All 3 CRUD APIs work
- [ ] Filters work

**PHASE 12 COMPLETE â†' YES / NO**

---

## PHASE 13 â€" BACKEND: SEARCH ENGINE [DEV]

**Goal:** Full-text search with filters and natural language parsing.

### [DEV] Steps
1. Create `backend/app/services/search_service.py`:
   - PostgreSQL full-text search (`to_tsvector`, GIN indexes)
   - Trigram similarity for typos
   - Multi-filter search: course, state, city, type, ownership, fee range, rating, hostel, placement%
2. Natural language parsing:
   - "BHMS colleges in Karnataka" â†' course=BHMS, state=Karnataka
   - "Nursing colleges under 5 lakh" â†' course=Nursing, max_fee=500000
   - "Private BHMS with hostel" â†' type=private, hostel=true
3. Pagination, sorting (relevance, rating, fees, placement)
4. Redis caching of popular searches
5. Rate limit: 30/min per IP
6. Tests

### Completion Gate
- [ ] Text search works
- [ ] Filters work
- [ ] NLP parsing works

**PHASE 13 COMPLETE â†' YES / NO**

---

## PHASE 14 â€" BACKEND: PLACEMENT, CUTOFF, NIRF APIs [DEV]

**Goal:** Placement, cutoff, ranking APIs.

### [DEV] Steps
1. CRUD APIs for placement_records, cutoffs, nirf_rankings, seat_matrix
2. Branch-wise data queries
3. Historical trend queries (5 years)
4. Admin-only writes
5. Tests

### Completion Gate
- [ ] Placement data can be added per college-branch
- [ ] Cutoff trends queryable
- [ ] NIRF rank assignable

**PHASE 14 COMPLETE â†' YES / NO**

---

## PHASE 15 â€" FRONTEND: LOGIN, REGISTER, OTP PAGES [DEV]

**Goal:** Students can register and log in.

### [DEV] Steps
1. `/auth/register` â€" name, email, mobile, password form
2. `/auth/login` â€" email/password OR mobile/OTP tabs
3. `/auth/verify-otp` â€" 6-digit OTP entry with resend
4. `/auth/forgot-password` â€" email input
5. `/auth/reset-password` â€" new password form
6. Form validation (Zod)
7. API integration
8. JWT storage (httpOnly cookie or memory)
9. Redirect to /dashboard after login
10. Error handling (wrong password, OTP expired, etc.)
11. Mobile responsive
12. Loading states, disabled buttons during submit

### [VERIFY] Manual Check
| Test | How | Expected |
|---|---|---|
| Register | Create account with your mobile | OTP reaches your phone |
| Login | Log in with password | Dashboard loads |
| Login OTP | Choose mobile OTP login | OTP reaches phone, login works |
| Wrong password | Enter wrong password | Error message shows |

### Completion Gate
- [ ] Registration works on your real phone
- [ ] Login works
- [ ] OTP works
- [ ] Password reset works

**PHASE 15 COMPLETE â†' YES / NO**

---

## PHASE 16 â€" FRONTEND: HEADER, FOOTER, HOMEPAGE [DEV]

**Goal:** The main public pages.

### [DEV] Steps
1. Header: logo, navigation (Colleges, Courses, Predictor, Scholarships, Mock Tests, Exams, Blog), "Get Admission Help" button, Login/Register, sticky on scroll, mobile hamburger
2. Footer: branding, quick links, courses, exams, legal, contact, social
3. Homepage sections (all from API, not hardcoded):
   - Hero: "Find the Right College for Your Future" + search bar + Predictor CTA
   - Quick action cards: Find Colleges, Compare, Predictor, Scholarships, Mock Tests, Get Help
   - Popular courses
   - Featured colleges
   - Scholarships (active)
   - Upcoming exams
   - Why Padhaanewala
   - Student reviews
   - Latest blog articles
   - Admission assistance CTA
   - WhatsApp floating button
4. Homepage API: `GET /api/v1/homepage/sections` â€" returns all sections from database, cached 5 min
5. Loading skeletons for each section
6. SEO meta tags + structured data (Organization, WebSite)
7. Mobile responsive

### Completion Gate
- [ ] Homepage looks modern and professional
- [ ] All sections load from database
- [ ] Mobile phone view works

**PHASE 16 COMPLETE â†' YES / NO**

---

## PHASE 17 â€" FRONTEND: COLLEGE LISTING [DEV]

**Goal:** Search/filter college pages.

### [DEV] Steps
1. `/colleges` page:
   - Filter sidebar: course, state, city, type, ownership, fees range, hostel, rating, placement%
   - College cards: name, location, badge (featured/verified), rating, placement %, fees
   - Sort: relevance, rating, fees, NIRF rank, placement
   - Pagination, results count
   - URL-based filters (bookmarkable: /colleges?state=Karnataka&type=private)
   - Mobile: filters open in drawer
   - Empty state: "No colleges found. Adjust filters."

### Completion Gate
- [ ] Filters work
- [ ] Colors, layout look professional
- [ ] Works on mobile

**PHASE 17 COMPLETE â†' YES / NO**

---

## PHASE 18 â€" FRONTEND: COLLEGE DETAIL PAGE [DEV]

**Goal:** Full college profile page.

### [DEV] Steps
1. `/college/{slug}`:
   - Header: name, location, type, rating, Apply/Get Help button, Compare button, Save button
   - Placement section: % , median salary, highest salary, top recruiters, branch-wise table, year trend graph
   - NIRF section: rank badge, score, rank change
   - Overview
   - Courses (table: name, duration, fees, seats)
   - Fees (structured, "Approximate" notice)
   - Eligibility, Admission, Cutoff (historical trends), Facilities, Hostel
   - Scholarships, Reviews, Gallery, FAQs
   - Similar colleges
   - Enquiry CTA, WhatsApp CTA
2. Structured data: CollegeOrUniversity JSON-LD
3. SSR/ISR for SEO (5-minute revalidation)

### Completion Gate
- [ ] Page shows all sections with data
- [ ] Placement stats visible
- [ ] NIRF rank visible
- [ ] Save/Compare/Apply buttons work

**PHASE 18 COMPLETE â†' YES / NO**

---

## PHASE 19-22 â€" FRONTEND: COURSE, SCHOLARSHIP, EXAM PAGES [DEV]

**Goal:** All remaining public content pages.

### [DEV] Steps
**Phase 19 â€" Courses:** `/courses` grid + `/courses/{slug}` detail (overview, duration, eligibility, fee info, colleges offering, career info, FAQs). CTA: "Need help choosing a college?"

**Phase 20 â€" Scholarships:** `/scholarships` with filters + `/scholarships/{slug}` (provider, amount, deadline, documents, official link clearly marked as OFFICIAL)

**Phase 21 â€" Exams:** `/exams` upcoming/past tabs + `/exams/{slug}` (authority, all dates with countdown, official website, FAQs)

**Phase 22 â€" Mobile responsive audit** on all pages

### Completion Gate
- [ ] All content pages work
- [ ] Official links clearly distinguished
- [ ] Countdown to exam dates works

**PHASE 19-22 COMPLETE â†' YES / NO**
---

## PHASE 23 â€" FRONTEND: STUDENT DASHBOARD [DEV]

**Goal:** Students can see saved items, tests, enquiries.

### [DEV] Steps
1. `/dashboard` â€" welcome, quick stats
2. `/dashboard/profile` â€" edit name/mobile/email/education/preferences, change password
3. `/dashboard/saved-colleges` â€" saved list, remove, compare
4. `/dashboard/test-history` â€" attempts with scores
5. `/dashboard/enquiries` â€" enquiries with status
6. All pages require login (redirect to /auth/login)

### Completion Gate
- [ ] Dashboard works after login
- [ ] Profile edit saves
- [ ] Saved colleges list works

**PHASE 23 COMPLETE â†' YES / NO**

---

## PHASE 24 â€" FRONTEND: COMPARISON + PREDICTOR [DEV]

**Goal:** College comparison and AI predictor.

### [DEV] Steps
1. `/compare` â€" up to 4 colleges side-by-side:
   - NIRF rank, NAAC grade, location, fees, placement%, median salary, highest salary, top recruiters, cutoff, hostel, facilities, rating
   - Add/remove, share via WhatsApp/copy link
   - "Ask AI: Which is better?" button
2. `/college-predictor`:
   - Form: exam, rank/score, category, state, course, budget, govt/private, hostel
   - Results: Dream / Safe / Moderate / Not Eligible columns
   - Each college: name, fees, location, chance %, "Get Help" button
   - Disclaimer: "Estimates based on previous year cutoffs. Not guaranteed."

### Completion Gate
- [ ] Compare 2-4 colleges works
- [ ] Predictor takes inputs and shows categorized results
- [ ] Disclaimer visible

**PHASE 24 COMPLETE â†' YES / NO**

---

## PHASE 25 â€" BACKEND: ENQUIRY, LEAD APIs [DEV]

**Goal:** Enquiry submission and lead management.

### [DEV] Steps
1. `POST /api/v1/enquiries` â€" public, rate-limited (3/10min)
   - Capture: source URL, UTM params, device, IP
   - Trigger admin notification on new enquiry
2. `GET /api/v1/enquiries` â€" admin list with filters
3. `PUT /api/v1/admin/leads/{id}` â€" counsellor updates status
4. `POST /api/v1/admin/leads/{id}/notes` â€" add follow-up note
5. Status history on every change
6. Role-based: counsellors see only assigned leads

### Completion Gate
- [ ] Enquiry creates lead
- [ ] Admin sees new lead
- [ ] Status changes tracked

**PHASE 25 COMPLETE â†' YES / NO**

---

## PHASE 26 â€" FRONTEND: ENQUIRY FORM, WHATSAPP, STATIC PAGES [DEV]

**Goal:** Lead capture everywhere + info pages.

### [DEV] Steps
1. Reusable `EnquiryForm` (modal on any page):
   - Fields: name, mobile, email, course, college, state, city, qualification, message
   - Pre-fills college/course when triggered from a college/course page
   - Success: "Thank you. Our counsellor will contact you."
2. WhatsApp button everywhere (number from settings, not hardcoded)
3. `/about` â€" mission, vision, services
4. `/contact` â€" info, form, map
5. `/privacy-policy`, `/terms-conditions`, `/disclaimer` â€" editable from admin

### Completion Gate
- [ ] Enquiry form works from college page
- [ ] WhatsApp button opens correct chat
- [ ] All static pages render

**PHASE 26 COMPLETE â†' YES / NO**

---

## PHASE 27-30 â€" ADMIN PANEL: FOUNDATION + COLLEGE MANAGEMENT [DEV]

**Goal:** Admin can manage colleges and content.

### [DEV] Steps
**Phase 27 â€" Admin foundation:**
1. `/admin/login`
2. Layout: sidebar, header, breadcrumbs
3. Role-based menu visibility

**Phase 28 â€" Admin dashboard:**
1. Stats: total colleges/courses/scholarships/exams/students/leads
2. Enquiries today/week/month
3. Recent activity
4. Most viewed colleges/top searched courses

**Phase 29 â€" College management:**
1. `/admin/colleges` â€" list with search/filters/bulk actions
2. `/admin/colleges/[id]/edit`:
   - All college fields
   - Fee structure editor
   - Course assignment
   - Gallery upload
   - FAQ management
   - SEO editor
   - Preview before publish
   - Draft/publish workflow
3. Rich text editor for overview

**Phase 30 â€" Placement data management:**
1. Add placement records per college-branch-year
2. Add NIRF rank
3. Add cutoff data (admin may also import via CSV later)

### [VERIFY] You check
| Test | How | Expected |
|---|---|---|
| Add college | Create a test college in admin | Saves, appears on public site |
| Add placement | Enter placement data | Shows on college page |
| Publish | Switch to published | Public can see it |

### Completion Gate
- [ ] You can add a college from admin without code
- [ ] Placement data shows on college page
- [ ] Publish/unpublish works

**PHASE 27-30 COMPLETE â†' YES / NO**

---

## PHASE 31-34 â€" ADMIN: COURSES, SCHOLARSHIPS, EXAMS, BLOGS, REVIEWS, LEADS [DEV]

**Goal:** Complete admin content management.

### [DEV] Steps
**Phase 31 â€" Course/scholarship/exam admin screens** (list + edit + publish)

**Phase 32 â€" Blog CMS:** list, create/edit with rich text editor, category, featured image, SEO, draftâ†'publish, schedule

**Phase 33 â€" Review moderation:** pending queue, approve/reject, bulk actions; FAQ management; banner management

**Phase 34 â€" Lead/CRM admin:** leads list with filters, assign counsellor, status updates, notes, export CSV; counsellor management

### Completion Gate
- [ ] You can add/edit everything from admin
- [ ] Reviews can be approved/rejected
- [ ] Leads visible and assignable

**PHASE 31-34 COMPLETE â†' YES / NO**

---

## PHASE 35 â€" ADMIN: SUB-USERS + USER ACTIVITY MONITORING [DEV]

**Goal:** You can create limited admin users and see all user activity.

### [DEV] Steps
1. Sub-user creation:
   - Create user with role (Content Manager, Test Admin, Counsellor, etc.)
   - Granular permissions per module (view/create/edit/publish/delete)
   - Deactivate/reactivate
   - View sub-user activity log
2. User activity monitoring:
   - Dashboard: active users, registrations, most viewed colleges, most searched courses, recent enquiries
   - Student detail: full profile + tabs for Search History, Browsing, Interactions, Enquiries, Tests, AI Chats
   - Search history viewer (query, filters, results, timestamp)

### [VERIFY] You test:
| Test | How | Expected |
|---|---|---|
| Create sub-user | Create a "Content Manager" | They can only see content modules |
| Sub-user logs in | Test sub-user's account | Cannot access other modules |
| View student activity | Open a student profile | See their searches, pages, enquiries |

### Completion Gate
- [ ] You can create sub-users with limited access
- [ ] You can see any user's complete activity

**PHASE 35 COMPLETE â†' YES / NO**

---

## PHASE 36 â€" NOTIFICATIONS, EMAIL, SMS [DEV]

**Goal:** Automated emails/SMS/notifications.

### [DEV] Steps
1. Notification service (in-app + email + SMS)
2. Templates: enquiry confirmation, lead assigned, review approved, welcome
3. Triggers: enquiryâ†'student email + admin alert; lead assignedâ†'counsellor; review statusâ†'student
4. Notification bell with unread count + history
5. User notification preferences

### Completion Gate
- [ ] Enquiry sends email to student
- [ ] Admin gets notified on new lead
- [ ] Bell icon shows notifications

**PHASE 36 COMPLETE â†' YES / NO**

---

## PHASE 37 â€" SEO: SITEMAP, ROBOTS, STRUCTURED DATA [DEV]

**Goal:** Search engines can find the site.

### [DEV] Steps
1. Dynamic XML sitemap at /sitemap.xml (all public pages, lastmod dates)
2. robots.txt
3. Structured data on all page types:
   - CollegeOrUniversity, Course, Scholarship, Event (exam), Article, FAQPage, BreadcrumbList
4. Meta tags, canonical, Open Graph on every page
5. Programmatic SEO pages (auto-generate /bhms-colleges-in-karnataka only when 3+ colleges match)

### [VERIFY] You check:
1. Visit https://search.google.com/test/rich-results
2. Paste a college page URL â†' should validate without errors

### Completion Gate
- [ ] Sitemap works
- [ ] Structured data validates

**PHASE 37 COMPLETE â†' YES / NO**

---

## PHASE 38-41 â€" AI SYSTEM: RAG, CHAT, PREDICTOR, ADMIN [DEV]

**Goal:** AI assistant and predictor working with verified data.

### [DEV] Steps
**Phase 38 â€" RAG Knowledge Pipeline:**
1. `backend/app/services/rag_service.py`
2. Ingestion: extract text from colleges, courses, scholarships, exams, FAQs, blogs
3. Cleaning + normalization
4. Chunking (500-1000 tokens)
5. Embedding generation (OpenAI ada-002)
6. Store in pgvector
7. Retrieval: cosine similarity + metadata filter
8. Re-index on entity update + weekly full reindex

**Phase 39 â€" AI Chat API + Safety:**
1. `POST /api/v1/ai/chat` â€" RAG pipeline â†' LLM â†' response with sources
2. System prompt (safety rules):
   - "NEVER invent colleges, fees, dates"
   - "Only use retrieved context"
   - "If not in DB: 'I could not verify this information'"
   - "Never guarantee admissions"
3. Conversation storage
4. Rate limit 20/min per user
5. Cost tracking (model, tokens, per-query cost)
6. Response caching for similar queries (30-40% cost savings)
7. AI admin dashboard (usage, cost, queries)

**Phase 40 â€" College Predictor (cutoff-based):**
1. Match rank against historical cutoffs
2. Dream/Safe/Moderate/Not Eligible
3. Round-wise + category-wise prediction
4. Disclaimer

**Phase 41 â€" Frontend AI chat widget** (floating, sources shown, mobile full-screen)

### Completion Gate
- [ ] "What is BHMS?" â†' correct answer with source
- [ ] "BHMS colleges in Karnataka" â†' colleges listed with source
- [ ] Predictor returns categorized colleges with disclaimers

**PHASE 38-41 COMPLETE â†' YES / NO**

---

## PHASE 42-46 â€" MOCK TEST SYSTEM [DEV]

**Goal:** Standard (non-proctored) mock tests.

### [DEV] Steps
**Phase 42 â€" Test listing + instructions pages**

**Phase 43 â€" Question bank admin:** create/edit questions, bulk import CSV, question types (MCQ, true/false), difficulty levels

**Phase 44 â€" Test interface (DESKTOP ONLY):**
- Full-screen
- Countdown timer (server-authoritative)
- Question navigation grid
- Answer selection
- Mark for review
- Auto-save every answer
- Submit (with confirm), auto-submit on timeout
- Block mobile (message: "Mock tests available on laptop/desktop only")

**Phase 45 â€" Results page:** score, %, correct/incorrect/unattempted, time taken, topic-wise breakdown, Practice Again, View Solutions

**Phase 46 â€" Test admin:** create test, select exam/course/subject/difficulty/questions/duration/marks/negative marking

### [VERIFY] You test:
| Test | How | Expected |
|---|---|---|
| Take test | Take a 10-question test | All features work |
| Auto-save | Refresh mid-test | Answers saved |
| Timeout | Start 1-minute test, wait | Auto-submits |
| Mobile | Open test on phone | Shows "desktop only" message |

### Completion Gate
- [ ] You can take a full test
- [ ] Answers auto-save
- [ ] Auto-submit works
- [ ] Mobile blocked correctly

**PHASE 42-46 COMPLETE â†' YES / NO**

---

## PHASE 47-55 â€" PROCTORED EXAM SYSTEM [DEV]

**Goal:** Secure proctored exams with camera monitoring.

### [DEV] Steps
**Phase 47 â€" Consent + pre-test:**
1. Consent dialog (DPDP-compliant): what's recorded, why, retention, who can access, privacy policy link
2. Device check (block mobile/tablet)
3. Camera/microphone/screen permission requests
4. Full-screen entry

**Phase 48 â€" Client-side monitoring:**
- Tab switch detection (visibility API)
- Full-screen exit detection
- Window blur detection
- Copy/paste prevention
- Context menu blocking
- Keyboard shortcut detection

**Phase 49 â€" Event reporting:** events sent to backend in real-time, warnings, violation counter

**Phase 50 â€" Auto-submission:** timer zero, first violation (strict), threshold reached, camera disabled â†' auto-submit with reason + saved answers

**Phase 51 â€" Proctoring ML service** (separate Docker):
- Face detection (MediaPipe)
- Multiple face / face-not-detected
- Looking away detection
- Risk scoring (Normalâ†'Lowâ†'Warningâ†'Highâ†'Critical)
- **AI assists, never automatically declares cheating**

**Phase 52 â€" Evidence storage:** camera snapshots â†' private S3, encrypted, retention policy, auto-delete

**Phase 53 â€" Admin proctoring dashboard:** sessions list (filters), session detail with event timeline + evidence viewer, review status (Normal/Suspicious/Cleared)

**Phase 54 â€" Proctoring policies:** configurable per test in admin

**Phase 55 â€" Proctoring recovery:** handle disconnect, reconnect, restore session, sync answers, resume per policy

### [VERIFY] You test (with real camera):
| Test | How | Expected |
|---|---|---|
| Start proctored test | On desktop with camera | Consent, camera, full-screen |
| Switch tab | Alt+Tab during test | Warning/violation recorded |
| Cover camera | Block camera | Camera-disabled event |
| Review | Check admin proctoring dashboard | Session + evidence visible |

### Completion Gate
- [ ] Full proctoring flow works on your desktop
- [ ] Tab switch detected
- [ ] Evidence viewable by admin
- [ ] Auto-submit works per policy

**PHASE 47-55 COMPLETE â†' YES / NO**

---

## PHASE 56-65 â€" DATA IMPORT [BOTH]

**Goal:** Fill the platform with real data.

### [YOU] Do these:
1. Finalize college CSV (1000+ colleges) â€" Phase 59
2. Finalize course/scholarship/exam CSVs â€" Phase 60
3. Finalize question bank CSV (500+) â€" Phase 61
4. Placement data CSV from NIRF â€" Phase 62
5. Cutoff data CSV from JoSAA/MCC â€" Phase 63

### [DEV] Steps
**Phase 56 â€" CSV import API:** uploadâ†'validateâ†'errorsâ†'previewâ†'confirmâ†'import
**Phase 57 â€" Admin import UI:** drag-drop, error report, preview, import progress
**Phase 58 â€" Duplicate detection:** fuzzy name matching
**Phase 59 â€" Import colleges** (your CSV â†' database)
**Phase 60 â€" Import courses/scholarships/exams**
**Phase 61 â€" Import questions**
**Phase 62 â€" Import placement data**
**Phase 63 â€" Import cutoff data**
**Phase 64 â€" Data verification workflow:** draftâ†'verifyâ†'publish; verification dashboard
**Phase 65 â€" Blog content + legal pages** (you write content, developer uploads)

### Completion Gate
- [ ] 1000+ colleges live
- [ ] 50+ courses live
- [ ] 100+ scholarships live
- [ ] 50+ exams live
- [ ] 500+ questions live
- [ ] Placement data live for top 500
- [ ] Cutoff data live
- [ ] 20+ blog articles live
- [ ] Legal pages live

**PHASE 56-65 COMPLETE â†' YES / NO**

---

## PHASE 66-75 â€" SECURITY, PERFORMANCE, TESTING [DEV]

**Goal:** Fast, secure, works everywhere.

### [DEV] Steps
**Phase 66:** Security headers, CORS, HTTPS redirect
**Phase 67:** Rate limiting on all endpoints (search 30/min, auth 5/min, enquiry 3/10min, AI 20/min)
**Phase 68:** Input validation hardening (all fields)
**Phase 69:** Consistent error handling ("Something went wrong")
**Phase 70:** Database query optimization (indexes, N+1 fixes)
**Phase 71:** Redis caching (homepage 5min, lists 5min, details 5min)
**Phase 72:** Frontend performance (Lighthouse >90, images lazy-loaded)
**Phase 73:** Mobile audit (touch targets, no horizontal scroll)
**Phase 74:** Accessibility (WCAG 2.1 AA, alt text, keyboard nav, contrast)
**Phase 75:** Cross-browser (Chrome, Firefox, Edge, Safari)

### Completion Gate
- [ ] Lighthouse score >90
- [ ] Mobile works well
- [ ] Security headers active

**PHASE 66-75 COMPLETE â†' YES / NO**

---

## PHASE 76-85 â€" LEGAL COMPLIANCE, MONITORING, BACKUP [BOTH]

**Goal:** Legally compliant, monitored, backed up.

### [YOU] Do:
1. **Phase 76:** Appoint Grievance Officer (name/email/phone), publish on website
2. **Phase 77:** Confirm DPDP parental consent flow works for under-18
3. **Phase 79:** Configure Sentry account (give DSN to developer)
4. **Phase 83:** Create GA4 property (give Measurement ID)
5. **Phase 84:** Google Search Console verification (DNS TXT record)

### [DEV] Steps
**Phase 76 â€" DPDP compliance:** parental consent, no child tracking, data deletion request flow
**Phase 77 â€" IT Rules compliance:** grievance officer page, 24h ack / 15-day resolve, content takedown (3h), 3-month user reminders
**Phase 78 â€" Sentry** error tracking
**Phase 79 â€" Monitoring:** health checks, alerts (error rate, response time, disk, DB connections)
**Phase 80 â€" Backup:** daily automated, 30-day retention, restore test
**Phase 81 â€" SSL/HTTPS:** Let's Encrypt/AWS ACM, auto-renewal, HSTS
**Phase 82 â€" DNS:** production + www + staging records
**Phase 83 â€" Analytics:** GA4 events (search, college views, predictor, enquiries, registrations, WhatsApp clicks)
**Phase 84 â€" Search Console:** submit sitemap, monitor coverage
**Phase 85 â€" WAF:** Cloudflare rules, DDoS protection, bot protection

### Completion Gate
- [ ] Grievance officer details on website
- [ ] SSL works (HTTPS)
- [ ] Analytics tracking live
- [ ] Backups working
- [ ] Monitoring alerts active

**PHASE 76-85 COMPLETE â†' YES / NO**

---

## PHASE 86-95 â€" CI/CD, STAGING, PRODUCTION [BOTH]

**Goal:** Automated deployments, safe launch environment.

### [YOU] Do:
1. **Phase 89:** Set up staging AWS resources
2. **Phase 90:** Set up production AWS resources (RDS, Redis, S3, ECS)
3. **Phase 90:** Repo secrets for CI/CD (GitHub â†' Settings â†' Secrets)
4. **Phase 91:** Help verify load test
5. **Phase 94:** UAT â€" test everything yourself + 5 friends

### [DEV] Steps
**Phase 86:** Git branching (main/develop/feature) + commit conventions + tags
**Phase 87:** CI pipeline (lint, type check, unit tests, build)
**Phase 88:** CD pipeline (staging auto-deploy on develop merge, production on main with approval)
**Phase 89:** Staging setup + deploy + verify
**Phase 90:** Production setup (Mumbai ap-south-1, Multi-AZ)
**Phase 91:** Load test (homepage 100 concurrent, search 50, test sessions 50 â†' target p95 < 500ms)
**Phase 92:** Security audit (OWASP ZAP scan, fix critical/high)
**Phase 93:** Final QA (functional + visual + content)
**Phase 94:** UAT fixes
**Phase 95:** SEO verification (Search Console, structured data)

### Completion Gate
- [ ] Staging working at staging.padhaanewala.in
- [ ] CI/CD deploying automatically
- [ ] Load test passed
- [ ] Security scan clean

**PHASE 86-95 COMPLETE â†' YES / NO**

---

## PHASE 96-105 â€" LAUNCH [BOTH]

**Goal:** Go live.

### [YOU] Final launch checklist (Phase 96-97):
- [ ] All legal pages published + Grievance Officer shown
- [ ] Privacy Policy in English AND Hindi
- [ ] Domain â†' production server
- [ ] SSL works
- [ ] Analytics live
- [ ] Test on your phone + laptop
- [ ] 5 friends tested (UAT)
- [ ] All content reviewed
- [ ] Backup verified
- [ ] You have ALL credentials: AWS, Cloudflare, GitHub, database, admin login
- [ ] Approve launch

### [DEV] Steps
**Phase 96:** Production deployment (migrations, seed data, deploy backend + frontend, CDN)
**Phase 97:** Smoke tests (homepage, search, college page, login, enquiry, AI chat, mock test, admin)
**Phase 98:** 24-hour monitoring (errors in Sentry, response times)
**Phase 99:** Fix critical bugs
**Phase 100:** Documentation (README, admin guide, deployment guide, env vars)
**Phase 101:** Admin training (show you how to use everything)
**Phase 102:** Handover (all source code, DB schema, credentials, docs)
**Phase 103:** 2-week stabilization (monitor, fix bugs, optimize)
**Phase 104:** Performance tuning based on real traffic
**Phase 105:** Final sign-off

### Completion Gate
- [ ] Site live at padhaanewala.in
- [ ] Stable 2 weeks
- [ ] All credentials transferred to you
- [ ] You can manage everything yourself without developer

**PHASE 96-105 COMPLETE â†' YES / NO â†' PROJECT DONE**

---

# END OF PHASES

Now that all phases are complete, you own a fully functional, legally compliant, India-scale education platform. The developer's job is done. Routine updates (colleges, scholarships, blog, lead management) are done by YOU from the admin panel â€" no developer needed.
# MASTER MANUAL TASK LIST

## Accounts to Create
- GitHub, AWS, Cloudflare, OpenAI/Anthropic, Sentry, MSG91/Twilio, AWS SES/SendGrid, GA4, Search Console, Domain Registrar

## Domain/DNS
- Purchase padhaanewala.in, configure nameservers, A/CNAME/MX/TXT/CAA records

## Cloud Infrastructure
- AWS VPC, RDS PostgreSQL, ElastiCache Redis, S3 buckets (media + proctoring), IAM roles, ECR, ECS

## Database
- Create production/staging DBs, automated backups, test restoration, seed data

## AI Provider
- Create account, generate API key, set budget alerts

## Email/SMS
- Verify sender domain, create templates, move SES out of sandbox, DLT registration for SMS

## Google Services
- GA4 property, Search Console verification, sitemap submission, conversion tracking

## Content
- Research 1000+ colleges, 50+ courses, 100+ scholarships, 50+ exams, 500+ questions, 20+ blog articles, legal pages

## Testing
- Test all flows on mobile + desktop, Chrome/Firefox/Safari, Android/iPhone, HTTPS, sitemap, robots.txt

## Legal
- Appoint Grievance Officer, publish contact details, DPDP compliance verification

---

# DEFINITION OF READY FOR LAUNCH

- [ ] Homepage works
- [ ] College search works (text + filters + NLP)
- [ ] College pages work (with placement, NIRF, cutoff)
- [ ] Course pages work
- [ ] Scholarship pages work
- [ ] Exam pages work
- [ ] Admin works
- [ ] Sub-user management works with RBAC
- [ ] User activity monitoring works
- [ ] Content editable from admin
- [ ] Enquiries reach admin
- [ ] Authentication works
- [ ] Mobile version works
- [ ] Exam portal desktop-only enforced
- [ ] SEO configured (sitemap, robots, structured data)
- [ ] HTTPS works
- [ ] Database backup works
- [ ] Security testing completed
- [ ] All APIs tested
- [ ] Error handling works
- [ ] Analytics configured
- [ ] AI Chat (RAG) works
- [ ] Standard mock tests work
- [ ] Proctored tests work (desktop)
- [ ] Background jobs running
- [ ] WAF configured
- [ ] Monitoring active
- [ ] Grievance Officer appointed and published
- [ ] Privacy Policy in English and Hindi
- [ ] Parental consent flow for under-18
- [ ] DPDP compliance verified
- [ ] IT Rules compliance verified
- [ ] Load tested (50K concurrent)
- [ ] CDN with Indian PoPs
- [ ] Data in ap-south-1
- [ ] Auto-scaling tested
- [ ] Low-end Android tested
- [ ] Documentation complete

---

**PADHAANEWALA EDUTECH SERVICES**
**BENGALURU â€" 560100**

*Master Plan V5.0 â€" Unified Specification + Implementation Phases*


