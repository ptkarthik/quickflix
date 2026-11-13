/**
 * Headline library for list posts / carousels: 200+ cover headings (with a matching label + subheading), filled in
 * with your number of titles, movies/series, language and genre. Plus your own saved headings.
 */

export type HeadingCat = 'Must-watch' | 'Hidden gems' | 'Weekend & binge' | 'Mood' | 'Ratings & awards' | 'Language' | 'Genre' | 'Era' | 'Hooks' | 'In cinemas' | 'On OTT' | 'Mine';
export const HEADING_CATS: HeadingCat[] = ['Must-watch', 'Hidden gems', 'Weekend & binge', 'Mood', 'Ratings & awards', 'Language', 'Genre', 'Era', 'Hooks', 'In cinemas', 'On OTT', 'Mine'];

export interface HeadingTpl { id: string; cat: HeadingCat; heading: string; kicker: string; sub: string; only?: 'cinema' | 'ott' }
export interface HeadingCtx { n: number; kind: 'movie' | 'tv' | 'mixed'; lang?: string | null; genre?: string | null; desk: 'ott' | 'cinema' | 'world' }
export interface CoverText { heading: string; kicker: string; sub: string }

type Row = [heading: string, kicker: string, sub: string];
const rows = (cat: HeadingCat, list: Row[], only?: 'cinema' | 'ott'): HeadingTpl[] =>
  list.map(([heading, kicker, sub], i) => ({ id: `${cat}-${i}`, cat, heading, kicker, sub, only }));

