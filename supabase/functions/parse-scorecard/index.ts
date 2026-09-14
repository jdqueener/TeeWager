import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: CORS });
  }

  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'Anthropic key not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => null);
  if (!body?.base64Image) {
    return new Response(JSON.stringify({ error: 'base64Image required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { base64Image, mimeType = 'image/jpeg' } = body;

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          {
            type: 'text',
            text: 'This is a golf scorecard. Extract the hole number, par, and yardage for each hole. Return ONLY a JSON array with no extra text, like: [{"number":1,"par":4,"yardage":385},{"number":2,"par":3,"yardage":145},...]. If yardage is not visible for a hole use 0. Include all holes shown.',
          },
        ],
      }],
    }),
  });

  if (!anthropicRes.ok) {
    return new Response(JSON.stringify({ error: `Vision API error ${anthropicRes.status}` }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const result = await anthropicRes.json();
  const text = result.content?.[0]?.text ?? '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Could not parse scorecard data' }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let holes;
  try {
    holes = JSON.parse(match[0]);
  } catch {
    return new Response(JSON.stringify({ error: 'Could not parse scorecard data' }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ holes }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
