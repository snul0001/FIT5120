export const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const method = options.method || 'GET';
  const headers = { 'Accept': 'application/json', ...options.headers };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  try {
    const res = await fetch(url, { ...options, method, headers });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : null;
    if (!res.ok) {
      const error = new Error(data?.error || `HTTP error ${res.status}`);
      error.status = res.status; error.data = data; throw error;
    }
    return data;
  } catch (err) {
    console.error(`[API Error] ${method} ${url}:`, err.message); throw err;
  }
}

// Step 1 — Quiz match (unchanged)
// Step 1 — Quiz matching
export async function matchOccupations({
  interest_ids,
  interest_codes,
} = {}) {
  const interests = interest_codes ?? interest_ids;

  const values = Array.isArray(interests)
    ? interests
    : interests
      ? [interests]
      : [];

  if (!values.length) {
    throw new Error('matchOccupations requires interest codes');
  }

  const riasecMap = {
    realistic: 'R',
    investigative: 'I',
    artistic: 'A',
    social: 'S',
    enterprising: 'E',
    conventional: 'C',
  };

  const codes = values.map(value => {
    const code = String(value).trim().toUpperCase();

    if (/^[RIASEC]$/.test(code)) return code;

    const mapped = riasecMap[String(value).trim().toLowerCase()];

    if (!mapped) {
      throw new Error(`Invalid RIASEC interest: ${value}`);
    }

    return mapped;
  });

  return request('/v3/occupations/match', {
    method: 'POST',
    body: {
      interest_codes: [...new Set(codes)],
    },
  });
}

// Step 2 — Career results (v3)
export async function getOccupationAI(anzscoCode) {
  if (!anzscoCode) throw new Error('anzscoCode is required');
  return request(`/v3/occupations/${anzscoCode}`);
}
export async function getOccupationTasks(anzscoCode) {
  if (!anzscoCode) throw new Error('anzscoCode is required');
  return request(`/v3/occupations/${anzscoCode}/tasks`);
}

// Step 3 — Skill gap (v3)
export async function getSkillGap(anzscoCode, userSkills = []) {
  if (!anzscoCode) throw new Error('anzscoCode is required');
  return request('/v3/skills/gap', {
    method: 'POST',
    body: { anzsco_code: String(anzscoCode), user_skills: Array.isArray(userSkills) ? userSkills : [] }
  });
}

// Step 4 — Learning plan (v3)
export async function createLearningPlan({ anzscoCode, occupationName, durationMonths, hrsPerWeek, missingSkills }) {
  return request('/v3/plans', {
    method: 'POST',
    body: {
      anzsco_code: String(anzscoCode),
      occupation_name: occupationName,
      duration_months: durationMonths,
      hrs_per_week: hrsPerWeek,
      missing_skills: missingSkills,
    }
  });
}

// Step 5 — Progress tracker (v3)
export async function getPlanByCode(code) {
  if (!code) throw new Error('code is required');
  return request(`/v3/plans/${code}`);
}
export async function updatePlanProgress(code, phases) {
  if (!code) throw new Error('code is required');
  return request(`/v3/plans/${code}`, { method: 'PATCH', body: { phases } });
}

// Step 6 — Regional (v3)
export async function getRegionalData(anzscoCode) {
  return request(`/v3/regional/${anzscoCode}`);
}
export async function getRegionalVacancies(anzscoCode) {
  return request(`/v3/regional/${String(anzscoCode).slice(0, 2)}/vacancies`);
}

// Regional Insights page (RegionalInsights.jsx)
// TODO: these three are imported by RegionalInsights.jsx but no v3 routes were provided,
// so they fail loudly instead of guessing an endpoint. Replace each body with the real request, e.g.
//   return request(`/v3/...`);
const regionalNotConfigured = name => {
  throw new Error(`${name}: API route not configured in api/client.js`);
};
export async function getRegionalOccupations() { return regionalNotConfigured('getRegionalOccupations'); }
export async function getMultiRegionOpportunity(/* anzsco4Code, regions */) { return regionalNotConfigured('getMultiRegionOpportunity'); }
export async function getRegionalDemand(/* regionCode */) { return regionalNotConfigured('getRegionalDemand'); }

// Step 7 — Chatbot
export async function sendChat({ message, conversationHistory = [], profileContext = {} }) {
  if (!message?.trim()) throw new Error('message is required');
  return request('/chat', { method: 'POST', body: { message: message.trim(), conversationHistory, profileContext } });
}

// Legacy — used by PDF export in App.jsx
export async function getSkills(limit = 400) {
  let page = 1, all = [], hasNext = true;
  do {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const data = await request(`/profile/skills?${params}`);
    const batch = data?.skills ? data.skills.map(s => s.label) : [];
    if (!batch.length) { hasNext = false; } else { all.push(...batch); page++; }
  } while (hasNext);
  return all;
}

export const BASE_URL_EXPORT = BASE_URL;