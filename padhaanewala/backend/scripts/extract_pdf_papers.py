"""Extract exam papers from the source PDFs into the mockTests.json schema.

    python scripts/extract_pdf_papers.py --source-dir <dir> --out ../tmp_extracted.json

Read-only with respect to the database: this script writes a JSON file that a
human can review, and it is `seed_mock_tests.py` that loads content into
Postgres. Keeping the two apart means a parsing bug cannot corrupt the catalogue.

Three PDF layouts are handled, because the three papers were generated
separately and do not share a template:

* `Hardcore_JEE_Mock_Paper_3_2026-1.pdf` - `PHYSICS` / `Section A` /
  `Section B` headers, options as `A) ...`, continuous numbering 1..75, and an
  answer key rendered as a `Q Ans Q Ans` grid.
* `JEE_Main_2026_Hardcore_Full_Length_Mock_Test-1.pdf` - self-describing
  `Q12. [MCQ]` markers, and numbering that restarts at 1 for every subject.
* `NEET_Hardcore_Mock_Test_2_...pdf` - `SECTION I - PHYSICS` headers,
  options as `A. ...`, flat 1..180 numbering, and an answer key as
  `1. C 2. C ...`.

Every question found in the answer key but not in the body is reported rather
than dropped, because a missing question means the parse lost content.
"""

import json
import re
import sys
from pathlib import Path

import pdfplumber

# Glyphs the PDF generator emitted as `(cid:N)` instead of a real character. The
# mapping is unambiguous, so repairing it is safe; anything not listed here is
# left alone and reported as unparsed.
CID_GLYPHS = {
    "214": "√",  # square root
    "242": "∫",  # integral
    "181": "∝",  # proportional to
    "177": "×",  # multiplication sign
}

# Page footers repeat on every page and would otherwise be read as question text.
FOOTER_RE = re.compile(
    r"^(Hardcore JEE Practice|JEE Main 2026 Hardcore Mock|NENEET|MADIHA|BEST OF LUCK|PAPER|TEST 2|Page \d+ of \d+)"
)

SUBJECTS = ("Physics", "Chemistry", "Mathematics", "Botany", "Zoology")

#: Printed section headers are uppercase in every one of the three PDFs, while
#: the subjects are stored mixed-case. Matching case-sensitively silently left
#: `subject` NULL on every question, so the lookup goes through this instead.
SUBJECT_BY_UPPER = {name.upper(): name for name in SUBJECTS}


def subject_of(line: str) -> str | None:
    return SUBJECT_BY_UPPER.get(line.strip().upper())


def repair(text: str) -> tuple[str, list[str]]:
    """Expand `(cid:N)` escapes. Returns the text and any unrepairable tokens."""
    unknown: list[str] = []

    def sub(match: re.Match) -> str:
        token = match.group(1)
        if token in CID_GLYPHS:
            return CID_GLYPHS[token]
        unknown.append(token)
        return match.group(0)

    return re.sub(r"\(cid:(\d+)\)", sub, text), unknown


def page_lines(pdf: pdfplumber.PDF, index: int) -> list[str]:
    raw = (pdf.pages[index].extract_text() or "").splitlines()
    lines: list[str] = []
    for line in raw:
        if FOOTER_RE.match(line.strip()):
            continue
        repaired, _ = repair(line)
        lines.append(repaired.rstrip())
    return lines


def clean_body(line: str) -> str:
    """Normalise the mojibake that Paper 3 uses for Greek and radical glyphs."""
    line = line.replace("\u00a3", "≤")
    # Paper 3 renders `μ` as a bare `m` and `ω` as `w`; both are recoverable only
    # in the specific token shapes below, so they are left as-is otherwise.
    line = re.sub(r"(?<=[=(])mmg", "μmg", line)
    line = line.replace("£", "≤")
    return re.sub(r"[ \t]+", " ", line).strip()


# ---------------------------------------------------------------- Paper 3 ----

Q_START_P3 = re.compile(r"^(\d{1,3})\.\s+(.*)$")
OPT_P3 = re.compile(r"^([A-D])\)\s*(.+)$")


