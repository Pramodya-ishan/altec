import fs from 'fs';

let content = fs.readFileSync('server/ai/respondStream.ts', 'utf8');

const oldEvent = `emitSse(res, "direct_pdf_qa_required", {
              source: paperSource,
              question: prompt,
              questionNo: requestedQuestionNo,
              questionType: paperIntent.questionType || "MCQ",
              questionId: questionId,
              subject: requestedSubject,
              year: requestedYear,
              parsedIntent: {
                year: requestedYear,
                subject: requestedSubject,
                questionType: paperIntent.questionType || "MCQ",
                questionNo: requestedQuestionNo
              },
              reason: noChunks ? "no_chunks" : (badTextQuality ? "bad_quality" : "needs_ocr")
            });
            
            // [FIX 1] Emit explicit done event for pending Direct PDF QA
            emitSse(res, "done", {
              ok: true,
              completed: false,
              pending: true,
              requestId,
              finishReason: "pending_direct_pdf_qa",
              reason: "PENDING_DIRECT_PDF_QA",`;

const newEvent = `emitSse(res, "direct_pdf_handoff_required", {
              sourceId: paperSource.id || paperSource.sourceId,
              storagePath: paperSource.storagePath,
              title: paperSource.title,
              subject: requestedSubject,
              year: requestedYear,
              questionNo: requestedQuestionNo,
              questionType: paperIntent.questionType || "MCQ",
              reason: "DIRECT_PDF_QA_REQUIRES_CLIENT_FILE",
              message: "PDF scan කරන්න client file handoff අවශ්‍යයි."
            });
            
            // [FIX 1] Emit explicit done event for pending Direct PDF QA
            emitSse(res, "done", {
              ok: true,
              completed: false,
              pending: true,
              requestId,
              finishReason: "pending_direct_pdf_qa",
              reason: "DIRECT_PDF_HANDOFF_REQUIRED",
              canContinue: true,
              needsClientFile: true,`;

content = content.replace(oldEvent, newEvent);

fs.writeFileSync('server/ai/respondStream.ts', content);
