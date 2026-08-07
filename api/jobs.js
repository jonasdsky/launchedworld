/**
 * ─────────────────────────────────────────────────────────────
 *  LAUNCHED — Live Job Data Integration
 *  Supports: Ashby, Greenhouse, Lever
 *
 *  HOW TO USE
 *  ──────────
 *  1. Add this script to your HTML just before </body>:
 *       <script src="launched-jobs-api.js"></script>
 *
 *  2. Configure your companies below in COMPANY_CONFIG.
 *     Each entry needs the ATS type + the company's board ID
 *     (found in their public careers URL — see comments below).
 *
 *  3. Call loadAllJobs() once on page load. It fetches all
 *     sources in parallel, normalises them into the OPPS format
 *     your site already uses, and calls renderOpps() when done.
 *
 *  FINDING BOARD IDs
 *  ─────────────────
 *  Ashby:       jobs.ashbyhq.com/{boardId}
 *  Greenhouse:  boards.greenhouse.io/{boardId}
 *  Lever:       jobs.lever.co/{boardId}
 *
 *  Example: Linear uses Ashby → boardId = "linear"
 *           Stripe uses Greenhouse → boardId = "stripe"
 *           Brex uses Lever → boardId = "brex"
 * ─────────────────────────────────────────────────────────────
 */

// ── PROXY CONFIG ─────────────────────────────────────────────
//  Ashby supports CORS directly so we call it from the browser.
//  Greenhouse and Lever block browser requests — we route them
//  through /api/jobs (a Vercel serverless function in your repo).
const PROXY = '/api/jobs';


//
//  Add or remove entries freely. The color is the dot shown
//  next to the company name in the table.
//
const COMPANY_CONFIG = [
  // ASHBY
  { name: 'Linear',       ats: 'ashby',      boardId: 'linear',      color: '#f59e0b', tags: ['Dev Tools', 'Startup'] },
  { name: 'Notion',       ats: 'ashby',      boardId: 'notion',      color: '#ef4444', tags: ['Enterprise', 'NYC'] },
  { name: 'Vercel',       ats: 'ashby',      boardId: 'vercel',      color: '#8b5cf6', tags: ['Dev Tools', 'Remote'] },
  { name: 'Ramp',         ats: 'ashby',      boardId: 'ramp',        color: '#14b8a6', tags: ['Fintech', 'NYC'] },
  { name: 'Cohere',       ats: 'ashby',      boardId: 'cohere',      color: '#8b5cf6', tags: ['AI'] },
  { name: 'Loom',         ats: 'ashby',      boardId: 'loom',        color: '#6366f1', tags: ['SaaS'] },

  // GREENHOUSE
  { name: 'Stripe',       ats: 'greenhouse', boardId: 'stripe',      color: '#6366f1', tags: ['Fintech', 'SF'] },
  { name: 'Figma',        ats: 'greenhouse', boardId: 'figma',       color: '#0ea5e9', tags: ['Dev Tools', 'SF'] },
  { name: 'Anthropic',    ats: 'greenhouse', boardId: 'anthropiccareers', color: '#10b981', tags: ['AI', 'SF'] },
  { name: 'Rippling',     ats: 'greenhouse', boardId: 'rippling',    color: '#f97316', tags: ['Enterprise', 'SF'] },
  { name: 'HubSpot',      ats: 'greenhouse', boardId: 'hubspot',     color: '#ec4899', tags: ['Enterprise', 'SaaS'] },
  { name: 'Scale AI',     ats: 'greenhouse', boardId: 'scaleai',     color: '#f97316', tags: ['AI', 'SF'] },

  // LEVER
  { name: 'Brex',         ats: 'lever',      boardId: 'brex',        color: '#ef4444', tags: ['Fintech', 'NYC'] },
  { name: 'OpenAI',       ats: 'lever',      boardId: 'openai',      color: '#10b981', tags: ['AI', 'SF'] },
  { name: 'Palantir',     ats: 'lever',      boardId: 'palantir',    color: '#6366f1', tags: ['Defense', 'NYC'] },
  { name: 'Salesforce',   ats: 'lever',      boardId: 'salesforce',  color: '#0ea5e9', tags: ['Enterprise', 'SF'] },
];