def parse_paper3(path: Path) -> dict:
    with pdfplumber.open(path) as pdf:
        subject = None
        mode = None
        questions: list[dict] = []
        for index in range(len(pdf.pages)):
            text = "\n".join(page_lines(pdf, index))
            if text.lstrip().startswith("HARDCORE JEE MOCK TEST"):
                continue
            for line in text.splitlines():
                line = clean_body(line)
                if not line:
                    continue
                upper = line.upper()
                found = subject_of(line)
                if found:
                    subject = found
                    mode = None
                    continue
                if line.startswith("Section A"):
                    mode = "mcq"
                    continue
                if line.startswith("Section B"):
                    mode = "numeric"
                    continue
                if re.match(r"^(FINAL ANSWER KEY|DETAILED SOLUTIONS|FINAL QUALITY)", upper):
                    mode = None
                    continue

                opt = OPT_P3.match(line)
                if opt and questions:
                    questions[-1]["options"].append(opt.group(2).strip())
                    continue

                start = Q_START_P3.match(line)
                if start:
                    number = int(start.group(1))
                    body = start.group(2).strip()
                    kind = "numeric" if mode == "numeric" else "mcq"
                    questions.append(
                        {
                            "source_number": number,
                            "subject": subject,
                            "type": kind,
                            "text": body,
                            "options": [],
                            "page": index + 1,
                        }
                    )
    return {"questions": questions, "answers": _grid_key(p3_key_text(path))}


def p3_key_text(path: Path) -> str:
    with pdfplumber.open(path) as pdf:
        for index in range(len(pdf.pages)):
            text = "\n".join(page_lines(pdf, index))
            if "FINAL ANSWER KEY" in text:
                return text
    return ""


def _grid_key(text: str) -> dict[int, str]:
    """Read the `Q Ans Q Ans` answer grid used by Paper 3."""
    answers: dict[int, str] = {}
    for line in text.splitlines():
        if not re.match(r"^\s*\d+\s+[A-D0-9]", line):
            continue
        tokens = re.findall(r"(\d+)\s+([A-D]|\d+(?:\.\d+)?|-\d+)", line)
        for number, value in tokens:
            answers[int(number)] = value
    return answers


# ------------------------------------------------------- JEE Main full length ---

Q_START_FULL = re.compile(r"^Q(\d+)\.\s*\[(MCQ|NUM)\]\s*(.*)$")
OPT_FULL = re.compile(r"^([A-D])\)\s*(.+)$")


def parse_full_length(path: Path) -> dict:
    with pdfplumber.open(path) as pdf:
        subject = None
        subject_index = 0
        questions: list[dict] = []
        for index in range(len(pdf.pages)):
            text = "\n".join(page_lines(pdf, index))
            if re.search(r"ANSWER KEY|DETAILED SOLUTIONS|QUALITY-AUDIT", text, re.I):
                continue
            for line in text.splitlines():
                line = clean_body(line)
                if not line:
                    continue
                found = subject_of(line)
                if found:
                    subject = found
                    subject_index += 1
                    continue
                opt = OPT_FULL.match(line)
                if opt and questions:
                    questions[-1]["options"].append(opt.group(2).strip())
                    continue
                start = Q_START_FULL.match(line)
                if start:
                    number = int(start.group(1))
                    kind = "mcq" if start.group(2) == "MCQ" else "numeric"
                    questions.append(
                        {
                            "source_number": number,
                            "subject": subject,
                            "subject_index": subject_index,
                            "type": kind,
                            "text": start.group(3).strip(),
                            "options": [],
                            "page": index + 1,
                        }
                    )
        return {"questions": questions, "answers": _full_key(path)}


