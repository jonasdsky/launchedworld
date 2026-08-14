// Launched — job sync function
// Fetches ALL companies across Ashby + Greenhouse + Lever, normalizes, filters to
// NYC + sales/engineering, and upserts them into Supabase.
// Runs nightly via Vercel Cron (see vercel.json) and can be triggered manually.
//
// Requires env vars:
//   SUPABASE_URL             (from Supabase → Settings → API → Project URL)
//   SUPABASE_SERVICE_KEY     (from Supabase → Settings → API → service_role key — keep secret!)
//   CRON_SECRET              (any random string; protects manual triggers)

const COMPANIES = require('./companies');
const crypto = require('crypto');

const NYC_RE = /(new york|nyc|manhattan|brooklyn|\bny\b|new york city|ny,|, ny)/i;
const ENG_RE = /(engineer|developer|swe|software|backend|frontend|full[- ]?stack|infrastructure|platform|data|ml|machine learning|devops|sre|security|mobile|ios|android|architect)/i;
const SALES_RE = /(sales|account executive|\bae\b|account manager|business development|\bbdr\b|\bsdr\b|revenue|go[- ]to[- ]market|\bgtm\b|partnerships|customer success|solutions engineer)/i;

function inferSector(t){t=(t||'').toLowerCase();
  if(/defense|defence|military|govtech|weapon|aerospace|missile/.test(t))return 'def';
  if(/robot|autonom|hardware|mechatron/.test(t))return 'rob';
  if(/energy|fusion|solar|grid|battery|climate|nuclear/.test(t))return 'energy';
  return 'ai';}
function categoryOf(t){return ENG_RE.test(t)?'eng':SALES_RE.test(t)?'sales':'other';}
function parseSalary(s){if(!s)return{salary:0,label:null};
  const k=s.match(/\$\s?(\d+(?:\.\d+)?)\s?[kK]/g);
  if(k&&k.length){const n=k.map(x=>Math.round(parseFloat(x.replace(/[^0-9.]/g,''))*1000));return{salary:Math.max.apply(null,n),label:s.replace(/\s+/g,' ').trim()};}
  const f=s.match(/\$\s?\d{2,3}(?:,\d{3})+/g);
  if(f&&f.length){const n=f.map(x=>parseInt(x.replace(/[^0-9]/g,''),10));return{salary:Math.max.apply(null,n),label:s.replace(/\s+/g,' ').trim()};}
  return{salary:0,label:null};}
function jid(company,role,location){return crypto.createHash('sha1').update((company+'|'+role+'|'+location).toLowerCase()).digest('hex').slice(0,24);}

function row(j,company,sector){
  const cat=categoryOf(j.role);
  return {id:jid(company,j.role,j.location||''),role:j.role,company:company,
    sector:sector||inferSector(j.role+' '+(j.department||'')),category:cat,
    salary:j.salary||0,salary_label:j.salaryLabel||null,location:j.location||'Remote',
    department:j.department||'',source:j.source,url:j.url||'#',posted:1,match:85};
}

async function fetchAshby(c){
  const r=await fetch('https://api.ashbyhq.com/posting-api/job-board/'+c.slug+'?includeCompensation=true',{headers:{accept:'application/json'}});
  if(!r.ok)return[];const d=await r.json();
  return((d&&d.jobs)||[]).filter(j=>j.isListed!==false).map(j=>{
    const comp=j.compensation||{};const sal=parseSalary(comp.scrapeableCompensationSalarySummary||comp.compensationTierSummary||'');
    const loc=j.location||(j.address&&j.address.postalAddress&&j.address.postalAddress.addressLocality)||(j.isRemote?'Remote':'');
    return row({role:j.title,salary:sal.salary,salaryLabel:sal.label,location:loc,department:j.department||'',source:'Ashby',url:j.jobUrl||j.applyUrl},c.name,c.sector);});
}
async function fetchGreenhouse(c){
  const r=await fetch('https://boards-api.greenhouse.io/v1/boards/'+c.slug+'/jobs?content=true',{headers:{accept:'application/json'}});
  if(!r.ok)return[];const d=await r.json();
  return((d&&d.jobs)||[]).map(j=>row({role:j.title,location:(j.location&&j.location.name)||'',department:(j.departments&&j.departments[0]&&j.departments[0].name)||'',source:'Greenhouse',url:j.absolute_url},c.name,c.sector));
}
async function fetchLever(c){
  const r=await fetch('https://api.lever.co/v0/postings/'+c.slug+'?mode=json',{headers:{accept:'application/json'}});
  if(!r.ok)return[];const d=await r.json();
  return(Array.isArray(d)?d:[]).map(j=>row({role:j.text,location:(j.categories&&j.categories.location)||'',department:(j.categories&&j.categories.team)||'',source:'Lever',url:j.hostedUrl||j.applyUrl},c.name,c.sector));
}
function fetchCompany(c){const fn=c.ats==='greenhouse'?fetchGreenhouse:c.ats==='lever'?fetchLever:fetchAshby;return fn(c).catch(()=>[]);}

async function runBatched(items,worker,size){const out=[];for(let i=0;i<items.length;i+=size){const chunk=items.slice(i,i+size);const res=await Promise.all(chunk.map(worker));res.forEach(a=>{if(a&&a.length)out.push.apply(out,a);});}return out;}

module.exports = async (req,res)=>{
  // protect the endpoint: allow Vercel Cron (adds this header) or a matching secret
  const secret=process.env.CRON_SECRET;
  const auth=(req.headers['authorization']||'')===('Bearer '+secret);
  const isCron=req.headers['x-vercel-cron']!=null;
  if(secret && !auth && !isCron) return res.status(401).json({error:'unauthorized'});

  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_KEY;
  if(!url||!key) return res.status(500).json({error:'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'});

  try{
    let jobs=await runBatched(COMPANIES,fetchCompany,25);
    // NYC + sales/eng only
    jobs=jobs.filter(j=>NYC_RE.test(j.location)).filter(j=>j.category==='eng'||j.category==='sales');
    // dedupe by id
    const seen=new Set();jobs=jobs.filter(j=>{if(seen.has(j.id))return false;seen.add(j.id);return true;});

    // upsert into Supabase (PostgREST). Chunk to stay under payload limits.
    let written=0;
    for(let i=0;i<jobs.length;i+=200){
      const chunk=jobs.slice(i,i+200);
      const r=await fetch(url+'/rest/v1/jobs?on_conflict=id',{
        method:'POST',
        headers:{'content-type':'application/json','apikey':key,'authorization':'Bearer '+key,'prefer':'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(chunk)
      });
      if(r.ok)written+=chunk.length; else{const t=await r.text();console.error('upsert error',r.status,t.slice(0,300));}
    }
    return res.status(200).json({ok:true,companies:COMPANIES.length,fetched:jobs.length,written});
  }catch(e){return res.status(500).json({error:'sync_error',detail:String(e).slice(0,300)});}
};
