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

// Parse a scorecard image using Claude vision (via a Supabase Edge Function
// so the Anthropic API key never ships in the client bundle) and return
// structured hole data
export async function parseScorecardImage(base64Image, mimeType = 'image/jpeg') {
  const { data, error } = await supabase.functions.invoke('parse-scorecard', {
    body: { base64Image, mimeType },
  });
  if (error) throw error;
  return data.holes;
}
