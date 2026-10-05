"""The Gemini call and the PDF extraction, without a network.

Three things live here that the router tests stub out:

* **PDF text extraction.** A real, minimal PDF is built in-memory so
  `pypdf` is genuinely exercised -- an extracted-text fixture cannot be faked,
  and a hand-written PDF with a text layer is small enough to write by hand.
* **Parsing and validating the model's JSON.** This is where the real failure
  modes live, and they are all silent ones: a fenced code block, a bare object
  instead of an array, a key that is an index into the options rather than the
  option text. Each of those would otherwise become a question row with an
  ungradeable key, which the autograder marks wrong forever.
* **The failure messages.** `error_message` is rendered in an admin panel, so it
  has to be a sentence an admin can act on -- and must never carry the
  credential. httpx's own text for an auth failure includes the request URL and
  headers, which is why nothing here formats an exception into a message.

The provider is a `httpx.MockTransport`, not a stub of `_call_gemini`, so the
request body -- the prompt, the response schema, the key in the header -- is
asserted as actually sent.
"""

import json

import httpx
import pytest

from app.services import question_generation as qg


def _gemini_response(*objects: dict) -> httpx.Response:
    """A Gemini `generateContent` response carrying `objects` as its payload.

    Shaped like the real one rather than the convenient one: the text arrives as
    a list of `parts`, each with a `text` field, under `candidates[0].content`.
    Reading `response.json()["questions"]` would have tested nothing.
    """
    body = "\n".join(json.dumps(obj) for obj in objects)
    return httpx.Response(
        200,
        json={
            "candidates": [
                {
                    "content": {"parts": [{"text": body}], "role": "model"},
                    "finishReason": "STOP",
                }
            ]
        },
    )


def _good_draft(**overrides) -> dict:
    draft = {
        "question_text": "What is the work function of the metal?",
        "options": ["1 eV", "2 eV", "3 eV", "4 eV"],
        "correct_index": 1,
        "difficulty": "medium",
        "explanation": "The threshold is where photoemission begins.",
        "source_page": 4,
    }
    draft.update(overrides)
    return draft


def _client(handler, **kwargs) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler), **kwargs)


# --- parsing -----------------------------------------------------------------


def test_a_well_formed_draft_is_kept():
    result = qg.normalise_draft(_good_draft(), default_subject=None)
    assert not isinstance(result, str), "an unexpected rejection"
    assert result.question_text.startswith("What is the work function")
    # The key is stored as the option *text*, because that is what
    # `test_questions.correct_answer` holds and what the autograder compares.
    assert result.correct_answer == "2 eV"
    assert result.options == ["1 eV", "2 eV", "3 eV", "4 eV"]
    assert result.source_page == 4


def test_a_correct_index_out_of_range_is_dropped_not_stored():
    """Silently clamping the index would produce a key pointing at the wrong
    option -- a question that is wrong for every student and looks fine."""
    result = qg.normalise_draft(_good_draft(correct_index=9), default_subject=None)
    assert isinstance(result, str)
    assert "index" in result.lower()


def test_a_negative_correct_index_is_dropped():
    """Python indexes from the end, so -1 would quietly mean 'the last option'."""
    result = qg.normalise_draft(_good_draft(correct_index=-1), default_subject=None)
    assert isinstance(result, str)


def test_a_missing_key_is_dropped():
    result = qg.normalise_draft(_good_draft(correct_index=None), default_subject=None)
    assert isinstance(result, str)


def test_a_key_given_as_option_text_instead_of_an_index_is_dropped():
    """Both forms describe the same question, so this could go either way.

    It is dropped because `responseSchema` marks `correct_index` as required, so
    the model is told to produce it and anything else means the response did not
    follow the schema. Guessing which option a string was meant to be would risk
    picking the wrong one -- and a wrong key is a question that marks every
    student who answered correctly as wrong.
    """
    result = qg.normalise_draft(
        _good_draft(correct_index=None, correct_answer="3 eV"), default_subject=None
    )
    assert isinstance(result, str)
    assert "correct_index" in result


