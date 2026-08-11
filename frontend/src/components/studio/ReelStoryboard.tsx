import React from 'react';
import { Film, Video, Mic, Type, Image as ImageIcon } from 'lucide-react';

export function ReelStoryboard({ script, assets }: { script: any[], assets: any[] }) {
  if (!Array.isArray(script)) {
    return <div className="text-slate-500">Invalid script format. Expected JSON array.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-bold text-indigo-100 flex items-center"><Film className="w-5 h-5 mr-2 text-indigo-400" /> Production Blueprint</h3>
          <p className="text-sm text-indigo-300">Shot-by-shot directions for your Reel.</p>
        </div>
      </div>

      <div className="space-y-4">
        {script.map((scene: any, idx: number) => {
          let assetUrl = null;
          if (scene.visual?.assetId) {
            const asset = assets.find(a => a.id === scene.visual.assetId || a.originalName === scene.visual.assetId);
            if (asset) {
              assetUrl = `http://localhost:3000/${asset.path}`;
            }
          }

          return (
            <div key={idx} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex shadow-lg">
              {/* Timeline Info */}
              <div className="bg-slate-950 w-24 p-4 border-r border-slate-800 flex flex-col items-center justify-center shrink-0">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Time</span>
                <span className="text-lg font-black text-indigo-400">{scene.startTime}</span>
                <span className="text-slate-600 text-xs my-1">to</span>
                <span className="text-lg font-black text-indigo-400">{scene.endTime}</span>
              </div>
              
              {/* Visuals */}
              <div className="w-48 bg-slate-900/50 border-r border-slate-800 p-4 flex flex-col justify-center items-center shrink-0">
                {assetUrl ? (
                  <img src={assetUrl} alt="Scene Visual" className="w-full h-24 object-cover rounded shadow border border-slate-700" />
                ) : (
                  <div className="w-full h-24 bg-slate-800 rounded shadow border border-slate-700 flex flex-col items-center justify-center text-slate-500">
                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-xs font-medium text-center px-2">{scene.visual?.type || 'Visual'}</span>
                  </div>
                )}
                <div className="mt-3 text-xs text-center font-medium text-slate-400 flex items-center justify-center space-x-1">
                   <Video className="w-3 h-3" />
                   <span className="truncate max-w-[140px]" title={scene.visual?.direction}>{scene.visual?.direction || 'Static'}</span>
                </div>
              </div>

              {/* Audio & Text */}
              <div className="flex-1 p-5 flex flex-col justify-between">
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center mb-2">
                    <Mic className="w-3 h-3 mr-1" /> Voiceover
                  </h4>
                  <p className="text-white text-sm leading-relaxed bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    "{scene.voiceover}"
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center mb-1">
                      <Type className="w-3 h-3 mr-1" /> Text Overlay
                    </h4>
                    <p className="text-amber-400 text-sm font-bold bg-amber-900/10 p-2 rounded border border-amber-900/30 truncate" title={scene.textOverlay}>
                      {scene.textOverlay || 'None'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center mb-1">
                      <Film className="w-3 h-3 mr-1" /> Transition Out
                    </h4>
                    <p className="text-slate-300 text-sm p-2 rounded bg-slate-800/50 border border-slate-700/50">
                      {scene.transition || 'Cut'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
