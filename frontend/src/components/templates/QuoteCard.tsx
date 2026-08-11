import React from 'react';
import { Quote } from 'lucide-react';

export function QuoteCard({ config, project, content }: any) {
  return (
    <div 
      id="export-node"
      className="bg-[#111115] overflow-hidden flex flex-col p-24 font-sans relative border-l-[30px] border-indigo-600"
      style={{ width: config.width, height: config.height }}
    >
      <Quote className="absolute top-16 right-16 w-48 h-48 text-indigo-900/30" />
      
      <div className="mt-auto mb-20 z-10">
        <p className="text-white text-[55px] leading-[1.3] font-serif italic font-light tracking-wide">
          "{content?.detailedReview || content?.shortReview || 'The film masterfully weaves complex emotional arcs into a visually stunning tapestry that demands to be seen on the biggest screen possible.'}"
        </p>
      </div>

      <div className="mt-auto border-t-2 border-slate-800 pt-16 flex items-center justify-between">
         <div>
            <h1 className="text-white font-black uppercase tracking-tight text-5xl mb-3">
              {project?.title || 'MOVIE TITLE'}
            </h1>
            <p className="text-slate-400 text-2xl font-medium tracking-widest uppercase">
              {project?.genre || 'GENRE'} • {project?.releaseYear || 'YEAR'}
            </p>
         </div>
         <div className="text-right">
            <div className="text-amber-400 font-black text-6xl mb-2">{project?.rating || '0'}/5</div>
            <div className="text-indigo-400 font-bold uppercase tracking-widest text-xl">My Rating</div>
         </div>
      </div>
    </div>
  );
}
