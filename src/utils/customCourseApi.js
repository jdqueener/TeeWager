import { supabase } from './supabase';

// Search shared custom courses by name (case-insensitive)
export async function searchCustomCourses(query) {
  const { data, error } = await supabase
    .from('custom_courses')
    .select('id, name, holes')
    .ilike('name', `%${query}%`)
    .limit(10);
  if (error) throw error;
  return (data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    holes: c.holes,
    custom: true,
  }));
}

// Save a new custom course and return it with its generated id
export async function saveCustomCourse(name, holes) {
  const { data: { session } } = await supabase.auth.getSession();
  const created_by = session?.user?.id ?? null;
  const { data, error } = await supabase
    .from('custom_courses')
    .insert({ name, holes, created_by })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, holes: data.holes, custom: true };
}

// Parse a scorecard image using Claude vision and return structured hole data
export async function parseScorecardImage(base64Image, mimeType = 'image/jpeg') {
  const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  if (!ANTHROPIC_KEY) throw new Error('Anthropic key not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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

  if (!response.ok) throw new Error(`Vision API error ${response.status}`);
  const result = await response.json();
  const text = result.content?.[0]?.text ?? '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Could not parse scorecard data');
  return JSON.parse(match[0]);
}
