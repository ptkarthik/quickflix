'use client';
/* eslint-disable @next/next/no-img-element -- slides are rasterised by html-to-image; next/image would break export */
import React from 'react';
import { OttRelease, displayTitle, fmtDate, languageLabel, platformStyle, posterUrl, proxied, proxiedPoster } from '@/lib/ott';
import { PostLook, defaultLook, SlideAdjust } from '@/lib/postLook';
import { LookContent, LookFrame } from './PostLayout';
import { metaBits } from '@/lib/postMeta';
import type { PostItem } from '@/lib/postDomain';
import { PostTheme, THEME_PRESETS, frameBackground, textureLayers, titleStyle } from '@/lib/themes';

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;

export interface SlideBrand {
  handle: string;
  accent: string; // hex
}

/** No theme given → the original look (brand preset with your accent colour). */
export const brandTheme = (brand: SlideBrand): PostTheme => ({ ...THEME_PRESETS[0], accent: brand.accent });

const frameStyle = (t: PostTheme): React.CSSProperties => ({
  width: SLIDE_W,
  height: SLIDE_H,
  position: 'relative',
  overflow: 'hidden',
  background: frameBackground(t),
  color: t.text,
  fontFamily: t.bodyFont,
});

/** Texture overlays (grain, light leaks, …) — drawn above the picture, below the text. */
export function Texture({ theme }: { theme: PostTheme }) {
  return (
    <>
      {textureLayers(theme).map((s, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...s }} />
      ))}
    </>
  );
}

function Footer({ brand, page, theme }: { brand: SlideBrand; page?: string; theme: PostTheme }) {
  return (
    <div style={{ position: 'absolute', left: 64, right: 64, bottom: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 30, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: theme.bodyFont }}>
      <span>{brand.handle}</span>
      {page && <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{page}</span>}
    </div>
  );
}

export function PlatformPill({ platform, size = 34 }: { platform?: string | null; size?: number }) {
  const s = platformStyle(platform);
  return (
    <span style={{ background: s.bg, color: s.fg, padding: `${size * 0.35}px ${size * 0.8}px`, borderRadius: 999, fontSize: size, fontWeight: 800, letterSpacing: 0.5, lineHeight: 1, display: 'inline-block', border: '2px solid rgba(255,255,255,0.18)', fontFamily: 'var(--font-geist-sans), "Segoe UI", sans-serif' }}>
      {platform || 'Platform TBA'}
    </span>
  );
}

/** Ticket-style label for cinema posts. Drawn (not an emoji) so it exports identically everywhere. */
export function TicketBadge({ text, accent, size = 32 }: { text: string; accent: string; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.4, background: '#111', color: accent, padding: `${size * 0.36}px ${size * 0.8}px`, borderRadius: 12, fontSize: size, fontWeight: 900, border: `3px dashed ${accent}`, letterSpacing: 2, lineHeight: 1, fontFamily: 'var(--font-geist-sans), "Segoe UI", sans-serif' }}>
      <svg width={size * 1.15} height={size * 0.8} viewBox="0 0 46 32" fill="none" aria-hidden>
        <path d="M3 3h40v8a5 5 0 0 0 0 10v8H3v-8a5 5 0 0 0 0-10V3z" fill={accent} />
        <path d="M30 6v20" stroke="#111" strokeWidth="2.5" strokeDasharray="3 3" />
      </svg>
      {text}
    </span>
  );
}

/** A one-liner over the bottom of a picture (dark fade so it stays readable on any poster). */
export function OneLinerBand({ text, theme, size = 30 }: { text: string; theme: PostTheme; size?: number }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: `${size * 2.4}px ${size * 0.9}px ${size * 0.9}px`, background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 45%, rgba(0,0,0,0.92) 100%)', textAlign: 'center' }}>
      <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.25, color: '#fff', fontFamily: theme.bodyFont, textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
        <span style={{ color: theme.accent, fontSize: size * 1.3, lineHeight: 0 }}>“</span>{text}<span style={{ color: theme.accent, fontSize: size * 1.3, lineHeight: 0 }}>”</span>
      </div>
    </div>
  );
}

