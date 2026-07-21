# Altec Production Repair V31 — Adaptive AI Hardening

## Scope

V31 is a focused hardening pass on the V30 learner-assistant pipeline. The audit covered the AI request path from intent routing and source retrieval through prompt construction, model selection, streaming, continuation, quality review, telemetry, and subject/lesson follow-ups.

Static review covered **509 project files / 97,148 lines** (excluding dependencies and generated build/runtime folders). V31 changes or adds **23 source/config/test entries** relative to V30.

## Main root causes found

1. **Every substantive learner turn could trigger the slowest path.**
   The writer used the final Pro model, the planner could make another Pro call, and the reviewer could make a third model call even for a straightforward lesson question.

2. **Prompt context was unbounded and repetitive.**
   The full JSON chat history and repeated RAG/source blocks were placed into the model request. This increased first-token latency, reduced focus, and made the model more likely to follow stale context.

3. **A failing primary model was retried on later turns.**
   Repeated 404/5xx/timeout failures wasted time before the same fallback was selected again.

4. **External dependencies and model calls could wait indefinitely.**
   Firestore evidence, syllabus loading, URL grounding, model request startup, and an already-open provider stream did not all have bounded recovery behavior.

5. **Continuation text could repeat a semantically identical tail.**
   Exact overlap removal did not catch punctuation, whitespace, or lightly paraphrased repetition, and a continuation with almost no new information could be accepted.

6. **Sinhala quality checks were incomplete.**
   A response could contain legacy Sinhala/mojibake, become English-heavy despite a Sinhala request, or expose internal-reasoning labels without triggering repair.

7. **Lesson words were not always subject-aware.**
   “electrical” could resolve to SFT Electricity even while the active subject was ET, and Electronics follow-ups could lose the intended lesson scope.

## V31 changes

### 1. Risk-aware AI strategy

A deterministic turn-risk classifier now scores each turn as **low, medium, high, or critical** using:

- official/PDF/marking-scheme evidence requirements;
- calculations and derivations;
- OCR or multimodal uncertainty;
- evidence contradictions;
- number of sources and explicit subparts;
- forecast/admission/high-stakes intent;
- visual dependencies and prompt size.

The score controls:

- Flash versus Pro writer;
- deterministic versus model planner;
- deterministic versus model-assisted reviewer;
- continuation-pass budget;
- evidence and history context budgets.

Straightforward questions start streaming without unnecessary planner/reviewer calls. High-risk official-paper, calculation, or contradictory-evidence turns keep the deeper verification path.

### 2. Evidence and history compaction

The new context budgeter:

- deduplicates repeated source blocks;
- prioritizes selected, exact-question, official, marking-scheme, PDF, and syllabus evidence;
- scores blocks against current prompt terms;
- keeps recent useful conversation turns rather than serializing the entire chat object;
- strips embedded base64/binary payloads;
- preserves the current request tail when the final request must be bounded.

Adaptive default budgets range from **42k–150k evidence characters** and **8k–24k recent-history characters** depending on turn risk.

### 3. Model-health cooldown and request timeouts

The router now:

- records primary and fallback model failures;
- temporarily bypasses an unhealthy primary;
- applies escalating cooldowns, with a longer cooldown for missing/unsupported models;
- preserves streaming behavior when the primary is skipped, even without an external AbortSignal;
- applies task-aware request-start timeouts:
  - background planning: 25 s;
  - normal chat: 45 s;
  - direct PDF: 75 s;
  - Pro/vision: 90 s;
- moves to the configured fallback after a retryable timeout/error.

The timeouts are configurable through `AI_MODEL_REQUEST_TIMEOUT_MS` and the cooldown through `AI_MODEL_HEALTH_TTL_MS`.

### 4. Stream idle watchdog

A provider stream can no longer leave the UI in an endless thinking state after it has opened. The watchdog resets after every chunk and only aborts when **no new chunk** arrives for the configured idle period (45 s by default).

This is not an answer-length limit: a long answer can continue indefinitely while it is producing new content.

### 5. Dependency timeouts and safe fallbacks

Bounded recovery was added for:

- intent router;
- user AI context;
- evidence retrieval;
- web and URL grounding;
- syllabus grounding;
- background memory extraction.

Required official evidence fails explicitly instead of silently hallucinating. Optional context falls back without blocking the whole answer.

### 6. Stronger completion recovery

Continuation handling now:

- recognizes OCR-damaged forms such as `i)`, `ii.` and `(iii)`;
- removes exact and normalized overlap;
- removes repeated leading sentence/paragraph segments;
- detects token-level suffix/prefix overlap;
- rejects continuation passes that add no meaningful new information;
- uses a risk-aware continuation-pass ceiling.

### 7. Sinhala and answer-quality hardening

Deterministic review now detects:

- legacy FM-Abhaya/unknown legacy Sinhala output;
- English-heavy answers to Sinhala prompts;
- exposed “chain of thought/internal reasoning/analysis” labels;
- unclosed Markdown/math;
- truncated endings and missing explicit subparts.

Only high-risk turns use an additional model reviewer; lower-risk turns retain deterministic checks for speed.

### 8. Subject-aware lesson resolution

Lesson aliases now accept active subject scope:

- SFT `electrical` → Electricity;
- ET `electrical` → Electrical Technology;
- ET `electronic/electronics` → Electronics;
- ICT aliases remain scoped to ICT.

The active/catalog subject is passed through retrieval, evidence routing, knowledge routing, and paper follow-up selection.

### 9. Observability

AI telemetry now records:

- risk score and risk level;
- planner and reviewer strategy;
- original versus retained context size;
- existing latency/model/source/quality fields.

This allows production traces to show whether latency comes from retrieval, model selection, context size, review, or continuation.

## New regression coverage

- turn-risk classification;
- context deduplication and hard request budget;
- model health cooldown;
- stuck-request timeout and fallback;
- stream fallback remains an async stream;
- stream idle watchdog;
- semantic continuation deduplication;
- legacy Sinhala and Sinhala-first quality checks;
- ET/SFT subject-aware lesson resolution.

## Verification completed

- Full application and operational-script TypeScript checks: passed.
- Main source regression chain: **44 test commands**, passed.
- Knowledge routing regressions: passed.
- Security and role-capability tests: passed.
- Secure video tests: passed.
- AI evaluation suite: **600/600 passed**.
- V31 static production-repair assertions: passed.
- Vite production build: **3,297 modules**, passed.
- Self-contained Vercel runtime bundle: passed.
- Vercel runtime import verification: **49 imports**, passed.
- Isolated production runtime smoke boot: passed.

## Honest limitations

- A live production latency benchmark was not run because this build environment does not contain the deployed Vertex/Firebase credentials and production data. The changes remove deterministic sources of avoidable delay, but actual response time will still depend on provider load, network latency, Firestore/OCR readiness, and PDF size.
- A scanned paper that has neither indexed text nor completed OCR still requires document processing. V31 now times out/fails clearly rather than inventing an official answer.
- Provider context/output limits still exist. V31 does not add a smaller learner-facing answer cap and continues unfinished answers while they make meaningful progress.
