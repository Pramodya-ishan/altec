# Plyr and Shaka player

`SecureVideoPlayer.tsx` lazy-loads Shaka and Plyr so the large streaming libraries do not enter the initial application bundle. Shaka handles HLS, adaptive bitrate selection, credentialed segment requests, and manual rendition selection. Plyr provides keyboard-friendly controls, fullscreen, picture-in-picture, captions, volume, seeking, and speed choices from 0.5x to 2x.

The player stores resume position per video in local storage, exposes transcript and chapter panels when processing metadata exists, and dispatches `clora:explain-video-section` with only the current time and active cue. It never sends the whole video to the AI path.