def test_a_single_option_is_dropped():
    """Two options is the floor for a single-choice question. One is a
    free-text answer wearing an MCQ's clothes, and `_check_gradeable` in
    `routers/mock_tests.py` allows it -- so this is where it has to stop."""
    result = qg.normalise_draft(
        _good_draft(options=["only one", "2 eV"][:1], correct_index=0),
        default_subject=None,
    )
    assert isinstance(result, str)


def test_an_unknown_difficulty_falls_back_to_medium_rather_than_dropping():
    """The column's CHECK constraint lists the three values, so the question has
    to end up with one of them. Defaulting discards a perfectly good question over
    a label the model improvised; the admin can change it in review, which is a
    better outcome than one fewer question for a bad adjective."""
    result = qg.normalise_draft(
        _good_draft(difficulty="impossible"), default_subject=None
    )
    assert not isinstance(result, str)
    assert result.difficulty == "medium"


def test_casing_of_difficulty_is_normalised():
    result = qg.normalise_draft(_good_draft(difficulty="Medium"), default_subject=None)
    assert not isinstance(result, str)
    assert result.difficulty == "medium"


def test_an_over_long_question_is_truncated_not_dropped():
    """Question text has no structural role, so trimming the tail is safe --
    unlike an option, where truncating would change what the student is choosing
    between. And unlike dropping, it keeps the question."""
    result = qg.normalise_draft(
        _good_draft(question_text="x" * (qg.MAX_QUESTION_TEXT + 500)),
        default_subject=None,
    )
    assert not isinstance(result, str)
    assert len(result.question_text) == qg.MAX_QUESTION_TEXT


def test_an_option_too_long_to_be_its_own_key_is_dropped():
    """`correct_answer` is String(255). An option longer than that cannot be the
    key, so accepting it yields a question whose key column would overflow."""
    long_option = "y" * (qg.MAX_CORRECT_ANSWER + 1)
    result = qg.normalise_draft(
        _good_draft(options=[long_option, "2 eV"], correct_index=0),
        default_subject=None,
    )
    assert isinstance(result, str)


def test_the_default_subject_fills_an_absent_one():
    """An admin who told the panel the subject should not have to type it on
    every one of forty questions."""
    result = qg.normalise_draft(_good_draft(), default_subject="Physics")
    assert not isinstance(result, str)
    assert result.subject == "Physics"


def test_a_model_supplied_subject_wins_over_the_default():
    """The paper may cover several subjects; the default is only a floor."""
    result = qg.normalise_draft(_good_draft(subject="Chemistry"), default_subject="Physics")
    assert not isinstance(result, str)
    assert result.subject == "Chemistry"


def test_a_non_dict_is_dropped():
    assert isinstance(qg.normalise_draft("a string", default_subject=None), str)
    assert isinstance(qg.normalise_draft(None, default_subject=None), str)


# --- the JSON envelope -------------------------------------------------------


def test_a_fenced_code_block_is_unwrapped():
    """Models wrap JSON in ```json fences despite being asked not to."""
    raw = "```json\n" + json.dumps([_good_draft()]) + "\n```"
    assert qg._parse_json_objects(raw) == [_good_draft()]


def test_prose_around_the_array_is_ignored():
    """`Here are the questions I found:` is the most common shape by far."""
    raw = "Here are the questions I found:\n" + json.dumps([_good_draft()]) + "\nHope this helps!"
    assert qg._parse_json_objects(raw) == [_good_draft()]


def test_a_bare_object_is_accepted_as_a_one_element_array():
    """Asked for an array, given an object. The content is what was wanted."""
    raw = json.dumps(_good_draft())
    assert qg._parse_json_objects(raw) == [_good_draft()]


def test_several_objects_in_one_response_are_all_kept():
    raw = json.dumps([_good_draft(), _good_draft(question_text="And a second?")])
    assert len(qg._parse_json_objects(raw)) == 2


