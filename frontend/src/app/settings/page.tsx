'use client';
import { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle, Database, Plus, Film, LayoutTemplate, Layers, CalendarPlus } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  // New Profile Form State
  const [isCreating, setIsCreating] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: '',
    language: 'English',
    style: '',
    structure: '',
    constraints: ''
  });

  const [activeTab, setActiveTab] = useState('VOICE_PROFILES');
  const [socialAccounts, setSocialAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetchProfiles();
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('http://localhost:3000/social/accounts');
      const data = await res.json();
      setSocialAccounts(data);
    } catch(err) {
      console.error(err);
    }
  };

  const handleConnect = async (platform: string, accountName: string) => {
    try {
      await fetch('http://localhost:3000/social/mock-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, accountName })
      });
      fetchAccounts();
    } catch(err) {
      console.error(err);
    }
  };

  const fetchProfiles = async () => {
    try {
      const res = await fetch('http://localhost:3000/settings/voice');
      const data = await res.json();
      setProfiles(data);
      const active = data.find((p: any) => p.isActive);
      if (active) setActiveProfileId(active.id);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      await fetch(`http://localhost:3000/settings/voice/${id}/active`, { method: 'PATCH' });
      setActiveProfileId(id);
      fetchProfiles();
    } catch(err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:3000/settings/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile)
      });
      setIsCreating(false);
      setNewProfile({ name: '', language: 'English', style: '', structure: '', constraints: '' });
      fetchProfiles();
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-white overflow-hidden">
      
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
          <Link href="/calendar" className="flex items-center text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg transition-colors font-medium">
            <CalendarPlus className="w-5 h-5 mr-3" /> Calendar
          </Link>
          <div className="flex items-center text-indigo-400 bg-indigo-500/10 p-3 rounded-lg font-medium mt-8">
            <Settings className="w-5 h-5 mr-3" /> Settings
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="border-b border-slate-800 bg-slate-900/50 p-6 z-10 shrink-0 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
            <p className="text-sm text-slate-400">Configure your workspace and AI preferences.</p>
          </div>
          <div className="flex space-x-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button 
              onClick={() => setActiveTab('VOICE_PROFILES')} 
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'VOICE_PROFILES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Voice Profiles
            </button>
            <button 
              onClick={() => setActiveTab('INTEGRATIONS')} 
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'INTEGRATIONS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Integrations
            </button>
          </div>
        </div>

        <div className="p-8 max-w-5xl mx-auto w-full space-y-12">
          
          {activeTab === 'VOICE_PROFILES' && (
            <section>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1 flex items-center"><Database className="w-5 h-5 mr-2 text-indigo-400" /> Review Voice Profiles</h2>
                  <p className="text-sm text-slate-400">Manage the personas used by the AI Content Engine.</p>
                </div>
                {!isCreating && (
                  <button 
                    onClick={() => setIsCreating(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center shadow-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" /> New Profile
                  </button>
                )}
              </div>

              {isCreating && (
                <div className="bg-slate-900 border border-indigo-500/50 rounded-xl p-6 mb-8 shadow-xl">
                  <h3 className="font-bold text-lg mb-4">Create New Voice Profile</h3>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Profile Name</label>
                        <input type="text" required value={newProfile.name} onChange={e => setNewProfile({...newProfile, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-indigo-500" placeholder="e.g. YouTube Deep Dive" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Language</label>
                        <input type="text" required value={newProfile.language} onChange={e => setNewProfile({...newProfile, language: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-indigo-500" placeholder="e.g. Tamil/English Mix" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Style</label>
                      <input type="text" required value={newProfile.style} onChange={e => setNewProfile({...newProfile, style: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-indigo-500" placeholder="e.g. Colloquial, highly analytical" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Review Structure</label>
                      <textarea rows={2} required value={newProfile.structure} onChange={e => setNewProfile({...newProfile, structure: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-indigo-500" placeholder="e.g. Hook -> Story -> Performances -> Verdict" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Constraints & Rules</label>
                      <textarea rows={2} value={newProfile.constraints} onChange={e => setNewProfile({...newProfile, constraints: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-indigo-500" placeholder="e.g. No artificial literary language" />
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                      <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center">
                        <Save className="w-4 h-4 mr-2" /> Save Profile
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profiles.map(profile => (
                  <div key={profile.id} className={`bg-slate-900 border rounded-xl p-6 relative shadow-lg transition-colors ${profile.isActive ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-slate-800 hover:border-slate-700'}`}>
                    {profile.isActive && (
                      <div className="absolute top-4 right-4 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" /> Active Engine
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-white mb-4 pr-24">{profile.name}</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Language</span>
                        <span className="text-sm text-slate-300">{profile.language}</span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Style</span>
                        <span className="text-sm text-slate-300">{profile.style}</span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Structure</span>
                        <span className="text-sm text-slate-300">{profile.structure}</span>
                      </div>
                    </div>
                    {!profile.isActive && (
                      <div className="mt-6 pt-4 border-t border-slate-800">
                        <button 
                          onClick={() => handleSetActive(profile.id)}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg transition-colors"
                        >
                          Set as Active
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'INTEGRATIONS' && (
            <section className="space-y-8">
              <div>
                <h2 className="text-xl font-bold mb-1">Social Accounts</h2>
                <p className="text-sm text-slate-400">Connect your platform accounts for publishing.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Instagram Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between h-48">
                   <div>
                     <h3 className="font-bold text-lg text-white mb-1">Instagram</h3>
                     <p className="text-xs text-slate-500">Publish Feed Posts, Stories, and Reels.</p>
                   </div>
                   {socialAccounts.find(a => a.platform === 'INSTAGRAM') ? (
                     <div className="bg-emerald-900/20 border border-emerald-500/20 p-3 rounded-lg flex items-center justify-between">
                        <span className="text-emerald-400 text-sm font-bold flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> Connected</span>
                        <span className="text-xs text-emerald-500 font-mono">@{socialAccounts.find(a => a.platform === 'INSTAGRAM').accountName}</span>
                     </div>
                   ) : (
                     <button 
                       onClick={() => handleConnect('INSTAGRAM', 'my_movie_page')}
                       className="bg-indigo-600 hover:bg-indigo-700 text-white w-full py-3 rounded-lg font-bold text-sm shadow flex items-center justify-center"
                     >
                        Connect Instagram (Mock)
                     </button>
                   )}
                </div>

                {/* YouTube Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between h-48">
                   <div>
                     <h3 className="font-bold text-lg text-white mb-1">YouTube</h3>
                     <p className="text-xs text-slate-500">Publish Full Reviews and Shorts.</p>
                   </div>
                   {socialAccounts.find(a => a.platform === 'YOUTUBE') ? (
                     <div className="bg-emerald-900/20 border border-emerald-500/20 p-3 rounded-lg flex items-center justify-between">
                        <span className="text-emerald-400 text-sm font-bold flex items-center"><CheckCircle className="w-4 h-4 mr-2" /> Connected</span>
                        <span className="text-xs text-emerald-500 font-mono">@{socialAccounts.find(a => a.platform === 'YOUTUBE').accountName}</span>
                     </div>
                   ) : (
                     <button 
                       onClick={() => handleConnect('YOUTUBE', 'MovieChannel123')}
                       className="bg-rose-600 hover:bg-rose-700 text-white w-full py-3 rounded-lg font-bold text-sm shadow flex items-center justify-center"
                     >
                        Connect YouTube (Mock)
                     </button>
                   )}
                </div>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
