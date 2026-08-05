// Launched jobs API - Vercel serverless function
// Pulls live roles from Ashby public job boards and normalizes them.
// Deploy at /api/jobs.js. No API key needed (Ashby posting API is public).
//
// Query params:
//   ?q=<search terms>   optional keyword filter (title/dept/location)
//   ?board=<slug>       optional single board; otherwise all BOARDS below
//
// Add more companies by dropping their Ashby slug into BOARDS.

const BOARDS = [
  { slug: 'northslope-technologies', company: 'Northslope Technologies', sector: 'ai' }
];

// crude sector inference from title/department
function inferSector(text) {
  const t = (text || '').toLowerCase();
  if (/defense|defence|military|govtech|weapon|aerospace|missile/.test(t)) return 'def';
  if (/robot|autonom|hardware|mechatron/.test(t)) return 'rob';
  if (/energy|fusion|solar|grid|battery|climate|nuclear/.test(t)) return 'energy';
  return 'ai';
}

// parse "$185K - $275K" or "$81K – $87K • 0.5%..." -> max salary number
function parseSalary(summary) {
  if (!summary) return 0;
  const matches = summary.match(/\$\s?(\d+(?:\.\d+)?)\s?[kK]/g);
  if (!matches || !matches.length) {
    // try full numbers like $185,000
    const full = summary.match(/\$\s?(\d{2,3}(?:,\d{3})+)/g);
    if (full && full.length) {
      const nums = full.map(s => parseInt(s.replace(/[^0-9]/g, ''), 10));
      return Math.max.apply(null, nums);
    }
    return 0;
  }
  const nums = matches.map(s => Math.round(parseFloat(s.replace(/[^0-9.]/g, '')) * 1000));
  return Math.max.apply(null, nums);
}

async function fetchBoard(board) {
  const url = 'https://api.ashbyhq.com/posting-api/job-board/' + board.slug + '?includeCompensation=true';
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) return [];
  const data = await r.json();
  const jobs = (data && data.jobs) || [];
  return jobs
    .filter(j => j.isListed !== false)
    .map(j => {
      const comp = j.compensation || {};
      const salSummary = comp.scrapeableCompensationSalarySummary || comp.compensationTierSummary || '';
      const salary = parseSalary(salSummary);
      const loc = j.location || (j.address && j.address.postalAddress && j.address.postalAddress.addressLocality) || (j.isRemote ? 'Remote' : '—');
      return {
        role: j.title || 'Role',
        company: board.company,
        sector: inferSector((j.title || '') + ' ' + (j.department || '') + ' ' + (j.team || '')),
        salary: salary,
        salaryLabel: salSummary || null,
        location: j.isRemote ? (loc && loc !== '—' ? loc + ' · Remote' : 'Remote') : loc,
        department: j.department || '',
        employmentType: j.employmentType || '',
        source: 'Ashby',
        url: j.jobUrl || j.applyUrl || '#'
      };
    });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const q = ((req.query && req.query.q) || '').toString().toLowerCase().trim();
    const boardParam = ((req.query && req.query.board) || '').toString().trim();
    const boards = boardParam
      ? [{ slug: boardParam, company: boardParam, sector: 'ai' }]
      : BOARDS;

    const results = await Promise.all(boards.map(b => fetchBoard(b).catch(() => [])));
    let jobs = [].concat.apply([], results);

    // keyword filter (posting API can't search, so we filter here)
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      const scored = jobs.map(j => {
        const hay = (j.role + ' ' + j.company + ' ' + j.department + ' ' + j.location + ' ' + j.sector).toLowerCase();
        let score = 0;
        terms.forEach(t => { if (hay.indexOf(t) !== -1) score++; });
        return { j, score };
      });
      const anyHit = scored.some(s => s.score > 0);
      if (anyHit) jobs = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).map(s => s.j);
    }

    // sort by salary desc as a sensible default, assign a light match score
    jobs.sort((a, b) => (b.salary || 0) - (a.salary || 0));
    jobs = jobs.map((j, i) => Object.assign({}, j, { match: Math.max(80, 98 - i * 2) }));

    return res.status(200).json({ count: jobs.length, jobs: jobs });
  } catch (e) {
    return res.status(500).json({ error: 'jobs_error', detail: String(e).slice(0, 300), jobs: [] });
  }
};
