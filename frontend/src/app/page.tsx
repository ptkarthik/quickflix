'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Clock, Star, Film, LayoutTemplate, Layers, CalendarPlus, Settings } from 'lucide-react';

import { apiFetch, API_BASE } from '@/lib/api';

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
        setError('Unable to load projects from server.');
      }
    } catch {
      setError('Backend server is still starting or unreachable. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-white overflow-hidden">
      {/* Global Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black tracking-tight text-white flex items-center">
             <span className="bg-indigo-600 p-1.5 rounded mr-2">
               <Film className="w-4 h-4 text-white" />
             </span>
             Studio
          </h1>
        </div>
        <div className="p-4 flex-1 space-y-2">
          <div className="flex items-center text-indigo-400 bg-indigo-500/10 p-3 rounded-lg font-medium">
            <LayoutTemplate className="w-5 h-5 mr-3" /> Projects
          </div>
          <Link href="/assets" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium">
            <Layers className="w-5 h-5 mr-3" /> Asset Library
          </Link>
          <Link href="/calendar" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium">
            <CalendarPlus className="w-5 h-5 mr-3" /> Calendar
          </Link>
          <Link href="/settings" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium mt-8">
            <Settings className="w-5 h-5 mr-3" /> Settings
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
              <p className="text-slate-400 mt-1">Manage your movie review projects.</p>
            </div>
            <Link 
              href="/create" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-indigo-900/20"
            >
              <PlusCircle className="w-5 h-5" />
              <span>New Movie</span>
            </Link>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4 text-slate-200">Recent Movies</h2>
            
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : error ? (
              <div className="bg-slate-900/50 border border-amber-500/20 rounded-xl p-8 text-center flex flex-col items-center">
                <p className="text-amber-400 font-medium mb-3">{error}</p>
                <button
                  onClick={loadProjects}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            ) : projects.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center">
                <div className="bg-slate-800 p-4 rounded-full mb-4">
                  <Film className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
                <p className="text-slate-400 mb-6 max-w-md">Create your first movie project to start generating professional review content.</p>
                <Link 
                  href="/create" 
                  className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Start Creating
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {projects.map((project) => (
                  <Link href={`/projects/${project.id}`} key={project.id} className="group">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-900/10">
                      <div className="aspect-[3/4] bg-slate-800 relative">
                        {project.assets?.find((a: any) => a.type === 'poster') ? (
                          <img 
                            src={`${API_BASE}/${project.assets.find((a: any) => a.type === 'poster').path}`} 
                            alt={project.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                            <Film className="w-12 h-12 mb-2 opacity-50" />
                            <span className="text-sm font-medium">No Poster</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-white truncate text-lg">{project.title}</h3>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center text-amber-400 space-x-1 bg-amber-400/10 px-2 py-0.5 rounded text-sm font-medium">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span>{project.rating?.toFixed(2) || 'N/A'}</span>
                          </div>
                          <span className="text-xs text-slate-500 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(project.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center">
                          <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 font-medium border border-slate-700">
                            {project.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
