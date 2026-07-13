# Skip silence

Skip Silence is opt-in. When enabled, the player seeks to the end of a server-produced silence interval once playback enters that interval. The original media, timeline, transcript timestamps, and chapters remain unchanged.

Only intervals with conservative speech-analysis confidence should be stored. Do not classify quiet teaching, demonstrations, music, or exam thinking time as silence. The player does nothing when interval metadata is absent.
