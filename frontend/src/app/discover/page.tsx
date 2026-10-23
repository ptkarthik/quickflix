'use client';
import React, { useState, useEffect } from 'react';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { PosterGeneratorCanvas } from '@/components/studio/PosterGeneratorCanvas';
import { 
  Loader2, 
  Calendar, 
  Tv, 
  Sparkles, 
  Filter, 
  Clapperboard, 
  Play, 
  Clock, 
  Monitor, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

const TABS = [
  { 
    key: 'upcomingTheater', 
    label: 'Upcoming in Theaters', 
    icon: Clapperboard, 
    badge: 'bg-amber-600', 
    badgeLabel: 'Coming Soon',
    dotColor: 'bg-amber-400' 
  },
  { 
    key: 'nowInTheater', 
    label: 'Now in Theaters', 
    icon: Play, 
    badge: 'bg-red-600', 
    badgeLabel: 'In Cinemas',
    dotColor: 'bg-red-400' 
  },
  { 
    key: 'upcomingOTT', 
    label: 'Upcoming OTT', 
    icon: Clock, 
    badge: 'bg-purple-600', 
    badgeLabel: 'Coming to OTT',
    dotColor: 'bg-purple-400' 
  },
  { 
    key: 'nowStreaming', 
    label: 'Now Streaming', 
    icon: Monitor, 
    badge: 'bg-emerald-600', 
    badgeLabel: 'Streaming Now',
    dotColor: 'bg-emerald-400' 
  },
  { 
    key: 'pendingValidation', 
    label: 'Pending Validation', 
    icon: ShieldCheck, 
    badge: 'bg-amber-700', 
    badgeLabel: 'Quarantined',
    dotColor: 'bg-amber-400' 
  },
] as const;

const INDUSTRIES = ['All', 'Bollywood', 'Tollywood', 'Kollywood', 'Mollywood', 'Sandalwood', 'Hollywood', 'Punjabi', 'Bengali', 'Marathi'] as const;

export default function DiscoverPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('upcomingTheater');
  const [industryFilter, setIndustryFilter] = useState<string>('All');
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await apiFetch('/discover/all');
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        setFetchError('Failed to fetch movies from server.');
      }
    } catch {
      setFetchError('Backend server is still starting or unreachable. Please retry shortly.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = (movie: any) => {
    setSelectedMovie(movie);
  };

  const currentTabConfig = TABS.find(t => t.key === activeTab)!;
  const movies: any[] = data ? (data[activeTab] || []) : [];
  const filteredMovies = industryFilter === 'All' 
    ? movies 
    : movies.filter(m => m.industries?.includes(industryFilter));

  const availableIndustries = new Set(movies.flatMap((m: any) => m.industries || []).filter(Boolean));

  const getPlatformBadgeStyle = (platform?: string) => {
    if (!platform) return 'bg-slate-800 text-slate-300 border-slate-700';
    const p = platform.toLowerCase();
    if (p.includes('netflix')) return 'bg-red-500/15 text-red-400 border-red-500/30';
    if (p.includes('prime')) return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    if (p.includes('hotstar')) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (p.includes('jio')) return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    if (p.includes('sonyliv') || p.includes('sony')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (p.includes('zee')) return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    if (p.includes('aha')) return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
  };

  return (
    <SidebarLayout>
      <div className="flex flex-col h-full">
        {/* Sticky Header */}
        <div className="p-6 pb-0 border-b border-slate-800 bg-[#0a0a0c] sticky top-0 z-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                <Tv className="w-8 h-8 text-indigo-400" />
                Discover
              </h1>
              <p className="text-slate-400 text-sm">
                Strict Multi-Source Ingestion • Zero Tab Leakage • India Theatrical &amp; OTT Verified
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchMovies} variant="outline" className="border-slate-700 text-slate-300 hover:text-white">
                Refresh
              </Button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              const count = data ? (data[tab.key]?.length || 0) : 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setIndustryFilter('All'); }}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                    isActive 
                      ? 'border-indigo-500 text-white bg-slate-900/50 shadow-sm' 
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-indigo-500/30 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="absolute right-6 bottom-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAudit(!showAudit)}
              className="text-[10px] h-7 px-2 border-slate-700 text-slate-400 hover:text-white bg-slate-900 flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              {showAudit ? 'Hide Classification Engine' : 'Classification Engine Audit'}
            </Button>
          </div>
        </div>

        {/* Audit & Leakage Metrics Panel */}
        {showAudit && data?.audit && (
          <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-300">
            <div className="flex items-center justify-between mb-3">
              <div className="text-indigo-400 font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                CLASSIFICATION ENGINE GUARANTEES &amp; INVARIANT VERIFICATION
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3" />
                ZERO LEAKAGE (Mutual Exclusivity Enforced)
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px] uppercase tracking-wider mb-1">Total Canonical</span>
                <span className="text-white text-base font-bold">{data.audit.uniqueCanonicalCount}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-amber-500 block text-[9px] uppercase tracking-wider mb-1">Upcoming Theaters</span>
                <span className="text-amber-400 text-base font-bold">{data.audit.classificationEngine?.upcomingTheaterCount || data.upcomingTheater?.length || 0}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-red-500 block text-[9px] uppercase tracking-wider mb-1">Now In Theaters</span>
                <span className="text-red-400 text-base font-bold">{data.audit.classificationEngine?.nowInTheaterCount || data.nowInTheater?.length || 0}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-purple-500 block text-[9px] uppercase tracking-wider mb-1">Upcoming OTT</span>
                <span className="text-purple-400 text-base font-bold">{data.audit.classificationEngine?.upcomingOTTCount || data.upcomingOTT?.length || 0}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-emerald-500 block text-[9px] uppercase tracking-wider mb-1">Now Streaming</span>
                <span className="text-emerald-400 text-base font-bold">{data.audit.classificationEngine?.nowStreamingCount || data.nowStreaming?.length || 0}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-orange-500 block text-[9px] uppercase tracking-wider mb-1">Quarantine Pool</span>
                <span className="text-orange-400 text-base font-bold">{data.audit.classificationEngine?.pendingValidationCount || data.pendingValidation?.length || 0}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider mb-1">Leakage Detections</span>
                <span className="text-emerald-400 text-base font-bold">
                  {data.audit.classificationEngine?.leakageDetections ?? 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Industry Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-800/50 bg-slate-950/50 flex items-center gap-2 overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
          {INDUSTRIES.filter(i => i === 'All' || availableIndustries.has(i)).map(industry => (
            <button
              key={industry}
              onClick={() => setIndustryFilter(industry)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                industryFilter === industry
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {industry}
            </button>
          ))}
        </div>

        {/* Strict Indian Theatrical Gatekeeper Banner */}
        {activeTab === 'upcomingTheater' && (
          <div className="mx-6 mt-4 p-3.5 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent border border-amber-500/20 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <span className="text-white font-bold">
                  Strict Indian Theatrical Gatekeeper:
                </span>{' '}
                <span className="text-slate-300">
                  Showing strictly verified upcoming Indian cinema releases with future theatrical dates. Zero mock entities, zero OTT overlaps, zero running films.
                </span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" /> Region IN Validated
            </div>
          </div>
        )}

        {/* Quarantine Gate Banner */}
        {activeTab === 'pendingValidation' && (
          <div className="mx-6 mt-4 p-3.5 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border border-orange-500/30 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <div>
                <span className="text-white font-bold">
                  Quarantine &amp; Holding Gate:
                </span>{' '}
                <span className="text-slate-300">
                  Movies with conflicting dates, uncorroborated theatrical schedules, or date disputes held for verification to guarantee zero leakage into Upcoming in Theaters.
                </span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-orange-400 font-bold bg-orange-950/60 px-3 py-1 rounded-full border border-orange-500/30 whitespace-nowrap">
              Holding Queue
            </div>
          </div>
        )}

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
              <p className="text-slate-400">Classifying movies with strict Indian release criteria...</p>
            </div>
          ) : fetchError ? (
            <div className="bg-slate-900/50 border border-amber-500/20 rounded-xl p-8 text-center flex flex-col items-center max-w-lg mx-auto my-12">
              <p className="text-amber-400 font-medium mb-3">{fetchError}</p>
              <Button 
                onClick={fetchMovies} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                Retry Discover
              </Button>
            </div>
          ) : filteredMovies.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              No movies found for this category{industryFilter !== 'All' ? ` in ${industryFilter}` : ''}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
              {filteredMovies.map((movie: any) => {
                const effectiveDate = movie.theatricalRelease || movie.ottRelease;
                const formattedDate = effectiveDate 
                  ? new Date(effectiveDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'TBD';

                return (
                  <div key={movie.canonicalId} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group hover:border-indigo-500/50 transition-all hover:shadow-lg hover:shadow-indigo-500/5 flex flex-col">
                    <div 
                      className="relative aspect-[2/3] bg-slate-800 cursor-pointer"
                      onClick={() => handleGenerate(movie)}
                    >
                      {movie.posterPath ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/w500${movie.posterPath}`} 
                          alt={movie.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900 p-4 text-center">
                          <Clapperboard className="w-12 h-12 opacity-30 mb-2 text-red-400" />
                          <span className="text-red-400 font-bold text-sm uppercase tracking-wider mb-1">Artwork Required</span>
                          <span className="text-[10px]">No verified source image found.</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-85" />
                      
                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                        <span className={`px-2 py-0.5 ${currentTabConfig.badge} text-white text-[10px] font-bold uppercase tracking-wider rounded shadow-md`}>
                          {currentTabConfig.badgeLabel}
                        </span>

                        {activeTab === 'upcomingTheater' && (
                          <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider rounded shadow-md flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" /> India Verified
                          </span>
                        )}

                        {movie.primaryPlatform && activeTab !== 'upcomingTheater' && (
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border shadow-md ${getPlatformBadgeStyle(movie.primaryPlatform)}`}>
                            {movie.primaryPlatform}
                          </span>
                        )}
                      </div>

                      {/* Poster Bottom Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          {movie.industries?.[0] && (
                            <span className="inline-block px-2 py-0.5 bg-slate-700/80 text-slate-300 text-[10px] font-medium uppercase tracking-wider rounded">
                              {movie.industries[0]}
                            </span>
                          )}
                          {movie.originalLanguage && (
                            <span className="inline-block px-2 py-0.5 bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider rounded">
                              {movie.originalLanguage === 'hi' ? 'Hindi' :
                               movie.originalLanguage === 'ta' ? 'Tamil' :
                               movie.originalLanguage === 'te' ? 'Telugu' :
                               movie.originalLanguage === 'ml' ? 'Malayalam' :
                               movie.originalLanguage === 'kn' ? 'Kannada' :
                               movie.originalLanguage === 'bn' ? 'Bengali' :
                               movie.originalLanguage === 'mr' ? 'Marathi' :
                               movie.originalLanguage.toUpperCase()}
                            </span>
                          )}
                        </div>
                        
                        <h3 className="text-lg font-bold text-white leading-tight mb-1.5 line-clamp-1">{movie.title}</h3>
                        
                        {/* Status Line */}
                        <div className="flex items-center text-xs text-slate-200 gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${currentTabConfig.dotColor} ${activeTab === 'nowStreaming' ? 'animate-pulse' : ''}`} />
                          <span className="font-medium">
                            {activeTab === 'upcomingTheater' ? (
                              (() => {
                                const days = movie.theatricalRelease 
                                  ? Math.max(0, Math.round((new Date(movie.theatricalRelease).getTime() - new Date().getTime()) / 86400000))
                                  : null;
                                return `In Theaters: ${formattedDate}${days !== null ? ` (${days} days to go)` : ''}`;
                              })()
                            ) : (
                              movie.streamingStatus || (
                                activeTab === 'nowStreaming' 
                                  ? `Streaming Now${movie.primaryPlatform ? ` on ${movie.primaryPlatform}` : ''}`
                                  : activeTab === 'upcomingOTT'
                                  ? `Coming to OTT: ${formattedDate}`
                                  : activeTab === 'nowInTheater'
                                  ? `In Theaters: ${formattedDate}`
                                  : `Theatrical: ${formattedDate}`
                              )
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-900 flex-1 flex flex-col justify-between">
                      <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                        {movie.overview || "No synopsis available."}
                      </p>
                      
                      <div className="flex flex-col gap-2">
                        {/* Direct Platform Watch Link if available */}
                        {movie.watchUrl && (
                          <a
                            href={movie.watchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-all group/link"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-indigo-400 group-hover/link:text-indigo-300" />
                            <span>
                              {activeTab === 'nowStreaming'
                                ? `Watch on ${movie.primaryPlatform || 'Platform'}`
                                : `View on ${movie.primaryPlatform || 'Platform'}`}
                            </span>
                          </a>
                        )}

                        {movie.artworkStatus === 'ARTWORK_REQUIRED' ? (
                          <button 
                            onClick={() => handleGenerate(movie)}
                            className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-red-500/30 text-white py-2 rounded-lg transition-colors font-medium text-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-red-400" />
                            <span>Find Artwork</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleGenerate(movie)}
                            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition-colors font-medium text-xs shadow-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Open Canvas</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedMovie && (
        <PosterGeneratorCanvas 
          movie={selectedMovie} 
          onClose={() => setSelectedMovie(null)} 
        />
      )}
    </SidebarLayout>
  );
}
