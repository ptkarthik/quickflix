'use client';
import { useState, useEffect } from 'react';
import { Film, LayoutTemplate, Layers, CalendarPlus, BarChart3, TrendingUp, PlaySquare, Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import Link from 'next/link';

export default function AnalyticsDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<any>(null);

  useEffect(() => {
    fetch('http://localhost:3000/analytics/dashboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) return <div className="flex h-screen bg-[#0a0a0c] text-white items-center justify-center">Loading Analytics...</div>;

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-white overflow-hidden">
      
      {/* Global Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0 z-20">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black tracking-tight text-white flex items-center">
             <span className="bg-indigo-600 p-1.5 rounded mr-2">
               <Film className="w-4 h-4 text-white" />
             </span>
             Studio
          </h1>
        </div>
        <div className="p-4 flex-1 space-y-2">
          <Link href="/" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium">
            <LayoutTemplate className="w-5 h-5 mr-3" /> Projects
          </Link>
          <Link href="/assets" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium">
            <Layers className="w-5 h-5 mr-3" /> Asset Library
          </Link>
          <Link href="/calendar" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium">
            <CalendarPlus className="w-5 h-5 mr-3" /> Calendar
          </Link>
          <div className="flex items-center text-indigo-400 bg-indigo-500/10 p-3 rounded-lg font-medium">
            <BarChart3 className="w-5 h-5 mr-3" /> Analytics
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="border-b border-slate-800 bg-slate-900/50 p-6 z-10 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Performance Intelligence</h1>
              <p className="text-sm text-slate-400">Measure, analyze, and optimize your content strategy.</p>
            </div>
            <div className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center">
              ⚠️ Simulated Data
            </div>
          </div>
        </div>

        <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
          
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Views</div>
              <div className="text-3xl font-black">{formatNumber(data.overview.totalViews)}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Avg Engagement</div>
              <div className="text-3xl font-black text-indigo-400">{data.overview.avgEngagement.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Avg Retention</div>
              <div className="text-3xl font-black text-emerald-400">{data.overview.avgRetention.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Posts</div>
              <div className="text-3xl font-black">{data.overview.posts}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* By Format */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <h2 className="text-lg font-bold mb-6 flex items-center">
                <LayoutTemplate className="w-5 h-5 mr-2 text-indigo-400" />
                Performance by Format
              </h2>
              <div className="space-y-4">
                {data.byFormat.map((f: any) => (
                  <div key={f.format} className="flex justify-between items-center border-b border-slate-800/50 pb-4 last:border-0 last:pb-0">
                    <div className="font-semibold text-slate-200">{f.format}</div>
                    <div className="flex space-x-6 text-sm">
                      <div className="text-right">
                        <div className="text-slate-400 text-xs uppercase mb-0.5">Views</div>
                        <div className="font-bold">{formatNumber(f.views)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-400 text-xs uppercase mb-0.5">Engagement</div>
                        <div className="font-bold text-indigo-400">{f.engagement.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Movie */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <h2 className="text-lg font-bold mb-6 flex items-center">
                <Film className="w-5 h-5 mr-2 text-indigo-400" />
                Performance by Movie
              </h2>
              <div className="space-y-4">
                {data.byMovie.map((m: any) => (
                  <div key={m.movie} className="flex justify-between items-center border-b border-slate-800/50 pb-4 last:border-0 last:pb-0">
                    <div className="font-semibold text-slate-200">{m.movie}</div>
                    <div className="flex space-x-6 text-sm">
                      <div className="text-right">
                        <div className="text-slate-400 text-xs uppercase mb-0.5">Views</div>
                        <div className="font-bold">{formatNumber(m.views)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-400 text-xs uppercase mb-0.5">Engagement</div>
                        <div className="font-bold text-indigo-400">{m.engagement.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Individual Post Performance */}
          <div>
            <h2 className="text-xl font-bold mb-6">Recent Content Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.individual.slice(0, 12).map((post: any) => (
                <div 
                  key={post.id} 
                  onClick={() => setSelectedPost(post)}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-indigo-500/50 transition-colors cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{post.format.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-slate-500">{new Date(post.publishedAt).toLocaleDateString()}</div>
                  </div>
                  <h3 className="font-bold text-white mb-1 line-clamp-1 group-hover:text-indigo-300 transition-colors">{post.title}</h3>
                  <div className="text-sm text-slate-400 mb-6">{post.movie}</div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Views</div>
                      <div className="font-bold">{formatNumber(post.views)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Retention</div>
                      <div className="font-bold text-emerald-400">{post.retention.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
            <button onClick={() => setSelectedPost(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white z-10 bg-slate-800 p-1 rounded-full">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            <div className="p-8">
              <div className="inline-flex mb-4">
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                  {selectedPost.isSimulated ? 'Simulated Data' : 'Live Data'}
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-1">{selectedPost.title}</h2>
              <p className="text-sm text-slate-400 mb-8">{selectedPost.movie} • {selectedPost.format.replace(/_/g, ' ')} • Published {new Date(selectedPost.publishedAt).toLocaleDateString()}</p>
              
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                  <div className="flex items-center text-slate-400 text-xs font-bold uppercase mb-2"><PlaySquare className="w-4 h-4 mr-2" /> Views</div>
                  <div className="text-2xl font-black">{formatNumber(selectedPost.views)}</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                  <div className="flex items-center text-emerald-400 text-xs font-bold uppercase mb-2"><TrendingUp className="w-4 h-4 mr-2" /> Retention</div>
                  <div className="text-2xl font-black text-emerald-400">{selectedPost.retention.toFixed(1)}%</div>
                </div>
              </div>
              
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl grid grid-cols-4 gap-4 divide-x divide-slate-800">
                <div className="text-center">
                  <Heart className="w-5 h-5 mx-auto text-rose-400 mb-2" />
                  <div className="text-sm font-bold">{formatNumber(selectedPost.likes)}</div>
                  <div className="text-[10px] text-slate-500 uppercase mt-1">Likes</div>
                </div>
                <div className="text-center">
                  <MessageCircle className="w-5 h-5 mx-auto text-blue-400 mb-2" />
                  <div className="text-sm font-bold">{formatNumber(selectedPost.comments)}</div>
                  <div className="text-[10px] text-slate-500 uppercase mt-1">Comments</div>
                </div>
                <div className="text-center">
                  <Share2 className="w-5 h-5 mx-auto text-indigo-400 mb-2" />
                  <div className="text-sm font-bold">{formatNumber(selectedPost.shares)}</div>
                  <div className="text-[10px] text-slate-500 uppercase mt-1">Shares</div>
                </div>
                <div className="text-center">
                  <Bookmark className="w-5 h-5 mx-auto text-amber-400 mb-2" />
                  <div className="text-sm font-bold">{formatNumber(selectedPost.saves)}</div>
                  <div className="text-[10px] text-slate-500 uppercase mt-1">Saves</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