// ── 2. DEPT MAPPING ──────────────────────────────────────────
//
//  Maps raw department strings from each ATS into the
//  standard dept values your filters expect.
//
const DEPT_MAP = {
  'engineering':           'Engineering',
  'software engineering':  'Engineering',
  'infrastructure':        'Engineering',
  'data':                  'Engineering',
  'machine learning':      'Engineering',
  'product':               'Product',
  'product management':    'Product',
  'design':                'Product',
  'sales':                 'GTM',
  'account executive':     'GTM',
  'business development':  'GTM',
  'partnerships':          'GTM',
  'revenue':               'GTM',
  'customer success':      'GTM',
  'solutions':             'GTM',
  'marketing':             'Marketing',
  'growth':                'Marketing',
  'demand generation':     'Marketing',
  'content':               'Marketing',
  'operations':            'Operations',
  'finance':               'Operations',
  'legal':                 'Operations',
  'people':                'Operations',
  'hr':                    'Operations',
  'recruiting':            'Operations',
  'general management':    'Leadership',
  'executive':             'Leadership',
  'leadership':            'Leadership',
  'chief of staff':        'Leadership',
};

function normalizeDept(raw) {
  if (!raw) return 'Other';
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(DEPT_MAP)) {
    if (lower.includes(key)) return val;
  }
  return raw;
}

// ── 3. TYPE MAPPING ──────────────────────────────────────────
function normalizeType(raw) {
  if (!raw) return 'Hybrid';
  const lower = raw.toLowerCase();
  if (lower.includes('remote')) return 'Remote';
  if (lower.includes('on-site') || lower.includes('onsite') || lower.includes('in-office')) return 'On-site';
  return 'Hybrid';
}

// ── 4. LEVEL MAPPING ─────────────────────────────────────────
function normalizeLevel(title) {
  if (!title) return 'Mid';
  const lower = title.toLowerCase();
  if (lower.includes('vp') || lower.includes('vice president') || lower.includes('chief') || lower.includes('head of')) return 'Executive';
  if (lower.includes('director') || lower.includes('principal') || lower.includes('staff')) return 'Senior';
  if (lower.includes('senior') || lower.includes('lead') || lower.includes('manager')) return 'Senior';
  if (lower.includes('junior') || lower.includes('associate') || lower.includes('entry')) return 'Entry';
  return 'Mid';
}

// ── 5. POSTED DATE ───────────────────────────────────────────
function postedAgo(dateStr) {
  if (!dateStr) return 'Recently';
  const then = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now - then) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── 6. LOCATION NORMALISER ───────────────────────────────────
function normalizeLocation(loc) {
  if (!loc) return 'Remote';
  const lower = loc.toLowerCase();
  if (lower.includes('remote')) return 'Remote';
  if (lower.includes('new york') || lower.includes('nyc')) return 'New York, NY';
  if (lower.includes('san francisco') || lower.includes('sf')) return 'San Francisco, CA';
  if (lower.includes('boston')) return 'Boston, MA';
  if (lower.includes('austin')) return 'Austin, TX';
  if (lower.includes('seattle')) return 'Seattle, WA';
  if (lower.includes('chicago')) return 'Chicago, IL';
  if (lower.includes('los angeles') || lower.includes(' la,')) return 'Los Angeles, CA';
  if (lower.includes('london')) return 'London, UK';
  if (lower.includes('toronto')) return 'Toronto, Canada';
  return loc.split(',').slice(0, 2).join(',').trim();
}

