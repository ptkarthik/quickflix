'use client';
import { useState, useEffect } from 'react';
import { Film, LayoutTemplate, Layers, CalendarPlus, ChevronLeft, ChevronRight, X, CheckCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function ContentCalendar() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1)); // August 2026 for demo based on user prompt
  const [viewItem, setViewItem] = useState<any>(null);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const res = await fetch('http://localhost:3000/calendar');
      const data = await res.json();
      setSchedules(data);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishNow = async (id: string) => {
    setViewItem({...viewItem, status: 'PUBLISHING'});
    
    try {
      await fetch(`http://localhost:3000/calendar/${id}/publish`, {
        method: 'POST'
      });
      // Refresh to get final status (PUBLISHED or PUBLISH_FAILED)
      fetchSchedules();
      const res = await fetch('http://localhost:3000/calendar');
      const data = await res.json();
      const updatedItem = data.find((s: any) => s.id === id);
      setViewItem(updatedItem);
    } catch(err) {
      console.error(err);
      setViewItem({...viewItem, status: 'PUBLISH_FAILED', publishError: 'Network Error'});
    }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
  
  // Adjust for Monday start (0 = Monday in UI, but Date.getDay() 0 = Sunday)
  const emptyDays = firstDay === 0 ? 6 : firstDay - 1;

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-white overflow-hidden relative">
      
      {/* View/Publish Modal */}
      {viewItem && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl flex overflow-hidden shadow-2xl">
             <div className="w-1/2 bg-black flex flex-col justify-center border-r border-slate-800 p-6">
                {viewItem.asset ? (
                  <img src={`http://localhost:3000/${viewItem.asset.path}`} alt="Preview" className="w-full object-contain rounded-lg max-h-[400px]" />
                ) : (
                  <div className="text-slate-500 text-center">No Image</div>
                )}
             </div>
             
             <div className="w-1/2 p-8 flex flex-col relative">
                <button onClick={() => setViewItem(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
                <div className="mb-2 inline-flex">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded flex items-center ${
                    viewItem.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400' : 
                    viewItem.status === 'PUBLISH_FAILED' ? 'bg-rose-500/20 text-rose-400' :
                    viewItem.status === 'PUBLISHING' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {viewItem.status === 'PUBLISHING' && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                    {viewItem.status.replace('_', ' ')}
                  </span>
                </div>
                <h2 className="text-xl font-bold mb-1">{viewItem.title}</h2>
                <p className="text-sm text-slate-400 mb-6">{new Date(viewItem.scheduledFor).toLocaleString()} • {viewItem.platform}</p>
                
                {viewItem.notes && (
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg mb-6 text-sm text-slate-300">
                    <strong className="text-slate-500 uppercase tracking-wider text-xs block mb-1">Notes</strong>
                    {viewItem.notes}
                  </div>
                )}
                
                {viewItem.publishError && (
                  <div className="bg-rose-950/50 border border-rose-900 p-4 rounded-lg mb-6 text-sm text-rose-300">
                    <strong className="text-rose-500 uppercase tracking-wider text-xs block mb-1">Publish Error</strong>
                    {viewItem.publishError}
                  </div>
                )}
                
                <div className="mt-auto pt-4">
                  {viewItem.status === 'PUBLISHED' ? (
                    <button 
                      disabled
                      className="w-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold py-3 rounded-lg flex justify-center items-center cursor-not-allowed"
                    >
                      <CheckCircle className="w-5 h-5 mr-2"/> Published
                    </button>
                  ) : viewItem.status === 'PUBLISHING' ? (
                    <button 
                      disabled
                      className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg flex justify-center items-center cursor-wait"
                    >
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin"/> Publishing...
                    </button>
                  ) : viewItem.status === 'PUBLISH_FAILED' ? (
                    <button 
                      onClick={() => handlePublishNow(viewItem.id)}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-lg flex justify-center items-center"
                    >
                      <RefreshCw className="w-5 h-5 mr-2"/> Retry Publishing
                    </button>
                  ) : (
                    <button 
                      onClick={() => handlePublishNow(viewItem.id)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex justify-center items-center"
                    >
                      <CheckCircle className="w-5 h-5 mr-2"/> Publish Now
                    </button>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Global Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black tracking-tight text-white flex items-center">
             <span className="bg-indigo-600 p-1.5 rounded mr-2">
               <Film className="w-4 h-4 text-white" />
             </span>
             Studio
          </h1>
        </div>
        <div className="p-4 flex-1 space-y-2">
          <Link href="/" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium">
            <LayoutTemplate className="w-5 h-5 mr-3" /> Projects
          </Link>
          <Link href="/assets" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium">
            <Layers className="w-5 h-5 mr-3" /> Asset Library
          </Link>
          <div className="flex items-center text-indigo-400 bg-indigo-500/10 p-3 rounded-lg font-medium">
            <CalendarPlus className="w-5 h-5 mr-3" /> Calendar
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-800 bg-slate-900/50 p-6 flex justify-between items-center z-10 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Content Calendar</h1>
            <p className="text-sm text-slate-400">Plan and track your publishing schedule.</p>
          </div>
          
          <div className="flex items-center space-x-6">
             <div className="flex items-center space-x-4 bg-slate-950 border border-slate-800 rounded-lg p-1">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-bold min-w-[120px] text-center">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                  <ChevronRight className="w-5 h-5" />
                </button>
             </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
           <div className="grid grid-cols-7 gap-4">
             {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
               <div key={day} className="text-center text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                 {day}
               </div>
             ))}
             
             {Array.from({length: emptyDays}).map((_, i) => (
               <div key={`empty-${i}`} className="h-32 rounded-xl bg-slate-900/20 border border-slate-800/30"></div>
             ))}

             {Array.from({length: daysInMonth}).map((_, i) => {
               const day = i + 1;
               const currentCellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
               
               // Find schedules for this day
               const daySchedules = schedules.filter(s => {
                 const sDate = new Date(s.scheduledFor);
                 return sDate.getFullYear() === currentCellDate.getFullYear() && 
                        sDate.getMonth() === currentCellDate.getMonth() && 
                        sDate.getDate() === currentCellDate.getDate();
               });

               return (
                 <div key={day} className="h-32 rounded-xl bg-slate-900 border border-slate-800 p-2 overflow-hidden flex flex-col">
                   <div className="text-right text-sm font-semibold text-slate-500 mb-1">{day}</div>
                   <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                     {daySchedules.map(schedule => (
                       <div 
                         key={schedule.id}
                         onClick={() => setViewItem(schedule)}
                         className={`text-xs p-1.5 rounded cursor-pointer truncate font-medium border ${
                           schedule.status === 'PUBLISHED' 
                            ? 'bg-emerald-900/30 border-emerald-800/50 text-emerald-400' 
                            : schedule.status === 'PUBLISH_FAILED'
                            ? 'bg-rose-900/30 border-rose-800/50 text-rose-400'
                            : schedule.status === 'PUBLISHING'
                            ? 'bg-blue-900/30 border-blue-800/50 text-blue-400'
                            : 'bg-indigo-900/30 border-indigo-800/50 text-indigo-300 hover:bg-indigo-900/50'
                         }`}
                       >
                         🎬 {schedule.title}
                       </div>
                     ))}
                   </div>
                 </div>
               );
             })}
           </div>
        </div>
      </div>
    </div>
  );
}
