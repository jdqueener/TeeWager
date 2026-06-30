import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY  = 'FRXWXF5EXNPQJEIM7VOFO746SA';
const BASE_URL = 'https://api.golfcourseapi.com/v1';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Key ${API_KEY}` },
  });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function searchCoursesByName(query) {
  const data = await apiFetch(`/search?search_query=${encodeURIComponent(query)}`);
  return normalizeCourseList(data.courses ?? []);
}

export async function searchCoursesByLocation(lat, lng) {
  const data = await apiFetch(`/search?latitude=${lat}&longitude=${lng}`);
  return normalizeCourseList(data.courses ?? []);
}

export async function getAvailableTees(courseId) {
  // Tee names come from the course detail response
  const raw = await apiFetch(`/courses/${courseId}`);
  const course = raw.course ?? raw;
  const male   = (course.tees?.male   ?? []).map(t => t.tee_name).filter(Boolean);
  const female = (course.tees?.female ?? []).map(t => t.tee_name).filter(Boolean);
  return [...new Set([...male, ...female])];
}

export async function getCourseDetails(courseId, teeName) {
  const cacheKey = `course_${courseId}_${teeName}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    const { data, ts } = JSON.parse(cached);
    if (Date.now() - ts < CACHE_TTL_MS) return data;
  }

  const raw = await apiFetch(`/courses/${courseId}`);
  const course = raw.course ?? raw;
  const data = normalizeCourseDetail(course, teeName);
  await AsyncStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
  return data;
}

function normalizeCourseList(courses) {
  return courses.map(c => ({
    id:    String(c.id),
    name:  [c.club_name, c.course_name].filter(Boolean).join(' — ') || 'Unknown',
    city:  c.location?.city  ?? '',
    state: c.location?.state ?? '',
  }));
}

function normalizeCourseDetail(course, teeName) {
  const allTees = [...(course.tees?.male ?? []), ...(course.tees?.female ?? [])];
  const tee = allTees.find(t =>
    (t.tee_name ?? '').toLowerCase() === teeName.toLowerCase()
  ) ?? allTees[0] ?? {};

  const holes = (tee.holes ?? []).map((h, i) => ({
    number:   i + 1,
    par:      h.par      ?? 4,
    yardage:  h.yardage  ?? 0,
    handicap: h.handicap ?? 0,
  }));

  return {
    id:       String(course.id),
    name:     [course.club_name, course.course_name].filter(Boolean).join(' — ') || 'Unknown',
    tee:      tee.tee_name ?? teeName,
    totalPar: tee.par_total ?? holes.reduce((s, h) => s + h.par, 0),
    holes,
  };
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
