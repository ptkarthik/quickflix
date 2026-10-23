'use client';
import React, { useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import { Star, Download, Loader2, RefreshCw, Edit3 } from 'lucide-react';
import { frames, frameCategories } from '@/lib/frames';
import { cn } from '@/lib/utils';

interface PosterGeneratorProps {
  movie: any;
  details: {
    synopsis: string;
    oneLiner: string;
    rating: number;
    detailedReview: string;
  };
  onClose: () => void;
}

const getTheme = (movie: any) => {
  let genreId = -1;
  if (movie.genre_ids && movie.genre_ids.length > 0) genreId = movie.genre_ids[0];
  else if (movie.genres && movie.genres.length > 0) genreId = movie.genres[0].id;

  if ([28, 12, 80, 10752].includes(genreId)) { // Action, Adventure, Crime, War
    return {
      label: 'text-amber-400', btn: 'bg-amber-600 hover:bg-amber-700', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
      overlayVertical: 'from-red-900 via-orange-900/40', overlaySquare: 'from-red-900/40 via-orange-900/40',
      tag: 'from-yellow-400 to-amber-600 border-yellow-200 text-black', title: 'from-yellow-200 to-amber-500',
      star: 'text-yellow-400', box: 'from-red-900/90 to-orange-900/90 border-yellow-500', text: 'text-yellow-100', divider: 'bg-amber-400/50'
    };
  }
  if ([878, 14, 9648].includes(genreId)) { // Sci-Fi, Fantasy, Mystery
    return {
      label: 'text-cyan-400', btn: 'bg-cyan-600 hover:bg-cyan-700', shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.3)]',
      overlayVertical: 'from-blue-900 via-cyan-900/40', overlaySquare: 'from-blue-900/40 via-cyan-900/40',
      tag: 'from-cyan-400 to-blue-600 border-cyan-200 text-white', title: 'from-cyan-200 to-blue-400',
      star: 'text-cyan-400', box: 'from-blue-900/90 to-cyan-900/90 border-cyan-500', text: 'text-cyan-100', divider: 'bg-cyan-400/50'
    };
  }
  if ([10749, 18, 10402].includes(genreId)) { // Romance, Drama, Music
    return {
      label: 'text-fuchsia-400', btn: 'bg-fuchsia-600 hover:bg-fuchsia-700', shadow: 'shadow-[0_0_15px_rgba(192,38,211,0.3)]',
      overlayVertical: 'from-purple-900 via-fuchsia-900/40', overlaySquare: 'from-purple-900/40 via-fuchsia-900/40',
      tag: 'from-fuchsia-400 to-purple-600 border-fuchsia-200 text-white', title: 'from-fuchsia-200 to-purple-400',
      star: 'text-fuchsia-400', box: 'from-purple-900/90 to-fuchsia-900/90 border-fuchsia-500', text: 'text-fuchsia-100', divider: 'bg-fuchsia-400/50'
    };
  }
  if ([27, 53].includes(genreId)) { // Horror, Thriller
    return {
      label: 'text-emerald-400', btn: 'bg-emerald-600 hover:bg-emerald-700', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
      overlayVertical: 'from-teal-900 via-emerald-900/40', overlaySquare: 'from-teal-900/40 via-emerald-900/40',
      tag: 'from-emerald-400 to-teal-600 border-emerald-200 text-white', title: 'from-emerald-200 to-teal-400',
      star: 'text-emerald-400', box: 'from-teal-900/90 to-emerald-900/90 border-emerald-500', text: 'text-emerald-100', divider: 'bg-emerald-400/50'
    };
  }
  return {
      label: 'text-indigo-400', btn: 'bg-indigo-600 hover:bg-indigo-700', shadow: 'shadow-[0_0_15px_rgba(99,102,241,0.3)]',
      overlayVertical: 'from-indigo-900 via-violet-900/40', overlaySquare: 'from-indigo-900/40 via-violet-900/40',
      tag: 'from-indigo-400 to-violet-600 border-indigo-200 text-white', title: 'from-indigo-200 to-violet-400',
      star: 'text-indigo-400', box: 'from-indigo-900/90 to-violet-900/90 border-indigo-500', text: 'text-indigo-100', divider: 'bg-indigo-400/50'
  };
};

