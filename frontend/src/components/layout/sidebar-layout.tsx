'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Film, PlusCircle, Settings, Palette, Tv, Inbox, Clapperboard, Globe, MonitorPlay, CalendarHeart, TrendingUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-black text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            CineAI Studio
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <Home className={cn("w-5 h-5", pathname === '/' ? "text-indigo-400" : "")} />
            <span>Dashboard</span>
          </Link>
          <Link href="/movies" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/movies' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <Film className={cn("w-5 h-5", pathname === '/movies' ? "text-indigo-400" : "")} />
            <span>Movies</span>
          </Link>
          <Link href="/create" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/create' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <PlusCircle className={cn("w-5 h-5", pathname === '/create' ? "text-indigo-400" : "")} />
            <span>New Movie</span>
          </Link>
          <Link href="/discover" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/discover' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <Tv className={cn("w-5 h-5", pathname === '/discover' ? "text-indigo-400" : "")} />
            <span>Discover OTT</span>
          </Link>
          <Link href="/ott" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/ott' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <Inbox className={cn("w-5 h-5", pathname === '/ott' ? "text-indigo-400" : "")} />
            <span>OTT Desk</span>
          </Link>
          <Link href="/cinema" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/cinema' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <Clapperboard className={cn("w-5 h-5", pathname === '/cinema' ? "text-indigo-400" : "")} />
            <span>Cinema Desk</span>
          </Link>
          <Link href="/world" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/world' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <Globe className={cn("w-5 h-5", pathname === '/world' ? "text-indigo-400" : "")} />
            <span>World Movies & Series</span>
          </Link>
          <Link href="/trends" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/trends' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <Flame className={cn("w-5 h-5", pathname === '/trends' ? "text-indigo-400" : "")} />
            <span>Trending now</span>
          </Link>
          <Link href="/growth" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/growth' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <TrendingUp className={cn("w-5 h-5", pathname === '/growth' ? "text-indigo-400" : "")} />
            <span>Growth & analytics</span>
          </Link>
          <Link href="/on-this-day" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/on-this-day' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <CalendarHeart className={cn("w-5 h-5", pathname === '/on-this-day' ? "text-indigo-400" : "")} />
            <span>On this day</span>
          </Link>
          <Link href="/watch-free" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/watch-free' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <MonitorPlay className={cn("w-5 h-5", pathname === '/watch-free' ? "text-indigo-400" : "")} />
            <span>Watch Free site</span>
          </Link>
          <Link href="/canvas" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/canvas' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <Palette className={cn("w-5 h-5", pathname === '/canvas' ? "text-indigo-400" : "")} />
            <span>AI Canvas</span>
          </Link>
          <Link href="/brand" className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
            pathname === '/brand' ? "bg-slate-900 text-white font-medium" : "text-slate-300 hover:bg-slate-900 hover:text-white"
          )}>
            <Palette className={cn("w-5 h-5", pathname === '/brand' ? "text-indigo-400" : "")} />
            <span>Brand Kit</span>
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button className="flex items-center space-x-3 px-3 py-2 w-full rounded-md hover:bg-slate-900 transition-colors text-slate-400 hover:text-white text-left">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#0a0a0c]">
        {children}
      </main>
    </div>
  );
}
