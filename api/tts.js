// Launched voice (ElevenLabs TTS) - Vercel serverless function
// Place at /api/tts.js. Requires env var ELEVENLABS_API_KEY.
// Optional env: ELEVENLABS_VOICE_ID (defaults to "Rachel"), ELEVENLABS_MODEL.
//
// Frontend POSTs { text: "..." } and gets back MP3 audio bytes.

const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // "Rachel" - warm, natural
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'; // fast + high quality

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing ELEVENLABS_API_KEY environment variable.' });

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    let text = (body && body.text ? String(body.text) : '').trim();
    if (!text) return res.status(400).json({ error: 'No text provided.' });

    // keep requests snappy + within limits
    if (text.length > 2500) text = text.slice(0, 2500);
    const voiceId = (body && body.voiceId) || DEFAULT_VOICE;

    const elRes = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_128',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
          'accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: text,
          model_id: MODEL,
          voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true }
        })
      }
    );

    if (!elRes.ok) {
      const errText = await elRes.text();
      console.error('ElevenLabs error', elRes.status, errText);
      return res.status(502).json({ error: 'TTS upstream error', detail: errText.slice(0, 400) });
    }

    const arrayBuf = await elRes.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    console.error('TTS server error', e);
    return res.status(500).json({ error: 'Server error', detail: String(e).slice(0, 300) });
  }
};
