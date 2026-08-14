// Launched jobs API — reads pre-synced jobs from Supabase (fast).
// If Supabase isn't configured yet, it falls back to fetching live from the ATS providers
// so the site still works during setup.
//
// Query params: ?q= ?loc=nyc|all ?cat=eng|sales|all ?limit=

let COMPANIES = [];
try { COMPANIES = require('./companies'); } catch (e) { COMPANIES = []; }

const NYC_RE = /(new york|nyc|manhattan|brooklyn|\bny\b|new york city|ny,|, ny)/i;
const ENG_RE = /(engineer|developer|swe|software|backend|frontend|full[- ]?stack|infrastructure|platform|data|ml|machine learning|devops|sre|security|mobile|ios|android|architect)/i;
const SALES_RE = /(sales|account executive|\bae\b|account manager|business development|\bbdr\b|\bsdr\b|revenue|go[- ]to[- ]market|\bgtm\b|partnerships|customer success|solutions engineer)/i;
function categoryOf(t){return ENG_RE.test(t)?'eng':SALES_RE.test(t)?'sales':'other';}
function parseSalary(s){if(!s)return{salary:0,label:null};const k=s.match(/\$\s?(\d+(?:\.\d+)?)\s?[kK]/g);if(k&&k.length){const n=k.map(x=>Math.round(parseFloat(x.replace(/[^0-9.]/g,''))*1000));return{salary:Math.max.apply(null,n),label:s.replace(/\s+/g,' ').trim()};}return{salary:0,label:null};}

// ── Supabase read path (fast) ──
async function fromSupabase(q,loc,cat,limit){
  try{
    let url=process.env.SUPABASE_URL;
    const key=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_SERVICE_KEY;
    if(!url||!key) return null; // not configured -> caller falls back to live
    url=url.trim().replace(/\/+$/,''); // strip trailing slash(es)
    if(!/^https?:\/\//i.test(url)) url='https://'+url; // ensure scheme
    let qs='select=*&order=match.desc&limit='+limit;
    if(cat==='eng')qs+='&category=eq.eng';
    else if(cat==='sales')qs+='&category=eq.sales';
    else qs+='&category=in.(eng,sales)';
    if(q)qs+='&or=(role.ilike.*'+encodeURIComponent(q)+'*,company.ilike.*'+encodeURIComponent(q)+'*,location.ilike.*'+encodeURIComponent(q)+'*)';
    const r=await fetch(url+'/rest/v1/jobs?'+qs,{headers:{apikey:key,authorization:'Bearer '+key}});
    if(!r.ok)return null;
    const rows=await r.json();
    if(!Array.isArray(rows))return null;
    return rows.map(j=>({role:j.role,company:j.company,sector:j.sector,category:j.category,
      salary:j.salary,salaryLabel:j.salary_label,location:j.location,department:j.department,
      source:j.source,url:j.url,posted:j.posted,match:j.match}));
  }catch(e){
    console.error('fromSupabase error',String(e).slice(0,200));
    return null; // any failure -> safe fallback to live
  }
}

// ── live fallback (only used before Supabase is set up) ──
async function fetchAshby(c){const r=await fetch('https://api.ashbyhq.com/posting-api/job-board/'+c.slug+'?includeCompensation=true',{headers:{accept:'application/json'}});if(!r.ok)return[];const d=await r.json();return((d&&d.jobs)||[]).filter(j=>j.isListed!==false).map(j=>{const comp=j.compensation||{};const sal=parseSalary(comp.scrapeableCompensationSalarySummary||comp.compensationTierSummary||'');const loc=j.location||(j.isRemote?'Remote':'');return{role:j.title,company:c.name,sector:c.sector,category:categoryOf(j.title),salary:sal.salary,salaryLabel:sal.label,location:loc,department:j.department||'',source:'Ashby',url:j.jobUrl||j.applyUrl,posted:1};});}
async function fetchGreenhouse(c){const r=await fetch('https://boards-api.greenhouse.io/v1/boards/'+c.slug+'/jobs?content=true',{headers:{accept:'application/json'}});if(!r.ok)return[];const d=await r.json();return((d&&d.jobs)||[]).map(j=>({role:j.title,company:c.name,sector:c.sector,category:categoryOf(j.title),salary:0,salaryLabel:null,location:(j.location&&j.location.name)||'',department:(j.departments&&j.departments[0]&&j.departments[0].name)||'',source:'Greenhouse',url:j.absolute_url,posted:1}));}
async function fetchLever(c){const r=await fetch('https://api.lever.co/v0/postings/'+c.slug+'?mode=json',{headers:{accept:'application/json'}});if(!r.ok)return[];const d=await r.json();return(Array.isArray(d)?d:[]).map(j=>({role:j.text,company:c.name,sector:c.sector,category:categoryOf(j.text),salary:0,salaryLabel:null,location:(j.categories&&j.categories.location)||'',department:(j.categories&&j.categories.team)||'',source:'Lever',url:j.hostedUrl,posted:1}));}
function fetchCompany(c){const fn=c.ats==='greenhouse'?fetchGreenhouse:c.ats==='lever'?fetchLever:fetchAshby;return fn(c).catch(()=>[]);}
async function runBatched(items,worker,size){const out=[];for(let i=0;i<items.length;i+=size){const res=await Promise.all(items.slice(i,i+size).map(worker));res.forEach(a=>{if(a&&a.length)out.push.apply(out,a);});}return out;}
async function fromLive(q,loc,cat,limit){
  let jobs=await runBatched(COMPANIES,fetchCompany,25);
  if(loc==='nyc')jobs=jobs.filter(j=>NYC_RE.test(j.location));
  jobs=(cat==='eng')?jobs.filter(j=>j.category==='eng'):(cat==='sales')?jobs.filter(j=>j.category==='sales'):jobs.filter(j=>j.category==='eng'||j.category==='sales');
  if(q){const t=q.toLowerCase().split(/\s+/);jobs=jobs.filter(j=>{const h=(j.role+' '+j.company+' '+j.location).toLowerCase();return t.every(x=>h.includes(x));});}
  const seen=new Set();jobs=jobs.filter(j=>{const k=(j.company+'|'+j.role+'|'+j.location).toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
  return jobs.slice(0,limit).map((j,i)=>Object.assign({},j,{match:Math.max(80,98-Math.floor(i/3))}));
}

module.exports = async (req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','s-maxage=120, stale-while-revalidate=600');
  if(req.method==='OPTIONS')return res.status(200).end();
  try{
    const q=((req.query&&req.query.q)||'').toString().toLowerCase().trim();
    const loc=((req.query&&req.query.loc)||'nyc').toString().toLowerCase();
    const cat=((req.query&&req.query.cat)||'all').toString().toLowerCase();
    const limit=Math.min(parseInt((req.query&&req.query.limit)||'500',10)||500,1000);
    let jobs=await fromSupabase(q,loc,cat,limit);          // fast path
    let src='supabase';
    if(jobs===null){ jobs=await fromLive(q,loc,cat,limit); src='live'; } // fallback during setup
    return res.status(200).json({count:jobs.length,source:src,jobs});
  }catch(e){return res.status(500).json({error:'jobs_error',detail:String(e).slice(0,300),jobs:[]});}
};
