import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { saveVideoFile, deleteVideoFile } from '../../lib/indexedDB';

export function PlaylistModal() {
  const { modals, setModals, data, currentSubject, saveData, showNotification } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [tempThumbnailUrl, setTempThumbnailUrl] = useState('');
  const [attachingIndex, setAttachingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Power Downloader Sub-States
  const [downloadOptionVideo, setDownloadOptionVideo] = useState<{ url: string; title: string; index: number } | null>(null);
  const [targetDir, setTargetDir] = useState('E:\\rec');
  const [combine, setCombine] = useState(true);
  const [enableCollector, setEnableCollector] = useState(true);
  const [frameInterval, setFrameInterval] = useState(10);
  const [cookiesBrowser, setCookiesBrowser] = useState('chrome');
  const [selectedOS, setSelectedOS] = useState<'windows' | 'macos'>('windows');

  const { open, topic } = modals.playlist;
  if (!open) return null;

  const subjectData = data[currentSubject];
  const topicData = subjectData.topics[topic] || { checked: false, videos: [] };
  const videos = topicData.videos || [];

  const close = () => {
    setModals(prev => ({ ...prev, playlist: { open: false, topic: '' } }));
    setShowAddForm(false);
    setUrl('');
    setTitle('');
  };

  const getThumbnail = (video: any) => {
    if (video.thumbnailUrl) return video.thumbnailUrl;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = video.url.match(regex);
    if (match && match[1]) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
    if (video.url.startsWith('localdb://')) return 'https://via.placeholder.com/300x170/f8fafc/94a3b8?text=Local+Video';
    return 'https://via.placeholder.com/300x170/f8fafc/94a3b8?text=Video';
  };

  const handleAdd = () => {
    if (!url.trim()) {
      showNotification('Please enter a valid URL or select a file', 'error');
      return;
    }
    const finalTitle = title.trim() !== '' ? title.trim() : `Video ${videos.length + 1}`;
    
    const nextData = structuredClone(data);
    if (!nextData[currentSubject].topics[topic]) {
      nextData[currentSubject].topics[topic] = { checked: false, videos: [] };
    }
    const newVideo: any = { url: url.trim(), title: finalTitle };
    if (tempThumbnailUrl) newVideo.thumbnailUrl = tempThumbnailUrl;
    nextData[currentSubject].topics[topic].videos.push(newVideo);
    saveData(nextData);
    setUrl('');
    setTitle('');
    setTempThumbnailUrl('');
    setShowAddForm(false);
    showNotification('Video added to playlist', 'success');
  };

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const vidUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = vidUrl;
      video.muted = true;
      video.currentTime = 1;
      video.onloadeddata = () => {
         const canvas = document.createElement('canvas');
         canvas.width = 300; canvas.height = 170;
         const ctx = canvas.getContext('2d');
         ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
         resolve(canvas.toDataURL('image/jpeg', 0.6));
         URL.revokeObjectURL(vidUrl);
      };
      video.onerror = () => {
         resolve('');
         URL.revokeObjectURL(vidUrl);
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      await saveVideoFile(id, file);
      setUrl(`localdb://${id}`);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
      const thumb = await generateVideoThumbnail(file);
      if (thumb) setTempThumbnailUrl(thumb);
      showNotification('Local video prepared. Click Save to add it!', 'success');
    }
  };

  const removeVideo = async (index: number) => {
    try {
      const playlistTopic = modals.playlist.topic;
      const targetVideo = data[currentSubject]?.topics[playlistTopic]?.videos?.[index];
      if (targetVideo && typeof targetVideo.url === 'string' && targetVideo.url.startsWith('localdb://')) {
        const fileId = targetVideo.url.replace('localdb://', '');
        if (fileId) {
          await deleteVideoFile(fileId);
        }
      }
    } catch (err) {
      console.warn("Failed to flush local video file on removal:", err);
    }
    const playlistTopic = modals.playlist.topic;
    const nextData = structuredClone(data);
    nextData[currentSubject].topics[playlistTopic].videos.splice(index, 1);
    saveData(nextData);
    showNotification('Video removed and local cache cleared', 'info');
  };

  const handleCopy = async (copyUrl: string, index: number) => {
    try {
      await navigator.clipboard.writeText(copyUrl);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {}
  };

  const generateId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleDownloadBat = (videoUrl: string, videoTitle: string) => {
    const safeTitle = videoTitle.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    
    // Build frame extraction if checked
    let frameCommands = "";
    if (enableCollector) {
      frameCommands = `echo [+] Frame Collector: Extracting video frames matching interval ${frameInterval}s...
set "FRAMES_DIR=${targetDir}\\frames_${safeTitle}"
if not exist "%FRAMES_DIR%" mkdir "%FRAMES_DIR%"
ffmpeg -y -i "%OUT_FILE%" -vf "fps=1/${frameInterval}" "%FRAMES_DIR%\\frame_%%04d.png"
echo [✓] Keyframes extracted successfully! Saved to: %FRAMES_DIR%`;
    }

    // Build cookies flag
    let cookiesFlag = "";
    if (cookiesBrowser !== "none") {
      cookiesFlag = `--cookies-from-browser ${cookiesBrowser}`;
    }

    const scriptText = `@echo off
:: Direct High-speed video compilation script for recoding viewer
title Video Downloader ^& Combiner (FFmpeg)
color 0F
echo ========================================================
echo   RECODING VIEWER - POWER VIDEO DOWNLOAD MANAGER        
echo ========================================================
echo.
echo Video Url:   ${videoUrl}
echo Title:       ${videoTitle}
echo Save Path:   ${targetDir}\\${safeTitle}.mp4
echo.

:: Check / install winget tools if not found
where yt-dlp >nul 2>nul
if %errorlevel% neq 0 (
    echo [+] yt-dlp is missing. Installing automatically via winget...
    winget install yt-dlp --accept-package-agreements --accept-source-agreements
)

where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [+] FFmpeg is missing. Installing Gyan.FFmpeg automatically...
    winget install Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
)

if not exist "${targetDir}" (
    echo [+] Creating local storage directory ${targetDir}...
    mkdir "${targetDir}"
)

set "OUT_FILE=${targetDir}\\${safeTitle}.mp4"

echo [+] Downloading full original stream (highest audio + video quality)
echo [+] Authenticating via Google Login / Browser sessions (${cookiesBrowser}) ...
${combine ? `yt-dlp -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best" ${cookiesFlag} --merge-output-format mp4 -o "%OUT_FILE%" "${videoUrl}"` : `yt-dlp -f "best" ${cookiesFlag} -o "%OUT_FILE%" "${videoUrl}"`}

if %errorlevel% neq 0 (
    echo [!] High quality merge failed. Downloading best pre-combined fallback...
    yt-dlp -f "best" ${cookiesFlag} -o "%OUT_FILE%" "${videoUrl}"
)

if exist "%OUT_FILE%" (
    echo.
    echo [✓] ORIGINAL VIDEO MERGED SUCCESSFULLY: %OUT_FILE%
    echo.
    ${frameCommands}
    echo.
    echo ========================================================
    echo  [✓] ALL STEPS COMPLETED! Saving to E:// rec complete.
    echo ========================================================
    pause
    explorer "${targetDir}"
) else (
    echo.
    echo [!] ERROR: Failed to compile the video.
    echo [💡] Try logging into Google inside Chrome, Edge or Brave and choosing that browser.
    pause
)
`;

    const blob = new Blob([scriptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dl_${safeTitle.substring(0, 25)}.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Batch script downloaded! Double-click to execute.', 'success');
  };

  const handleDownloadSh = (videoUrl: string, videoTitle: string) => {
    const safeTitle = videoTitle.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    
    // Build frame extraction if checked
    let frameCommands = "";
    if (enableCollector) {
      frameCommands = `echo "[+] Frame Collector: Extracting video frames matching interval ${frameInterval}s..."
FRAMES_DIR="${targetDir.replace(/\\/g, '/')}/frames_${safeTitle}"
mkdir -p "$FRAMES_DIR"
ffmpeg -y -i "$OUT_FILE" -vf "fps=1/${frameInterval}" "$FRAMES_DIR/frame_%04d.png"
echo "[✓] Keyframes extracted successfully! Saved to: $FRAMES_DIR"`;
    }

    // Build cookies flag
    let cookiesFlag = "";
    if (cookiesBrowser !== "none") {
      cookiesFlag = `--cookies-from-browser ${cookiesBrowser}`;
    }

    const scriptText = `#!/bin/bash
# Direct High-speed video compilation script for recoding viewer
echo "========================================================"
echo "  RECODING VIEWER - POWER VIDEO DOWNLOAD MANAGER        "
echo "========================================================"
echo ""
echo "Video Url:   ${videoUrl}"
echo "Title:       ${videoTitle}"
echo "Save Path:   ${targetDir.replace(/\\/g, '/')}/${safeTitle}.mp4"
echo ""

# Check / install tools if missing
if ! command -v yt-dlp &> /dev/null; then
    echo "[+] yt-dlp is missing. Installing automatically..."
    if command -v brew &> /dev/null; then
        brew install yt-dlp
    else
        sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
        sudo chmod a+rx /usr/local/bin/yt-dlp
    fi
fi

if ! command -v ffmpeg &> /dev/null; then
    echo "[+] FFmpeg is missing. Installing automatically..."
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y ffmpeg
    else
        echo "[!] Please install ffmpeg manually for stream combining."
    fi
fi

mkdir -p "${targetDir.replace(/\\/g, '/')}"

OUT_FILE="${targetDir.replace(/\\/g, '/')}/${safeTitle}.mp4"

echo "[+] Downloading full original stream"
${combine ? `yt-dlp -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best" ${cookiesFlag} --merge-output-format mp4 -o "$OUT_FILE" "${videoUrl}"` : `yt-dlp -f "best" ${cookiesFlag} -o "$OUT_FILE" "${videoUrl}"`}

if [ $? -ne 0 ]; then
    echo "[!] High quality merge failed. Downloading best pre-combined fallback..."
    yt-dlp -f "best" ${cookiesFlag} -o "$OUT_FILE" "${videoUrl}"
fi

if [ -f "$OUT_FILE" ]; then
    echo ""
    echo "[✓] ORIGINAL VIDEO DOWNLOADED SUCCESSFULLY: $OUT_FILE"
    echo ""
    ${frameCommands}
    echo ""
    echo "========================================================"
    echo " [✓] ALL STEPS COMPLETED! Saving complete."
    echo "========================================================"
    if command -v open &> /dev/null; then
        open "${targetDir.replace(/\\/g, '/')}"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "${targetDir.replace(/\\/g, '/')}"
    fi
else
    echo "[!] ERROR: Failed to compile the video."
fi
`;

    const blob = new Blob([scriptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dl_${safeTitle.substring(0, 25)}.sh`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Bash script downloaded! Make runnable (chmod +x) and execute.', 'success');
  };

  const handleCopyScript = (videoUrl: string, videoTitle: string) => {
    const safeTitle = videoTitle.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    
    if (selectedOS === 'macos') {
      let frameCommands = "";
      if (enableCollector) {
        frameCommands = `echo "[+] Frame Collector: Extracting video frames matching interval ${frameInterval}s..."
FRAMES_DIR="${targetDir.replace(/\\/g, '/')}/frames_${safeTitle}"
mkdir -p "$FRAMES_DIR"
ffmpeg -y -i "$OUT_FILE" -vf "fps=1/${frameInterval}" "$FRAMES_DIR/frame_%04d.png"
echo "[✓] Keyframes extracted successfully! Saved to: $FRAMES_DIR"`;
      }

      let cookiesFlag = "";
      if (cookiesBrowser !== "none") {
        cookiesFlag = `--cookies-from-browser ${cookiesBrowser}`;
      }

      const scriptText = `#!/bin/bash
# Direct High-speed video compilation script for recoding viewer
echo "========================================================"
echo "  RECODING VIEWER - POWER VIDEO DOWNLOAD MANAGER        "
echo "========================================================"
echo ""
echo "Video Url:   ${videoUrl}"
echo "Title:       ${videoTitle}"
echo "Save Path:   ${targetDir.replace(/\\/g, '/')}/${safeTitle}.mp4"
echo ""

# Check / install tools if missing
if ! command -v yt-dlp &> /dev/null; then
    echo "[+] yt-dlp is missing. Installing automatically..."
    if command -v brew &> /dev/null; then
        brew install yt-dlp
    else
        sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
        sudo chmod a+rx /usr/local/bin/yt-dlp
    fi
fi

if ! command -v ffmpeg &> /dev/null; then
    echo "[+] FFmpeg is missing. Installing automatically..."
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y ffmpeg
    else
        echo "[!] Please install ffmpeg manually for stream combining."
    fi
fi

mkdir -p "${targetDir.replace(/\\/g, '/')}"

OUT_FILE="${targetDir.replace(/\\/g, '/')}/${safeTitle}.mp4"

echo "[+] Downloading full original stream"
${combine ? `yt-dlp -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best" ${cookiesFlag} --merge-output-format mp4 -o "$OUT_FILE" "${videoUrl}"` : `yt-dlp -f "best" ${cookiesFlag} -o "$OUT_FILE" "${videoUrl}"`}

if [ $? -ne 0 ]; then
    echo "[!] High quality merge failed. Downloading best pre-combined fallback..."
    yt-dlp -f "best" ${cookiesFlag} -o "$OUT_FILE" "${videoUrl}"
fi

if [ -f "$OUT_FILE" ]; then
    echo ""
    echo "[✓] ORIGINAL VIDEO DOWNLOADED SUCCESSFULLY: $OUT_FILE"
    echo ""
    ${frameCommands}
    echo ""
    echo "========================================================"
    echo " [✓] ALL STEPS COMPLETED! Saving complete."
    echo "========================================================"
    if command -v open &> /dev/null; then
        open "${targetDir.replace(/\\/g, '/')}"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "${targetDir.replace(/\\/g, '/')}"
    fi
else
    echo "[!] ERROR: Failed to compile the video."
fi
`;
      navigator.clipboard.writeText(scriptText);
      showNotification('macOS Bash script copied to clipboard!', 'success');
      return;
    }

    let frameCommands = "";
    if (enableCollector) {
      frameCommands = `echo [+] Frame Collector: Extracting video frames matching interval ${frameInterval}s...
set "FRAMES_DIR=${targetDir}\\frames_${safeTitle}"
if not exist "%FRAMES_DIR%" mkdir "%FRAMES_DIR%"
ffmpeg -y -i "%OUT_FILE%" -vf "fps=1/${frameInterval}" "%FRAMES_DIR%\\frame_%%04d.png"
echo [✓] Keyframes extracted successfully! Saved to: %FRAMES_DIR%`;
    }

    let cookiesFlag = "";
    if (cookiesBrowser !== "none") {
      cookiesFlag = `--cookies-from-browser ${cookiesBrowser}`;
    }

    const scriptText = `@echo off
title Video Downloader ^& Combiner (FFmpeg)
echo ========================================================
echo   RECODING VIEWER - POWER VIDEO DOWNLOAD MANAGER        
echo ========================================================
echo.
echo Video Url:   ${videoUrl}
echo Title:       ${videoTitle}
echo Save Path:   ${targetDir}\\${safeTitle}.mp4
echo.

where yt-dlp >nul 2>nul
if %errorlevel% neq 0 (
    echo [+] yt-dlp is missing. Installing automatically via winget...
    winget install yt-dlp --accept-package-agreements --accept-source-agreements
)

where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [+] FFmpeg is missing. Installing Gyan.FFmpeg automatically...
    winget install Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
)

if not exist "${targetDir}" (
    echo [+] Creating local storage directory ${targetDir}...
    mkdir "${targetDir}"
)

set "OUT_FILE=${targetDir}\\${safeTitle}.mp4"

echo [+] Downloading full original stream (highest audio + video quality)
echo [+] Authenticating via Google Login / Browser sessions (${cookiesBrowser}) ...
${combine ? `yt-dlp -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best" ${cookiesFlag} --merge-output-format mp4 -o "%OUT_FILE%" "${videoUrl}"` : `yt-dlp -f "best" ${cookiesFlag} -o "%OUT_FILE%" "${videoUrl}"`}

if %errorlevel% neq 0 (
    echo [!] High quality merge failed. Downloading best pre-combined fallback...
    yt-dlp -f "best" ${cookiesFlag} -o "%OUT_FILE%" "${videoUrl}"
)

if exist "%OUT_FILE%" (
    echo.
    echo [✓] ORIGINAL VIDEO MERGED SUCCESSFULLY: %OUT_FILE%
    echo.
    ${frameCommands}
    echo.
    echo ========================================================
    echo  [✓] ALL STEPS COMPLETED! Saving to E:// rec complete.
    echo ========================================================
    pause
    explorer "${targetDir}"
) else (
    echo.
    echo [!] ERROR: Failed to compile the video.
    echo [💡] Try logging into Google inside Chrome, Edge or Brave and choosing that browser.
    pause
)
`;

    navigator.clipboard.writeText(scriptText);
    showNotification('Windows Batch script copied to clipboard!', 'success');
  };

  const downloadBatAndPlay = (videoUrl: string, videoTitle: string, index: number) => {
    if (videoUrl.startsWith('blob:') || videoUrl.startsWith('localdb://')) {
      setModals(prev => ({ ...prev, silencePlayer: { open: true, videoUrl, title: videoTitle } }));
      return;
    }
    
    let videoId = (data[currentSubject].topics[topic].videos[index] as any).id;
    if (!videoId) {
      videoId = generateId();
      const nextData = structuredClone(data);
      (nextData[currentSubject].topics[topic].videos[index] as any).id = videoId;
      saveData(nextData);
    }
    
    const isYoutube = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(videoUrl);
    
    if (!isYoutube && !videoUrl.startsWith('localdb://') && !videoUrl.startsWith('blob:')) {
       // Not a YouTube video, just open it in a new tab
       window.open(videoUrl, '_blank');
       return;
    }
    
    setDownloadOptionVideo({ url: videoUrl, title: videoTitle, index });
  };

  const handleAttachFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      await saveVideoFile(id, file);
      
      const nextData = structuredClone(data);
      nextData[currentSubject].topics[topic].videos[index].url = `localdb://${id}`;
      saveData(nextData);
      
      showNotification('Local video attached successfully!', 'success');
    }
    setAttachingIndex(null);
  };

  const openAddForm = () => {
    setShowAddForm(true);
    setTimeout(() => {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[10000] backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500 shadow-inner">
              <i className="fa-brands fa-youtube"></i>
            </div>
            <span className="truncate">{topic}</span>
          </h2>
          <div className="flex items-center gap-2">
            {!showAddForm && (
              <button type="button" 
                onClick={openAddForm} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-100 text-primary-600 hover:bg-primary-200 transition-colors"
                title="Add Video"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            )}
            <button type="button" onClick={close} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-500 transition-colors">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 relative" ref={contentRef}>
          <AnimatePresence>
            {showAddForm && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col gap-4 relative">
                  <button type="button" 
                    onClick={() => setShowAddForm(false)}
                    className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-colors text-xs"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                  <h3 className="text-sm font-bold text-slate-700 tracking-tight flex items-center gap-2">
                    <i className="fa-solid fa-video text-primary-500"></i> Add New Video
                  </h3>
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="Title (Optional)"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-50 transition-all font-medium"
                    />
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="YouTube Link or Web URL"
                          value={url}
                          onChange={e => setUrl(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-50 transition-all"
                        />
                        <button type="button"
                          onClick={handleAdd}
                          className="px-5 py-2.5 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 active:scale-[0.98] transition-all whitespace-nowrap shadow-sm"
                        >
                          Save
                        </button>
                      </div>
                      <div className="text-center font-bold text-slate-400 text-xs my-0.5">OR</div>
                      <input 
                        type="file" 
                        accept="video/*" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileChange} 
                      />
                      <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-4 py-2.5 bg-white border-2 border-dashed border-slate-300 text-slate-600 font-bold text-sm rounded-lg hover:bg-slate-50 hover:border-primary-400 hover:text-primary-600 transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-folder-open"></i> Browse Internal Storage
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {videos.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center text-xl">
                  <i className="fa-solid fa-film"></i>
                </div>
                <p className="text-slate-500 text-sm font-bold">No videos saved yet.</p>
                {!showAddForm && (
                  <button type="button" 
                    onClick={openAddForm}
                    className="text-primary-600 text-sm font-bold mt-2 hover:underline"
                  >
                    Add your first video
                  </button>
                )}
              </div>
            ) : (
              videos.map((video, index) => (
                <li key={index} className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group relative">
                  <button type="button"
                    onClick={() => removeVideo(index)}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-10 scale-95 hover:scale-100"
                    title="Remove Video"
                  >
                    <i className="fa-solid fa-trash-can text-xs"></i>
                  </button>
                  
                  <a href={video.url.startsWith('localdb://') ? '#' : video.url} 
                     target={video.url.startsWith('localdb://') ? undefined : "_blank"} 
                     rel="noreferrer" 
                     className="w-full aspect-video bg-slate-100 block relative overflow-hidden" 
                     onClick={(e) => {
                       if (video.url.startsWith('localdb://')) {
                         e.preventDefault();
                         downloadBatAndPlay(video.url, video.title, index);
                       }
                     }}
                  >
                    <img src={getThumbnail(video)} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-red-600 shadow-lg pl-1">
                        <i className="fa-solid fa-play text-xl"></i>
                      </div>
                    </div>
                  </a>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="font-extrabold text-slate-800 text-[15px] leading-snug line-clamp-2" title={video.title}>{video.title}</div>
                    
                    <div className="flex gap-2 items-center mt-auto">
                      <button type="button"
                        onClick={() => downloadBatAndPlay(video.url, video.title, index)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 hover:text-emerald-600 font-bold text-xs rounded-lg transition-all"
                        title={video.url.startsWith('localdb://') || video.url.startsWith('blob:') ? "Play Local Video" : "Download & Play"}
                      >
                        <i className="fa-solid fa-play"></i> {(video.url.startsWith('localdb://') || video.url.startsWith('blob:')) ? 'Play in App' : 'Play & DL'}
                      </button>
                      
                      {!(video.url.startsWith('localdb://') || video.url.startsWith('blob:')) && (
                        <div className="relative flex">
                          <input 
                              type="file" 
                              id={`attach-file-${index}`}
                              accept="video/*" 
                              className="hidden" 
                              onChange={(e) => handleAttachFileChange(e, index)} 
                          />
                          <button type="button"
                            onClick={() => document.getElementById(`attach-file-${index}`)?.click()}
                            className="w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 rounded-lg transition-all"
                            title="Attach Local File"
                          >
                            <i className="fa-solid fa-link"></i>
                          </button>
                        </div>
                      )}

                      <button type="button"
                        onClick={() => handleCopy(video.url, index)}
                        className="w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 rounded-lg transition-all"
                        title="Copy URL"
                      >
                        {copiedIndex === index ? <i className="fa-solid fa-check text-emerald-500"></i> : <i className="fa-regular fa-copy"></i>}
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Power Download Setup Sub-Modal */}
      {downloadOptionVideo && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[20000] backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-[#fafbfe] flex justify-between items-center">
              <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-download text-emerald-500"></i>
                <span>Configure Download Options</span>
              </h3>
              <button type="button" 
                onClick={() => setDownloadOptionVideo(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Content Form */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-5 text-sm text-slate-600">
              
              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 flex flex-col gap-1">
                <span className="font-extrabold text-emerald-800 text-[11px] uppercase tracking-wide">Selected YouTube Stream:</span>
                <span className="text-slate-800 font-bold truncate">{downloadOptionVideo.title}</span>
                <span className="text-[11px] font-mono text-emerald-600 break-all">{downloadOptionVideo.url}</span>
              </div>

              {/* OS Selection tabs */}
              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold text-slate-700 flex items-center gap-1.5 text-xs">
                  <i className="fa-solid fa-laptop text-slate-400"></i> Your Operating System:
                </label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedOS('windows')}
                    className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 font-extrabold text-[11px] rounded-lg transition-all ${selectedOS === 'windows' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <i className="fa-brands fa-windows text-sky-500"></i> Windows PC
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOS('macos');
                      if (targetDir === 'E:\\rec') {
                        setTargetDir('~/Downloads/rec');
                      }
                    }}
                    className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 font-extrabold text-[11px] rounded-lg transition-all ${selectedOS === 'macos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <i className="fa-brands fa-apple text-slate-850"></i> macOS / Linux
                  </button>
                </div>
              </div>

              {/* Destination folder */}
              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold text-slate-700 flex items-center gap-1.5 text-xs">
                  <i className="fa-solid fa-folder text-slate-400"></i> Local Output Directory:
                </label>
                <input 
                  type="text"
                  value={targetDir}
                  onChange={(e) => setTargetDir(e.target.value)}
                  placeholder={selectedOS === 'windows' ? "E:\\rec" : "~/Downloads/rec"}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-emerald-500 transition-all text-xs font-mono font-bold"
                />
                <p className="text-[11px] text-slate-400">
                  {selectedOS === 'windows' 
                    ? "Writes video output directly to local drive path (e.g. E:\\rec)." 
                    : "Writes video output to user Directory path (e.g. ~/Downloads/rec)."}
                </p>
              </div>

              {/* Auth settings */}
              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold text-slate-700 flex items-center gap-1.5 text-xs">
                  <i className="fa-brands fa-google text-slate-400"></i> Google Browser Login (Bypasses YouTube Restrictions):
                </label>
                <select 
                  value={cookiesBrowser} 
                  onChange={(e) => setCookiesBrowser(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-emerald-500 transition-all text-xs font-semibold text-slate-800"
                >
                  <option value="chrome">Google Chrome (Authed session)</option>
                  <option value="edge">Microsoft Edge (Authed session)</option>
                  <option value="firefox">Mozilla Firefox (Authed session)</option>
                  <option value="brave">Brave Browser (Authed session)</option>
                  <option value="none">No Cookies (Anonymous Fetch)</option>
                </select>
                <p className="text-[11px] text-slate-400">The generated script reads the selected browser session locally on your computer. No account cookies are uploaded to Clora X.</p>
              </div>

              {/* FFmpeg Combine Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                <div className="flex flex-col gap-0.5">
                  <span className="font-extrabold text-slate-700 flex items-center gap-1.5 text-xs">
                    <i className="fa-solid fa-code-compare text-slate-400"></i> Merged Streams (FFmpeg):
                  </span>
                  <span className="text-[11px] text-slate-400">Combine highest individual Video ^& Audio channels (unlimited resolution).</span>
                </div>
                <input 
                  type="checkbox"
                  checked={combine}
                  onChange={(e) => setCombine(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 transition-all"
                />
              </div>

              {/* Frame Collector Group */}
              <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-100 hover:bg-slate-100/50 transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-extrabold text-slate-700 flex items-center gap-1.5 text-xs">
                      <i className="fa-solid fa-images text-slate-500"></i> Enable Frame Collector:
                    </span>
                    <span className="text-[11px] text-slate-400">Extract high quality frame snapshots automatically from the video using FFmpeg.</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={enableCollector}
                    onChange={(e) => setEnableCollector(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 transition-all"
                  />
                </div>

                {enableCollector && (
                  <div className="p-4 bg-white flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                      Snap Frame Interval:
                    </label>
                    <div className="flex gap-2">
                      {[5, 10, 30, 60].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFrameInterval(val)}
                          className={`flex-1 py-2 font-extrabold text-xs rounded-md border transition-all ${frameInterval === val ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                        >
                          Every {val}s
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Actions Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-100/70 flex flex-col gap-2.5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => selectedOS === 'windows' ? handleDownloadBat(downloadOptionVideo.url, downloadOptionVideo.title) : handleDownloadSh(downloadOptionVideo.url, downloadOptionVideo.title)}
                  className="flex-1 px-4 py-3 bg-slate-900 text-white font-extrabold text-xs rounded-xl hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  {selectedOS === 'windows' ? (
                    <>
                      <i className="fa-solid fa-file-code text-cyan-400 text-sm"></i> Download Windows Script (.bat)
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-terminal text-yellow-500 text-sm"></i> Download macOS/Linux (.sh)
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyScript(downloadOptionVideo.url, downloadOptionVideo.title)}
                  className="px-4 py-3 bg-white border border-slate-200 text-slate-700 font-extrabold text-xs rounded-xl hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center"
                  title="Copy Power Script to Clipboard"
                >
                  <i className="fa-regular fa-copy text-sm"></i>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDownloadOptionVideo(null)}
                className="text-center font-bold text-slate-400 hover:text-red-500 transition-colors text-xs py-1"
              >
                Close Download Manager
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

