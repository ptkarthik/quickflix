'use client';
import React, { useState } from 'react';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import { Sparkles, Download, Type, Sliders, Image as ImageIcon, Palette } from 'lucide-react';

export default function CanvasPage() {
  const [theme, setTheme] = useState('Cyberpunk Thriller in Mumbai');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Customization State
  const [posterTitle, setPosterTitle] = useState('NEON SHADOWS');
  const [posterTagline, setPosterTagline] = useState('In the city of dreams, nightmares are real.');
  const [posterRelease, setPosterRelease] = useState('STREAMING THIS FRIDAY');
  
  // Style State
  const [fontFamily, setFontFamily] = useState('Cinzel');
  const [titleSize, setTitleSize] = useState(64);
  const [taglineSize, setTaglineSize] = useState(24);
  
  // Color State
  const [titleColor, setTitleColor] = useState('#ffffff');
  const [taglineColor, setTaglineColor] = useState('#a5b4fc'); // Indigo-300
  const [bgColor1, setBgColor1] = useState('#0f172a');
  const [bgColor2, setBgColor2] = useState('#312e81');

  const generateContent = () => {
    setIsGenerating(true);
    setTimeout(() => {
      // Mock AI generation based on theme
      const themes = theme.toLowerCase().split(' ');
      const isRomantic = themes.includes('love') || themes.includes('romance');
      const isHorror = themes.includes('horror') || themes.includes('scary');
      
      if (isRomantic) {
        setPosterTitle('ETERNAL HEARTS');
        setPosterTagline('A love story that defies time.');
        setBgColor1('#2e1022');
        setBgColor2('#701a43');
        setFontFamily('Playfair Display');
      } else if (isHorror) {
        setPosterTitle('THE SILENCE');
        setPosterTagline('Some secrets should stay buried.');
        setBgColor1('#000000');
        setBgColor2('#450a0a');
        setFontFamily('Cinzel');
      } else {
        // Dynamic construction
        const words = theme.split(' ').filter(w => w.length > 3);
        const keyword = words.length > 0 ? words[0].toUpperCase() : 'AWAKENING';
        setPosterTitle(`${keyword} PROTOCOL`);
        setPosterTagline(`The ultimate ${theme} experience.`);
        setBgColor1('#0f172a');
        setBgColor2('#312e81');
        setFontFamily('Montserrat');
      }
      
      setIsGenerating(false);
    }, 1200);
  };

  return (
    <SidebarLayout>
      <div className="flex h-full w-full bg-[#0a0a0c] overflow-hidden">
        
        {/* Left Sidebar - Controls */}
        <div className="w-96 flex-shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col h-full overflow-y-auto">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              AI Canvas
            </h1>
            <p className="text-slate-400 text-sm">Generate and deeply customize poster typography.</p>
          </div>

          <div className="p-6 space-y-8">
            {/* AI Generator Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> AI Theme Generator
              </h3>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Describe the movie theme</label>
                <textarea 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-24 resize-none"
                  placeholder="e.g. A gritty action thriller set in Mumbai..."
                />
              </div>
              <button 
                onClick={generateContent}
                disabled={isGenerating || !theme.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-2.5 rounded-md transition-all flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? 'Generating...' : 'Generate Content'}
              </button>
            </div>

            <hr className="border-slate-800" />

            {/* Typography Controls */}
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Type className="w-4 h-4" /> Typography
              </h3>
              
              <div>
                <label className="block text-xs text-slate-500 mb-1">Font Family</label>
                <select 
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-white"
                >
                  <option value="Inter">Inter (Clean & Modern)</option>
                  <option value="Cinzel">Cinzel (Cinematic & Epic)</option>
                  <option value="Playfair Display">Playfair (Elegant & Dramatic)</option>
                  <option value="Montserrat">Montserrat (Bold & Geometric)</option>
                  <option value="Bebas Neue">Bebas Neue (Impactful & Tall)</option>
                </select>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Title Size</span>
                    <span>{titleSize}px</span>
                  </label>
                  <input 
                    type="range" min="32" max="120" 
                    value={titleSize} onChange={(e) => setTitleSize(parseInt(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Edit Title Text</label>
                  <input 
                    type="text" value={posterTitle} onChange={(e) => setPosterTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Tagline Size</span>
                    <span>{taglineSize}px</span>
                  </label>
                  <input 
                    type="range" min="12" max="48" 
                    value={taglineSize} onChange={(e) => setTaglineSize(parseInt(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Edit Tagline Text</label>
                  <input 
                    type="text" value={posterTagline} onChange={(e) => setPosterTagline(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-sm text-white"
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Colors */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4 h-4" /> Colors
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Title Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={titleColor} onChange={(e) => setTitleColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-slate-900 border border-slate-700 p-0.5" />
                    <span className="text-xs text-slate-400 uppercase">{titleColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tagline Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={taglineColor} onChange={(e) => setTaglineColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-slate-900 border border-slate-700 p-0.5" />
                    <span className="text-xs text-slate-400 uppercase">{taglineColor}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs text-slate-500 mb-2">Background Gradient</label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input type="color" value={bgColor1} onChange={(e) => setBgColor1(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-slate-900 border border-slate-700 p-0.5" />
                  </div>
                  <span className="text-slate-600">→</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={bgColor2} onChange={(e) => setBgColor2(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-slate-900 border border-slate-700 p-0.5" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Side - Canvas Preview */}
        <div className="flex-1 bg-black p-8 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-slate-300">Live Preview</h2>
            <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-md transition-colors text-sm">
              <Download className="w-4 h-4" /> Download HD
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden bg-[url('https://transparenttextures.com/patterns/cubes.png')] relative">
            
            {/* The Poster Aspect Ratio Container */}
            <div 
              className="relative w-[400px] h-[600px] shadow-2xl rounded-sm overflow-hidden flex flex-col justify-end p-10 text-center transition-all duration-500"
              style={{
                background: `linear-gradient(to bottom, ${bgColor1}, ${bgColor2})`,
                fontFamily: `'${fontFamily}', sans-serif`
              }}
            >
              {/* Decorative elements */}
              <div className="absolute top-8 left-0 right-0 flex justify-center opacity-30">
                <div className="w-32 h-[1px] bg-white"></div>
              </div>
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>

              {/* Poster Content */}
              <div className="relative z-10 flex flex-col items-center justify-center transform transition-all">
                <h1 
                  className="font-bold tracking-tight leading-none uppercase mb-4"
                  style={{ 
                    fontSize: `${titleSize}px`, 
                    color: titleColor,
                    textShadow: `0 4px 24px ${titleColor}40`
                  }}
                >
                  {posterTitle}
                </h1>
                
                <p 
                  className="font-medium tracking-wide leading-snug max-w-[90%]"
                  style={{ 
                    fontSize: `${taglineSize}px`, 
                    color: taglineColor 
                  }}
                >
                  {posterTagline}
                </p>

                <div className="mt-8 pt-6 border-t border-white/20 w-3/4">
                  <p className="text-[10px] tracking-[0.3em] uppercase text-white/60">
                    {posterRelease}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </SidebarLayout>
  );
}