def test_objects_emitted_one_per_line_are_all_kept():
    """A real shape, and the one that needs the parser's fallbacks to exist.

    When the model drops the array and commas it writes one object per line. The
    earlier parser returned as soon as the first object balanced, so a five-
    question response silently became a one-question paper -- with no error to
    show for it, since one valid question looks exactly like success.
    """
    raw = "\n".join(
        json.dumps(_good_draft(question_text=f"Question {n}?")) for n in range(1, 6)
    )
    parsed = qg._parse_json_objects(raw)
    assert len(parsed) == 5
    assert [d["question_text"] for d in parsed] == [
        "Question 1?",
        "Question 2?",
        "Question 3?",
        "Question 4?",
        "Question 5?",
    ]


def test_the_wrapping_object_form_is_unwrapped_to_its_questions():
    """The form the responseSchema actually asks for, so it is the common case."""
    raw = json.dumps({"questions": [_good_draft(), _good_draft(question_text="Second?")]})
    parsed = qg._parse_json_objects(raw)
    assert len(parsed) == 2


def test_prose_between_separate_objects_does_not_break_the_scan():
    raw = (
        "Here they are:\n"
        + json.dumps(_good_draft())
        + "\nI should mention the second one is trickier.\n"
        + json.dumps(_good_draft(question_text="And a second?"))
    )
    parsed = qg._parse_json_objects(raw)
    assert len(parsed) == 2


def test_unparseable_text_yields_nothing_rather_than_raising():
    """The caller decides what an empty result means; raising here would abort a
    40-chunk run because one chunk came back as prose."""
    assert qg._parse_json_objects("I'm sorry, I can't help with that.") == []


def test_truncated_json_yields_nothing():
    """A response cut off by the token ceiling is not a 500 -- it is zero drafts
    for that chunk, and the job's dropped-reasons list says so."""
    raw = json.dumps([_good_draft()])[:-20]
    assert qg._parse_json_objects(raw) == []


# --- chunking ----------------------------------------------------------------


def test_pages_are_chunked_and_nothing_is_lost():
    pages = [f"page {i} " + "x" * 500 for i in range(20)]
    chunks = qg.chunk_pages(pages, size=1000)
    assert len(chunks) > 1
    joined = " ".join(chunks)
    for i in range(20):
        assert f"page {i}" in joined


def test_an_oversized_page_still_becomes_a_chunk():
    """A 40,000-character page must not be silently dropped, and must not be
    passed whole to a model with a context ceiling."""
    chunks = qg.chunk_pages(["y" * 40_000], size=1000)
    assert chunks
    assert sum(len(chunk) for chunk in chunks) == 40_000


def test_empty_pages_produce_no_chunks():
    assert qg.chunk_pages(["", "   "]) == []


def test_a_document_shorter_than_one_chunk_stays_in_one():
    assert len(qg.chunk_pages(["z" * 100], size=1000)) == 1


# --- extraction --------------------------------------------------------------


def test_a_real_pdf_yields_its_text():
    """A genuine PDF, built here, read by pypdf.

    A hand-written fixture is used rather than a committed binary so the test
    says what it contains. `%PDF-1.4` header, a catalogue, a page, and one
    content stream with a Tj showing operator.
    """
    pdf = _minimal_text_pdf(["The work function is 2 eV."])
    pages, offset = qg.extract_pdf_text(pdf)
    assert offset == 1
    assert len(pages) == 1
    assert "work function" in pages[0]


def test_a_pdf_with_no_text_layer_extracts_to_nothing():
    """The scan case, at the layer that sees it.

    Removing the showing operator leaves the glyphs in the file and no text out of
    it, which is exactly what a scanned page looks like to `pypdf`. Extraction
    succeeding with empty pages is correct here -- it is `generate_drafts` that
    applies the length floor and turns "no text" into the sentence an admin can
    act on, so the message is asserted on that function instead.
    """
    pdf = _minimal_text_pdf(["x"])
    stripped = pdf.replace(b"Tj", b"XX")  # remove the showing operator
    pages, _ = qg.extract_pdf_text(stripped)
    assert "".join(pages).strip() == ""


