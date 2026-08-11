import React from 'react';
import { Star } from 'lucide-react';

export function MinimalPoster({ config, project, content, posterUrl }: any) {
  return (
    <div 
      id="export-node"
      className="relative bg-black overflow-hidden flex flex-col font-sans"
      style={{ width: config.width, height: config.height }}
    >
      {posterUrl ? (
        <img src={posterUrl} alt="Poster" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-slate-900" />
      )}
      
      {/* Gradient Overlay for bottom text */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/80 to-transparent" />
      
      {/* Content */}
      <div className="relative z-10 mt-auto p-16 flex flex-col items-center text-center">
        <h1 className="text-white font-black uppercase tracking-tighter" style={{ fontSize: '100px', lineHeight: '1' }}>
          {project?.title || 'MOVIE TITLE'}
        </h1>
        
        <div className="flex items-center space-x-4 mt-8 bg-amber-400/20 px-6 py-3 rounded-full border border-amber-400/30 backdrop-blur-md">
          <Star className="w-10 h-10 text-amber-400 fill-current" />
          <span className="text-amber-400 font-bold text-4xl">{project?.rating || '0'}/5</span>
        </div>
        
        <p className="text-slate-200 mt-10 text-4xl font-medium max-w-4xl leading-tight">
          "{content?.oneLiner || content?.hook || 'An unforgettable cinematic experience.'}"
        </p>
      </div>
    </div>
  );
}
