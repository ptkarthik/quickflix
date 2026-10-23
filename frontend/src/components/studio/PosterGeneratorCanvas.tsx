'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toJpeg } from 'html-to-image';
import { 
  Download, 
  X, 
  Sparkles, 
  RefreshCw, 
  LayoutTemplate, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  Zap, 
  Bug, 
  Move,
  Film,
  Star,
  Sliders,
  Eye,
  Save,
  Type,
  Maximize2,
  Tv,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_BASE } from '@/lib/api';

interface PosterGeneratorProps {
  movie: any;
  onClose: () => void;
}

type GenerationState = 'LOADING' | 'READY' | 'NEEDS_ARTWORK' | 'ERROR' | 'AI_GENERATION_FAILED' | 'REQUIRES_ARTWORK_SELECTION';
type TriggerReason = 'INITIAL_GENERATION' | 'USER_CLICK_REGENERATE_CREATIVE' | 'USER_CLICK_FIND_ANOTHER' | 'USER_CLICK_REGENERATE_ALL' | 'USER_CLICK_APPLY_RATING';

export type AspectRatioMode = '4:5' | '9:16' | '16:9' | '1:1';

interface AspectRatioConfig {
  id: AspectRatioMode;
  label: string;
  sublabel: string;
  width: number;
  height: number;
  previewClass: string;
}

const ASPECT_RATIOS: Record<AspectRatioMode, AspectRatioConfig> = {
  '4:5': {
    id: '4:5',
    label: '4:5 Portrait',
    sublabel: 'Instagram Feed (1080×1350)',
    width: 1080,
    height: 1350,
    previewClass: 'w-[420px] h-[525px]',
  },
  '9:16': {
    id: '9:16',
    label: '9:16 Story',
    sublabel: 'Stories & Reels (1080×1920)',
    width: 1080,
    height: 1920,
    previewClass: 'w-[315px] h-[560px]',
  },
  '16:9': {
    id: '16:9',
    label: '16:9 Banner',
    sublabel: 'YouTube & Landscape (1920×1080)',
    width: 1920,
    height: 1080,
    previewClass: 'w-[560px] h-[315px]',
  },
  '1:1': {
    id: '1:1',
    label: '1:1 Square',
    sublabel: 'Universal Post (1080×1080)',
    width: 1080,
    height: 1080,
    previewClass: 'w-[440px] h-[440px]',
  },
};

const TITLE_STYLES = [
  { id: 'Cinematic', label: 'Cinematic', className: 'font-black uppercase tracking-tight text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)]' },
  { id: 'Blockbuster', label: 'Blockbuster', className: 'font-black uppercase tracking-widest text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]' },
  { id: 'GoldGlow', label: 'Gold Accent', className: 'font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 drop-shadow-[0_6px_20px_rgba(245,158,11,0.6)]' },
  { id: 'Crimson', label: 'Crimson', className: 'font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-rose-500 to-orange-400 drop-shadow-[0_6px_20px_rgba(239,68,68,0.6)]' },
  { id: 'CyberNeon', label: 'Neon Cyber', className: 'font-black uppercase tracking-wider text-cyan-300 drop-shadow-[0_0_25px_rgba(6,182,212,0.9)]' },
  { id: 'Minimalist', label: 'Minimalist', className: 'font-medium tracking-[0.25em] text-white/95 uppercase' },
];

const OTT_PLATFORMS = [
  { name: 'None', label: 'None', badgeClass: '' },
  { name: 'Netflix', label: 'Netflix', badgeClass: 'bg-red-600 text-white' },
  { name: 'Prime Video', label: 'Prime Video', badgeClass: 'bg-sky-500 text-slate-950 font-black' },
  { name: 'Disney+ Hotstar', label: 'Hotstar', badgeClass: 'bg-blue-600 text-white' },
  { name: 'JioCinema', label: 'JioCinema', badgeClass: 'bg-pink-600 text-white' },
  { name: 'SonyLIV', label: 'SonyLIV', badgeClass: 'bg-amber-500 text-black font-bold' },
  { name: 'Zee5', label: 'Zee5', badgeClass: 'bg-purple-600 text-white' },
  { name: 'Aha', label: 'Aha', badgeClass: 'bg-orange-600 text-white' },
];