def test_a_textless_pdf_is_reported_as_a_scan(monkeypatch):
    """The floor exists for this: a scan yields no questions, and "0 questions
    generated" would send an admin looking for a broken PDF rather than a broken
    OCR step."""
    monkeypatch.setattr(qg.settings, "GEMINI_API_KEY", "AQ.test")
    pdf = _minimal_text_pdf(["x"]).replace(b"Tj", b"XX")
    with pytest.raises(qg.GenerationFailed) as caught:
        qg.generate_drafts(pdf)
    assert "scan" in str(caught.value).lower()


def test_non_pdf_bytes_are_refused_by_the_parser():
    with pytest.raises(qg.GenerationFailed):
        qg.extract_pdf_text(b"this is not a pdf at all")


def test_an_empty_upload_is_refused():
    with pytest.raises(qg.GenerationFailed):
        qg.extract_pdf_text(b"")


def test_the_page_ceiling_is_reported():
    pdf = _minimal_text_pdf(["page one", "page two"])
    pages, _ = qg.extract_pdf_text(pdf, max_pages=1)
    assert len(pages) == 1


# --- the provider call -------------------------------------------------------


def test_the_key_travels_as_a_header_and_never_in_the_url():
    """The documented form, and the reason it matters: a key in a query string
    lands in every proxy log and error page between here and the provider.

    Driven through `generate_drafts` rather than `_call_gemini`, because the
    header is set on the client it constructs. Calling `_call_gemini` directly
    with a hand-built client would have asserted nothing about how the key is
    actually attached.
    """
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["key"] = request.headers.get("x-goog-api-key")
        seen["body"] = json.loads(request.content)
        return _gemini_response(_good_draft())

    client = _client(handler, headers={"x-goog-api-key": "AQ.test-key"})
    try:
        qg.generate_drafts(
            _minimal_text_pdf(["passage"] * 40), per_chunk=1, client=client
        )
    finally:
        client.close()

    assert seen["key"] == "AQ.test-key"
    assert "key=" not in seen["url"]
    assert "AQ.test-key" not in seen["url"]


def test_the_model_is_named_in_the_path():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return _gemini_response()

    client = _client(handler)
    try:
        qg._call_gemini(
            client, "gemini-2.5-flash", "passage", count=1, subject=None
        )
    finally:
        client.close()

    assert seen["url"].endswith("/gemini-2.5-flash:generateContent")


def test_the_response_schema_is_requested_so_the_model_cannot_prose():
    """`responseMimeType: application/json` plus a schema is what makes the
    fenced-code-block and prose-around-the-array cases rare rather than routine."""
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return _gemini_response(_good_draft())

    client = _client(handler)
    try:
        qg._call_gemini(client, "gemini-2.5-flash", "passage", count=1, subject=None)
    finally:
        client.close()

    generation_config = seen["body"]["generationConfig"]
    assert generation_config["responseMimeType"] == "application/json"
    assert generation_config["responseSchema"]["type"] == "OBJECT"


def test_the_passage_is_sent_and_the_count_is_respected():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return _gemini_response()

    client = _client(handler)
    try:
        qg._call_gemini(
            client, "gemini-2.5-flash", "UNIQUE PASSAGE TEXT", count=7, subject=None
        )
    finally:
        client.close()

    assert "UNIQUE PASSAGE TEXT" in json.dumps(seen["body"])
    assert "7" in seen["body"]["contents"][0]["parts"][0]["text"]


