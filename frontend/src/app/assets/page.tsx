'use client';
import { useState, useEffect } from 'react';
import { Database, Image as ImageIcon, LayoutTemplate, Layers, Search, Filter, CalendarPlus, X } from 'lucide-react';
import Link from 'next/link';

export default function GlobalAssetLibrary() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'SOURCE' | 'GENERATED'>('ALL');
  const [search, setSearch] = useState('');

  // Modal State
  const [scheduleAsset, setScheduleAsset] = useState<any>(null);
  const [scheduleData, setScheduleData] = useState({
    platform: 'INSTAGRAM_FEED',
    date: '',
    time: '',
    notes: ''
  });
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const res = await fetch('http://localhost:3000/assets');
      const data = await res.json();
      setAssets(data);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScheduling(true);
    try {
      const scheduledFor = new Date(`${scheduleData.date}T${scheduleData.time}`).toISOString();
      const title = `${scheduleAsset.project.title} ${scheduleAsset.template || 'Creative'}`;
      
      await fetch('http://localhost:3000/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: scheduleAsset.projectId,
          title,
          contentType: scheduleAsset.type,
          assetId: scheduleAsset.id,
          scheduledFor,
          platform: scheduleData.platform,
          notes: scheduleData.notes
        })
      });
      setScheduleAsset(null);
      // Optional: show a toast notification
    } catch (err) {
      console.error(err);
    } finally {
      setIsScheduling(false);
    }
  };

  const filteredAssets = assets.filter(a => {
    if (filter === 'SOURCE' && a.isGenerated) return false;
    if (filter === 'GENERATED' && !a.isGenerated) return false;
    if (search && !a.project?.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-white overflow-hidden relative">
      
      {/* Schedule Modal */}
      {scheduleAsset && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl flex overflow-hidden shadow-2xl">
             {/* Preview Side */}
             <div className="w-1/2 bg-black flex flex-col justify-center border-r border-slate-800 p-6">
                <img src={`http://localhost:3000/${scheduleAsset.path}`} alt="Preview" className="w-full object-contain rounded-lg max-h-[400px]" />
                <div className="mt-4 text-center">
                  <h4 className="font-bold">{scheduleAsset.project.title}</h4>
                  <p className="text-xs text-slate-400">{scheduleAsset.format?.replace('_', ' ')} • {scheduleAsset.width}x{scheduleAsset.height}</p>
                </div>
             </div>
             
             {/* Form Side */}
             <div className="w-1/2 p-8 flex flex-col relative">
                <button onClick={() => setScheduleAsset(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold mb-6 flex items-center"><CalendarPlus className="w-5 h-5 mr-2 text-indigo-400"/> Schedule Content</h2>
                
                <form onSubmit={handleScheduleSubmit} className="space-y-4 flex-1 flex flex-col">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Platform</label>
                    <select 
                      value={scheduleData.platform}
                      onChange={e => setScheduleData({...scheduleData, platform: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="INSTAGRAM_FEED">Instagram Feed</option>
                      <option value="INSTAGRAM_STORY">Instagram Story</option>
                      <option value="REELS">Reels</option>
                      <option value="YOUTUBE">YouTube</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Date</label>
                      <input 
                        type="date" required
                        value={scheduleData.date}
                        onChange={e => setScheduleData({...scheduleData, date: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Time</label>
                      <input 
                        type="time" required
                        value={scheduleData.time}
                        onChange={e => setScheduleData({...scheduleData, time: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Notes</label>
                    <textarea 
                      rows={3}
                      value={scheduleData.notes}
                      onChange={e => setScheduleData({...scheduleData, notes: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. Remember to tag the director..."
                    />
                  </div>
                  <div className="mt-auto pt-4">
                    <button 
                      type="submit"
                      disabled={isScheduling}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg shadow-lg shadow-indigo-900/20"
                    >
                      {isScheduling ? 'Scheduling...' : 'Schedule Content'}
                    </button>
                  </div>
                </form>
             </div>
          </div>
        </div>
      )}

      {/* Global Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black tracking-tight text-white flex items-center">
             <span className="bg-indigo-600 p-1.5 rounded mr-2">
               <Database className="w-4 h-4 text-white" />
             </span>
             Studio
          </h1>
        </div>
        <div className="p-4 flex-1 space-y-2">
          <Link href="/" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium">
            <LayoutTemplate className="w-5 h-5 mr-3" /> Projects
          </Link>
          <div className="flex items-center text-indigo-400 bg-indigo-500/10 p-3 rounded-lg font-medium">
            <Layers className="w-5 h-5 mr-3" /> Asset Library
          </div>
          <Link href="/calendar" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium">
            <CalendarPlus className="w-5 h-5 mr-3" /> Calendar
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-900/50 p-6 flex justify-between items-center z-10 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Global Asset Library</h1>
            <p className="text-sm text-slate-400">Manage source files and generated creatives across all projects.</p>
          </div>
          
          <div className="flex space-x-4">
             <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Search by movie..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:ring-1 focus:ring-indigo-500 w-64"
                />
             </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 shrink-0 px-6">
           {[
             { id: 'ALL', label: 'All Assets' },
             { id: 'SOURCE', label: 'Source Material' },
             { id: 'GENERATED', label: 'Generated Creatives' }
           ].map(f => (
             <button
               key={f.id}
               onClick={() => setFilter(f.id as any)}
               className={`px-6 py-4 font-medium text-sm transition-colors border-b-2 flex items-center ${
                 filter === f.id ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
               }`}
             >
               {f.id === 'SOURCE' && <ImageIcon className="w-4 h-4 mr-2" />}
               {f.id === 'GENERATED' && <LayoutTemplate className="w-4 h-4 mr-2" />}
               {f.label}
             </button>
           ))}
        </div>

        {/* Asset Grid */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
           {loading ? (
             <div className="text-slate-400">Loading assets...</div>
           ) : filteredAssets.length === 0 ? (
             <div className="text-slate-500 flex flex-col items-center justify-center h-full">
                <Filter className="w-12 h-12 mb-4 opacity-50" />
                <p>No assets found matching the current filters.</p>
             </div>
           ) : (
             <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-6 space-y-6">
               {filteredAssets.map(asset => (
                 <div key={asset.id} className="break-inside-avoid bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-colors group shadow-lg shadow-black/50">
                    <div className="relative group/img">
                      <img src={`http://localhost:3000/${asset.path}`} alt={asset.filename} className="w-full object-contain bg-black/50" />
                      {asset.isGenerated && (
                        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                          GENERATED
                        </div>
                      )}
                      {asset.isGenerated && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                           <a 
                             href={`http://localhost:3000/${asset.path}`} download
                             className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded"
                           >
                             Download
                           </a>
                           <button 
                             onClick={() => setScheduleAsset(asset)}
                             className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded"
                           >
                             Schedule
                           </button>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                       <h3 className="text-white font-semibold truncate text-sm mb-1">{asset.project?.title || 'Unknown Project'}</h3>
                       <p className="text-slate-400 text-xs flex justify-between">
                         <span className="truncate max-w-[120px]" title={asset.type}>{asset.type.replace('GENERATED_', '').replace('_', ' ')}</span>
                         <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                       </p>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
