'use client';
import React from 'react';
import { WorldFacets, WorldFilter, WorldLanguage, countryName, langName } from '@/lib/world';

const field = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white min-w-0';

/** Language, country, genre, years, rating, votes, where-to-watch, sort. Facet lists show what's in the database. */
export function WorldFilters({ filter, onChange, facets, compact, showStatus, languages }: { filter: WorldFilter; onChange: (f: WorldFilter) => void; facets: WorldFacets | null; compact?: boolean; showStatus?: boolean; languages?: WorldLanguage[] | null }) {
  const set = (patch: Partial<WorldFilter>) => onChange({ ...filter, ...patch });
  const sel = (key: keyof WorldFilter, label: string, options: Array<{ value: string; label: string }>) => (
    <select value={filter[key] || ''} onChange={e => set({ [key]: e.target.value || undefined })} className={field} title={label}>
      <option value="">{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      {/* a value set elsewhere (preset, link) that isn't in the list is still shown — never a silent hidden filter */}
      {filter[key] && !options.some(o => o.value === filter[key]) && <option value={filter[key]}>{label.replace(/^Any /, '')}: {String(filter[key])}</option>}
    </select>
  );
  const top = (list: WorldFacets['languages'] | undefined, max: number) => (list || []).slice(0, max);
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4 xl:grid-cols-6'}`}>
      {!compact && (
        <input value={filter.q || ''} onChange={e => set({ q: e.target.value || undefined })} placeholder="Search title…" className={`${field} col-span-2`} />
      )}
      {sel('language', 'Any language', languageOptions(filter.kind, facets, languages))}
      {sel('country', 'Any country', top(facets?.countries, 80).map(f => ({ value: f.value, label: `${countryName(f.value)} (${f.n})` })))}
      {sel('genre', 'Any genre', top(facets?.genres, 40).map(f => ({ value: f.value, label: `${f.value} (${f.n})` })))}
      {sel('provider', 'Anywhere (India)', top(facets?.providers, 30).map(f => ({ value: f.value, label: `${f.value} (${f.n})` })))}
      <div className="flex gap-1">
        <input value={filter.yearFrom || ''} onChange={e => set({ yearFrom: e.target.value || undefined })} placeholder="Year from" inputMode="numeric" className={`${field} w-full`} />
        <input value={filter.yearTo || ''} onChange={e => set({ yearTo: e.target.value || undefined })} placeholder="to" inputMode="numeric" className={`${field} w-full`} />
      </div>
      {sel('minRating', 'Any rating', ['8.5', '8', '7.5', '7', '6.5', '6'].map(v => ({ value: v, label: `★ ${v}+` })))}
      {sel('minVotes', 'Any no. of votes', ['100', '500', '1000', '5000', '25000', '100000'].map(v => ({ value: v, label: `${Number(v).toLocaleString('en-IN')}+ votes` })))}
      <select value={filter.sort || 'score'} onChange={e => set({ sort: e.target.value })} className={field} title="Sort">
        <option value="score">Best rated (weighted by votes)</option>
        <option value="raw">Highest average (any votes)</option>
        <option value="popular">Trending now</option>
        <option value="votes">Most voted (popular)</option>
        <option value="year">Newest year</option>
        <option value="title">Title A–Z</option>
        <option value="newest">Recently added</option>
      </select>
      {showStatus && (
        <select value={filter.status || ''} onChange={e => set({ status: e.target.value || undefined })} className={field} title="Approval">
          <option value="">Approved + to review</option>
          <option value="APPROVED">✅ Approved only</option>
          <option value="PENDING">🕓 To review only</option>
          <option value="REJECTED">Rejected</option>
        </select>
      )}
      <label className="flex items-center gap-1.5 text-xs text-slate-300" title="Only titles you can stream free (with ads) in India — JustWatch data via TMDB">
        <input type="checkbox" checked={filter.freeIn === 'true'} onChange={e => set({ freeIn: e.target.checked ? 'true' : undefined })} /> Free in India
      </label>
      {filter.kind === 'movie' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
          <label className="flex items-center gap-1.5" title="Hides TV episodes & specials, TV movies, mini-series, shorts and stand-up / concert videos (IMDb's own title type)">
            <input type="checkbox" checked={filter.featureOnly !== 'false'} onChange={e => set({ featureOnly: e.target.checked ? undefined : 'false' })} /> Feature films only
          </label>
          <label className="flex items-center gap-1.5" title="Documentaries still show when you pick the Documentary genre">
            <input type="checkbox" checked={filter.noDocs !== 'false'} onChange={e => set({ noDocs: e.target.checked ? undefined : 'false' })} /> No documentaries
          </label>
        </div>
      )}
      {filter.kind === 'tv' && (
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input type="checkbox" checked={filter.scriptedOnly !== 'false'} onChange={e => set({ scriptedOnly: e.target.checked ? undefined : 'false' })} /> Scripted only
        </label>
      )}
    </div>
  );
}

/** Every language TMDB knows (with how many we hold for this tab), else just the ones in the database. */
function languageOptions(kind: WorldFilter['kind'], facets: WorldFacets | null, languages?: WorldLanguage[] | null) {
  if (languages?.length) {
    const count = (l: WorldLanguage) => (kind === 'tv' ? l.tv : kind === 'movie' ? l.movie : l.movie + l.tv);
    return [...languages]
      .sort((a, b) => count(b) - count(a) || a.name.localeCompare(b.name))
      .map(l => ({ value: l.code, label: `${langName(l.code) || l.name}${l.native && l.native !== l.name ? ` · ${l.native}` : ''} (${count(l).toLocaleString('en-IN')})` }));
  }
  return (facets?.languages || []).map(f => ({ value: f.value, label: `${langName(f.value)} (${f.n})` }));
}
