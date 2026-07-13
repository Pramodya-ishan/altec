# Transcript and chapters

The player accepts `transcriptCues`, `chapters`, and `silenceIntervals` from the video document. Current-cue display and chapter seeking are implemented. Automatic speech-to-text, translation, caption-file generation, and chapter-generation workers are intentionally separate from the upload request and must write version-bound metadata before publication.

Worker output must contain time ranges, language, model/version provenance, and the source video version. Reprocessing a video must not reuse stale transcript or chapter metadata from an earlier version.