const SUB = '{n} {kinds} worth your time';
export const HEADINGS: HeadingTpl[] = [
  ...rows('Must-watch', [
    ['Top {n} Must-Watch {Kinds}', 'Must watch', SUB],
    ['{n} {Kinds} You Must Watch', 'Must watch', 'Add these to your list today'],
    ['{n} {Kinds} Everyone Should See Once', 'Must watch', 'At least once in your life'],
    ['{n} {Kinds} You Can’t Skip', 'Don’t miss', SUB],
    ['Watch These {n} Before You Die', 'Bucket list', 'The ultimate watchlist'],
    ['{n} {Kinds} That Deserve the Hype', 'Worth the hype', 'Believe the reviews'],
    ['Our Top {n} Picks', 'Our picks', SUB],
    ['The {n} Best {Kinds} Right Now', 'Best right now', 'Fresh, rated and recommended'],
    ['{n} Absolute Classics', 'All-time classics', 'Timeless — never gets old'],
    ['{n} {Kinds} That Changed Cinema', 'Game changers', 'The ones that raised the bar'],
    ['{n} Masterpieces You Need to See', 'Masterpieces', SUB],
    ['Top {n}: Zero-Regret {Kinds}', 'Zero regrets', 'Not a single boring one'],
    ['{n} {Kinds} With No Bad Scenes', 'Perfect watch', 'Start to finish, pure gold'],
    ['{n} Certified Bangers', 'Certified', 'Trust us on these'],
    ['The {n} {Kinds} We Can’t Stop Recommending', 'We keep recommending', SUB],
    ['{n} {Kinds} That Live Rent-Free in Our Heads', 'Unforgettable', 'You won’t forget these'],
    ['{n} Instant Favourites', 'Instant favourites', 'Love at first watch'],
    ['{n} {Kinds} Worth Every Minute', 'Worth it', SUB],
    ['Top {n} {Kinds} of All Time', 'All-time best', 'The greatest, ranked'],
    ['{n} {Kinds} That Never Get Old', 'Rewatchable', 'Watch again and again'],
    ['{n} {Kinds} Worth Paying For', 'Worth paying for', SUB],
    ['{n} {Kinds} You’ll Want to Rewatch Immediately', 'Rewatch', SUB],
    ['{n} Picks Our Followers Loved', 'Followers’ favourites', 'Chosen with you'],
    ['{n} Essential {Kinds}', 'Essentials', 'Start your list here'],
    ['{n} {Kinds} That Are Pure Cinema', 'Pure cinema', SUB],
  ]),
  ...rows('Hidden gems', [
    ['{n} Hidden Gems You Missed', 'Hidden gems', 'Under-rated and under-seen'],
    ['Top {n} Underrated {Kinds}', 'Underrated', 'They deserved more love'],
    ['{n} {Kinds} Nobody Talks About', 'Underrated', 'But everyone should'],
    ['{n} Gems Flying Under the Radar', 'Under the radar', SUB],
    ['{n} {Kinds} That Deserved More Love', 'Deserved better', 'Give them a chance'],
    ['Top {n} Hidden Gems', 'Hidden gems', SUB],
    ['{n} Underrated Masterpieces', 'Underrated', 'Criminally overlooked'],
    ['{n} {Kinds} Only Real Cinephiles Know', 'For cinephiles', 'Deep cuts'],
    ['{n} Secret Picks for Your Watchlist', 'Secret picks', 'Thank us later'],
    ['{n} Surprises You’ll Thank Us For', 'Pleasant surprises', SUB],
    ['{n} Small {Kinds}, Huge Impact', 'Small but mighty', SUB],
    ['{n} {Kinds} That Flopped But Are Brilliant', 'Box-office flop, brilliant film', 'Ahead of their time'],
    ['{n} Cult Classics', 'Cult classics', 'Loved by those who found them'],
    ['{n} Gems Hiding on Your OTT', 'Hidden on OTT', 'Already in your subscription', ],
    ['{n} {Kinds} You Scrolled Past', 'Don’t scroll past', 'Stop scrolling, start watching'],
  ]),
  ...rows('Weekend & binge', [
    ['Top {n} for This Weekend', 'Weekend watchlist', SUB],
    ['{n} {Kinds} for Your Weekend', 'Weekend plans', 'Sorted'],
    ['Your Weekend Binge List', 'Binge list', '{n} {kinds} to binge'],
    ['{n} {Kinds} to Binge in One Sitting', 'Binge-worthy', 'Clear your schedule'],
    ['{n} Perfect Sunday Watches', 'Sunday sorted', SUB],
    ['{n} {Kinds} for Movie Night', 'Movie night', 'Grab the popcorn 🍿'],
    ['{n} Picks for a Lazy Weekend', 'Lazy weekend', SUB],
    ['{n} {Kinds} to Watch Tonight', 'Tonight’s pick', 'Can’t decide? Start here'],
    ['{n} Late-Night Watches', 'Late night', 'One more episode…'],
    ['{n} {Kinds} for a Rainy Day', 'Rainy day', 'Chai + these = perfect'],
    ['{n} Long-Weekend Marathons', 'Long weekend', 'Marathon mode on'],
    ['{n} {Kinds} to Watch With Family', 'Family time', 'Fun for everyone'],
    ['{n} {Kinds} to Watch With Friends', 'With friends', 'Group-watch approved'],
    ['{n} {Kinds} for Date Night', 'Date night', SUB],
    ['{n} Watches for Your Holiday', 'Holiday watchlist', SUB],
    ['Weekend Sorted: {n} Picks', 'Weekend sorted', SUB],
    ['{n} {Kinds} for Your Next Flight', 'Travel watch', 'Download before you fly'],
    ['{n} Picks for a Cosy Night In', 'Night in', SUB],
    ['{n} {Kinds} to Start This Week', 'Start this week', SUB],
    ['{n} Quick Watches for a Busy Week', 'Busy week', 'Short and worth it'],
    ['{n} {Kinds} for a Festival Holiday', 'Festival holiday', 'Celebrate with cinema'],
  ]),
  ...rows('Mood', [
    ['{n} Feel-Good {Kinds}', 'Feel good', 'Guaranteed smiles'],
    ['{n} {Kinds} That Will Blow Your Mind', 'Mind-bending', 'Pay attention till the end'],
    ['{n} {Kinds} With Insane Twists', 'Plot twists', 'You won’t see them coming'],
    ['{n} {Kinds} That Will Make You Cry', 'Emotional', 'Keep tissues ready'],
    ['{n} Edge-of-the-Seat Thrillers', 'Edge of your seat', 'Don’t blink'],
    ['{n} {Kinds} to Watch With the Lights Off', 'Scary', 'If you dare'],
    ['{n} {Kinds} That Will Make You Laugh Out Loud', 'LOL', 'Comedy gold'],
    ['{n} Comfort {Kinds}', 'Comfort watch', 'Like a warm hug'],
    ['{n} {Kinds} for When You’re Sad', 'Mood lifter', 'Instant mood fix'],
    ['{n} {Kinds} That Will Motivate You', 'Motivation', 'Get up and go'],
    ['{n} Mass Entertainers', 'Mass', 'Whistle-worthy moments'],
    ['{n} Goosebump Moments on Screen', 'Goosebumps', SUB],
    ['{n} {Kinds} With the Best Endings', 'Best endings', 'The last scene says it all'],
    ['{n} {Kinds} That Make You Think', 'Thought-provoking', 'Stays with you'],
    ['{n} Slow Burns Worth the Wait', 'Slow burn', 'Patience pays off'],
    ['{n} Heart-Warming {Kinds}', 'Heart-warming', SUB],
    ['{n} Adrenaline Rushes', 'Adrenaline', 'Non-stop action'],
    ['{n} {Kinds} That Feel Like a Vacation', 'Escape', 'Travel from your couch'],
    ['{n} Dark & Gritty {Kinds}', 'Dark & gritty', 'Not for the faint-hearted'],
    ['{n} Wholesome {Kinds}', 'Wholesome', 'Pure and lovely'],
    ['{n} {Kinds} That Feel Like a Hug', 'Cosy', 'Soft, warm, lovely'],
    ['{n} Brain-Teasing Mysteries', 'Mystery', 'Solve it before the end'],
    ['{n} {Kinds} With Jaw-Dropping Action', 'Action', 'Pure adrenaline'],
    ['{n} Romantic {Kinds} to Fall For', 'Romance', 'Butterflies guaranteed'],
    ['{n} {Kinds} That Will Haunt You', 'Haunting', 'Sleep with the lights on'],
    ['{n} Chill {Kinds} to Unwind', 'Chill', 'Switch off and relax'],
    ['{n} Inspiring True Stories', 'Inspiring', 'Real people, real courage'],
    ['{n} {Kinds} That Hit Different at 2 AM', '2 AM watches', SUB],
    ['{n} {Kinds} for When You Can’t Sleep', 'Can’t sleep?', SUB],
    ['{n} Nail-Biting Courtroom Dramas', 'Courtroom', 'Objection!'],
  ]),
  ...rows('Ratings & awards', [
    ['{n} Highest-Rated {Kinds}', 'Top rated', 'Ranked by ratings'],
    ['{n} {Kinds} Rated 8+ on IMDb', 'IMDb 8+', 'Critics and audiences agree'],
    ['{n} {Kinds} With Near-Perfect Ratings', 'Near perfect', SUB],
    ['{n} Award-Winning {Kinds}', 'Award winners', 'Trophies well deserved'],
    ['{n} Critics’ Favourites', 'Critics’ choice', SUB],
    ['{n} Audience Favourites', 'Audience choice', 'Loved by viewers'],
    ['{n} {Kinds} With 100% Fresh Reviews', 'Fresh', 'Rotten Tomatoes approved'],
    ['The {n} Best-Reviewed {Kinds}', 'Best reviewed', SUB],
    ['{n} {Kinds} That Topped the Charts', 'Chart-toppers', SUB],
    ['{n} Oscar-Worthy Watches', 'Oscar-worthy', SUB],
  ]),
  ...rows('Era', [
    ['{n} Best {Kinds} of the 2020s', '2020s', 'The decade so far'],
    ['{n} Best {Kinds} of the 2010s', '2010s', 'A decade of greats'],
    ['{n} Best {Kinds} of the 2000s', '2000s', 'Y2K classics'],
    ['{n} 90s {Kinds} That Still Hit', '90s nostalgia', 'Rewind time'],
    ['{n} 80s Classics', '80s', 'Retro and legendary'],
    ['{n} Golden-Era Classics', 'Golden era', 'They don’t make them like this'],
    ['{n} {Kinds} From Your Childhood', 'Nostalgia', 'Remember these?'],
    ['{n} Old {Kinds} Better Than New Ones', 'Old is gold', SUB],
    ['{n} Best {Kinds} of This Year (So Far)', 'This year', SUB],
    ['{n} Best {Kinds} of Last Year', 'Last year’s best', SUB],
    ['{n} Modern Classics', 'Modern classics', SUB],
    ['{n} {Kinds} That Aged Like Fine Wine', 'Aged well', 'Even better today'],
    ['{n} Retro Gems Worth Revisiting', 'Retro', SUB],
    ['{n} {Kinds} Ahead of Their Time', 'Ahead of time', SUB],
    ['{n} Throwback Watches', 'Throwback', SUB],
  ]),
  ...rows('Hooks', [
    ['Stop Scrolling. Watch These {n}.', 'Stop scrolling', SUB],
    ['Can’t Decide What to Watch? Try These {n}', 'Can’t decide?', 'We picked for you'],
    ['Save This for Later 📌', 'Save this', '{n} {kinds} to watch'],
    ['How Many Have You Watched?', 'Count them', '{n} {kinds} — comment your score'],
    ['Rate These {n} Out of 10', 'Rate them', 'Tell us in the comments'],
    ['{n} {Kinds} Your Friends Haven’t Seen', 'Be the first', 'Send this to them'],
    ['If You Liked This, Watch These {n}', 'If you liked…', SUB],
    ['{n} {Kinds} We’d Watch Again Tonight', 'Rewatch tonight', SUB],
    ['The Only {n} {Kinds} You Need This Month', 'This month', SUB],
    ['Tag Someone Who Needs These {n}', 'Tag a friend', SUB],
    ['{n} {Kinds} in {n} Slides', 'Quick list', 'Swipe through'],
    ['POV: You Finally Found Something to Watch', 'POV', '{n} {kinds} worth your time'],
    ['Your Watchlist Just Got Better', 'Upgrade', '{n} {kinds} to add'],
    ['Don’t Watch Anything Else Until You See These', 'Priority list', SUB],
    ['Swipe for {n} Must-Watch {Kinds} →', 'Swipe', SUB],
    ['{n} {Kinds} That Are Better Than You Think', 'Better than you think', SUB],
    ['{n} Picks Approved by Us', 'Approved', SUB],
    ['Unpopular Opinion: These {n} Are Masterpieces', 'Unpopular opinion', 'Fight us in the comments'],
    ['{n} {Kinds}, Zero Boring Moments', 'Zero boring', SUB],
    ['Ranked: {n} {Kinds}', 'Ranked', 'Agree with our order?'],
    ['{n} {Kinds} With the Best Climax', 'Best climax', 'Wait for the last 20 minutes'],
    ['{n} {Kinds} With Iconic Dialogues', 'Iconic dialogues', 'Quote them in the comments'],
    ['{n} {Kinds} With Mind-Blowing Visuals', 'Visual feast', 'Every frame a painting'],
    ['{n} {Kinds} With Killer Background Scores', 'BGM', 'Turn the volume up'],
    ['{n} Villains You’ll Never Forget', 'Iconic villains', SUB],
    ['{n} {Kinds} Based on True Stories', 'True stories', 'Stranger than fiction'],
    ['{n} {Kinds} Under 2 Hours', 'Short & sweet', 'Perfect for a weeknight'],
    ['{n} Short Series You Can Finish This Weekend', 'Quick binge', 'One season, all done'],
    ['{n} {Kinds} With Perfect Casting', 'Perfect casting', SUB],
    ['{n} Directors’ Best Works', 'Director’s best', SUB],
    ['{n} {Kinds} That Started a Trend', 'Trendsetters', SUB],
    ['{n} {Kinds} With Strong Women Leads', 'Women-led', SUB],
    ['{n} Remakes Better Than the Original?', 'Remakes', 'You decide 👇'],
    ['{n} Sequels That Beat the First One', 'Better sequels', SUB],
    ['{n} {Kinds} Every Student Should Watch', 'Students', SUB],
  ]),
  ...rows('In cinemas', [
    ['Must-Watch in Cinemas This Weekend', 'In cinemas', '{n} films worth the ticket'],
    ['{n} Films to Catch on the Big Screen', 'Big screen', 'Worth the ticket'],
    ['{n} Theatre-Worthy Films', 'Theatre-worthy', 'Book your tickets 🎟️'],
    ['FDFS Watchlist', 'First day first show', '{n} films to book now'],
    ['{n} Films to Book Tickets For', 'Book now', SUB],
    ['This Week at the Movies', 'This week', '{n} films in cinemas'],
    ['{n} Big-Screen Experiences', 'IMAX worthy', 'Don’t wait for OTT'],
    ['{n} Films Worth the Popcorn', 'Popcorn picks', SUB],
    ['Skip OTT — Watch These {n} in Theatres', 'Theatres only', SUB],
    ['{n} Must-Watch Releases This Month', 'This month', SUB],
  ], 'cinema'),
  ...rows('On OTT', [
    ['Top OTT Picks This Weekend', 'OTT picks', SUB],
    ['{n} New on OTT This Week', 'New on OTT', SUB],
    ['{n} {Kinds} Streaming Now', 'Streaming now', 'Already on your apps'],
    ['{n} OTT Gems You Missed', 'OTT gems', SUB],
    ['{n} Must-Stream {Kinds}', 'Must stream', SUB],
    ['{n} {Kinds} to Watch on Your Subscription', 'Use your subscription', 'Make it worth the money'],
    ['{n} {Kinds} Free to Stream', 'Free to stream', 'No subscription needed'],
    ['This Week’s OTT Watchlist', 'This week', '{n} {kinds} to stream'],
    ['{n} Fresh Drops on OTT', 'Fresh drops', SUB],
    ['{n} OTT Releases You Can’t Miss', 'Don’t miss', SUB],
  ], 'ott'),
  // With your language (only shown when the post has one language)
  ...rows('Language', [
    ['Top {n} {Lang} {Kinds}', '{Lang} picks', SUB],
    ['{n} {Lang} {Kinds} You Must Watch', 'Must watch', SUB],
    ['{n} Underrated {Lang} {Kinds}', '{Lang} gems', 'Under-rated and under-seen'],
    ['{n} Best {Lang} {Kinds} of All Time', '{Lang} classics', 'The greatest, ranked'],
    ['{n} {Lang} {Kinds} for This Weekend', 'Weekend watchlist', SUB],
    ['{n} {Lang} {Kinds} With Insane Twists', 'Plot twists', 'You won’t see them coming'],
    ['{n} {Lang} Feel-Good {Kinds}', 'Feel good', 'Guaranteed smiles'],
    ['{n} {Lang} {Kinds} Rated 8+', '{Lang} top rated', 'IMDb 8 and above'],
    ['{n} {Lang} {Kinds} Everyone Should See', 'Must see', SUB],
    ['{n} {Lang} Hidden Gems', 'Hidden gems', SUB],
    ['Best of {Lang} Cinema: {n} Picks', '{Lang} cinema', SUB],
    ['{n} {Lang} {Kinds} to Binge', 'Binge list', 'Clear your schedule'],
    ['{n} {Lang} Thrillers That Grip You', 'Thrillers', 'Edge of your seat'],
    ['{n} {Lang} {Kinds} With the Best Music', 'Music', 'Songs on loop'],
    ['{n} {Lang} {Kinds} for Family Night', 'Family time', 'Fun for everyone'],
    ['{n} {Lang} Comedies to Laugh Out Loud', 'Comedy', 'Comedy gold'],
    ['{n} {Lang} {Kinds} That Made History', 'Landmarks', 'They changed {Lang} cinema'],
    ['{n} {Lang} {Kinds} Non-{Lang} Fans Will Love', 'Start here', 'The perfect introduction'],
    ['{n} Must-Watch {Lang} {Kinds} on OTT', '{Lang} on OTT', 'Already streaming'],
    ['Your {Lang} Watchlist: {n} Picks', 'Watchlist', SUB],
  ]),
  // With your genre (only shown when the post is one genre)
  ...rows('Genre', [
    ['Top {n} {Genre} {Kinds}', '{Genre}', SUB],
    ['{n} {Genre} {Kinds} You Must Watch', 'Must watch', SUB],
    ['{n} Underrated {Genre} {Kinds}', 'Underrated {genre}', SUB],
    ['{n} Best {Genre} {Kinds} of All Time', 'All-time best', 'Ranked by ratings'],
    ['{n} {Genre} {Kinds} for This Weekend', 'Weekend watchlist', SUB],
    ['{n} {Genre} {Kinds} With Insane Twists', 'Plot twists', SUB],
    ['{n} {Genre} Masterpieces', 'Masterpieces', SUB],
    ['{n} {Genre} {Kinds} Rated 8+', 'Top rated', 'IMDb 8 and above'],
    ['{n} {Genre} Hidden Gems', 'Hidden gems', SUB],
    ['If You Love {Genre}, Watch These {n}', 'For {genre} fans', SUB],
    ['{n} {Genre} {Kinds} That Never Get Old', 'Rewatchable', SUB],
    ['{n} {Genre} Picks for Tonight', 'Tonight', SUB],
    ['The Ultimate {Genre} Watchlist', 'Ultimate list', '{n} {kinds}'],
    ['{n} Modern {Genre} Classics', 'Modern classics', SUB],
    ['{n} {Genre} {Kinds} for Beginners', 'Start here', 'Perfect first picks'],
  ]),
];