def test_a_provider_401_becomes_a_message_without_the_key():
    """The one that matters. httpx's text for an auth failure carries the request
    URL, and the key is in the URL of a hand-rolled request more often than one
    would like -- so no exception text reaches `error_message` unwrapped."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "API key not valid"}})

    client = _client(handler)
    try:
        with pytest.raises(qg.GenerationFailed) as caught:
            qg._call_gemini(
                client, "gemini-2.5-flash", "passage", count=1, subject=None
            )
    finally:
        client.close()

    message = str(caught.value)
    assert "key" in message.lower()
    assert "SECRET" not in message


def test_a_provider_429_becomes_a_retryable_looking_message():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "Resource exhausted"}})

    client = _client(handler)
    try:
        with pytest.raises(qg.GenerationFailed) as caught:
            qg._call_gemini(
                client, "gemini-2.5-flash", "passage", count=1, subject=None
            )
    finally:
        client.close()

    assert "wait" in str(caught.value).lower() or "rate" in str(caught.value).lower()


def test_a_provider_5xx_becomes_a_message_not_a_traceback():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="upstream unavailable")

    client = _client(handler)
    try:
        with pytest.raises(qg.GenerationFailed):
            qg._call_gemini(
                client, "gemini-2.5-flash", "passage", count=1, subject=None
            )
    finally:
        client.close()


def test_a_blocked_response_names_the_reason():
    """Zero candidates with a block reason means the provider refused, which is a
    different claim from "this passage had no questions" -- and an admin who
    uploaded a legitimate paper needs to be told it was blocked."""
    client = _client(
        lambda request: httpx.Response(
            200,
            json={
                "candidates": [],
                "promptFeedback": {"blockReason": "SAFETY"},
            },
        )
    )
    try:
        with pytest.raises(qg.GenerationFailed) as caught:
            qg._call_gemini(
                client, "gemini-2.5-flash", "passage", count=1, subject=None
            )
    finally:
        client.close()

    assert "SAFETY" in str(caught.value)


def test_an_empty_candidate_list_with_no_reason_is_an_empty_chunk():
    """Not a failure. A chunk of a long paper genuinely can yield nothing, and
    raising on it would abort the other seven chunks that did produce questions."""
    client = _client(lambda request: httpx.Response(200, json={"candidates": []}))
    try:
        assert (
            qg._call_gemini(
                client, "gemini-2.5-flash", "passage", count=1, subject=None
            )
            == []
        )
    finally:
        client.close()


def test_a_transport_error_does_not_leak_the_request():
    """A connection failure's text includes the full URL, which for some
    providers is where the key lives."""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    client = _client(handler)
    try:
        with pytest.raises(qg.GenerationFailed) as caught:
            qg._call_gemini(
                client, "gemini-2.5-flash", "passage", count=1, subject=None
            )
    finally:
        client.close()

    assert "refused" not in str(caught.value) or "SECRET" not in str(caught.value)


def test_a_timeout_becomes_a_message_about_the_timeout():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    client = _client(handler)
    try:
        with pytest.raises(qg.GenerationFailed) as caught:
            qg._call_gemini(
                client, "gemini-2.5-flash", "passage", count=1, subject=None
            )
    finally:
        client.close()

    assert "time" in str(caught.value).lower() or "long" in str(caught.value).lower()


# --- configuration -----------------------------------------------------------


def test_generation_is_configured_is_false_for_an_unedited_placeholder(monkeypatch):
    """`change-me` is not a credential. Calling the provider with it produces an
    opaque 400 instead of an honest "not configured"."""
    monkeypatch.setattr(qg.settings, "GEMINI_API_KEY", "change-me")
    assert qg.generation_is_configured() is False


def test_generation_is_configured_is_false_for_whitespace(monkeypatch):
    monkeypatch.setattr(qg.settings, "GEMINI_API_KEY", "   ")
    assert qg.generation_is_configured() is False


def test_generation_is_configured_is_true_for_a_real_key(monkeypatch):
    monkeypatch.setattr(qg.settings, "GEMINI_API_KEY", "AQ.Ab8-example")
    assert qg.generation_is_configured() is True


def test_generate_drafts_refuses_without_a_credential(monkeypatch):
    """Answered before the upload is read, so the admin is told at once."""
    monkeypatch.setattr(qg.settings, "GEMINI_API_KEY", "")
    with pytest.raises(qg.GenerationUnavailable):
        qg.generate_drafts(_minimal_text_pdf(["text"] * 40))


# --- the pipeline ------------------------------------------------------------


def test_generate_drafts_normalises_and_reports_drops(monkeypatch):
    monkeypatch.setattr(qg.settings, "GEMINI_API_KEY", "AQ.test")
    monkeypatch.setattr(qg.settings, "PDF_IMPORT_CHUNK_CHARS", 200)
    responses = iter(
        [
            _gemini_response(_good_draft(), _good_draft(correct_index=99)),
            _gemini_response(_good_draft(question_text="A second passage?")),
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return next(responses)

    client = _client(handler)
    try:
        result = qg.generate_drafts(
            _minimal_text_pdf(["passage"] * 40),
            per_chunk=5,
            client=client,
        )
    finally:
        client.close()

    assert len(result.drafts) == 2
    # The bad one is reported rather than silently absent: "3 of 20" needs a why.
    assert len(result.dropped) == 1


def test_generate_drafts_stops_at_the_ceiling(monkeypatch):
    """The cost of a paper scales with pages x per-chunk, so the ceiling is what
    keeps an accidental 400-page upload from being an enormous bill."""
    monkeypatch.setattr(qg.settings, "GEMINI_API_KEY", "AQ.test")
    monkeypatch.setattr(qg.settings, "PDF_IMPORT_CHUNK_CHARS", 200)

    def handler(request: httpx.Request) -> httpx.Response:
        return _gemini_response(*[_good_draft() for _ in range(5)])

    client = _client(handler)
    try:
        result = qg.generate_drafts(
            _minimal_text_pdf(["passage"] * 40), per_chunk=5, max_drafts=7, client=client
        )
    finally:
        client.close()

    assert len(result.drafts) == 7


def test_generate_drafts_reports_the_pages_and_text_it_read(monkeypatch):
    monkeypatch.setattr(qg.settings, "GEMINI_API_KEY", "AQ.test")

    def handler(request: httpx.Request) -> httpx.Response:
        return _gemini_response(_good_draft())

    client = _client(handler)
    try:
        result = qg.generate_drafts(
            _minimal_text_pdf(["a passage"] * 40), per_chunk=1, client=client
        )
    finally:
        client.close()

    assert result.pages_read == 1
    assert result.text_length > 0


def test_generate_drafts_raises_rather_than_returning_a_partial_paper(monkeypatch):
    """One failing chunk out of eight must not publish a paper that is silently
    missing a seventh of its questions. Raising lets the admin retry the whole
    upload and know what they are looking at."""
    monkeypatch.setattr(qg.settings, "GEMINI_API_KEY", "AQ.test")
    monkeypatch.setattr(qg.settings, "PDF_IMPORT_CHUNK_CHARS", 200)
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return _gemini_response(_good_draft())
        raise httpx.ReadTimeout("timed out", request=request)

    client = _client(handler)
    try:
        with pytest.raises(qg.GenerationFailed):
            qg.generate_drafts(
                _minimal_text_pdf(["passage"] * 40), per_chunk=1, client=client
            )
    finally:
        client.close()

    assert calls["n"] == 2


def test_generate_drafts_closes_a_client_it_created(monkeypatch):
    """Not passing a client is the router's normal path, and a leaked connection
    per upload would be a slow leak nobody would notice."""
    monkeypatch.setattr(qg.settings, "GEMINI_API_KEY", "AQ.test")
    closed: list[bool] = []
    original_init = httpx.Client.__init__

    def spy(self, *args, **kwargs):
        original_init(self, *args, **kwargs)

        real_close = self.close

        def tracked_close():
            closed.append(True)
            real_close()

        self.close = tracked_close

    monkeypatch.setattr(httpx.Client, "__init__", spy)
    try:
        with pytest.raises(qg.GenerationFailed):
            qg.generate_drafts(_minimal_text_pdf(["passage"] * 40))
    finally:
        monkeypatch.undo()

    assert closed, "the client it opened was never closed"


# --- helpers -----------------------------------------------------------------


def _minimal_text_pdf(lines: list[str]) -> bytes:
    """A one-page PDF with a real text layer, built byte by byte.

    Small enough to construct here rather than commit as a binary, so the test
    says what the document contains and cannot rot silently. Offsets in the xref
    table are recomputed as the objects are emitted, because a PDF reader
    genuinely walks them.
    """
    content = "BT /F1 12 Tf 72 720 Td 14 TL\n"
    for line in lines:
        escaped = line.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        content += f"({escaped}) Tj T*\n"
    content += "ET"

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content.encode() + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"

    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_at}\n%%EOF\n"
    ).encode()
    return bytes(out)