'use client';
import { useState, useRef } from 'react';
import { Check, X, Play, RefreshCw, CalendarPlus, Image as ImageIcon } from 'lucide-react';
import { exportToBlob } from '@/lib/export';

// Templates
import { MinimalPoster } from '../templates/MinimalPoster';
import { ReviewCard } from '../templates/ReviewCard';
import { QuoteCard } from '../templates/QuoteCard';
import { RatingCard } from '../templates/RatingCard';
import { Top5Reasons } from '../templates/Top5Reasons';

export function StrategyExecution({ 
  strategy, 
  project, 
  approvedContent,
  onComplete 
}: { 
  strategy: any, 
  project: any, 
  approvedContent: any,
  onComplete: () => void 
}) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(strategy.schedule?.map((s:any) => s.id)));
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionState, setExecutionState] = useState<Record<string, { status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR', message?: string }>>({});
  const offscreenContainerRef = useRef<HTMLDivElement>(null);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  };

  const getTemplateForFormat = (format: string) => {
    switch (format) {
      case 'REVIEW_CARD': return ReviewCard;
      case 'QUOTE_CARD': return QuoteCard;
      case 'RATING_CARD': return RatingCard;
      case 'TOP_5_REASONS': return Top5Reasons;
      case 'MINIMAL_POSTER': return MinimalPoster;
      default: return null;
    }
  };

  const getFormatForTemplate = (format: string) => {
    if (format === 'STORY' || format === 'TOP_5_REASONS') return 'INSTAGRAM_STORY'; // 1080x1920
    return 'INSTAGRAM_FEED'; // 1080x1350
  };

  const executeItem = async (item: any) => {
    try {
      setExecutionState(prev => ({ ...prev, [item.id]: { status: 'RUNNING', message: 'Processing...' } }));

      const isGraphic = !['REEL', 'YOUTUBE_REVIEW'].includes(item.format);
      let assetId = undefined;

      if (isGraphic) {
        setExecutionState(prev => ({ ...prev, [item.id]: { status: 'RUNNING', message: 'Rendering graphic...' } }));
        const Template = getTemplateForFormat(item.format);
        if (!Template) throw new Error(`No template for ${item.format}`);

        const renderConfig = {
          format: getFormatForTemplate(item.format),
          width: 1080,
          height: getFormatForTemplate(item.format) === 'INSTAGRAM_STORY' ? 1920 : 1350,
          scale: 1,
          fontFamily: 'Inter',
          colorScheme: 'dark'
        };

        const templateId = `offscreen-${item.id}`;
        
        // Wait for next tick to ensure DOM is updated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const el = document.getElementById(templateId);
        if (!el) throw new Error('Render element not found');

        const blob = await exportToBlob(el, renderConfig);
        
        // Upload Asset
        setExecutionState(prev => ({ ...prev, [item.id]: { status: 'RUNNING', message: 'Saving asset...' } }));
        const formData = new FormData();
        formData.append('file', blob, `${project.title.replace(/\s+/g, '_')}_${item.format}.png`);
        formData.append('projectId', project.id);
        formData.append('type', item.format);
        formData.append('isGenerated', 'true');
        formData.append('template', item.format);
        formData.append('format', renderConfig.format);
        formData.append('width', renderConfig.width.toString());
        formData.append('height', renderConfig.height.toString());

        const assetRes = await fetch('http://localhost:3000/assets/upload', {
          method: 'POST',
          body: formData
        });
        const assetData = await assetRes.json();
        assetId = assetData.id;
      }

      // Schedule Calendar
      setExecutionState(prev => ({ ...prev, [item.id]: { status: 'RUNNING', message: 'Scheduling...' } }));
      
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + item.dayOffset);

      await fetch('http://localhost:3000/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          title: `${project.title} - ${item.format.replace('_', ' ')}`,
          contentType: item.format,
          assetId,
          scheduledFor: scheduledFor.toISOString(),
          platform: 'INSTAGRAM_FEED', // default for now, could map more explicitly
          notes: item.notes,
          strategyItemId: item.id
        })
      });

      setExecutionState(prev => ({ ...prev, [item.id]: { status: 'SUCCESS', message: 'Scheduled successfully' } }));

    } catch (err: any) {
      console.error(`Execution failed for ${item.id}`, err);
      setExecutionState(prev => ({ ...prev, [item.id]: { status: 'ERROR', message: err.message || 'Execution failed' } }));
    }
  };

  const handleExecuteSelected = async () => {
    setIsExecuting(true);
    const itemsToExecute = strategy.schedule.filter((s:any) => selectedItems.has(s.id));
    
    // Process sequentially to not overload DOM capture
    for (const item of itemsToExecute) {
      if (executionState[item.id]?.status === 'SUCCESS') continue; // Idempotent skip
      await executeItem(item);
    }
    
    setIsExecuting(false);
    onComplete();
  };

  const completedCount = Object.values(executionState).filter(e => e.status === 'SUCCESS').length;
  const totalSelected = selectedItems.size;

  return (
    <div className="space-y-6">
      
      {/* Invisible render container */}
      <div ref={offscreenContainerRef} style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        {strategy.schedule?.map((item: any) => {
          if (!selectedItems.has(item.id)) return null;
          const Template = getTemplateForFormat(item.format);
          if (!Template) return null;
          const renderConfig = {
            format: getFormatForTemplate(item.format),
            width: 1080,
            height: getFormatForTemplate(item.format) === 'INSTAGRAM_STORY' ? 1920 : 1350,
            scale: 1,
            fontFamily: 'Inter',
            colorScheme: 'dark'
          };
          return (
            <div key={`offscreen-${item.id}`} id={`offscreen-${item.id}`} style={{ width: renderConfig.width, height: renderConfig.height }}>
              <Template 
                project={project} 
                content={approvedContent[item.format === 'MINIMAL_POSTER' ? 'REVIEW' : (item.format === 'TOP_5_REASONS' || item.format === 'QUOTE_CARD' ? 'REVIEW' : 'REVIEW')]} // Simplify mapping for demo
                config={renderConfig} 
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center bg-slate-900 border border-slate-700 p-4 rounded-xl">
        <div>
          <h3 className="font-bold text-white flex items-center"><Play className="w-4 h-4 mr-2 text-indigo-400" /> Execute Strategy</h3>
          <p className="text-sm text-slate-400">Select items to automatically generate and schedule.</p>
        </div>
        <button
          onClick={handleExecuteSelected}
          disabled={isExecuting || selectedItems.size === 0}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded font-bold shadow flex items-center"
        >
          {isExecuting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          Execute Selected ({selectedItems.size})
        </button>
      </div>

      {isExecuting && (
        <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl flex items-center justify-between mb-4">
           <span className="text-indigo-300 font-medium text-sm">Execution Progress</span>
           <span className="text-indigo-400 font-bold">{completedCount} / {totalSelected} Completed</span>
        </div>
      )}

      <div className="space-y-3">
        {strategy.schedule?.map((item: any) => {
          const isSelected = selectedItems.has(item.id);
          const state = executionState[item.id];
          
          return (
            <div key={item.id} className={`flex items-center p-4 rounded-xl border transition-colors ${
              isSelected ? 'bg-slate-900 border-indigo-500/50' : 'bg-slate-950 border-slate-800 opacity-50'
            }`}>
              
              <div className="mr-4">
                <input 
                  type="checkbox" 
                  checked={isSelected}
                  onChange={() => toggleSelect(item.id)}
                  disabled={isExecuting || state?.status === 'SUCCESS'}
                  className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                />
              </div>
              
              <div className="w-16 bg-slate-950 rounded border border-slate-800 flex flex-col items-center justify-center mr-4 shrink-0 p-2">
                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Day</span>
                 <span className="text-lg font-black text-white">+{item.dayOffset}</span>
              </div>
              
              <div className="flex-1">
                 <h4 className="text-sm font-bold text-white flex items-center mb-1">
                   {item.format.replace(/_/g, ' ')}
                   {!['REEL', 'YOUTUBE_REVIEW'].includes(item.format) && <ImageIcon className="w-3 h-3 ml-2 text-slate-500" title="Generates Graphic" />}
                   {['REEL', 'YOUTUBE_REVIEW'].includes(item.format) && <CalendarPlus className="w-3 h-3 ml-2 text-slate-500" title="Calendar Only" />}
                 </h4>
                 <p className="text-xs text-slate-400">{item.notes}</p>
              </div>

              {state && (
                <div className="ml-4 shrink-0 text-xs font-medium flex items-center w-40 justify-end">
                  {state.status === 'RUNNING' && <span className="text-indigo-400 flex items-center"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> {state.message}</span>}
                  {state.status === 'SUCCESS' && <span className="text-emerald-400 flex items-center"><Check className="w-3 h-3 mr-1" /> Scheduled</span>}
                  {state.status === 'ERROR' && (
                    <div className="flex flex-col items-end">
                       <span className="text-rose-400 flex items-center mb-1"><X className="w-3 h-3 mr-1" /> {state.message}</span>
                       <button onClick={() => executeItem(item)} className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded hover:bg-rose-500/30">Retry</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
