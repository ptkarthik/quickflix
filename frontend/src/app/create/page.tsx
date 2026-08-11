'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Check, Film, Image as ImageIcon, UploadCloud } from 'lucide-react';
import Link from 'next/link';

export default function CreateMovie() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  
  const [details, setDetails] = useState({
    title: '',
    rating: 2.5,
    genre: '',
    language: '',
    releaseYear: new Date().getFullYear().toString(),
    oneLiner: '',
    review: ''
  });

  const [files, setFiles] = useState<{ poster?: File, still?: File, logo?: File }>({});
  const [previews, setPreviews] = useState<{ poster?: string, still?: string, logo?: string }>({});

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Create project
      const res = await fetch('http://localhost:3000/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...details, 
          releaseYear: parseInt(details.releaseYear) || null, 
          rating: parseFloat(details.rating.toString()) 
        })
      });
      const data = await res.json();
      setProjectId(data.id);
      setStep(2);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (type: 'poster' | 'still' | 'logo', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => ({ ...prev, [type]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = async (type: string, file: File) => {
    if (!projectId) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    await fetch(`http://localhost:3000/assets/${projectId}`, {
      method: 'POST',
      body: formData
    });
  };

  const handleAssetsSubmit = async () => {
    setLoading(true);
    try {
      if (files.poster) await handleFileUpload('poster', files.poster);
      if (files.still) await handleFileUpload('still', files.still);
      if (files.logo) await handleFileUpload('logo', files.logo);
      setStep(3);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Create Movie Project</h1>
        <p className="text-slate-400">Initialize a new project and upload source materials.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-12">
        {[
          { num: 1, label: 'Details', icon: Film },
          { num: 2, label: 'Assets', icon: ImageIcon },
          { num: 3, label: 'Review', icon: Check }
        ].map((s, i) => (
          <div key={s.num} className="flex flex-col items-center relative z-10">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 mb-3 transition-colors ${
              step === s.num ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 
              step > s.num ? 'bg-slate-800 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}>
              <s.icon className="w-5 h-5" />
            </div>
            <span className={`text-sm font-medium ${step >= s.num ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
            {i < 2 && (
              <div className={`absolute top-6 left-12 w-[calc(100vw_/_2_-_4rem)] md:w-48 h-0.5 -z-10 ${
                step > s.num ? 'bg-indigo-600' : 'bg-slate-800'
              }`} style={{ transform: 'translateX(50%)' }}></div>
            )}
          </div>
        ))}
      </div>

      {/* Forms */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl">
        {step === 1 && (
          <form onSubmit={handleDetailsSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Movie Title <span className="text-red-400">*</span></label>
                <input required type="text" value={details.title} onChange={e => setDetails({...details, title: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500" placeholder="e.g. Interstellar" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Rating (0.5 - 5.0) <span className="text-red-400">*</span></label>
                <div className="flex items-center space-x-4">
                  <input required type="range" min="0.5" max="5.0" step="0.25" value={details.rating} onChange={e => setDetails({...details, rating: parseFloat(e.target.value)})} className="w-full accent-indigo-500" />
                  <span className="bg-slate-950 border border-slate-700 rounded-md px-3 py-1 font-mono text-indigo-400 font-bold">{details.rating.toFixed(2)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Genre</label>
                <input type="text" value={details.genre} onChange={e => setDetails({...details, genre: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="Sci-Fi / Drama" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Release Year</label>
                <input type="number" value={details.releaseYear} onChange={e => setDetails({...details, releaseYear: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="2014" />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">One-Liner (Hook)</label>
              <input type="text" value={details.oneLiner} onChange={e => setDetails({...details, oneLiner: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="An unforgettable cinematic experience." />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Short Review</label>
              <textarea rows={4} value={details.review} onChange={e => setDetails({...details, review: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-md px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none" placeholder="Write your thoughts..."></textarea>
            </div>

            <div className="pt-4 flex justify-end">
              <button disabled={loading} type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors flex items-center space-x-2 disabled:opacity-50">
                <span>Next Step</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <p className="text-slate-400">Upload official artwork for {details.title || 'the movie'}. The design engine will use these as the source of truth.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { id: 'poster' as const, label: 'Official Poster', desc: 'Primary visual' },
                { id: 'still' as const, label: 'Movie Still', desc: 'Secondary / Background' },
                { id: 'logo' as const, label: 'Transparent Logo', desc: 'Title typography' }
              ].map(asset => (
                <div key={asset.id} className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-4 transition-colors relative group">
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(asset.id, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  
                  {previews[asset.id] ? (
                    <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-slate-950">
                      <img src={previews[asset.id]} alt={asset.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white font-medium flex items-center"><UploadCloud className="w-4 h-4 mr-2"/> Replace</p>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[3/4] flex flex-col items-center justify-center text-slate-500 bg-slate-950/50 rounded-lg">
                      <UploadCloud className="w-8 h-8 mb-3 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                      <span className="font-medium text-slate-300">{asset.label}</span>
                      <span className="text-xs mt-1">{asset.desc}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-6 flex justify-between">
              <button onClick={() => setStep(1)} className="text-slate-400 hover:text-white px-4 py-2 font-medium transition-colors">
                Back
              </button>
              <button onClick={handleAssetsSubmit} disabled={loading || !files.poster} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-indigo-900/20 disabled:opacity-50">
                <span>Upload & Continue</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-12 space-y-6">
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Project Ready</h2>
              <p className="text-slate-400 max-w-md mx-auto">
                "{details.title}" has been successfully created and assets are stored in the library.
              </p>
            </div>
            
            <div className="pt-8 flex justify-center space-x-4">
              <Link href={`/`} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-md font-medium transition-colors">
                Return to Dashboard
              </Link>
              <button disabled className="bg-indigo-600/50 text-white px-6 py-3 rounded-md font-medium cursor-not-allowed opacity-50 flex items-center space-x-2">
                <span>Design Generator (Phase 2)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
