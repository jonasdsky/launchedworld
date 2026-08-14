// Launched — NYC startup company list (grows toward 1,000+)
// Each entry: { name, ats, slug, sector, domain }
//   ats    = 'ashby' | 'greenhouse' | 'lever'
//   slug   = the company's identifier in that ATS's public job board
//   domain = the company's real website domain (for accurate logos via Clearbit)
//
// HOW TO ADD A COMPANY:
//   1. Open its careers page → the URL gives you ats + slug
//      (boards.greenhouse.io/acme → greenhouse/acme; jobs.lever.co/acme → lever/acme; jobs.ashbyhq.com/acme → ashby/acme)
//   2. Open its main website → copy the bare domain (e.g. "acme.com", no https://, no www)
//   3. Add a row below. The domain is what makes the logo correct.

module.exports = [
  // ── Ashby ──
  { name: 'Northslope Technologies', ats: 'ashby', slug: 'northslope-technologies', sector: 'ai',  domain: 'northslope.tech' },
  { name: 'Ramp',            ats: 'ashby', slug: 'ramp',            sector: 'ai',  domain: 'ramp.com' },
  { name: 'Linear',          ats: 'ashby', slug: 'linear',          sector: 'ai',  domain: 'linear.app' },
  { name: 'Runway',          ats: 'ashby', slug: 'runwayml',        sector: 'ai',  domain: 'runwayml.com' },
  { name: 'Hex',             ats: 'ashby', slug: 'hex',             sector: 'ai',  domain: 'hex.tech' },
  { name: 'Clay',            ats: 'ashby', slug: 'clay',            sector: 'ai',  domain: 'clay.com' },
  { name: 'Vanta',           ats: 'ashby', slug: 'vanta',           sector: 'ai',  domain: 'vanta.com' },
  { name: 'Modal',           ats: 'ashby', slug: 'modal',           sector: 'ai',  domain: 'modal.com' },
  { name: 'Baseten',         ats: 'ashby', slug: 'baseten',         sector: 'ai',  domain: 'baseten.co' },

  // ── Greenhouse ──
  { name: 'Datadog',         ats: 'greenhouse', slug: 'datadog',      sector: 'ai', domain: 'datadoghq.com' },
  { name: 'Betterment',      ats: 'greenhouse', slug: 'betterment',   sector: 'ai', domain: 'betterment.com' },
  { name: 'Justworks',       ats: 'greenhouse', slug: 'justworks',    sector: 'ai', domain: 'justworks.com' },
  { name: 'Alloy',           ats: 'greenhouse', slug: 'alloy',        sector: 'ai', domain: 'alloy.com' },
  { name: 'Cockroach Labs',  ats: 'greenhouse', slug: 'cockroachlabs',sector: 'ai', domain: 'cockroachlabs.com' },
  { name: 'DigitalOcean',    ats: 'greenhouse', slug: 'digitalocean', sector: 'ai', domain: 'digitalocean.com' },
  { name: 'Oscar Health',    ats: 'greenhouse', slug: 'oscar',        sector: 'ai', domain: 'hioscar.com' },
  { name: 'MongoDB',         ats: 'greenhouse', slug: 'mongodb',      sector: 'ai', domain: 'mongodb.com' },

  // ── Lever ──
  { name: 'Attentive',       ats: 'lever', slug: 'attentive',        sector: 'ai', domain: 'attentive.com' },
  { name: 'Ro',              ats: 'lever', slug: 'ro',               sector: 'ai', domain: 'ro.co' },
];
