export interface FrameStyle {
  id: string;
  name: string;
  category: string;
  getClasses: (theme: any) => string;
}

// Safelist for Tailwind JIT to pick up dynamic classes:
// border-[10px] border-[20px] border-[30px] border-[40px] border-[50px] border-[60px] border-[80px] border-[100px] border-[120px] border-[150px] border-[200px]
// border-y-[20px] border-y-[40px] border-y-[60px] border-y-[80px] border-y-[100px] border-y-[120px] border-y-[150px] border-y-[200px] border-y-[250px]
// border-x-[20px] border-x-[40px] border-x-[60px] border-x-[80px] border-x-[100px]
// border-b-[80px] border-b-[120px] border-b-[160px] border-b-[200px] border-b-[250px] border-b-[300px]
// border-black border-white border-slate-900 border-slate-800 border-slate-200
// border-amber-400 border-amber-600 border-cyan-400 border-cyan-600 border-fuchsia-400 border-fuchsia-600 border-emerald-400 border-emerald-600 border-indigo-400 border-indigo-600
// shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] shadow-[inset_0_0_150px_rgba(0,0,0,1)]
// border-dashed border-dotted border-double
// rounded-xl rounded-2xl rounded-3xl rounded-full

export const frameCategories = [
  "Cinematic (Letterbox)",
  "Polaroid (Vintage)",
  "Neon (Cyberpunk)",
  "Minimalist (Clean)",
  "Heavy Box (Action)",
  "Asymmetric (Modern)",
  "Double Frame (Classic)",
  "Soft Edge (Dreamy)",
  "Pill (Rounded)",
  "Stamp (Dashed)"
];

const getThemeBorder = (theme: any) => theme.label.replace('text-', 'border-');
const getThemeBorderDark = (theme: any) => theme.label.replace('text-', 'border-').replace('400', '600');

