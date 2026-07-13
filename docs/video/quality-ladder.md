# Quality ladder

The Transcoder job can create 144p, 240p, 360p, 480p, 720p, 1080p, 1440p, and 2160p H.264/AAC HLS renditions. Requested renditions above the source height are removed, preventing upscaling and unnecessary cost. 2160p is additionally gated by `ENABLE_4K=true`.

Every rendition uses six-second transport-stream segments and a versioned master manifest. The browser starts in Auto mode; a user can select a height, which disables ABR until Auto is selected again.
