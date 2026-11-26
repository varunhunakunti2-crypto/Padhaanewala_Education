# Padhaanewala — College Data Operations Plan

**Status:** `PLANNING ONLY — NOT APPROVAL — NOT DATA IMPORT`  
**Purpose:** Define how to build a verified college/course/exam dataset suitable for a Collegedunia-like platform without copying third-party content.

This document does not import data, modify the database, change source code, scrapeThird-party sites, or authorise production writes.

---

## 1. Data principles

Every public data record must have:

```text
source
verification status
last verified date
verified by
confidence level
```

Do not publish a record that has no source and no verification state.

Do not copy:

- Collegedunia text;
- Collegedunia reviews;
- Collegedunia rankings descriptions;
- Collegedunia images;
- other sites’ protected content;
- unverified user claims.

Use:

- official college websites;
- official university websites;
- UGC/AICTE/ regulatory sources;
- NIRF and other public ranking sources with attribution;
- official admission notices;
- verified institutional communication;
- original editorial writing.

---

## 2. Core entity set

### Colleges

Required fields:

```text
college_id
college_name
official_name
college_type
government_or_private
university
state
district
city
address
pincode
website
email
phone
established_year
accreditation
recognition
courses
fees
hostel
facilities
admission_information
eligibility
entrance_exam
cutoff
rankings
images
reviews
faqs
data_source
last_verified_date
verification_status
verified_by
```

### Courses

```text
course_id
name
degree
duration
eligibility
entrance_exam
admission_procedure
fees_information
career_information
faqs
seo_metadata
```

### Exams

```text
exam_id
exam_name
conducting_authority
eligibility
application_start_date
application_deadline
exam_date
admit_card_date
result_date
official_website
official_notification
faqs
```

### Scholarships

```text
scholarship_id
name
provider
government_or_private
eligibility
state
course
income_criteria
amount
deadline
documents
application_procedure
official_source
status
last_verified_date
```

---

## 3. Verification states

Use a controlled workflow:

```text
DRAFT
→ SOURCE_CHECKED
→ NEEDS_REVIEW
→ REVIEWED
→ PUBLISHED
→ NEEDS_REVERIFICATION
→ ARCHIVED
```

Publishing rules:

- `DRAFT` pages are not indexable;
- `SOURCE_CHECKED` may be previewed internally only;
- `PUBLISHED` requires reviewer identity and date;
- fees and deadlines require more frequent re-verification;
- older than 180 days without recheck becomes `NEEDS_REVERIFICATION`.

---

## 4. Import workflow

Required workflow from `hh.md`:

```text
Upload → Validate → Show Errors → Preview → Confirm → Import
```

Detailed steps:

1. Upload CSV/Excel into staging/admin staging area.
2. Validate required fields and data types.
3. Normalise names, state, city, university and course values.
4. Run duplicate detection.
5. Show all errors and warnings.
6. Preview records before commit.
7. Confirm with named operator.
8. Import idempotently.
9. Store row-level verification metadata.
10. Generate a reconciliation report.

No direct production database write is allowed unless separately authorised.

---

## 5. Duplicate detection

Detect duplicates using:

- normalised official name;
- common name;
- website domain;
- address;
- city/district/state;
- university;
- phone/email where available;
- known aliases.

Do not create separate records for trivial name differences such as:

```text
IIT Delhi
Indian Institute of Technology Delhi
IITD
```

Flag as possible duplicates and require human review.

---

## 6. Fee data

Fees must be structured:

```text
tuition_fee
hostel_fee
examination_fee
other_charges
total_approximate_fee
fee_period
currency
source
last_verified_date
```

Display rule:

```text
Approximate fee. Verify with the institution before admission.
```

Never present fee data as guaranteed unless the source is official and current.

---

## 7. Rankings and cutoffs

Each ranking/cutoff value must store:

```text
ranking_source
ranking_year
stream
value
source_url
last_verified_date
verification_status
```

Do not merge rankings from different agencies into one unclear number.

Display each source separately.

---

## 8. Reviews

Workflow:

```text
Submitted → Moderation → Approved → Published
```

Rules:

- no review is public before approval;
- no abusive, spam, discriminatory or unverifiable personal claims;
- no student PII in public review text;
- reviewer identity/date recorded internally;
- image reviews require file validation and moderation.

---

## 9. Programmatic SEO rules

Allowed pages:

```text
/{course}-colleges-in-{state}
/{course}-colleges-in-{city}
/{course}-colleges
/{exam}-colleges
/{course}-colleges-under-{fee}
```

Only index when the page has:

- enough useful records;
- unique introductory copy;
- filters and comparison value;
- verified data;
- internal links;
- canonical URL;
- structured data.

Do not generate thousands of thin duplicate pages.

---

## 10. Rollout targets

### Gate DQ-1 — First usable catalogue

```text
1,000 verified colleges
20 core courses
36 states
top 100 cities
6 core exams
basic scholarship set
```

### Gate DQ-2 — Usable SEO scale

```text
3,000 verified colleges
50+ courses
200+ programmatic pages
review moderation live
ranking/cutoff data on top colleges
```

### Gate DQ-3 — Large catalogue

```text
5,000+ verified colleges
exam-specific predictor datasets
study-goal pages
city/state/course combinations
```

### Gate DQ-4 — Collegedunia-scale ambition

```text
10,000–19,000 verified colleges
continuous verification pipeline
editorial newsroom workflow
large review corpus
```

Do not skip DQ-1.

---

## 11. Acceptance criteria

A data batch is accepted only when:

- no duplicates remain unresolved;
- every published row has source and verification metadata;
- no copied third-party content is present;
- all error rows are reviewed;
- import is idempotent;
- rollback reference exists;
- public pages render correctly;
- search/filter results are correct;
- sitemap includes only approved pages.

---

## 12. Current action

This is a planning document only.

No CSV/Excel file was imported. No database row was added, changed, or deleted. No production content was accessed.

Created file:

```text
docs/college-data-operations-plan.md
```