const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

/** Fill a template for this post; null when it needs a language/genre the post doesn't have or the desk doesn't fit. */
export function fillHeading(t: HeadingTpl, c: HeadingCtx): CoverText | null {
  if (t.only === 'cinema' && c.desk !== 'cinema') return null;
  if (t.only === 'ott' && c.desk === 'cinema') return null;
  const all = t.heading + t.kicker + t.sub;
  if (/\{lang\}/i.test(all) && !c.lang) return null;
  if (/\{genre\}/i.test(all) && !c.genre) return null;
  const one = c.n === 1;
  const kinds = c.desk === 'cinema' ? (one ? 'film' : 'films') : c.kind === 'tv' ? (one ? 'series' : 'series') : c.kind === 'movie' ? (one ? 'movie' : 'movies') : one ? 'title' : 'titles';
  const sub = (s: string) => s
    .replace(/\{n\}/g, String(c.n))
    .replace(/\{Kinds\}/g, titleCase(kinds))
    .replace(/\{kinds\}/g, kinds)
    .replace(/\{Lang\}/g, c.lang || '')
    .replace(/\{lang\}/g, (c.lang || '').toLowerCase())
    .replace(/\{Genre\}/g, titleCase(c.genre || ''))
    .replace(/\{genre\}/g, (c.genre || '').toLowerCase())
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { heading: sub(t.heading), kicker: sub(t.kicker), sub: sub(t.sub) };
}

