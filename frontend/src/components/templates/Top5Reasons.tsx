import React from 'react';
import { Play } from 'lucide-react';

export function Top5Reasons({ config, project, content }: any) {
  const pros = content?.pros || ['Incredible Cinematography', 'Career-defining performances', 'Masterful pacing', 'Stunning score', 'Emotional resonance'];
  
  return (
    <div 
      id="export-node"
      className="bg-[#0c0c0f] overflow-hidden flex flex-col p-20 font-sans"
      style={{ width: config.width, height: config.height }}
    >
      <div className="mb-16 border-b-4 border-emerald-500 pb-12 inline-block self-start">
        <h2 className="text-emerald-400 font-black text-4xl tracking-widest uppercase mb-4">Why you need to watch</h2>
        <h1 className="text-white font-black uppercase tracking-tighter" style={{ fontSize: '90px', lineHeight: '1' }}>
          {project?.title || 'MOVIE TITLE'}
        </h1>
      </div>
      
      <div className="flex-1 flex flex-col justify-center space-y-12">
         {pros.slice(0, 5).map((pro: string, i: number) => (
           <div key={i} className="flex items-start bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
             <div className="text-emerald-500 font-black text-7xl mr-10 leading-none">
               {i + 1}
             </div>
             <p className="text-slate-200 text-4xl font-bold leading-tight mt-3">
               {pro}
             </p>
           </div>
         ))}
      </div>

      <div className="mt-16 text-center bg-indigo-600 rounded-2xl py-8 flex items-center justify-center space-x-6">
        <Play className="w-12 h-12 text-white fill-current" />
        <span className="text-white font-black text-4xl uppercase tracking-widest">Added to Watchlist</span>
      </div>
    </div>
  );
}
