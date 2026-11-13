import {
  Abril_Fatface, Alfa_Slab_One, Anton, Archivo_Black, Bebas_Neue, Black_Ops_One, Bungee, Cinzel, Creepster, Dancing_Script, Monoton, Orbitron, Oswald, Pacifico,
  Noto_Sans_Tamil, Permanent_Marker, Playfair_Display, Poppins, Righteous, Russo_One, Special_Elite, Teko,
} from 'next/font/google';

/**
 * Poster fonts for the theme engine. Self-hosted by Next (same origin), so html-to-image can embed them
 * into exported JPEGs. Each exposes a CSS variable used by lib/themes.ts.
 */
export const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton', display: 'swap' });
export const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas', display: 'swap' });
export const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald', display: 'swap' });
export const playfair = Playfair_Display({ subsets: ['latin'], weight: ['700', '900'], style: ['normal', 'italic'], variable: '--font-playfair', display: 'swap' });
export const cinzel = Cinzel({ subsets: ['latin'], weight: ['700', '900'], variable: '--font-cinzel', display: 'swap' });
export const creepster = Creepster({ weight: '400', subsets: ['latin'], variable: '--font-creepster', display: 'swap' });
export const orbitron = Orbitron({ subsets: ['latin'], weight: ['700', '900'], variable: '--font-orbitron', display: 'swap' });
export const poppins = Poppins({ subsets: ['latin'], weight: ['600', '800', '900'], variable: '--font-poppins', display: 'swap' });
export const righteous = Righteous({ weight: '400', subsets: ['latin'], variable: '--font-righteous', display: 'swap' });

// Theme library fonts (more variety: slab, neon, stencil, script, marker, typewriter, sport …)
export const abril = Abril_Fatface({ weight: '400', subsets: ['latin'], variable: '--font-abril', display: 'swap' });
export const alfaslab = Alfa_Slab_One({ weight: '400', subsets: ['latin'], variable: '--font-alfaslab', display: 'swap' });
export const bungee = Bungee({ weight: '400', subsets: ['latin'], variable: '--font-bungee', display: 'swap' });
export const blackops = Black_Ops_One({ weight: '400', subsets: ['latin'], variable: '--font-blackops', display: 'swap' });
export const monoton = Monoton({ weight: '400', subsets: ['latin'], variable: '--font-monoton', display: 'swap' });
export const pacifico = Pacifico({ weight: '400', subsets: ['latin'], variable: '--font-pacifico', display: 'swap' });
export const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], variable: '--font-marker', display: 'swap' });
export const typewriter = Special_Elite({ weight: '400', subsets: ['latin'], variable: '--font-typewriter', display: 'swap' });
export const teko = Teko({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-teko', display: 'swap' });
export const russo = Russo_One({ weight: '400', subsets: ['latin'], variable: '--font-russo', display: 'swap' });
export const archivo = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-archivo', display: 'swap' });
export const dancing = Dancing_Script({ subsets: ['latin'], weight: ['700'], variable: '--font-dancing', display: 'swap' });

// Tamil script for news / Tamil posts (Latin fonts above don't have Tamil letters)
export const tamil = Noto_Sans_Tamil({ subsets: ['tamil'], weight: ['500', '700', '900'], variable: '--font-tamil', display: 'swap' });

export const posterFontVariables = [
  anton, bebas, oswald, playfair, cinzel, creepster, orbitron, poppins, righteous,
  abril, alfaslab, bungee, blackops, monoton, pacifico, marker, typewriter, teko, russo, archivo, dancing, tamil,
].map(f => f.variable).join(' ');