def _full_key(path: Path) -> dict[tuple[str, int], str]:
    """Read the per-subject answer key that restarts numbering at 1.

    The key page is found by locating the page that mentions the key *and*
    carries answer rows. Matching on the phrase alone also matches the
    instructions page, which references the key without containing one.
    """
    answers: dict[tuple[str, int], str] = {}
    with pdfplumber.open(path) as pdf:
        subject = None
        in_key = False
        for index in range(len(pdf.pages)):
            text = "\n".join(page_lines(pdf, index))
            if "FINAL ANSWER KEY" in text:
                in_key = True
            elif in_key and re.search(r"DETAILED SOLUTIONS|QUALITY-AUDIT", text, re.I):
                break
            if not in_key:
                continue
            for line in text.splitlines():
                line = line.strip()
                found = subject_of(line)
                if found:
                    subject = found
                    continue
                if subject is None:
                    continue
                for number, value in re.findall(
                    r"(\d+)\.\s+([A-D]|[\d.]+|sqrt\([^)]+\))", line
                ):
                    answers[(subject, int(number))] = value
    return answers


# ------------------------------------------------------------------- NEET ----

Q_START_NEET = re.compile(r"^(\d{1,3})\.\s+(.*)$")
OPT_NEET = re.compile(r"^([A-Z])\.\s+(.+)$")


def parse_neet(path: Path) -> dict:
    with pdfplumber.open(path) as pdf:
        subject = None
        questions: list[dict] = []
        for index in range(len(pdf.pages)):
            text = "\n".join(page_lines(pdf, index))
            if re.search(r"ANSWER KEY|QUALITY|NENEET|MADIHA", text, re.I) and "SECTION" not in text:
                if "ANSWER KEY" in text.upper():
                    break
            for line in text.splitlines():
                line = clean_body(line)
                if not line:
                    continue
                section = re.match(r"^SECTION\s+[IVX]+\s*[\-\u2013\u2014]\s*(\w+)", line, re.I)
                if section:
                    subject = subject_of(section.group(1)) or section.group(1).capitalize()
                    continue
                opt = OPT_NEET.match(line)
                if opt and questions:
                    questions[-1]["options"].append(opt.group(2).strip())
                    continue
                start = Q_START_NEET.match(line)
                if start:
                    questions.append(
                        {
                            "source_number": int(start.group(1)),
                            "subject": subject,
                            "type": "mcq",
                            "text": start.group(2).strip(),
                            "options": [],
                            "page": index + 1,
                        }
                    )
        return {"questions": questions, "answers": _neet_key(path)}


def _neet_key(path: Path) -> dict[int, str]:
    answers: dict[int, str] = {}
    with pdfplumber.open(path) as pdf:
        text = "\n".join(page_lines(pdf, len(pdf.pages) - 1))
    for number, value in re.findall(r"(\d{1,3})\.\s*([A-Z])\b", text):
        answers[int(number)] = value
    return answers


PAPERS = {
    "paper-3": parse_paper3,
    "full-length": parse_full_length,
    "neet": parse_neet,
}


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", required=True, help="directory holding the source PDFs")
    parser.add_argument("--out", required=True, help="JSON file to write")
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    out_path = Path(args.out)

    payload = {}
    for name, parser in PAPERS.items():
        # `full-length` keys its answer key by (subject, question) because that
        # paper restarts numbering per subject; JSON needs a string key, so the
        # tuple is flattened on the way out and rejoined by the loader.
        key_style = "tuple" if name == "full-length" else "flat"
        matches = sorted(source_dir.glob("*.pdf"))
        target = None
        for candidate in matches:
            lowered = candidate.name.lower()
            if name == "paper-3" and "paper_3" in lowered:
                target = candidate
            elif name == "full-length" and "full_length" in lowered:
                target = candidate
            elif name == "neet" and lowered.startswith("neet"):
                target = candidate
        if target is None:
            payload[name] = {"error": "no matching PDF found"}
            continue
        parsed = parser(target)
        answers = parsed["answers"]
        if key_style == "tuple":
            answers = {f"{subject}|{number}": value for (subject, number), value in answers.items()}
        payload[name] = {
            "source_file": target.name,
            "key_style": key_style,
            "question_count": len(parsed["questions"]),
            "answer_count": len(answers),
            "questions": parsed["questions"],
            "answers": answers,
        }

    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    for name, data in payload.items():
        print(f"{name:14s} {data.get('source_file', '-'):55s} "
              f"questions={data.get('question_count', 0):4d} answers={data.get('answer_count', 0):4d}")
    print(f"\nwrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())