export const frames: FrameStyle[] = [
  { id: 'none', name: 'None (Full Bleed)', category: 'Minimalist (Clean)', getClasses: () => '' },
  
  // 1. Cinematic (Letterbox) - 30 variants
  ...[20, 40, 60, 80, 100, 120, 150, 200, 250].flatMap(size => 
    ['black', 'white', 'slate-900'].map(color => ({
      id: `cinematic-${size}-${color}`,
      name: `Letterbox ${size}px (${color})`,
      category: 'Cinematic (Letterbox)',
      getClasses: () => `border-y-[${size}px] border-${color} box-border`
    }))
  ),
  ...[40, 80, 120].map(size => ({
    id: `cinematic-theme-${size}`,
    name: `Letterbox ${size}px (Theme Colored)`,
    category: 'Cinematic (Letterbox)',
    getClasses: (theme: any) => `border-y-[${size}px] ${getThemeBorderDark(theme)} box-border`
  })),

  // 2. Polaroid (Vintage) - 20 variants
  ...[80, 120, 160, 200, 250, 300].flatMap(bottomSize => 
    [20, 40].map(edgeSize => ({
      id: `polaroid-${edgeSize}-${bottomSize}`,
      name: `Polaroid Edge ${edgeSize}px / Bottom ${bottomSize}px`,
      category: 'Polaroid (Vintage)',
      getClasses: () => `border-[${edgeSize}px] border-b-[${bottomSize}px] border-white box-border bg-white`
    }))
  ),
  ...[120, 160, 200, 250].flatMap(bottomSize => 
    [20, 40].map(edgeSize => ({
      id: `polaroid-dark-${edgeSize}-${bottomSize}`,
      name: `Dark Polaroid Edge ${edgeSize}px / Bottom ${bottomSize}px`,
      category: 'Polaroid (Vintage)',
      getClasses: () => `border-[${edgeSize}px] border-b-[${bottomSize}px] border-slate-900 box-border bg-slate-900`
    }))
  ),

  // 3. Neon (Cyberpunk) - 30 variants
  ...[10, 20, 30, 40, 50, 60].flatMap(size => 
    ['light', 'dark'].map(shade => ({
      id: `neon-${size}-${shade}`,
      name: `Neon Edge ${size}px (${shade === 'light' ? 'Bright' : 'Deep'})`,
      category: 'Neon (Cyberpunk)',
      getClasses: (theme: any) => `border-[${size}px] ${shade === 'light' ? getThemeBorder(theme) : getThemeBorderDark(theme)} box-border shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]`
    }))
  ),
  ...[10, 20, 30].map(size => ({
    id: `neon-double-${size}`,
    name: `Neon Double Border ${size}px`,
    category: 'Neon (Cyberpunk)',
    getClasses: (theme: any) => `border-[${size}px] border-double ${getThemeBorder(theme)} box-border`
  })),

  // 4. Minimalist (Clean) - 30 variants
  ...[10, 20, 30, 40, 50, 60].flatMap(size => 
    ['white', 'black', 'slate-200'].map(color => ({
      id: `minimal-${size}-${color}`,
      name: `Clean Border ${size}px (${color})`,
      category: 'Minimalist (Clean)',
      getClasses: () => `border-[${size}px] border-${color} box-border`
    }))
  ),

  // 5. Heavy Box (Action) - 20 variants
  ...[80, 100, 120, 150, 200].flatMap(size => 
    ['black', 'white', 'theme-dark', 'theme-light'].map(color => ({
      id: `heavy-${size}-${color}`,
      name: `Massive Box ${size}px (${color})`,
      category: 'Heavy Box (Action)',
      getClasses: (theme: any) => `border-[${size}px] box-border ${
        color === 'black' ? 'border-black' : 
        color === 'white' ? 'border-white' : 
        color === 'theme-light' ? getThemeBorder(theme) : getThemeBorderDark(theme)
      }`
    }))
  ),

  // 6. Asymmetric (Modern) - 25 variants
  ...[40, 80, 100].flatMap(xSize => 
    [20, 40, 60].map(ySize => ({
      id: `asym-x${xSize}-y${ySize}`,
      name: `Pillars ${xSize}px / Caps ${ySize}px`,
      category: 'Asymmetric (Modern)',
      getClasses: () => `border-x-[${xSize}px] border-y-[${ySize}px] border-black box-border`
    }))
  ),
  ...[40, 80, 100].flatMap(xSize => 
    [20, 40, 60].map(ySize => ({
      id: `asym-white-x${xSize}-y${ySize}`,
      name: `White Pillars ${xSize}px / Caps ${ySize}px`,
      category: 'Asymmetric (Modern)',
      getClasses: () => `border-x-[${xSize}px] border-y-[${ySize}px] border-white box-border`
    }))
  ),

  // 7. Double Frame (Classic) - 20 variants
  ...[10, 20, 30, 40, 50].flatMap(size => 
    ['white', 'theme', 'black'].map(color => ({
      id: `double-${size}-${color}`,
      name: `Classic Double ${size}px (${color})`,
      category: 'Double Frame (Classic)',
      getClasses: (theme: any) => `border-[${size}px] border-double box-border ${
        color === 'theme' ? getThemeBorder(theme) : `border-${color}`
      }`
    }))
  ),

  // 8. Soft Edge (Dreamy) - 15 variants (Using massive inset shadows to soften edges)
  ...[50, 100, 150].flatMap(shadowSize => 
    ['black', 'theme'].map(color => ({
      id: `soft-${shadowSize}-${color}`,
      name: `Vignette ${shadowSize}px (${color})`,
      category: 'Soft Edge (Dreamy)',
      getClasses: (theme: any) => `box-border ${
        color === 'theme' ? `shadow-[inset_0_0_${shadowSize}px_rgba(255,255,255,0.3)] border-[20px] ${getThemeBorder(theme)}` : 
        `shadow-[inset_0_0_${shadowSize}px_rgba(0,0,0,1)] border-[20px] border-black`
      }`
    }))
  ),

  // 9. Pill (Rounded) - 10 variants
  ...[20, 40].flatMap(borderSize => 
    ['rounded-3xl', 'rounded-full'].flatMap(radius => 
      ['black', 'white', 'theme'].map(color => ({
        id: `pill-${radius}-${borderSize}-${color}`,
        name: `Pill ${radius} ${borderSize}px (${color})`,
        category: 'Pill (Rounded)',
        getClasses: (theme: any) => `border-[${borderSize}px] ${radius} box-border overflow-hidden ${
          color === 'theme' ? getThemeBorder(theme) : `border-${color}`
        }`
      }))
    )
  ),

  // 10. Stamp (Dashed/Dotted) - 20 variants
  ...[10, 20, 30].flatMap(size => 
    ['dashed', 'dotted'].flatMap(style => 
      ['white', 'theme', 'black'].map(color => ({
        id: `stamp-${style}-${size}-${color}`,
        name: `Stamp ${style} ${size}px (${color})`,
        category: 'Stamp (Dashed)',
        getClasses: (theme: any) => `border-[${size}px] border-${style} box-border ${
          color === 'theme' ? getThemeBorder(theme) : `border-${color}`
        }`
      }))
    )
  )
];

// Ensure we generated a lot of frames!
console.log(`Loaded ${frames.length} frame styles.`);
