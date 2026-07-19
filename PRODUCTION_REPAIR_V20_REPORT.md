# Production Repair V20

## Outcome

V20 adds a correctness-first answer completion layer on top of the V19 PDF, visual, Error Log, and Sinhala repairs. User-facing study answers now use the high-quality final-writer route, detect model or transport truncation, and recover automatically before the response is saved as complete.

## AI completeness and recovery

- Increased normal answer capacity from 2,000 to 8,192 output tokens.
- Increased tutor/notes/quiz answers to 12,288 tokens and PDF/paper answers to 16,384 tokens.
- Detects `MAX_TOKENS`, unspecified/other premature finish reasons, interrupted streams, empty output, unfinished sentences, open Markdown/math delimiters, and omitted explicit exam subparts.
- Runs up to two automatic Pro completion passes while retaining the original prompt, multimodal evidence, source constraints, and already-written answer.
- Removes repeated overlap when a continuation repeats the tail of the previous output.
- Records model finish reason, completion passes, missing subparts, and incomplete reasons in chat history and stream diagnostics.
- Does not extract long-term student memory from a partial answer.

## Transport and client reliability

- Replaced premature request `close` cancellation with actual request-abort/response-close handling.
- If the SSE connection closes before `done`, the browser automatically calls the continuation endpoint using the partial answer.
- If transport recovery also fails, the partial answer is retained as `incomplete` and an explicit Sinhala **ඉතිරි කොටස සම්පූර්ණ කරන්න** action is shown.
- Server chat IDs are retained so a continuation updates the correct saved answer.
- Final client rendering no longer reintroduces raw visual blocks or malformed trailing math after the stream closes.

## Reasoning and evidence improvements

- All substantive learner-facing answers use the high-quality final model; deterministic greetings still avoid an unnecessary model call.
- Vision and direct PDF solving prefer the Pro model with configured fallbacks.
- Lowered answer temperature for paper/PDF and factual tutor work.
- Expanded general RAG retrieval from 5 to 12 chunks and lesson retrieval from 24 to 32 chunks.
- Expanded each evidence excerpt from 1,000 to 3,000–4,000 characters.
- Corrected source-scoring operator precedence so a real resource type is not silently rewritten to `past_paper`.
- Removed fake generic question wording, unsupported 24-hour link claims, and invented mark-allocation fallback text.

## PDF completeness

- Full-paper lesson/point mapping now receives 16,384 output tokens.
- Incomplete or invalid full-paper JSON is retried as one complete replacement with the high-quality final model.
- Only a complete outline is cached; stale/partial V1 mappings are ignored.
- Direct PDF extraction JSON and PDF stream answers now have explicit generous token budgets.
- Full-paper Markdown table cells are escaped safely.

## Verification

- Application TypeScript check: passed.
- Script TypeScript check: passed.
- Full source, knowledge, security, and video test suite: passed.
- V10–V18 production repair verification: passed.
- V20 answer completeness regression tests: passed.
- Production Vite build and isolated self-contained Vercel runtime verification: run after this report is generated.
