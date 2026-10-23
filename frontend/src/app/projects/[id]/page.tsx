'use client';
import { useState, useEffect } from 'react';
import { use } from 'react';
import { Star, Image as ImageIcon, AlignLeft, Edit2, Save, RefreshCw, LayoutTemplate, Database, Search, Check } from 'lucide-react';
import { DesignStudio } from '@/components/studio/DesignStudio';
import { ReelStoryboard } from '@/components/studio/ReelStoryboard';
import { StrategyExecution } from '@/components/studio/StrategyExecution';

export default function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('REVIEW');
  const [editedContent, setEditedContent] = useState<Record<string, any>>({});
  const [isEditing, setIsEditing] = useState(false);
  
  // Research state
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [linking, setLinking] = useState(false);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/projects/${id}`);
      const data = await res.json();
      setProject(data);
      
      const initialEdited: Record<string, any> = {};
      data.editedContent?.forEach((ec: any) => {
        initialEdited[ec.type] = JSON.parse(ec.content);
      });
      ['REVIEW', 'INSTAGRAM', 'YOUTUBE', 'REEL_SCRIPT', 'CONTENT_STRATEGY'].forEach(type => {
         if (!initialEdited[type]) {
            const latestGen = data.generatedContent
               ?.filter((g: any) => g.type === type)
               .sort((a: any, b: any) => b.version - a.version)[0];
            initialEdited[type] = latestGen ? JSON.parse(latestGen.content) : null;
         }
      });
      setEditedContent(initialEdited);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  const handleGenerate = async (type?: string) => {
    setGenerating(true);
    try {
      const url = type 
        ? `http://localhost:3000/projects/${id}/generate/${type}` 
        : `http://localhost:3000/projects/${id}/generate`;
      await fetch(url, { method: 'POST' });
      await fetchProject();
    } catch(err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdits = async () => {
    try {
      await fetch(`http://localhost:3000/projects/${id}/content/${activeTab}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent[activeTab] })
      });
      setIsEditing(false);
      await fetchProject();
    } catch(err) {
      console.error(err);
    }
  };

  const updateField = (field: string, value: string | string[]) => {
    setEditedContent(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: value
      }
    }));
  };

  const handleSearchTMDB = async () => {
    setIsSearching(true);
    try {
      const res = await fetch(`http://localhost:3000/projects/${id}/research/search`);
      const data = await res.json();
      setSearchResults(data);
    } catch(err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLinkTMDB = async (tmdbId: string | number) => {
    setLinking(true);
    try {
      await fetch(`http://localhost:3000/projects/${id}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId })
      });
      await fetchProject();
      setSearchResults([]);
    } catch(err) {
      console.error(err);
    } finally {
      setLinking(false);
    }
  };

  if (loading) return <div className="p-8 text-white">Loading workspace...</div>;
  if (!project) return <div className="p-8 text-white">Project not found.</div>;

  const currentData = editedContent[activeTab];

  const renderField = (label: string, fieldKey: string, isList: boolean = false, isTextarea: boolean = false) => {
    const val = currentData?.[fieldKey] || (isList ? [] : '');
    
    if (isEditing) {
      return (
        <div className="space-y-2 mb-6">
          <label className="text-sm font-medium text-indigo-300 uppercase tracking-wider">{label}</label>
          {isList ? (
            <textarea 
              value={(val as string[]).join('\\n')}
              onChange={e => updateField(fieldKey, e.target.value.split('\\n'))}
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:ring-1 focus:ring-indigo-500 font-mono text-sm min-h-[100px]"
            />
          ) : isTextarea ? (
            <textarea 
              value={val as string}
              onChange={e => updateField(fieldKey, e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:ring-1 focus:ring-indigo-500 text-sm min-h-[100px]"
            />
          ) : (
            <input 
              type="text"
              value={val as string}
              onChange={e => updateField(fieldKey, e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:ring-1 focus:ring-indigo-500 text-sm"
            />
          )}
        </div>
      );
    }

    // View Mode
    return (
      <div className="space-y-2 mb-6">
        <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">{label}</label>
        <div className="bg-slate-900/50 border border-slate-800 rounded p-4 text-slate-300">
          {isList ? (
             <ul className="list-disc pl-5 space-y-1">
                {(val as string[]).map((item, i) => <li key={i}>{item}</li>)}
             </ul>
          ) : (
             <p className="whitespace-pre-wrap">{val}</p>
          )}
        </div>
      </div>
    );
  };

  const renderActiveTabContent = () => {
    if (activeTab === 'DESIGN') {
      return <DesignStudio project={project} approvedContent={editedContent} />;
    }

    if (!currentData) {
      return (
         <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 pt-20">
            <p>No content generated for {activeTab} yet.</p>
            <button 
               onClick={() => handleGenerate(activeTab.toLowerCase())}
               disabled={generating}
               className="border border-indigo-500 text-indigo-400 hover:bg-indigo-500/10 px-4 py-2 rounded-md font-medium transition-colors"
            >
               Generate {activeTab} Content
            </button>
         </div>
      );
    }

    return (
      <div className="max-w-3xl space-y-6 pt-6 mx-auto w-full px-8 pb-12 overflow-y-auto h-full">
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
           <h2 className="text-xl font-bold text-white flex items-center">
             {isEditing ? `Editing ${activeTab.replace('_', ' ')} Content` : `Approved ${activeTab.replace('_', ' ')} Content`}
             {project.editedContent?.some((e:any) => e.type === activeTab) && !isEditing && (
                <span className="ml-3 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/30">User Edited</span>
             )}
           </h2>
           <div className="flex space-x-3">
             {isEditing ? (
               <button onClick={handleSaveEdits} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center">
                 <Save className="w-4 h-4 mr-2" /> Save Edits
               </button>
             ) : (
               <>
                 <button onClick={() => setIsEditing(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center">
                   <Edit2 className="w-4 h-4 mr-2" /> Edit
                 </button>
                 <button 
                   onClick={() => handleGenerate(activeTab.toLowerCase())} 
                   disabled={generating}
                   className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center"
                 >
                   <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} /> Regenerate
                 </button>
               </>
             )}
           </div>
        </div>

        {activeTab === 'INSTAGRAM' && (
          <>
            {renderField('Hook', 'hook')}
            {renderField('Caption', 'caption', false, true)}
            {renderField('Hashtags', 'hashtags')}
            {renderField('Call To Action', 'cta')}
          </>
        )}

        {activeTab === 'YOUTUBE' && (
          <>
            <div className="space-y-2 mb-6">
               <label className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2 block">Title Options</label>
               {currentData.titles?.map((title: string, idx: number) => (
                 isEditing ? (
                   <input key={idx} type="text" value={title} onChange={(e) => {
                     const newTitles = [...currentData.titles];
                     newTitles[idx] = e.target.value;
                     updateField('titles', newTitles);
                   }} className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white mb-2 text-sm" />
                 ) : (
                   <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded p-3 text-slate-300 text-sm mb-2 font-medium">Option {idx+1}: {title}</div>
                 )
               ))}
            </div>
            {renderField('Description', 'description', false, true)}
            {renderField('Tags', 'tags')}
          </>
        )}

        {activeTab === 'REVIEW' && (
          <>
            {renderField('One-Liner', 'oneLiner')}
            {renderField('Short Review', 'shortReview', false, true)}
            {renderField('Detailed Review', 'detailedReview', false, true)}
            <div className="grid grid-cols-2 gap-6">
               {renderField('Pros', 'pros', true)}
               {renderField('Cons', 'cons', true)}
            </div>
            {renderField('Verdict', 'verdict')}
          </>
        )}

        {activeTab === 'REEL_SCRIPT' && (
          isEditing ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Reel Blueprint editing currently requires raw JSON editing. (Future enhancement: Visual editor)</p>
              <textarea 
                value={typeof currentData === 'string' ? currentData : JSON.stringify(currentData, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setEditedContent(prev => ({...prev, [activeTab]: parsed}));
                  } catch(e) {
                    // ignore parse errors while typing
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-slate-300 font-mono text-xs min-h-[400px]"
              />
            </div>
          ) : (
            <ReelStoryboard 
               script={(() => {
                 let d = currentData;
                 if (typeof d === 'string') {
                    try { d = JSON.parse(d); } catch(e){}
                 }
                 if (Array.isArray(d)) return d;
                 if (d && typeof d === 'object') {
                    if (Array.isArray(d.scenes)) return d.scenes;
                    if (Array.isArray(d.script)) return d.script;
                    const arrVal = Object.values(d).find(v => Array.isArray(v));
                    if (arrVal) return arrVal;
                    // Gemini returned a single object instead of an array
                    return [d];
                 }
                 return [];
               })()} 
               assets={project.assets || []} 
            />
          )
        )}
        {activeTab === 'CONTENT_STRATEGY' && currentData && (
          <div className="space-y-6 max-w-3xl mx-auto w-full">
            <div className="bg-indigo-900/20 border border-indigo-500/30 p-6 rounded-xl mb-6">
              <h3 className="text-lg font-bold text-indigo-100 mb-2">Strategy Rationale</h3>
              <p className="text-indigo-300 text-sm">{currentData.rationale}</p>
            </div>
            
            <StrategyExecution 
              strategy={currentData} 
              project={project} 
              approvedContent={editedContent}
              onComplete={fetchProject} 
            />
          </div>
        )}
      </div>
    );
  };

  const parsedResearch = project.researchData ? JSON.parse(project.researchData) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 p-6 z-10">
        <div className="flex justify-between items-center w-full">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{project.title}</h1>
              <span className="text-sm font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{project.status}</span>
            </div>
            <div className="flex items-center text-slate-400 space-x-4 text-sm">
              <span className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-white font-medium">{project.rating}/5</span>
              </span>
              <span>{project.genre}</span>
              <span>{project.releaseYear}</span>
            </div>
          </div>
          <div className="flex space-x-3">
             <button 
                onClick={() => handleGenerate()} 
                disabled={generating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2 disabled:opacity-50"
             >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Generate All Copy</span>
             </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 overflow-hidden flex w-full">
        
        {/* Left Sidebar - Assets & Metadata overview (Hide in Design mode) */}
        {activeTab !== 'DESIGN' && (
          <div className="w-80 border-r border-slate-800 p-6 overflow-y-auto space-y-6 flex-shrink-0 custom-scrollbar">
             
             {/* Factual Research Layer */}
             <div>
               <h3 className="font-semibold text-white mb-3 flex items-center"><Database className="w-4 h-4 mr-2" /> Factual Research</h3>
               {!parsedResearch ? (
                  <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-400 mb-3">No factual data linked yet.</p>
                    {searchResults.length === 0 ? (
                      <button 
                         onClick={handleSearchTMDB}
                         disabled={isSearching}
                         className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 text-sm rounded w-full flex justify-center items-center"
                      >
                         {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />} Link TMDB Data
                      </button>
                    ) : (
                      <div className="space-y-2 mt-2 text-left">
                         <p className="text-xs font-semibold text-slate-500 mb-2">Select correct match:</p>
                         {searchResults.slice(0, 3).map(res => (
                           <button 
                             key={res.id} 
                             onClick={() => handleLinkTMDB(res.id)}
                             disabled={linking}
                             className="w-full text-left text-xs bg-slate-800 hover:bg-slate-700 p-2 rounded text-slate-300 truncate"
                           >
                             {res.title} ({res.release_date?.substring(0,4)})
                           </button>
                         ))}
                      </div>
                    )}
                  </div>
               ) : (
                  <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-lg p-4">
                     <div className="flex justify-between items-center mb-3 border-b border-indigo-500/20 pb-2">
                       <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{project.researchSource} Connected</span>
                       <Check className="w-4 h-4 text-indigo-400" />
                     </div>
                     <div className="space-y-2 text-xs text-slate-300">
                        <p><strong className="text-white">Director:</strong> {parsedResearch.director}</p>
                        <p><strong className="text-white">Cast:</strong> {parsedResearch.cast?.slice(0,3).join(', ')}</p>
                        <p className="line-clamp-3"><strong className="text-white">Synopsis:</strong> {parsedResearch.synopsis}</p>
                     </div>
                  </div>
               )}
             </div>

             <div>
               <h3 className="font-semibold text-white mb-3 flex items-center"><ImageIcon className="w-4 h-4 mr-2" /> Source Assets</h3>
               <div className="space-y-4">
                 {project.assets.filter((a: any) => a.type === 'poster').map((a: any) => (
                   <div key={a.id} className="rounded-lg overflow-hidden border border-slate-700">
                      <img src={`http://localhost:3000/${a.path}`} alt="Poster" className="w-full object-cover" />
                   </div>
                 ))}
               </div>
             </div>
             
             <div>
               <h3 className="font-semibold text-white mb-2 flex items-center"><AlignLeft className="w-4 h-4 mr-2" /> Initial Thoughts</h3>
               <div className="bg-slate-900 border border-slate-800 rounded-md p-3 text-sm text-slate-300">
                 <p className="font-medium text-white mb-1">Hook</p>
                 <p className="mb-3">{project.oneLiner || 'N/A'}</p>
                 <p className="font-medium text-white mb-1">Review</p>
                 <p>{project.review || 'N/A'}</p>
               </div>
             </div>
          </div>
        )}

        {/* Right Content Editor */}
        <div className="flex-1 flex flex-col bg-[#0a0a0c] overflow-hidden">
           {/* Tabs */}
           <div className="flex border-b border-slate-800 bg-slate-950/50 shrink-0">
              {['REVIEW', 'INSTAGRAM', 'YOUTUBE', 'REEL_SCRIPT', 'CONTENT_STRATEGY', 'DESIGN'].map(tab => (
                 <button
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`px-5 py-4 font-medium text-sm transition-colors border-b-2 flex items-center ${
                     activeTab === tab ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                   }`}
                 >
                   {tab === 'DESIGN' && <LayoutTemplate className="w-4 h-4 mr-2" />}
                   {tab === 'CONTENT_STRATEGY' ? 'Content Strategy' : tab === 'DESIGN' ? 'Design Studio' : tab.replace('_', ' ')}
                 </button>
              ))}
           </div>

           {/* Content Area */}
           <div className="flex-1 overflow-hidden relative">
              {renderActiveTabContent()}
           </div>
        </div>
      </div>
    </div>
  );
}
