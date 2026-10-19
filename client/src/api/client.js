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
// Occupations the user can pick from.
export async function getRegionalOccupations() {
  const data = await request('/v3/occupations');
  return (data?.occupations || []).map(o => ({
    anzsco4_code: o.anzsco_code,
    anzsco4_name: o.name,
  }));
}

// Employment by state for one occupation: [{ state, opportunities }]
export async function getMultiRegionOpportunity(anzsco4Code, regions) {
  const data = await request(`/v3/regional/${anzsco4Code}`);
  const snapshot = data?.state_snapshot || [];
  return regions.map(state => ({
    state,
    opportunities: snapshot.find(s => s.state === state)?.employed || 0,
  }));
}

// Vacancies for one state. The vacancy route is keyed by the 2-digit ANZSCO group of the occupation
// being viewed. It only exists for some groups (ICT is 26), so any other group returns [] and the
// page simply shows no vacancy figure.
export async function getRegionalDemand(regionCode, anzsco4Code = '') {
  const anzsco2 = String(anzsco4Code).slice(0, 2);
  if (!anzsco2) return [];
  try {
    const data = await request(`/v3/regional/${anzsco2}/vacancies`);
    const stateData = (data?.state_snapshot || []).find(s => s.state === regionCode);
    return stateData
      ? [{ month: data.latest_month, vacancy_3m_moving_average: stateData.vacancies }]
      : [];
  } catch {
    return [];
  }
}

// Step 7 — Chatbot
export async function sendChat({ message, conversationHistory = [], profileContext = {} }) {
  if (!message?.trim()) throw new Error('message is required');
  return request('/chat', { method: 'POST', body: { message: message.trim(), conversationHistory, profileContext } });
}

export const BASE_URL_EXPORT = BASE_URL;