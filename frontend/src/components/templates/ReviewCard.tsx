import React from 'react';
import { Star, Check, X } from 'lucide-react';

export function ReviewCard({ config, project, content }: any) {
  return (
    <div 
      id="export-node"
      className="bg-[#0f0f13] overflow-hidden flex flex-col p-20 font-sans border-8 border-slate-800"
      style={{ width: config.width, height: config.height }}
    >
      <div className="text-center mb-16 mt-10">
        <h1 className="text-white font-black uppercase tracking-tighter mb-8" style={{ fontSize: '110px', lineHeight: '1' }}>
          {project?.title || 'MOVIE TITLE'}
        </h1>
        <div className="flex items-center justify-center space-x-4 text-amber-400">
           {Array.from({length: 5}).map((_, i) => (
             <Star key={i} className={`w-14 h-14 ${i < Math.floor(project?.rating || 0) ? 'fill-current' : 'opacity-20'}`} />
           ))}
           <span className="text-5xl font-bold ml-6">{project?.rating || '0'}</span>
        </div>
      </div>
      
      <div className="bg-slate-900/80 border border-slate-700/50 rounded-3xl p-14 mb-16 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
         <p className="text-slate-200 text-4xl leading-relaxed italic font-light">
           "{content?.shortReview || 'A compelling narrative that explores the depths of human emotion. Brilliantly directed.'}"
         </p>
      </div>

      <div className="grid grid-cols-2 gap-16 mb-16">
         <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-3xl p-10">
            <h3 className="text-emerald-400 font-bold text-3xl tracking-widest uppercase mb-10 border-b border-emerald-900/50 pb-4">Pros</h3>
            <ul className="space-y-8">
              {(content?.pros || ['Great acting', 'Stunning visuals']).map((pro: string, i: number) => (
                <li key={i} className="flex text-slate-300 text-3xl leading-snug"><Check className="w-10 h-10 text-emerald-500 mr-6 flex-shrink-0 mt-1" /> {pro}</li>
              ))}
            </ul>
         </div>
         <div className="bg-rose-950/20 border border-rose-900/30 rounded-3xl p-10">
            <h3 className="text-rose-400 font-bold text-3xl tracking-widest uppercase mb-10 border-b border-rose-900/50 pb-4">Cons</h3>
            <ul className="space-y-8">
              {(content?.cons || ['Pacing issues']).map((con: string, i: number) => (
                <li key={i} className="flex text-slate-300 text-3xl leading-snug"><X className="w-10 h-10 text-rose-500 mr-6 flex-shrink-0 mt-1" /> {con}</li>
              ))}
            </ul>
         </div>
      </div>

      <div className="mt-auto text-center border-t border-slate-800 pt-16">
        <p className="text-indigo-400 text-2xl tracking-widest uppercase mb-6 font-bold">The Verdict</p>
        <p className="text-white font-black text-5xl tracking-tight">{content?.verdict || 'Highly Recommended'}</p>
      </div>
    </div>
  );
}