export function PosterGenerator({ movie, details: initialDetails, onClose }: PosterGeneratorProps) {
  const theme = getTheme(movie);
  const [details, setDetails] = useState(initialDetails);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [frameCategory, setFrameCategory] = useState('Minimalist (Clean)');
  const [frameStyle, setFrameStyle] = useState('none');
  const instaRef = useRef<HTMLDivElement>(null);

  const availableFrames = React.useMemo(() => frames.filter(f => f.category === frameCategory), [frameCategory]);

  const getFrameClasses = (t: any) => {
    const frame = frames.find(f => f.id === frameStyle);
    return frame ? frame.getClasses(t) : '';
  };

  React.useEffect(() => {
    setDetails(initialDetails);
  }, [initialDetails]);

  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true);
      const res = await fetch('http://localhost:3000/discover/generate-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieData: movie })
      });
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegenerating(false);
    }
  };
  const youtubeRef = useRef<HTMLDivElement>(null);
  const massActionRef = useRef<HTMLDivElement>(null);
  const bollywoodRef = useRef<HTMLDivElement>(null);
  
  const posterUrl = movie.poster_path 
    ? `https://image.tmdb.org/t/p/original${movie.poster_path}`
    : movie.backdrop_path 
      ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
      : null;

  const handleDownload = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    try {
      setIsExporting(true);
      // Generate HD image
      const dataUrl = await toJpeg(ref.current, { 
        quality: 1, 
        pixelRatio: 2, // HD scaling
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const link = document.createElement('a');
      link.download = `${filename}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 overflow-y-auto">
      <div className="bg-slate-900 rounded-xl p-8 max-w-7xl w-full flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-white">Generate HD Posters</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">Close</button>
        </div>

        {/* Content Editor */}
        <div className="mb-8 p-6 bg-slate-800 rounded-xl border border-slate-700 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-400" />
              Customize Content
            </h3>
            <button 
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-medium"
            >
              {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              AI Regenerate Text
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Tagline / One-Liner</label>
              <input 
                type="text" 
                value={details.oneLiner}
                onChange={(e) => setDetails({ ...details, oneLiner: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                placeholder="Enter a catchy one-liner..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Rating (out of 5)</label>
              <input 
                type="number" 
                min="1" max="5" step="0.1"
                value={details.rating}
                onChange={(e) => setDetails({ ...details, rating: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Frame Genre</label>
              <select 
                value={frameCategory}
                onChange={(e) => {
                  setFrameCategory(e.target.value);
                  const firstFrame = frames.find(f => f.category === e.target.value);
                  if (firstFrame) setFrameStyle(firstFrame.id);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                {frameCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Frame Variant</label>
              <select 
                value={frameStyle}
                onChange={(e) => setFrameStyle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-md px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                {availableFrames.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-12 pb-8">
          
          {/* Instagram Version (1080x1350 scaled down for preview) */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between w-full items-center mb-4">
              <h3 className="text-lg font-semibold text-indigo-400">Instagram (1080x1350)</h3>
              <button 
                onClick={() => handleDownload(instaRef, `${movie.title.replace(/\s+/g, '_')}_Insta`)}
                disabled={isExporting}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Download HD</span>
              </button>
            </div>
            
            {/* Wrapper for scaling preview but actual size for html2canvas */}
            <div className="relative w-full max-w-[400px] aspect-[4/5] bg-black overflow-hidden rounded-md border border-slate-700">
              <div 
                ref={instaRef}
                className={`absolute top-0 left-0 bg-black flex flex-col font-sans ${getFrameClasses({ label: 'text-indigo-400' })}`}
                style={{ width: '1080px', height: '1350px', transform: 'scale(0.3703)', transformOrigin: 'top left' }}
              >
                {posterUrl ? (
                  <img src={posterUrl} alt="Poster" className="absolute inset-0 w-full h-full object-cover opacity-80" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 bg-slate-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
                
                <div className="relative z-10 p-16 flex flex-col h-full justify-end">
                  <div className="bg-rose-600 text-white font-bold px-6 py-2 rounded-full w-max mb-6 text-3xl uppercase tracking-widest">
                    New on OTT
                  </div>
                  <h1 className="text-white font-black uppercase tracking-tighter leading-tight" style={{ fontSize: '110px' }}>
                    {movie.title}
                  </h1>
                  
                  <div className="flex items-center space-x-4 mt-8 mb-8">
                    <Star className="w-12 h-12 text-amber-400 fill-current" />
                    <span className="text-amber-400 font-bold text-5xl">{details.rating}/5</span>
                  </div>
                  
                  <h2 className="text-indigo-400 font-bold text-5xl mb-6">"{details.oneLiner}"</h2>
                  <p className="text-slate-200 text-4xl font-medium leading-snug mb-8">
                    {details.synopsis}
                  </p>
                  
                  <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 mt-auto">
                    <p className="text-slate-300 text-3xl leading-relaxed line-clamp-4">
                      {details.detailedReview}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* YouTube Version (1920x1080 scaled down for preview) */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between w-full items-center mb-4">
              <h3 className="text-lg font-semibold text-rose-400">YouTube Community (1920x1080)</h3>
              <button 
                onClick={() => handleDownload(youtubeRef, `${movie.title.replace(/\s+/g, '_')}_YouTube`)}
                disabled={isExporting}
                className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Download HD</span>
              </button>
            </div>
            
            <div className="relative w-full aspect-video bg-black overflow-hidden rounded-md border border-slate-700">
              <div 
                ref={youtubeRef}
                className={`absolute top-0 left-0 bg-black flex flex-row font-sans ${getFrameClasses({ label: 'text-rose-400' })}`}
                style={{ width: '1920px', height: '1080px', transform: 'scale(0.333)', transformOrigin: 'top left' }}
              >
                {/* Left Side: Image */}
                <div className="w-1/2 h-full relative">
                  {posterUrl ? (
                    <img src={posterUrl} alt="Poster" className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous" />
                  ) : (
                    <div className="absolute inset-0 bg-slate-800" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black" />
                </div>
                
                {/* Right Side: Content */}
                <div className="w-1/2 h-full bg-black p-24 flex flex-col justify-center relative z-10">
                  <div className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-full w-max mb-10 text-4xl uppercase tracking-widest">
                    Review
                  </div>
                  <h1 className="text-white font-black uppercase tracking-tighter leading-none mb-10" style={{ fontSize: '120px' }}>
                    {movie.title}
                  </h1>
                  
                  <div className="flex items-center space-x-6 mb-12">
                    <Star className="w-16 h-16 text-amber-400 fill-current" />
                    <span className="text-amber-400 font-bold text-7xl">{details.rating}/5</span>
                  </div>
                  
                  <h2 className="text-rose-400 font-bold text-6xl mb-8 leading-tight">"{details.oneLiner}"</h2>
                  <p className="text-slate-300 text-4xl leading-relaxed line-clamp-6">
                    {details.detailedReview}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic OTT Vertical Style (1080x1350) */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between w-full items-center mb-4">
              <h3 className={`text-lg font-semibold ${theme.label}`}>Dynamic OTT Vertical (1080x1350)</h3>
              <button 
                onClick={() => handleDownload(massActionRef, `${movie.title.replace(/\s+/g, '_')}_Vertical`)}
                disabled={isExporting}
                className={`flex items-center space-x-2 ${theme.btn} text-white px-4 py-2 rounded-md transition-colors`}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Download HD</span>
              </button>
            </div>
            
            <div className={`relative w-full max-w-[400px] aspect-[4/5] bg-black overflow-hidden rounded-md border border-slate-700 ${theme.shadow}`}>
              <div 
                ref={massActionRef}
                className={`absolute top-0 left-0 bg-black flex flex-col font-sans ${getFrameClasses(theme)}`}
                style={{ width: '1080px', height: '1350px', transform: 'scale(0.3703)', transformOrigin: 'top left' }}
              >
                {posterUrl ? (
                  <img src={posterUrl} alt="Poster" className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 bg-slate-900" />
                )}
                {/* Vibrant Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t ${theme.overlayVertical} to-transparent mix-blend-multiply`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
                
                <div className="relative z-10 p-12 flex flex-col h-full justify-end items-center text-center">
                  <div className={`bg-gradient-to-r ${theme.tag} px-8 py-3 rounded-md w-max mb-6 text-4xl font-black uppercase tracking-widest shadow-lg border-2`}>
                    Streaming Now
                  </div>
                  
                  <h1 className={`text-transparent bg-clip-text bg-gradient-to-b ${theme.title} font-black uppercase tracking-tighter leading-tight filter drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]`} style={{ fontSize: '130px' }}>
                    {movie.title}
                  </h1>
                  
                  <div className="flex items-center space-x-4 mt-6 mb-6 bg-black/50 px-8 py-4 rounded-full border border-white/20">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-12 h-12 ${i < Math.floor(details.rating) ? `${theme.star} fill-current` : 'text-slate-600'}`} />
                    ))}
                    <span className={`${theme.star} font-black text-6xl ml-4`}>{details.rating}/5</span>
                  </div>
                  
                  <h2 className="text-white font-black text-6xl mb-8 uppercase italic filter drop-shadow-lg">"{details.oneLiner}"</h2>
                  
                  <div className={`bg-gradient-to-r ${theme.box} p-8 rounded-xl border-l-8 shadow-2xl w-full text-left`}>
                    <p className={`${theme.text} text-3xl font-bold leading-relaxed line-clamp-3`}>
                      {details.synopsis}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic OTT Square Style (1080x1080) */}
          <div className="flex flex-col items-center">
            <div className="flex justify-between w-full items-center mb-4">
              <h3 className={`text-lg font-semibold ${theme.label}`}>Dynamic OTT Square (1080x1080)</h3>
              <button 
                onClick={() => handleDownload(bollywoodRef, `${movie.title.replace(/\s+/g, '_')}_Square`)}
                disabled={isExporting}
                className={`flex items-center space-x-2 ${theme.btn} text-white px-4 py-2 rounded-md transition-colors`}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Download HD</span>
              </button>
            </div>
            
            <div className={`relative w-full max-w-[400px] aspect-square bg-black overflow-hidden rounded-md border border-slate-700 ${theme.shadow}`}>
              <div 
                ref={bollywoodRef}
                className={`absolute top-0 left-0 bg-black flex flex-col font-serif ${getFrameClasses(theme)}`}
                style={{ width: '1080px', height: '1080px', transform: 'scale(0.3703)', transformOrigin: 'top left' }}
              >
                {posterUrl ? (
                  <img src={posterUrl} alt="Poster" className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 bg-slate-900" />
                )}
                <div className={`absolute inset-0 bg-gradient-to-b ${theme.overlaySquare} to-black mix-blend-overlay`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-transparent" />
                
                <div className="relative z-10 p-14 flex flex-col h-full justify-end items-center text-center">
                  <div className="flex items-center justify-center space-x-4 w-full mb-6">
                    <div className={`h-px ${theme.divider} flex-1`} />
                    <span className={`${theme.label} uppercase tracking-[0.3em] text-2xl font-semibold`}>An Original Movie</span>
                    <div className={`h-px ${theme.divider} flex-1`} />
                  </div>
                  
                  <h1 className="text-white font-bold tracking-tight leading-none mb-8 font-sans" style={{ fontSize: '110px' }}>
                    {movie.title}
                  </h1>
                  
                  <p className="text-slate-200 text-3xl font-light italic leading-relaxed line-clamp-2 mb-10 w-4/5 mx-auto">
                    "{details.detailedReview.split('.')[0]}."
                  </p>
                  
                  <div className={`flex space-x-8 items-center border-t border-b border-white/20 py-6 px-12 mb-6 bg-black/40 backdrop-blur-sm rounded-2xl`}>
                    <div className="text-center">
                      <div className={`${theme.label} font-bold text-6xl mb-2 font-sans`}>{details.rating}/5</div>
                      <div className="text-slate-300 uppercase tracking-widest text-xl font-sans">Rating</div>
                    </div>
                    <div className={`w-px h-24 ${theme.divider}`} />
                    <div className="text-center flex flex-col items-center justify-center">
                      <div className="flex space-x-2 mb-3">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-10 h-10 ${i < Math.floor(details.rating) ? `${theme.star} fill-current` : 'text-slate-600'}`} />
                        ))}
                      </div>
                      <div className="text-slate-300 uppercase tracking-widest text-xl font-sans">Reviews</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