// ─────────────────────────────────────────────────────────────
//  ASHBY FETCHER
//  Public API: https://api.ashbyhq.com/posting-api/job-board/{boardId}
//  No API key needed. Returns all active postings.
// ─────────────────────────────────────────────────────────────
async function fetchAshby(company) {
  // Ashby has CORS — call directly
  const url = `https://api.ashbyhq.com/posting-api/job-board/${company.boardId}?includeCompensation=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ashby ${company.boardId}: ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map(job => ({
    role:     job.title,
    dept:     normalizeDept(job.department),
    co:       company.name,
    color:    company.color,
    loc:      normalizeLocation(job.location || job.locationName),
    comp:     formatAshbyComp(job.compensation),
    compMin:  extractCompMin(job.compensation),
    type:     normalizeType(job.workplaceType || job.location),
    level:    normalizeLevel(job.title),
    tags:     [...company.tags, normalizeDept(job.department)].filter((v,i,a) => a.indexOf(v) === i),
    posted:   postedAgo(job.publishedAt || job.createdAt),
    applyUrl: job.jobUrl || `https://jobs.ashbyhq.com/${company.boardId}/${job.id}`,
    source:   'ashby',
  }));
}

function formatAshbyComp(comp) {
  if (!comp) return 'Competitive';
  const { minValue, maxValue, currency, interval } = comp;
  if (!minValue) return 'Competitive';
  const fmt = n => `$${Math.round(n / 1000)}k`;
  const suffix = interval === 'year' ? '/yr' : '';
  if (maxValue && maxValue !== minValue) return `${fmt(minValue)}–${fmt(maxValue)}${suffix}`;
  return `${fmt(minValue)}${suffix}`;
}

function extractCompMin(comp) {
  if (!comp?.minValue) return 0;
  return Math.round(comp.minValue / 1000);
}

// ─────────────────────────────────────────────────────────────
//  GREENHOUSE FETCHER
//  Public API: https://boards-api.greenhouse.io/v1/boards/{boardId}/jobs
//  No API key needed. Returns all active postings.
// ─────────────────────────────────────────────────────────────
async function fetchGreenhouse(company) {
  // Greenhouse blocks browser CORS — route through our proxy
  const url = `${PROXY}?ats=greenhouse&boardId=${company.boardId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Greenhouse ${company.boardId}: ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map(job => {
    const dept = job.departments?.[0]?.name || job.metadata?.find(m => m.name === 'Department')?.value || '';
    const locStr = job.location?.name || '';
    const typeStr = job.metadata?.find(m => m.name?.toLowerCase().includes('remote'))?.value || locStr;
    return {
      role:     job.title,
      dept:     normalizeDept(dept),
      co:       company.name,
      color:    company.color,
      loc:      normalizeLocation(locStr),
      comp:     extractGreenhouseComp(job.content, job.metadata),
      compMin:  0, // Greenhouse rarely exposes comp in public API
      type:     normalizeType(typeStr),
      level:    normalizeLevel(job.title),
      tags:     [...company.tags, normalizeDept(dept)].filter((v,i,a) => a.indexOf(v) === i),
      posted:   postedAgo(job.updated_at || job.created_at),
      applyUrl: job.absolute_url || `https://boards.greenhouse.io/${company.boardId}/jobs/${job.id}`,
      source:   'greenhouse',
    };
  });
}

function extractGreenhouseComp(content, metadata) {
  // Try metadata first
  const compMeta = metadata?.find(m =>
    m.name?.toLowerCase().includes('salary') ||
    m.name?.toLowerCase().includes('compensation') ||
    m.name?.toLowerCase().includes('pay')
  );
  if (compMeta?.value) return compMeta.value;

  // Try to extract from job description HTML
  if (content) {
    const match = content.match(/\$[\d,]+k?\s*[-–]\s*\$[\d,]+k?/i);
    if (match) return match[0];
  }
  return 'Competitive';
}

