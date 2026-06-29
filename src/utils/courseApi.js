import AsyncStorage from '@react-native-async-storage/async-storage';

// Sign up at golfcourseapi.com and paste your key here (or load from env)
const API_KEY  = 'YOUR_API_KEY_HERE';
const BASE_URL = 'https://api.golfcourseapi.com/v1';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Key ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function searchCoursesByName(query) {
  const data = await apiFetch(`/courses/search?search_query=${encodeURIComponent(query)}`);
  return normalizeCourseList(data);
}

export async function searchCoursesByLocation(lat, lng) {
  const data = await apiFetch(`/courses/search?latitude=${lat}&longitude=${lng}`);
  return normalizeCourseList(data);
}

export async function getCourseDetails(courseId, teeName) {
  const cacheKey = `course_${courseId}_${teeName}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    const { data, ts } = JSON.parse(cached);
    if (Date.now() - ts < CACHE_TTL_MS) return data;
  }

  const raw = await apiFetch(`/courses/${courseId}`);
  const data = normalizeCourseDetail(raw, teeName);
  await AsyncStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
  return data;
}

// ---------- normalizers (adjust if actual API shape differs) ----------

function normalizeCourseList(raw) {
  const list = raw.courses ?? raw.data ?? raw ?? [];
  return list.map(c => ({
    id:   String(c.id ?? c.course_id),
    name: [c.club_name, c.course_name].filter(Boolean).join(' — ') || c.name || 'Unknown',
    city: c.location?.city ?? c.city ?? '',
    state: c.location?.state ?? c.state ?? '',
  }));
}

function normalizeCourseDetail(raw, teeName) {
  // Try male tees first, then female, then flat array
  const allTees = raw.tees?.male ?? raw.tees?.female ?? raw.tees ?? [];
  const tee = allTees.find(t =>
    (t.tee_name ?? t.name ?? '').toLowerCase() === teeName.toLowerCase()
  ) ?? allTees[0] ?? {};

  const holes = (tee.holes ?? raw.holes ?? []).map(h => ({
    number:   h.number ?? h.hole_number ?? 0,
    par:      h.par ?? 4,
    yardage:  h.yardage ?? h.yards ?? 0,
    handicap: h.handicap ?? h.stroke_index ?? 0,
  }));

  return {
    id:       String(raw.id ?? raw.course_id),
    name:     [raw.club_name, raw.course_name].filter(Boolean).join(' — ') || raw.name || 'Unknown',
    tee:      tee.tee_name ?? tee.name ?? teeName,
    totalPar: holes.reduce((s, h) => s + h.par, 0),
    holes,
  };
}

export async function getAvailableTees(courseId) {
  const raw = await apiFetch(`/courses/${courseId}`);
  const male   = (raw.tees?.male   ?? []).map(t => t.tee_name ?? t.name);
  const female = (raw.tees?.female ?? []).map(t => t.tee_name ?? t.name);
  // deduplicate
  return [...new Set([...male, ...female])].filter(Boolean);
}

export async function getRecentCourses() {
  const raw = await AsyncStorage.getItem('recent_courses');
  return raw ? JSON.parse(raw) : [];
}

export async function addRecentCourse(course) {
  const current = await getRecentCourses();
  const updated = [course, ...current.filter(c => c.id !== course.id)].slice(0, 5);
  await AsyncStorage.setItem('recent_courses', JSON.stringify(updated));
}
