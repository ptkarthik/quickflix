import React from 'react';
import { Star } from 'lucide-react';

export function RatingCard({ config, project, content }: any) {
  return (
    <div 
      id="export-node"
      className="bg-black overflow-hidden flex flex-col justify-center items-center p-20 font-sans"
      style={{ width: config.width, height: config.height }}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/40 to-black pointer-events-none"></div>
      
      <div className="z-10 text-center w-full max-w-4xl">
        <h1 className="text-white font-black uppercase tracking-tighter mb-12" style={{ fontSize: '130px', lineHeight: '0.9' }}>
          {project?.title || 'MOVIE TITLE'}
        </h1>
        
        <div className="flex flex-col items-center justify-center space-y-8 mb-16">
           <div className="flex space-x-6 text-amber-400">
             {Array.from({length: 5}).map((_, i) => (
               <Star key={i} className={`w-24 h-24 ${i < Math.floor(project?.rating || 0) ? 'fill-current' : 'opacity-20'}`} />
             ))}
           </div>
           <div className="bg-amber-400 text-black font-black text-6xl px-12 py-4 rounded-full">
             {project?.rating || '0'} / 5
           </div>
        </div>

        <p className="text-indigo-200 text-5xl leading-tight font-bold tracking-tight px-10">
          "{content?.oneLiner || 'An absolute masterpiece of modern cinema.'}"
        </p>
      </div>
    </div>
  );
}