// ───────────────────────── your own headings + variety (this browser) ─────────────────────────

const MINE = 'headings.mine';
const RECENT = 'headings.recent';
const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

/** Your saved headings — they may contain {n}, {Kinds}, {Lang}, {Genre} too. */
export const myHeadings = (): HeadingTpl[] => read<HeadingTpl[]>(MINE, []);
export function saveMyHeading(h: CoverText, ctx: HeadingCtx) {
  // turn the current number back into {n} so it fits any list size
  const tok = (s: string) => s.replace(new RegExp(`\\b${ctx.n}\\b`, 'g'), '{n}');
  const t: HeadingTpl = { id: `mine-${Date.now().toString(36)}`, cat: 'Mine', heading: tok(h.heading), kicker: tok(h.kicker), sub: tok(h.sub) };
  write(MINE, [t, ...myHeadings()].slice(0, 100));
  return t;
}
export function deleteMyHeading(id: string) {
  write(MINE, myHeadings().filter(h => h.id !== id));
}
export const allHeadings = () => [...myHeadings(), ...HEADINGS];
export function rememberHeading(id: string) {
  write(RECENT, [id, ...read<string[]>(RECENT, []).filter(x => x !== id)].slice(0, 80));
}
/** A heading that fits this post and wasn't used recently. */
export function randomHeading(ctx: HeadingCtx, cat?: HeadingCat | null): { tpl: HeadingTpl; text: CoverText } | null {
  const recent = new Set(read<string[]>(RECENT, []).slice(0, 50));
  const fits = allHeadings().filter(t => (!cat || t.cat === cat)).map(tpl => ({ tpl, text: fillHeading(tpl, ctx) })).filter((x): x is { tpl: HeadingTpl; text: CoverText } => !!x.text);
  const fresh = fits.filter(x => !recent.has(x.tpl.id));
  const from = fresh.length ? fresh : fits;
  return from.length ? from[Math.floor(Math.random() * from.length)] : null;
}
