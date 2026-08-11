import React, { useState } from 'react';
import { MinimalPoster } from '../templates/MinimalPoster';
import { ReviewCard } from '../templates/ReviewCard';
import { RatingCard } from '../templates/RatingCard';
import { QuoteCard } from '../templates/QuoteCard';
import { Top5Reasons } from '../templates/Top5Reasons';
import { FORMAT_DIMENSIONS, FormatType, TemplateType } from '@/lib/design-config';
import { exportToImage } from '@/lib/export';
import { Download, Layout, Check, AlertCircle } from 'lucide-react';

export function DesignStudio({ project, approvedContent }: { project: any, approvedContent: any }) {
  const [template, setTemplate] = useState<TemplateType>('MINIMAL_POSTER');
  const [format, setFormat] = useState<FormatType>('INSTAGRAM_FEED');
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'partial_error' | 'error'>('idle');

  const config = {
    template,
    format,
    width: FORMAT_DIMENSIONS[format].width,
    height: FORMAT_DIMENSIONS[format].height,
  };

  const posterUrl = project.assets?.find((a: any) => a.type === 'poster') 
    ? `http://localhost:3000/${project.assets.find((a: any) => a.type === 'poster').path}` 
    : '';

  const handleExport = async () => {
    setExportStatus('exporting');
    try {
      const filename = `${project.title.replace(/\\s+/g, '_')}_${template}_${format}`;
      // exportToImage triggers the local download and returns the Blob
      const blob = await exportToImage('export-node', filename, 'png');
      
      // Save to Asset Library
      const formData = new FormData();
      formData.append('file', blob, `${filename}.png`);
      formData.append('type', `GENERATED_${template}`);
      formData.append('template', template);
      formData.append('format', format);
      formData.append('width', config.width.toString());
      formData.append('height', config.height.toString());

      const res = await fetch(`http://localhost:3000/assets/${project.id}/generated`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        setExportStatus('partial_error'); // Download succeeded, library save failed
      } else {
        setExportStatus('success');
      }
    } catch(err) {
      console.error(err);
      setExportStatus('error');
    }

    setTimeout(() => {
      setExportStatus('idle');
    }, 5000);
  };

  const renderTemplate = () => {
    if (template === 'MINIMAL_POSTER') {
      return <MinimalPoster config={config} project={project} content={approvedContent.REVIEW || {}} posterUrl={posterUrl} />;
    }
    if (template === 'REVIEW_CARD') {
      return <ReviewCard config={config} project={project} content={approvedContent.REVIEW || {}} />;
    }
    if (template === 'RATING_CARD') {
      return <RatingCard config={config} project={project} content={approvedContent.REVIEW || {}} />;
    }
    if (template === 'QUOTE_CARD') {
      return <QuoteCard config={config} project={project} content={approvedContent.REVIEW || {}} />;
    }
    if (template === 'TOP_5_REASONS') {
      return <Top5Reasons config={config} project={project} content={approvedContent.REVIEW || {}} />;
    }
    return null;
  };

  const previewScale = 540 / config.width; 

  return (
    <div className="flex h-full">
      {/* Controls */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 p-6 space-y-8 flex flex-col overflow-y-auto custom-scrollbar">
        
        <div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 flex items-center"><Layout className="w-4 h-4 mr-2"/> Template</h3>
          <div className="space-y-3">
            {[
              { id: 'MINIMAL_POSTER', name: 'Minimal Poster', desc: 'Focuses on official artwork' },
              { id: 'REVIEW_CARD', name: 'Premium Review Card', desc: 'Editorial style review breakdown' },
              { id: 'RATING_CARD', name: 'Rating Card', desc: 'Hyper-minimal score graphic' },
              { id: 'QUOTE_CARD', name: 'Quote Card', desc: 'Text-heavy editorial layout' },
              { id: 'TOP_5_REASONS', name: 'Top 5 Reasons', desc: 'Dynamic pros list layout' },
            ].map(t => (
               <button 
                 key={t.id}
                 onClick={() => setTemplate(t.id as TemplateType)}
                 className={`w-full text-left px-4 py-3 rounded-lg border ${template === t.id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-700 hover:border-slate-500 text-slate-300'}`}
               >
                 <div className="font-medium">{t.name}</div>
                 <div className="text-xs opacity-70 mt-1">{t.desc}</div>
               </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Format</h3>
          <div className="space-y-3">
            <button 
              onClick={() => setFormat('INSTAGRAM_FEED')}
              className={`w-full text-left px-4 py-3 rounded-lg border ${format === 'INSTAGRAM_FEED' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-700 hover:border-slate-500 text-slate-300'}`}
            >
              <div className="font-medium">Instagram Feed</div>
              <div className="text-xs opacity-70 mt-1">1080 × 1350 (Portrait)</div>
            </button>
            <button 
              onClick={() => setFormat('INSTAGRAM_STORY')}
              className={`w-full text-left px-4 py-3 rounded-lg border ${format === 'INSTAGRAM_STORY' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-700 hover:border-slate-500 text-slate-300'}`}
            >
              <div className="font-medium">Instagram Story / Reel</div>
              <div className="text-xs opacity-70 mt-1">1080 × 1920 (Vertical)</div>
            </button>
          </div>
        </div>

        <div className="mt-auto pt-8">
          <button 
            onClick={handleExport}
            disabled={exportStatus === 'exporting'}
            className={`w-full font-bold py-3 rounded-lg flex flex-col items-center justify-center shadow-lg transition-all ${
              exportStatus === 'success' ? 'bg-emerald-600 text-white' :
              exportStatus === 'partial_error' || exportStatus === 'error' ? 'bg-rose-600 text-white' :
              'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-900/30'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              {exportStatus === 'success' ? <Check className="w-5 h-5" /> : 
               exportStatus === 'partial_error' || exportStatus === 'error' ? <AlertCircle className="w-5 h-5" /> :
               <Download className="w-5 h-5" />}
              <span>
                {exportStatus === 'exporting' ? 'Exporting...' : 
                 exportStatus === 'success' ? 'Exported & Saved' :
                 exportStatus === 'partial_error' ? 'Download OK, Save Failed' :
                 exportStatus === 'error' ? 'Export Failed' :
                 'Export High-Res PNG'}
              </span>
            </div>
            {exportStatus === 'success' && <span className="text-[10px] font-medium text-emerald-200 mt-1">Saved to Asset Library</span>}
            {exportStatus === 'partial_error' && <span className="text-[10px] font-medium text-rose-200 mt-1">Retry to save to Library</span>}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 bg-black overflow-auto flex items-center justify-center relative p-8">
         <div 
           className="shadow-2xl shadow-black/50 ring-1 ring-slate-800 transition-all duration-300 pointer-events-none"
           style={{ 
             width: config.width, 
             height: config.height, 
             transform: `scale(${previewScale})`,
             transformOrigin: 'center center'
           }}
         >
         </div>

         <div className="absolute top-[-9999px] left-[-9999px]">
            {renderTemplate()}
         </div>

         <div 
           className="absolute pointer-events-none shadow-2xl ring-1 ring-slate-800 transition-all duration-300"
           style={{ 
             width: config.width * previewScale, 
             height: config.height * previewScale,
             overflow: 'hidden'
           }}
         >
            <div style={{
              width: config.width,
              height: config.height,
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left'
            }}>
               {renderTemplate()}
            </div>
         </div>
      </div>
    </div>
  );
}
