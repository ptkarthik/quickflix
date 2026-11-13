import { scriptJson } from './watch.util';

export interface SiteBrand {
  name: string;
  tagline: string;
  handle: string;
  accent: string;
  instagram?: string;
  youtube?: string;
  facebook?: string;
}

export interface SiteTitle {
  id: string;
  kind: 'movie' | 'tv';
  title: string;
  year: number | null;
  language: string;
  genres: string[];
  overview: string;
  poster: string | null;
  backdrop: string | null;
  rating: string | null;
  length: string;
  oneLiner: string | null;
  free: string[];
  stream: string[];
  watchUrl: string;
  trailer: string | null;
}

export interface SiteVideo {
  id: string;
  source: 'youtube' | 'archive';
  title: string;
  channel: string;
  year: number | null;
  minutes: number | null;
  thumb: string | null;
  description: string;
  language: string | null;
  embeddable: boolean;
}

export interface SiteData {
  brand: SiteBrand;
  generatedAt: string;
  free: SiteTitle[];
  trailers: SiteTitle[];
  youtube: SiteVideo[];
  classics: SiteVideo[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const safeColor = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#FACC15');

/**
 * The client site: one self-contained HTML file (data inline). We host no video — trailers & full movies play from
 * YouTube's own player (official uploads) or the Internet Archive's player (public domain); OTT titles link to the
 * official service via TMDB's "where to watch" page.
 */
export function renderSite(d: SiteData): string {
  const b = d.brand;
  const accent = safeColor(b.accent);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.name)} — watch free, legally</title>
<meta name="description" content="${esc(b.tagline)}">
<style>
:root{--accent:${accent};--bg:#0b0b0f;--card:#15151c;--line:#26262f;--text:#ececf1;--muted:#9a9aa8}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:inherit}
header{position:sticky;top:0;z-index:20;background:rgba(11,11,15,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.wrap{max-width:1280px;margin:0 auto;padding:0 16px}
.bar{display:flex;align-items:center;gap:14px;padding:12px 0;flex-wrap:wrap}
.logo{font-weight:900;font-size:22px;letter-spacing:.5px}.logo span{color:var(--accent)}
.search{flex:1;min-width:180px}.search input{width:100%;background:#111118;border:1px solid var(--line);border-radius:999px;color:var(--text);padding:9px 16px;font-size:14px}
.tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:10px}
.tab{white-space:nowrap;border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:999px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer}
.tab.on{background:var(--accent);border-color:var(--accent);color:#000}
.hero{padding:28px 0 8px}.hero h1{margin:0 0 6px;font-size:clamp(24px,4vw,40px)}.hero p{margin:0;color:var(--muted)}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
.filters select{background:#111118;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;padding-bottom:40px}
.grid.wide{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .15s,border-color .15s;text-align:left;color:inherit;padding:0;font:inherit}
.card:hover{transform:translateY(-3px);border-color:var(--accent)}
.card .img{position:relative;aspect-ratio:2/3;background:#1e1e26}.grid.wide .card .img{aspect-ratio:16/9}
.card img{width:100%;height:100%;object-fit:cover;display:block}
.badge{position:absolute;left:8px;top:8px;background:var(--accent);color:#000;font-size:11px;font-weight:800;border-radius:6px;padding:3px 7px}
.rate{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.8);color:#fde047;font-size:11px;font-weight:800;border-radius:6px;padding:3px 7px}
.dur{position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.8);font-size:11px;border-radius:6px;padding:3px 7px}
.card .t{padding:9px 10px 2px;font-weight:700;font-size:14px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card .s{padding:0 10px 10px;color:var(--muted);font-size:12px}
.empty{color:var(--muted);padding:40px 0;text-align:center}
.modal{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.85);display:none;align-items:flex-start;justify-content:center;padding:24px 12px;overflow-y:auto}
.modal.open{display:flex}
.box{background:#121218;border:1px solid var(--line);border-radius:16px;max-width:980px;width:100%;overflow:hidden}
.player{position:relative;aspect-ratio:16/9;background:#000}.player iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.player img{width:100%;height:100%;object-fit:cover;opacity:.5}
.info{padding:18px 20px 22px}.info h2{margin:0 0 4px;font-size:24px}.meta{color:var(--muted);font-size:13px;margin-bottom:12px}
.quote{border-left:3px solid var(--accent);padding-left:12px;font-style:italic;margin:10px 0}
.btns{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.btn{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:9px 16px;font-weight:700;font-size:14px;text-decoration:none;border:0;cursor:pointer}
.btn.main{background:var(--accent);color:#000}.btn.alt{background:#23232d;color:var(--text)}
.close{position:absolute;right:10px;top:10px;z-index:2;background:rgba(0,0,0,.7);color:#fff;border:0;border-radius:999px;width:36px;height:36px;font-size:20px;cursor:pointer}
.note{color:var(--muted);font-size:12px}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:12px;padding:22px 0 40px;line-height:1.6}
footer a{color:var(--accent)}
</style>
</head>
<body>
<header><div class="wrap">
  <div class="bar"><div class="logo">${esc(b.name).replace(/^(\S+)/, '<span>$1</span>')}</div>
    <div class="search"><input id="q" type="search" placeholder="Search movies & series…" aria-label="Search"></div></div>
  <nav class="tabs" id="tabs"></nav>
</div></header>
<main class="wrap">
  <section class="hero"><h1 id="h1"></h1><p id="sub"></p></section>
  <div class="filters" id="filters"></div>
  <div class="grid" id="grid"></div>
</main>
<div class="modal" id="modal" role="dialog" aria-modal="true"><div class="box" style="position:relative"><button class="close" id="close" aria-label="Close">×</button><div id="mbody"></div></div></div>
<footer><div class="wrap">
  <div><b>${esc(b.name)}</b> — ${esc(b.tagline)}${b.handle ? ` · Follow <b>${esc(b.handle)}</b>` : ''}</div>
  <div id="social"></div>
  <div>We don’t host or upload any video. Full movies play from their official YouTube channels or from the Internet Archive (public domain); “free to stream” titles open the official service (free with ads in India, as listed by JustWatch via TMDB — availability can change). Trailers are the official ones on YouTube.</div>
  <div>This product uses the TMDB API but is not endorsed or certified by TMDB. Updated <span id="upd"></span>.</div>
</div></footer>
<script>window.SITE=${scriptJson(d)};</script>
<script>
(function(){
var S=window.SITE,$=function(i){return document.getElementById(i)};
function e(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var TABS=[
 {k:'free',l:'Free to stream',h:'Free to stream in India',s:'Movies & series you can watch free (with ads) on official apps.'},
 {k:'youtube',l:'Full movies on YouTube',h:'Full movies — free on YouTube',s:'Uploaded by the films’ official channels. Plays right here.'},
 {k:'classics',l:'Classics',h:'Timeless classics',s:'Public-domain films from the Internet Archive.'},
 {k:'trailers',l:'Trailers & where to watch',h:'Trailers & where to watch',s:'Official trailers, ratings and where each title streams.'}
].filter(function(t){return (S[t.k]||[]).length});
var tab=(location.hash||'').slice(1)||(TABS[0]&&TABS[0].k)||'free',lang='',genre='',q='';
function render(){
 $('tabs').innerHTML=TABS.map(function(t){return '<button class="tab'+(t.k===tab?' on':'')+'" data-t="'+t.k+'">'+e(t.l)+' <small>('+S[t.k].length+')</small></button>'}).join('');
 var T=TABS.filter(function(t){return t.k===tab})[0]||TABS[0];
 if(!T){$('h1').textContent='Coming soon';$('grid').innerHTML='';return}
 $('h1').textContent=T.h;$('sub').textContent=T.s;
 var list=S[T.k]||[],isVid=T.k==='youtube'||T.k==='classics';
 var langs={},genres={};list.forEach(function(x){if(x.language)langs[x.language]=1;(x.genres||[]).forEach(function(g){genres[g]=1})});
 $('filters').innerHTML=(Object.keys(langs).length>1?'<select id="fl"><option value="">All languages</option>'+Object.keys(langs).sort().map(function(l){return '<option'+(l===lang?' selected':'')+'>'+e(l)+'</option>'}).join('')+'</select>':'')+
  (Object.keys(genres).length>1?'<select id="fg"><option value="">All genres</option>'+Object.keys(genres).sort().map(function(g){return '<option'+(g===genre?' selected':'')+'>'+e(g)+'</option>'}).join('')+'</select>':'');
 var ql=q.toLowerCase();
 var shown=list.filter(function(x){return (!lang||x.language===lang)&&(!genre||(x.genres||[]).indexOf(genre)>=0)&&(!ql||x.title.toLowerCase().indexOf(ql)>=0)});
 $('grid').className='grid'+(isVid?' wide':'');
 $('grid').innerHTML=shown.length?shown.map(function(x,i){
  if(isVid)return '<button class="card" data-k="'+T.k+'" data-i="'+list.indexOf(x)+'"><div class="img">'+(x.thumb?'<img loading="lazy" src="'+e(x.thumb)+'" alt="">':'')+(x.minutes?'<span class="dur">'+Math.floor(x.minutes/60)+'h '+(x.minutes%60)+'m</span>':'')+'</div><div class="t">'+e(x.title)+'</div><div class="s">'+e([x.channel,x.year].filter(Boolean).join(' · '))+'</div></button>';
  return '<button class="card" data-k="'+T.k+'" data-i="'+list.indexOf(x)+'"><div class="img">'+(x.poster?'<img loading="lazy" src="'+e(x.poster)+'" alt="">':'')+(T.k==='free'&&x.free[0]?'<span class="badge">FREE · '+e(x.free[0])+'</span>':'')+(x.rating?'<span class="rate">★ '+e(x.rating)+'</span>':'')+'</div><div class="t">'+e(x.title)+'</div><div class="s">'+e([x.year,x.language,x.kind==='tv'?'Series':''].filter(Boolean).join(' · '))+'</div></button>';
 }).join(''):'<div class="empty">Nothing matches.</div>';
}
function yt(id){return '<iframe src="https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?rel=0&autoplay=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Video"></iframe>'}
function open(k,i){
 var x=S[k][i],h='';if(!x)return;
 if(k==='youtube'||k==='classics'){
  var player=k==='youtube'?(x.embeddable?yt(x.id):'<img src="'+e(x.thumb)+'" alt="">'):'<iframe src="https://archive.org/embed/'+encodeURIComponent(x.id)+'" allowfullscreen title="Film"></iframe>';
  var link=k==='youtube'?'https://www.youtube.com/watch?v='+encodeURIComponent(x.id):'https://archive.org/details/'+encodeURIComponent(x.id);
  h='<div class="player">'+player+'</div><div class="info"><h2>'+e(x.title)+'</h2><div class="meta">'+e([x.channel,x.year,x.minutes?x.minutes+' min':'',x.language].filter(Boolean).join(' · '))+'</div>'+
   (x.description?'<p class="note">'+e(x.description)+'</p>':'')+'<div class="btns"><a class="btn '+(k==='youtube'&&!x.embeddable?'main':'alt')+'" href="'+link+'" target="_blank" rel="noopener">'+(k==='youtube'?'Watch on YouTube':'Open on Internet Archive')+' ↗</a></div>'+
   '<div class="note">'+(k==='youtube'?'Uploaded by '+e(x.channel)+' (official channel).':'Public domain — free to watch and share.')+'</div></div>';
 }else{
  h='<div class="player">'+(x.trailer?yt(x.trailer):(x.backdrop?'<img src="'+e(x.backdrop)+'" alt="">':''))+'</div><div class="info"><h2>'+e(x.title)+'</h2><div class="meta">'+e([x.year,x.language,(x.genres||[]).join(', '),x.length,x.rating?'★ '+x.rating:''].filter(Boolean).join(' · '))+'</div>'+
   (x.oneLiner?'<div class="quote">“'+e(x.oneLiner)+'”</div>':'')+(x.overview?'<p>'+e(x.overview)+'</p>':'')+
   '<div class="btns">'+(x.free.length?'<a class="btn main" href="'+e(x.watchUrl)+'" target="_blank" rel="noopener">▶ Watch free on '+e(x.free.join(' / '))+' ↗</a>':'')+
   (x.stream.length?'<a class="btn alt" href="'+e(x.watchUrl)+'" target="_blank" rel="noopener">Stream on '+e(x.stream.slice(0,3).join(' / '))+' ↗</a>':'')+
   (!x.free.length&&!x.stream.length?'<a class="btn alt" href="'+e(x.watchUrl)+'" target="_blank" rel="noopener">Where to watch ↗</a>':'')+'</div>'+
   '<div class="note">'+(x.trailer?'Official trailer. ':'')+'Opens the official service’s page (links via JustWatch / TMDB).</div></div>';
 }
 $('mbody').innerHTML=h;$('modal').classList.add('open');document.body.style.overflow='hidden';
}
function close(){$('modal').classList.remove('open');$('mbody').innerHTML='';document.body.style.overflow=''}
document.addEventListener('click',function(ev){var t=ev.target.closest('[data-t]');if(t){tab=t.getAttribute('data-t');lang='';genre='';location.hash=tab;render();return}
 var c=ev.target.closest('.card');if(c){open(c.getAttribute('data-k'),+c.getAttribute('data-i'));return}
 if(ev.target.id==='modal'||ev.target.id==='close')close()});
document.addEventListener('change',function(ev){if(ev.target.id==='fl'){lang=ev.target.value;render()}if(ev.target.id==='fg'){genre=ev.target.value;render()}});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape')close()});
$('q').addEventListener('input',function(ev){q=ev.target.value;render()});
var soc=[['Instagram',S.brand.instagram],['YouTube',S.brand.youtube],['Facebook',S.brand.facebook]].filter(function(s){return s[1]&&/^https:\\/\\//.test(s[1])});
$('social').innerHTML=soc.map(function(s){return '<a href="'+e(s[1])+'" target="_blank" rel="noopener">'+s[0]+'</a>'}).join(' · ');
$('upd').textContent=new Date(S.generatedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
render();
})();
</script>
</body>
</html>`;
}
