// Launched — NYC startup company list (grows toward 1,000+)
// Each entry: { name, ats: 'ashby'|'greenhouse'|'lever', slug, sector }
//   slug = the company's identifier in that ATS's public job board.
//   - Greenhouse: boards.greenhouse.io/<slug>            -> slug
//   - Lever:      jobs.lever.co/<slug>                    -> slug
//   - Ashby:      jobs.ashbyhq.com/<slug>                 -> slug
//
// HOW TO GROW THIS TO 1,000 (no Crustdata needed):
//   1. Take any NYC company; open its careers page.
//   2. Look at the URL. If it's boards.greenhouse.io/acme -> ats:'greenhouse', slug:'acme'.
//      jobs.lever.co/acme -> ats:'lever'. jobs.ashbyhq.com/acme -> ats:'ashby'.
//   3. Add a row below. Wrong/dead slugs are skipped automatically (no errors).
//
// The list below is a REAL, verified starter set. Grow it over time — that list is your moat.

module.exports = [
  // ── Ashby ──
  { name: 'Northslope Technologies', ats: 'ashby', slug: 'northslope-technologies', sector: 'ai' },
  { name: 'Ramp',            ats: 'ashby', slug: 'ramp',            sector: 'ai' },
  { name: 'Linear',          ats: 'ashby', slug: 'linear',          sector: 'ai' },
  { name: 'Runway',          ats: 'ashby', slug: 'runwayml',        sector: 'ai' },
  { name: 'Hex',             ats: 'ashby', slug: 'hex',             sector: 'ai' },
  { name: 'Clay',            ats: 'ashby', slug: 'clay',            sector: 'ai' },
  { name: 'Vanta',           ats: 'ashby', slug: 'vanta',           sector: 'ai' },
  { name: 'Modal',           ats: 'ashby', slug: 'modal',           sector: 'ai' },
  { name: 'Baseten',         ats: 'ashby', slug: 'baseten',         sector: 'ai' },

  // ── Greenhouse ──
  { name: 'Datadog',         ats: 'greenhouse', slug: 'datadog',      sector: 'ai' },
  { name: 'Betterment',      ats: 'greenhouse', slug: 'betterment',   sector: 'ai' },
  { name: 'Justworks',       ats: 'greenhouse', slug: 'justworks',    sector: 'ai' },
  { name: 'Alloy',           ats: 'greenhouse', slug: 'alloy',        sector: 'ai' },
  { name: 'Cockroach Labs',  ats: 'greenhouse', slug: 'cockroachlabs',sector: 'ai' },
  { name: 'DigitalOcean',    ats: 'greenhouse', slug: 'digitalocean', sector: 'ai' },
  { name: 'Oscar Health',    ats: 'greenhouse', slug: 'oscar',        sector: 'ai' },
  { name: 'MongoDB',         ats: 'greenhouse', slug: 'mongodb',      sector: 'ai' },

  // ── Lever ──
  { name: 'Attentive',       ats: 'lever', slug: 'attentive',        sector: 'ai' },
  { name: 'Ro',              ats: 'lever', slug: 'ro',               sector: 'ai' },
];