/** "★ IMDb 8.4" — the rating always carries its source. */
export function RatingPill({ text, accent, size = 34 }: { text: string; accent: string; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: `${size * 0.35}px ${size * 0.7}px`, borderRadius: 999, fontSize: size, fontWeight: 800, lineHeight: 1, border: `2px solid ${accent}`, fontFamily: 'var(--font-geist-sans), "Segoe UI", sans-serif' }}>
      <span style={{ color: accent }}>★</span>{text}
    </span>
  );
}

// ───────────────────────── cover ─────────────────────────

export function CoverSlide({
  kicker, heading, subheading, items, brand, total, theme, swipe = true,
}: {
  /** "Swipe for all N →" — carousel only (hidden in Reels) */
  swipe?: boolean;
  kicker: string;
  heading: string;
  subheading: string;
  items: OttRelease[];
  brand: SlideBrand;
  total: number;
  theme?: PostTheme;
}) {
  const t = theme ?? brandTheme(brand);
  const posters = items.map(i => proxiedPoster(i.posterPath, 'w500')).filter(Boolean).slice(0, 6) as string[];
  return (
    <div style={frameStyle(t)}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 675, transform: 'rotate(-8deg) scale(1.25)', opacity: 0.55 }}>
        {posters.length > 0
          ? Array.from({ length: 9 }).map((_, i) => <img key={i} src={posters[i % posters.length]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: t.imageFilter }} />)
          : null}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.bg[1]}59 0%, ${t.bg[1]}bf 45%, ${t.bg[1]} 78%)` }} />
      <Texture theme={t} />
      <div style={{ position: 'absolute', left: 64, right: 64, bottom: 180 }}>
        <div style={{ display: 'inline-block', background: t.accent, color: '#000', fontWeight: 900, fontSize: 34, padding: '10px 22px', borderRadius: 10, letterSpacing: 2, textTransform: 'uppercase', fontFamily: t.bodyFont }}>
          {kicker}
        </div>
        <div style={{ ...titleStyle(t, 128), lineHeight: 0.95, marginTop: 28, textTransform: 'uppercase' }}>{heading}</div>
        <div style={{ fontSize: 46, fontWeight: 600, marginTop: 28, color: 'rgba(255,255,255,0.85)' }}>{subheading}</div>
        {swipe && <div style={{ fontSize: 32, fontWeight: 600, marginTop: 36, color: t.accent }}>Swipe for all {total} →</div>}
      </div>
      <Footer brand={brand} theme={t} />
    </div>
  );
}

// ───────────────────────── one title ─────────────────────────

export function TitleSlide({
  item, brand, page, rank, note, theme, dateLine, badge, prevDateLine, metaLine, ratingText, oneLiner, ratingChips, look, layout = 'card', adjust,
}: {
  /** per-slide fine-tuning */
  adjust?: SlideAdjust;
  /** How the picture sits on the slide: poster card (default), fill the slide, or fit the whole picture. */
  layout?: 'card' | 'full' | 'fit';
  item: OttRelease;
  brand: SlideBrand;
  page: string;
  rank?: number;
  note?: string;
  theme?: PostTheme;
  /** Override the date line (cinema: "In cinemas Fri, 13 Nov"). */
  dateLine?: string;
  /** Ticket-style label instead of the platform pill (cinema: "IN CINEMAS"). */
  badge?: string;
  /** Old date shown struck through (postponement posts). */
  prevDateLine?: string;
  /** Replaces the "Tamil • Movie" line (cinema: languages, certificate, runtime). */
  metaLine?: string;
  /** World suggestions: "IMDb 8.4" pill (with its source); the platform pill shows only when known. */
  ratingText?: string;
  /** Your one-liner. */
  oneLiner?: string | null;
  /** Ratings you chose to show ("IMDb 8.5", "RT 99%", …) — replace the single rating pill. */
  ratingChips?: string[];
  /** What's drawn and where (your layout); standard layout when not given. */
  look?: PostLook;
}) {
  const t = theme ?? brandTheme(brand);
  const meta = metaLine ?? [languageLabel(item.language), item.contentType === 'tv' ? (item.seasonNumber && item.seasonNumber > 1 ? `Series • S${item.seasonNumber}` : 'Series') : 'Movie']
    .filter(Boolean)
    .join('  •  ');
  const showPill = ratingText !== undefined ? !!item.platform : item.platform !== undefined && !dateLine;
  const content: LookContent = {
    title: displayTitle(item),
    badge: badge ? size => <TicketBadge text={badge} accent={t.accent} size={size} /> : showPill ? size => <PlatformPill platform={item.platform} size={size} /> : undefined,
    // numbered picks and World lists carry no date (old titles' dates would read like new releases)
    date: dateLine || (rank === undefined && ratingText === undefined ? fmtDate(item.releaseDate, { weekday: 'short', day: 'numeric', month: 'short' }) : undefined),
    prevDate: rank === undefined ? prevDateLine : undefined,
    meta,
    metaBits: metaLine ? undefined : metaBits(item as PostItem),
    chips: ratingChips?.length ? ratingChips : ratingText ? [ratingText] : [],
    stars: item.myRating,
    review: item.myReview || undefined,
    note,
    oneLiner,
  };
  return (
    <LookFrame look={look ?? defaultLook('slide')} theme={t} content={content} picture={{ src: posterUrl(item.posterPath, 'w780') }} layout={layout} adjust={adjust} brand={brand} page={page} rank={rank} darken={12} />
  );
}

// ───────────────────────── outro ─────────────────────────

export function OutroSlide({ brand, line, theme }: { brand: SlideBrand; line: string; theme?: PostTheme }) {
  const t = theme ?? brandTheme(brand);
  return (
    <div style={{ ...frameStyle(t), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: `radial-gradient(circle at 50% 35%, ${t.accent}40, ${t.bg[1]} 65%)` }}>
      <Texture theme={t} />
      <div style={{ ...titleStyle(t, 92), padding: '0 80px', position: 'relative' }}>{line}</div>
      <div style={{ marginTop: 48, display: 'flex', gap: 28, fontSize: 40, fontWeight: 700, position: 'relative' }}>
        <span>❤️ Like</span><span>💬 Comment</span><span>📌 Save</span>
      </div>
      <div style={{ marginTop: 70, fontSize: 56, fontWeight: 900, color: t.accent, position: 'relative', fontFamily: t.titleFont }}>Follow {brand.handle}</div>
    </div>
  );
}

// ───────────────────────── your own picture (upload, AI poster, editor post) ─────────────────────────

export function ImageSlide({
  src, fit, text, brand, page, bare, theme,
}: {
  src: string;
  fit: 'cover' | 'contain';
  text?: string;
  brand: SlideBrand;
  page?: string;
  /** A finished design (e.g. from the editor): show it exactly, no handle/page overlay. */
  bare?: boolean;
  theme?: PostTheme;
}) {
  const t = theme ?? brandTheme(brand);
  const url = proxied(src) || '';
  return (
    <div style={frameStyle(t)}>
      {fit === 'contain' && <img src={url} alt="" style={{ position: 'absolute', inset: -60, width: SLIDE_W + 120, height: SLIDE_H + 120, objectFit: 'cover', filter: 'blur(40px) brightness(0.45)' }} />}
      <img src={url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit }} />
      {text && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 55%, ${t.bg[1]}eb 90%)` }} />
          <div style={{ ...titleStyle(t, 56), position: 'absolute', left: 64, right: 64, bottom: bare ? 70 : 120, lineHeight: 1.08, textAlign: 'center' }}>{text}</div>
        </>
      )}
      {!bare && <Footer brand={brand} page={page} theme={t} />}
    </div>
  );
}
