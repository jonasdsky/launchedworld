// ─────────────────────────────────────────────────────────────
// Launched AI chat — Vercel serverless function
// Deploy: place at /api/chat.js in your repo.
// Set env var ANTHROPIC_API_KEY in Vercel (Project → Settings → Environment Variables).
// Optionally set ANTHROPIC_MODEL (defaults below).
// ─────────────────────────────────────────────────────────────

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

const SYSTEM_STUDENTS = `You are the Launched AI career guide, embedded on the Launched website (launched.life).

ABOUT LAUNCHED
Launched is a two-sided talent marketplace connecting exceptional university graduates and early-career people with the most exciting companies in emerging industries: AI, defense tech, clean energy, robotics, biotech, and space. The model: a candidate has a short AI discovery conversation, gets matched with a few curated roles, and a human operator makes a warm, personal introduction to the company. It is completely free for candidates. Launched evaluates on merit and trajectory, not school prestige — a driven graduate from any university is treated the same as one from an Ivy. Average starting salary in matched roles is around $90k; technical roles in AI and robotics often exceed $120k. Average time from first conversation to a signed offer is about three weeks.

YOUR JOB
Answer the person's career questions with genuinely useful, specific, and honest advice. Give real substance — concrete steps, real insight into how these industries hire, what actually matters, and how to stand out. Be warm, direct, and encouraging without being generic or fluffy. Keep answers to 2–4 short paragraphs. Where it fits naturally, mention that building a Launched profile is the fastest way to get matched — but never be pushy or salesy, and never force it if the question doesn't call for it.

RULES
- Be concrete and honest. If something is hard, say so, then say how to approach it.
- Do not invent specific current job openings or claim a specific company is hiring a specific role right now. You may reference well-known companies illustratively.
- Never fabricate statistics beyond the general figures above.
- Stay focused on careers, jobs, and the emerging industries Launched serves.
- Write in plain, natural prose. No headers, no bullet-point dumps unless the person asks for a list.`;

const SYSTEM_COMPANIES = `You are the Launched AI hiring guide, embedded on the Launched website (launched.life).

ABOUT LAUNCHED
Launched is a two-sided talent marketplace that sources exceptional, pre-vetted talent for companies building in emerging industries: AI, defense tech, clean energy, robotics, biotech, and space. The model for companies: you tell Launched the role and what "great" looks like; Launched taps its pre-vetted talent pool, runs an AI discovery conversation on candidates, and a human operator personally introduces the best fits. Companies interview only people Launched would personally vouch for. Pricing is a placement-fee model — the company pays only when it successfully hires someone Launched introduced. No retainers, no subscriptions, no upfront cost. Average time from role intake to first qualified candidate is measured in days; time-to-hire in weeks, not months.

YOUR JOB
Answer the founder's or hiring manager's questions with sharp, specific, genuinely useful advice on sourcing, vetting, compensation benchmarks, time-to-hire, and building teams in emerging industries. Be confident, substantive, and honest. Keep answers to 2–4 short paragraphs. Where it fits naturally, mention that a quick intro call is the fastest way to see candidates — but never be pushy or salesy.

RULES
- Be concrete and honest. Give real hiring insight, not platitudes.
- Do not invent specific candidates or fabricate specific market data beyond the general figures above.
- You may reference well-known companies illustratively.
- Stay focused on hiring, talent, and team-building in the industries Launched serves.
- Write in plain, natural prose. No headers, no bullet-point dumps unless the person asks for a list.`;

export default async function handler(req, res) {
  // CORS (same-origin in production; permissive helps local testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY environment variable.' });

  try {
    // Parse body (Vercel may pass string or object)
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const mode = body && body.mode === 'companies' ? 'companies' : 'students';
    let messages = (body && Array.isArray(body.messages)) ? body.messages : [];

    // Keep only role/content, clamp history to the last 10 turns
    messages = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10);
    if (!messages.length) return res.status(400).json({ error: 'No messages provided.' });

    const system = mode === 'companies' ? SYSTEM_COMPANIES : SYSTEM_STUDENTS;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(502).json({ error: 'Upstream error', detail: errText.slice(0, 500) });
    }

    const data = await anthropicRes.json();
    const reply = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return res.status(200).json({ reply: reply || "I'm not sure how to answer that — could you rephrase?" });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: String(e).slice(0, 300) });
  }
}