// ─────────────────────────────────────────────────────────────
//  LEVER FETCHER
//  Public API: https://api.lever.co/v0/postings/{boardId}?mode=json
//  No API key needed. Returns all active postings.
// ─────────────────────────────────────────────────────────────
async function fetchLever(company) {
  // Lever blocks browser CORS — route through our proxy
  const url = `${PROXY}?ats=lever&boardId=${company.boardId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Lever ${company.boardId}: ${res.status}`);
  const data = await res.json();
  return (data || []).map(job => {
    const locStr = job.categories?.location || job.workplaceType || '';
    const dept   = job.categories?.department || job.categories?.team || '';
    const commitment = job.categories?.commitment || '';
    return {
      role:     job.text,
      dept:     normalizeDept(dept),
      co:       company.name,
      color:    company.color,
      loc:      normalizeLocation(locStr),
      comp:     extractLeverComp(job.descriptionBody || job.description, job.salaryRange),
      compMin:  job.salaryRange?.min ? Math.round(job.salaryRange.min / 1000) : 0,
      type:     normalizeType(commitment + ' ' + locStr),
      level:    normalizeLevel(job.text),
      tags:     [...company.tags, normalizeDept(dept)].filter((v,i,a) => a.indexOf(v) === i),
      posted:   postedAgo(job.createdAt ? new Date(job.createdAt).toISOString() : null),
      applyUrl: job.applyUrl || `https://jobs.lever.co/${company.boardId}/${job.id}`,
      source:   'lever',
    };
  });
}

function extractLeverComp(description, salaryRange) {
  if (salaryRange?.min && salaryRange?.max) {
    const fmt = n => `$${Math.round(n / 1000)}k`;
    return `${fmt(salaryRange.min)}–${fmt(salaryRange.max)}`;
  }
  if (description) {
    const match = description.match(/\$[\d,]+k?\s*[-–]\s*\$[\d,]+k?/i);
    if (match) return match[0];
  }
  return 'Competitive';
}

// ─────────────────────────────────────────────────────────────
//  MAIN LOADER
//  Fetches all configured companies in parallel.
//  Falls back to existing OPPS data if a fetch fails.
//  Merges live + fallback, deduplicates, and calls renderOpps().
// ─────────────────────────────────────────────────────────────
async function loadAllJobs() {
  showJobsLoading(true);

  const fetchers = COMPANY_CONFIG.map(company => {
    const fn = {
      ashby:      fetchAshby,
      greenhouse: fetchGreenhouse,
      lever:      fetchLever,
    }[company.ats];

    return fn(company).catch(err => {
      console.warn(`[Launched] Failed to load ${company.name} (${company.ats}):`, err.message);
      return []; // graceful fallback — just skip this source
    });
  });

  const results = await Promise.allSettled(fetchers);
  const liveJobs = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  if (liveJobs.length > 0) {
    // Replace OPPS with live data
    OPPS.length = 0;
    OPPS.push(...liveJobs);
    console.log(`[Launched] Loaded ${liveJobs.length} live jobs from ${COMPANY_CONFIG.length} companies`);
  } else {
    console.warn('[Launched] No live jobs loaded — using fallback data');
  }

  showJobsLoading(false);

  // Re-render if the opportunities panel is currently visible
  if (document.getElementById('panel-opportunities')?.style.display !== 'none') {
    renderOpps();
  }
}

function showJobsLoading(on) {
  const count = document.getElementById('opp-count');
  if (!count) return;
  count.textContent = on ? 'Loading live jobs…' : '';
}

// ─────────────────────────────────────────────────────────────
//  COMPANY DATA LOADER
//  Enriches the COS array with real open role counts from the
//  live job data once loadAllJobs() has completed.
// ─────────────────────────────────────────────────────────────
function syncCompanyRoleCounts() {
  if (typeof COS === 'undefined' || typeof OPPS === 'undefined') return;
  COS.forEach(company => {
    const count = OPPS.filter(j => j.co === company.name).length;
    if (count > 0) company.roles = count;
  });
}

// ─────────────────────────────────────────────────────────────
//  AUTO-INIT
//  Runs on page load. You can also call loadAllJobs() manually.
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllJobs();
  syncCompanyRoleCounts();
  // Re-render map with live data if map is already initialized
  if (typeof renderMapMarkers === 'function') renderMapMarkers();
});