const THEATRICAL_BADGES = [
  'ONLY IN THEATERS',
  'NOW SHOWING IN THEATERS',
  'IN CINEMAS THIS FRIDAY',
  'ADVANCE BOOKINGS OPEN',
  'EXPERIENCE IN IMAX',
  'CRITICS CHOICE'
];

export function PosterGeneratorCanvas({ movie, onClose }: PosterGeneratorProps) {
  const [genState, setGenState] = useState<GenerationState>('LOADING');
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  
  const [payload, setPayload] = useState<any>(null);
  const [selectedArtwork, setSelectedArtwork] = useState<any>(null);
  
  // Stateful History
  const [usedCandidateIds, setUsedCandidateIds] = useState<string[]>([]);
  
  // Aspect Ratio & Layout
  const [exportMode, setExportMode] = useState<AspectRatioMode>('4:5');
  const [showDebug, setShowDebug] = useState(false);
  const [brokenImage, setBrokenImage] = useState(false);
  const [artworkViewMode, setArtworkViewMode] = useState<'poster' | 'backdrop'>('poster');

  // Creative Editor State
  const [editorState, setEditorState] = useState({
     title: '',
     subtitle: '',
     releaseDate: '',
     rating: '',
     category: 'IN THEATERS',
     theatricalBadge: 'ONLY IN THEATERS',
     ottLogo: 'None',
     titleStyle: 'Cinematic',
     posX: 50,
     posY: 80,
     size: 100,
     overlayOpacity: 65,
     vignetteOpacity: 50,
     useOfficialLogo: true,
     showStarBadge: true,
     showTheatricalPill: true,
  });

  const posterRef = useRef<HTMLDivElement>(null);
  
  // Guard references to prevent infinite loops and duplicate requests
  const isFetchingRef = useRef(false);
  const fetchIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Drag-and-drop: track whether user is dragging the text overlay on the canvas
  const isDraggingRef = useRef(false);
  const [isDraggingText, setIsDraggingText] = useState(false);

  const fetchCreativeData = useCallback(async (
    reason: TriggerReason,
    usedIds: string[] = [], 
    overrideRating?: number
  ) => {
    if (isFetchingRef.current) {
       console.warn(`[Studio] Blocked duplicate request. Reason: ${reason}`);
       return;
    }
    
    const currentFetchId = ++fetchIdRef.current;
    isFetchingRef.current = true;
    setGenState('LOADING');
    setBrokenImage(false);
    
    if (abortControllerRef.current) {
       abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch(`${API_BASE}/discover/generate-poster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({ 
          movieData: movie, 
          usedCandidateIds: usedIds,
          manualRating: overrideRating,
          forceDeepSearch: reason === 'USER_CLICK_FIND_ANOTHER'
        })
      });
      
      if (!res.ok) throw new Error('Failed to fetch creative payload');
      
      const data = await res.json();
      
      if (data.status === 'NO_VERIFIED_ARTWORK') {
         setPayload(data);
         setGenState('NEEDS_ARTWORK');
         return;
      }

      if (data.status === 'AI_GENERATION_FAILED') {
         setPayload(data);
         setGenState('AI_GENERATION_FAILED');
         return;
      }
      
      if (data.status === 'REQUIRES_ARTWORK_SELECTION') {
         setPayload(data);
         setGenState('REQUIRES_ARTWORK_SELECTION');
         return;
      }
      
      setPayload(data);
      if (data.artwork?.selectedArtwork) {
        setSelectedArtwork(data.artwork.selectedArtwork);
      }

      const releaseDisplay = data.releaseText 
        ? (data.releaseText.split('\n')[1] || data.releaseText).trim() 
        : (movie?.theatricalRelease || movie?.ottRelease || 'Coming Soon');

      setEditorState(prev => ({
         ...prev,
         title: data.movieTitle || movie?.title || prev.title,
         subtitle: movie?.industries?.[0] ? `${movie.industries[0]} Cinema Presentation` : prev.subtitle,
         releaseDate: releaseDisplay,
         rating: data.rating?.displayString || (movie?.rating ? `★ ${Number(movie.rating).toFixed(1)}/5.0` : prev.rating),
         category: movie?.classification === 'NOW_STREAMING' ? 'STREAMING NOW' : movie?.classification === 'UPCOMING_OTT' ? 'COMING TO OTT' : 'IN THEATERS'
      }));
      setGenState('READY');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
         console.error(err);
         setGenState('ERROR');
      }
    } finally {
      if (fetchIdRef.current === currentFetchId) {
        isFetchingRef.current = false;
      }
    }
  }, [movie]);

  useEffect(() => {
    fetchCreativeData('INITIAL_GENERATION', []);
    
    return () => {
       if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          isFetchingRef.current = false;
       }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleArtworkSelect = (candidate: any) => {
     setSelectedArtwork(candidate);
     setEditorState(prev => ({
         ...prev,
         title: payload?.movieTitle || movie?.title || prev.title,
         releaseDate: payload?.releaseText ? (payload.releaseText.split('\n')[1] || payload.releaseText).trim() : prev.releaseDate,
         rating: payload?.rating?.displayString || prev.rating
     }));
     setGenState('READY');
  };

  const handleFindAnotherPoster = () => {
     const newUsed = selectedArtwork ? [...usedCandidateIds, selectedArtwork.id] : [...usedCandidateIds];
     setUsedCandidateIds(newUsed);
     fetchCreativeData('USER_CLICK_FIND_ANOTHER', newUsed);
  };

  const handleRegenerateEverything = () => {
     if (!selectedArtwork) return;
     const newUsed = [...usedCandidateIds, selectedArtwork.id];
     setUsedCandidateIds(newUsed);
     fetchCreativeData('USER_CLICK_REGENERATE_ALL', newUsed);
  };

  const getProxiedImageUrl = (url?: string | null): string => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/api/proxy-image')) {
      return url;
    }
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const captureCanvasBlob = async (mode: AspectRatioMode): Promise<Blob | null> => {
    if (!posterRef.current) return null;
    const config = ASPECT_RATIOS[mode];
    
    const dataUrl = await toJpeg(posterRef.current, { 
      quality: 0.98, 
      pixelRatio: 2,
      skipFonts: true,
      cacheBust: false,
      imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      style: { transform: 'scale(1)', transformOrigin: 'top left' }
    });
    
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binaryStr = atob(parts[1]);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  };

  const handleDownload = async (mode: AspectRatioMode) => {
    if (!posterRef.current) return;
    try {
      setIsExporting(true);
      setExportMode(mode);
      await new Promise(r => setTimeout(r, 200));
      
      const blob = await captureCanvasBlob(mode);
      if (!blob) throw new Error('Capture failed');

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const movieTitle = (payload?.movieTitle || movie?.title || 'movie_poster')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .toLowerCase();
      
      const config = ASPECT_RATIOS[mode];
      link.download = `${movieTitle}_${config.id.replace(':', 'x')}_${config.width}x${config.height}.jpg`;
      link.href = blobUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToAssetLibrary = async () => {
    if (!posterRef.current) return;
    setIsSavingAsset(true);
    try {
      const blob = await captureCanvasBlob(exportMode);
      if (!blob) throw new Error('Failed to generate image blob');

      let targetProjectId = movie?.id || movie?.projectId;
      if (!targetProjectId || String(targetProjectId).startsWith('tmdb:') || String(targetProjectId).startsWith('title:')) {
        const createRes = await fetch(`${API_BASE}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: payload?.movieTitle || movie?.title || 'Untitled Movie',
            releaseYear: movie?.year || new Date().getFullYear(),
            genre: movie?.industries?.[0] || 'Feature Film',
            rating: 4.5,
            status: 'READY'
          })
        });
        if (createRes.ok) {
          const newProj = await createRes.json();
          targetProjectId = newProj.id;
        }
      }

      if (!targetProjectId) throw new Error('No target project available');

      const formData = new FormData();
      const config = ASPECT_RATIOS[exportMode];
      formData.append('file', blob, `${movie?.title || 'creative'}_${exportMode.replace(':', 'x')}.jpg`);
      formData.append('type', `GENERATED_POSTER_${exportMode.replace(':', '_')}`);
      formData.append('template', 'STUDIO_CANVAS');
      formData.append('format', exportMode);
      formData.append('width', String(config.width));
      formData.append('height', String(config.height));

      const uploadRes = await fetch(`${API_BASE}/assets/${targetProjectId}/generated`, {
        method: 'POST',
        body: formData
      });

      if (uploadRes.ok) {
        setSavedToLibrary(true);
        setTimeout(() => setSavedToLibrary(false), 3500);
      }
    } catch (err) {
      console.error('Failed to save to asset library', err);
    } finally {
      setIsSavingAsset(false);
    }
  };

  // Drag and drop positioning calculations
  const handleTextPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isExporting) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setIsDraggingText(true);
  }, [isExporting]);

  const handlePosterPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !posterRef.current) return;
    const rect = posterRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setEditorState(prev => ({ ...prev, posX: Math.round(x), posY: Math.round(y) }));
  }, []);

  const handlePosterPointerUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDraggingText(false);
  }, []);

  const currentRatioConfig = ASPECT_RATIOS[exportMode];
  const activeStyleConfig = TITLE_STYLES.find(s => s.id === editorState.titleStyle) || TITLE_STYLES[0];
  const activeOttConfig = OTT_PLATFORMS.find(p => p.name === editorState.ottLogo) || OTT_PLATFORMS[0];

  // Active artwork image source: Poster vs Backdrop
  const activeImageSource = artworkViewMode === 'backdrop' && (movie?.backdropPath || payload?.backdropPath)
    ? `https://image.tmdb.org/t/p/w1280${movie?.backdropPath || payload?.backdropPath}`
    : selectedArtwork?.imageUrl || (movie?.posterPath ? `https://image.tmdb.org/t/p/w780${movie.posterPath}` : null);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* LEFT PANEL: Canvas & Dynamic Preview */}
      <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden">
        
        {/* Top Floating Controls */}
        <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <button onClick={onClose} className="p-2 bg-slate-900/90 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors border border-slate-800 shadow-xl">
              <X className="w-5 h-5" />
            </button>
            <div className="px-4 py-1.5 bg-slate-900/90 rounded-full border border-slate-800 flex items-center gap-2 shadow-xl">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-white">Poster Studio & Canvas Editor</span>
            </div>
            
            <button 
              onClick={() => setShowDebug(!showDebug)} 
              className={`p-2 rounded-full border transition-colors shadow-xl ${showDebug ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-slate-900/90 border-slate-800 text-slate-500 hover:text-white'}`}
              title="Toggle Pipeline Debugger"
            >
              <Bug className="w-4 h-4" />
            </button>
          </div>

          {/* Ratio Selector Pill in Canvas Top Bar */}
          {genState === 'READY' && (
            <div className="hidden sm:flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-full border border-slate-800 shadow-2xl pointer-events-auto gap-1">
              {(Object.keys(ASPECT_RATIOS) as AspectRatioMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setExportMode(mode)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    exportMode === mode
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DEBUG PANEL */}
        {showDebug && payload?.artwork?.debugInfo && (
           <div className="absolute top-24 left-6 z-20 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl p-5 shadow-2xl pointer-events-none text-xs">
              <h3 className="font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" /> Discovery Pipeline
              </h3>
              <div className="space-y-1.5 font-mono text-slate-300">
                 <div className="flex justify-between"><span>TMDB Candidates:</span> <span className="text-white">{payload.artwork.debugInfo.tmdbCount}</span></div>
                 <div className="flex justify-between"><span>Web Search Candidates:</span> <span className="text-white">{payload.artwork.debugInfo.webCount}</span></div>
                 <div className="flex justify-between text-slate-500"><span>Duplicates Removed:</span> <span>{payload.artwork.debugInfo.duplicatesRemoved}</span></div>
                 <div className="flex justify-between text-red-400/80"><span>Rejected:</span> <span>{payload.artwork.debugInfo.rejected}</span></div>
                 <div className="flex justify-between text-emerald-400 font-bold border-t border-slate-700 pt-2 mt-2"><span>Verified &amp; Scored:</span> <span>{payload.artwork.debugInfo.verified}</span></div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700 font-mono text-[11px]">
                 <div className="text-slate-400">Target Ratio: {currentRatioConfig.sublabel}</div>
                 <div className="text-indigo-400 truncate mt-1">Active ID: {selectedArtwork?.id || 'TMDB Default'}</div>
              </div>
           </div>
        )}

        {/* Center Canvas Viewport */}
        <div className="flex-1 flex items-center justify-center p-8 relative overflow-y-auto">
          {genState === 'LOADING' ? (
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Composing Studio Creative...</h3>
              <p className="text-slate-400 max-w-sm text-sm">Harvesting verified artwork, analyzing title identity, and generating studio typography.</p>
            </div>
          ) : genState === 'ERROR' ? (
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Studio Generation Issue</h3>
              <p className="text-slate-400 max-w-sm mb-6 text-sm">Could not build the creative payload. Retry or select another title.</p>
              <Button onClick={() => fetchCreativeData('USER_CLICK_REGENERATE_ALL', usedCandidateIds)} variant="outline">Try Again</Button>
            </div>
          ) : genState === 'NEEDS_ARTWORK' ? (
             <div className="flex flex-col items-center justify-center text-center">
              <ImageIcon className="w-16 h-16 text-yellow-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No High-Res Artwork Found</h3>
              <p className="text-slate-400 max-w-sm mb-6 text-sm">We could not confidently verify a high-resolution poster for {payload?.movieTitle || movie.title}.</p>
              <div className="flex gap-4">
                 <Button onClick={handleFindAnotherPoster} variant="secondary">Run Deep Web Search</Button>
                 <Button onClick={onClose} variant="outline">Close</Button>
              </div>
            </div>
          ) : genState === 'REQUIRES_ARTWORK_SELECTION' ? (
            <div className="flex flex-col w-full h-full max-w-5xl mx-auto py-8 text-left">
               <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                 <Search className="w-6 h-6 text-indigo-400" />
                 Select Verified Artwork
               </h2>
               <p className="text-slate-400 mb-8 text-sm">
                 Choose from {payload?.artwork?.candidates?.length || 0} candidates verified for {movie.title}.
               </p>
               
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 overflow-y-auto pb-12 pr-4 custom-scrollbar">
                 {payload?.artwork?.candidates?.map((c: any) => (
                    <div 
                      key={c.id} 
                      onClick={() => handleArtworkSelect(c)}
                      className="group relative flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-500 transition-all hover:shadow-xl hover:shadow-indigo-500/20"
                    >
                       <div className="relative w-full bg-slate-950 aspect-[3/4]">
                         <img src={getProxiedImageUrl(c.imageUrl)} alt="Candidate" crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                         <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                            <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider">
                              {c.sourceDomain}
                            </div>
                         </div>
                         <div className="absolute top-3 right-3 bg-indigo-500 text-white font-bold text-[11px] px-2 py-0.5 rounded-full shadow-lg">
                           {c.qualityScore}
                         </div>
                       </div>
                    </div>
                 ))}
               </div>
            </div>
          ) : (
            <div className="relative flex flex-col items-center transition-all duration-500">
              
              {/* THE RENDERED POSTER CANVAS */}
              <div 
                ref={posterRef}
                className={`relative overflow-hidden transition-all duration-500 ${currentRatioConfig.previewClass} bg-slate-950 shadow-2xl rounded-sm border border-slate-800/80`}
                onPointerMove={handlePosterPointerMove}
                onPointerUp={handlePosterPointerUp}
                onPointerLeave={handlePosterPointerUp}
                style={{ cursor: isDraggingText ? 'grabbing' : 'default' }}
              >
                {/* 1. ARTWORK BACKGROUND */}
                {brokenImage || !activeImageSource ? (
                  <div className="absolute inset-0 bg-slate-900 flex items-center justify-center flex-col text-slate-500">
                     <ImageIcon className="w-12 h-12 mb-2 opacity-40 text-slate-400" />
                     <span className="text-xs uppercase font-bold text-slate-400">Artwork Placeholder</span>
                  </div>
                ) : (
                  <img 
                    src={getProxiedImageUrl(activeImageSource)} 
                    alt="Artwork" 
                    crossOrigin="anonymous"
                    onError={() => setBrokenImage(true)}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                )}
                
                {/* 2. CINEMATIC VIGNETTE & GRADIENT SCRIMS */}
                <div 
                  className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none"
                  style={{ opacity: editorState.overlayOpacity / 100 }}
                />
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{ 
                    boxShadow: `inset 0 0 100px rgba(0,0,0,${editorState.vignetteOpacity / 100})`,
                    opacity: editorState.vignetteOpacity / 100 
                  }}
                />

                {/* 3. TOP BRANDING / CORNER BADGES */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
                  {editorState.showTheatricalPill && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/20 text-white text-[10px] font-black tracking-widest uppercase shadow-lg">
                      <Film className="w-3 h-3 text-amber-400" />
                      {editorState.theatricalBadge}
                    </div>
                  )}

                  {editorState.showStarBadge && editorState.rating && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-amber-500/30 text-amber-400 text-xs font-bold shadow-lg ml-auto">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{editorState.rating}</span>
                    </div>
                  )}
                </div>

                {/* 4. DRAGGABLE TYPOGRAPHY OVERLAY */}
                <div 
                  className="absolute z-20 flex flex-col select-none"
                  style={{
                    left: `${editorState.posX}%`,
                    top: `${editorState.posY}%`,
                    transform: `translate(-50%, -50%) scale(${editorState.size / 100})`,
                    transformOrigin: 'center center',
                    width: 'max-content',
                    maxWidth: exportMode === '16:9' ? '70%' : '88%',
                    textAlign: editorState.posX < 35 ? 'left' : editorState.posX > 65 ? 'right' : 'center',
                    alignItems: editorState.posX < 35 ? 'flex-start' : editorState.posX > 65 ? 'flex-end' : 'center',
                    cursor: isDraggingText ? 'grabbing' : 'grab',
                    outline: isDraggingText ? '2px dashed rgba(99,102,241,0.8)' : '2px dashed transparent',
                    outlineOffset: '8px',
                    borderRadius: '6px',
                    padding: '4px 10px',
                  }}
                  onPointerDown={handleTextPointerDown}
                  title="Drag to reposition text"
                >
                  {/* Drag Indicator */}
                  {!isExporting && (
                    <div className={`absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-indigo-600 text-white text-[10px] px-2.5 py-0.5 rounded-full pointer-events-none whitespace-nowrap shadow-lg transition-opacity duration-200 ${isDraggingText ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <Move className="w-3 h-3" /> {isDraggingText ? `${editorState.posX}%, ${editorState.posY}%` : 'Drag overlay'}
                    </div>
                  )}

                  {/* Subtitle / Supertitle */}
                  {editorState.subtitle && (
                    <p className="text-[11px] tracking-[0.35em] text-white/80 uppercase font-semibold mb-2 drop-shadow-md">
                      {editorState.subtitle}
                    </p>
                  )}

                  {/* Main Title or Official Logo */}
                  {editorState.useOfficialLogo && payload?.titleProfile?.officialLogoUrl ? (
                     <img 
                       src={getProxiedImageUrl(payload.titleProfile.officialLogoUrl)} 
                       alt="Official Title Logo" 
                       crossOrigin="anonymous"
                       className="w-full object-contain mb-3 filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.9)] max-h-24" 
                     />
                  ) : (
                     <h1 className={`leading-none mb-3 break-words w-full ${exportMode === '16:9' ? 'text-3xl sm:text-4xl' : 'text-3xl sm:text-4xl'} ${activeStyleConfig.className}`}>
                       {editorState.title}
                     </h1>
                  )}

                  {/* Release Status & OTT Platform Chip */}
                  <div className="flex items-center gap-2 mt-1">
                    {editorState.ottLogo !== 'None' && (
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider shadow-md ${activeOttConfig.badgeClass}`}>
                        {editorState.ottLogo}
                      </span>
                    )}

                    <div className="text-xs uppercase font-bold tracking-[0.2em] text-white/90 drop-shadow-md">
                      {editorState.category} • <span className="text-amber-400 font-black">{editorState.releaseDate}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Bottom Canvas Toolbar */}
              <div className="mt-4 flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-full text-xs text-slate-400 shadow-xl">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                  {currentRatioConfig.label} ({currentRatioConfig.width}×{currentRatioConfig.height}px)
                </span>
                <span className="text-slate-700">•</span>
                <span className="text-slate-400">Click &amp; drag text to reposition</span>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Controls & Customization */}
      {genState !== 'REQUIRES_ARTWORK_SELECTION' && (
        <div className="w-full md:w-[440px] bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl z-20">
          
          <div className="p-6 border-b border-slate-800 shrink-0">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-indigo-400" />
              Studio Controls
            </h2>
            <p className="text-xs text-slate-400 mt-1">Customize aspect ratios, typography presets, and marketing badges.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-7 custom-scrollbar">
            
            {/* 1. ASPECT RATIO PRESETS */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-indigo-400" /> Target Aspect Ratio
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ASPECT_RATIOS) as AspectRatioMode[]).map((mode) => {
                  const cfg = ASPECT_RATIOS[mode];
                  const isSelected = exportMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setExportMode(mode)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isSelected 
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' 
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold">{cfg.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">{cfg.width}×{cfg.height}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. ARTWORK SOURCE TOGGLE */}
            {(movie?.backdropPath || payload?.backdropPath) && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> Image Composition
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setArtworkViewMode('poster')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                      artworkViewMode === 'poster'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Vertical Poster
                  </button>
                  <button
                    onClick={() => setArtworkViewMode('backdrop')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                      artworkViewMode === 'backdrop'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Cinematic Backdrop
                  </button>
                </div>
              </div>
            )}

            {/* 3. TYPOGRAPHY PRESETS */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-400" /> Typography Preset
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TITLE_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setEditorState({...editorState, titleStyle: style.id})}
                    className={`py-2.5 px-2 text-xs rounded-lg border transition-all ${
                      editorState.titleStyle === style.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold shadow-md' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. TITLE & SUBTITLE FIELDS */}
            <div className="space-y-3.5 pt-2 border-t border-slate-800">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span>Title Text</span>
                  {payload?.titleProfile?.officialLogoUrl && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-indigo-400 font-semibold normal-case">
                      <input 
                        type="checkbox" 
                        checked={editorState.useOfficialLogo} 
                        onChange={e => setEditorState({...editorState, useOfficialLogo: e.target.checked})}
                        className="w-3.5 h-3.5 accent-indigo-500 rounded"
                      />
                      <span>Use Official Logo</span>
                    </label>
                  )}
                </div>
                {!editorState.useOfficialLogo || !payload?.titleProfile?.officialLogoUrl ? (
                  <input 
                    type="text" 
                    value={editorState.title} 
                    onChange={e => setEditorState({...editorState, title: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                  />
                ) : (
                  <div className="w-full bg-slate-950 border border-indigo-500/40 rounded-lg p-2.5 flex justify-center items-center h-14">
                    <img src={getProxiedImageUrl(payload.titleProfile.officialLogoUrl)} crossOrigin="anonymous" className="h-full object-contain filter drop-shadow-md brightness-0 invert" alt="Logo preview" />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subtitle / Tagline</label>
                <input 
                  type="text" 
                  value={editorState.subtitle} 
                  placeholder="e.g. Official Theatrical Trailer Now Out"
                  onChange={e => setEditorState({...editorState, subtitle: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Release Text</label>
                  <input 
                    type="text" 
                    value={editorState.releaseDate} 
                    onChange={e => setEditorState({...editorState, releaseDate: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Score / Rating</label>
                  <input 
                    type="text" 
                    value={editorState.rating} 
                    onChange={e => setEditorState({...editorState, rating: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 5. BADGES & PLATFORMS */}
            <div className="space-y-3.5 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-indigo-400" /> Platform &amp; Exhibition Badges
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Streaming Platform</label>
                  <select 
                    value={editorState.ottLogo} 
                    onChange={e => setEditorState({...editorState, ottLogo: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none"
                  >
                    {OTT_PLATFORMS.map(p => (
                      <option key={p.name} value={p.name}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Theatrical Tag</label>
                  <select 
                    value={editorState.theatricalBadge} 
                    onChange={e => setEditorState({...editorState, theatricalBadge: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none"
                  >
                    {THEATRICAL_BADGES.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input 
                    type="checkbox" 
                    checked={editorState.showTheatricalPill} 
                    onChange={e => setEditorState({...editorState, showTheatricalPill: e.target.checked})}
                    className="w-3.5 h-3.5 accent-indigo-500 rounded"
                  />
                  <span>Show Top Badge</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input 
                    type="checkbox" 
                    checked={editorState.showStarBadge} 
                    onChange={e => setEditorState({...editorState, showStarBadge: e.target.checked})}
                    className="w-3.5 h-3.5 accent-indigo-500 rounded"
                  />
                  <span>Show Rating Badge</span>
                </label>
              </div>
            </div>

            {/* 6. SLIDERS FOR POSITION & ATMOSPHERE */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Fine-Tuning &amp; Lighting
              </label>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Text Vertical Position</span>
                  <span className="text-slate-300 font-mono">{editorState.posY}%</span>
                </div>
                <input 
                  type="range" 
                  min="15" 
                  max="90" 
                  value={editorState.posY} 
                  onChange={e => setEditorState({...editorState, posY: parseInt(e.target.value)})} 
                  className="w-full accent-indigo-500" 
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Text Scale</span>
                  <span className="text-slate-300 font-mono">{editorState.size}%</span>
                </div>
                <input 
                  type="range" 
                  min="60" 
                  max="140" 
                  value={editorState.size} 
                  onChange={e => setEditorState({...editorState, size: parseInt(e.target.value)})} 
                  className="w-full accent-indigo-500" 
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Shadow Darkness</span>
                  <span className="text-slate-300 font-mono">{editorState.overlayOpacity}%</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="95" 
                  value={editorState.overlayOpacity} 
                  onChange={e => setEditorState({...editorState, overlayOpacity: parseInt(e.target.value)})} 
                  className="w-full accent-indigo-500" 
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Cinematic Vignette</span>
                  <span className="text-slate-300 font-mono">{editorState.vignetteOpacity}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={editorState.vignetteOpacity} 
                  onChange={e => setEditorState({...editorState, vignetteOpacity: parseInt(e.target.value)})} 
                  className="w-full accent-indigo-500" 
                />
              </div>
            </div>

          </div>

          {/* ACTION BUTTONS & EXPORT FOOTER */}
          <div className="p-6 border-t border-slate-800 bg-slate-950 shrink-0 space-y-3">
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={handleFindAnotherPoster} 
                disabled={genState === 'LOADING'}
                variant="outline"
                className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 h-11 text-xs font-semibold"
              >
                <Search className="w-3.5 h-3.5 mr-1.5" />
                Find Alternate
              </Button>

              <Button 
                onClick={handleSaveToAssetLibrary} 
                disabled={genState !== 'READY' || isSavingAsset}
                variant="outline"
                className={`border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/40 h-11 text-xs font-semibold transition-all ${
                  savedToLibrary ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300' : 'bg-slate-900'
                }`}
              >
                {isSavingAsset ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : savedToLibrary ? (
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                {savedToLibrary ? 'Saved to Assets!' : 'Save to Library'}
              </Button>
            </div>

            {/* Main Single-Click High-Res Download Button */}
            <Button 
              onClick={() => handleDownload(exportMode)}
              disabled={genState !== 'READY' || isExporting}
              className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white font-bold h-12 shadow-xl shadow-indigo-500/20 text-sm"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              EXPORT HIGH-RES ({currentRatioConfig.id} • {currentRatioConfig.width}×{currentRatioConfig.height})
            </Button>

          </div>
        </div>
      )}
    </div>
  );
}
