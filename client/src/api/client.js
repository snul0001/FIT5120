export const BASE_URL = '/api';

// Map UI state abbreviations to strict API state names
export const STATE_NAME_MAP = {
  ACT: 'ACT',
  NSW: 'NSW',
  NT: 'NT',
  QLD: 'QLD',
  SA: 'SA',
  TAS: 'TAS',
  VIC: 'VIC',
  WA: 'WA'
};

export const REVERSE_STATE_MAP = Object.entries(STATE_NAME_MAP).reduce((acc, [abbr, full]) => {
  acc[full] = abbr;
  return acc;
}, {});



// Core API request handler
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const method = options.method || 'GET';
  
  const headers = {
    'Accept': 'application/json',
    ...options.headers,
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const config = {
    ...options,
    method,
    headers,
  };

  try {
    const res = await fetch(url, config);
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : null;

    if (!res.ok) {
      const error = new Error(data?.error || `HTTP error ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    console.error(`💥 [API Error] ${method} ${url}:`, err.message);
    throw err;
  }
}

// --- PROFILE & OCCUPATIONS ---

export async function getInterests() {
  return request('/profile/interests');
}

export async function getSkills(limit = 400, search = '') {
  let page = 1;
  let suggested_skills = [];
  let hasNextPage = true;
  do {
    let params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const newReqData = await request(`/profile/skills?${params.toString()}`);
    const newReq = newReqData?.skills ? newReqData.skills.map(skill => skill.label) : [];

    if (newReq.length == 0) { hasNextPage = false; }
    else {hasNextPage = true; suggested_skills.push(...newReq); page += 1;}
  } while (hasNextPage);

  return suggested_skills;
}

export async function matchOccupations({ interest_ids, skill_ids = [], region = '' }) {
  const ids = Array.isArray(interest_ids) 
    ? interest_ids 
    : (interest_ids ? [String(interest_ids)] : []);

  if (ids.length === 0) {
    throw new Error('matchOccupations requires a non-empty array of interest_ids');
  }

  const payload = { interest_ids: ids };
  if (skill_ids.length > 0) payload.skill_ids = skill_ids;
  if (region) payload.region = STATE_NAME_MAP[region] || region;

  return request('/occupations/match', {
    method: 'POST',
    body: payload
  });
}

export async function getOccupationAI(occupationId) {
  if (!occupationId) throw new Error("occupationId is required");
  return request(`/occupations/${occupationId}/ai`);
}

// --- SKILL GAP CHECK ---

export async function getSkillGap(occupationId, selectedSkills = []) {
  if (!occupationId) throw new Error("occupationId is required");
  
  return await request('/skills/gap', {
    method: 'POST',
    body: {
      occupation_id: String(occupationId),
      selected_skills: Array.isArray(selectedSkills) ? selectedSkills : [],
    }
  });
}

// --- REGIONAL INSIGHTS ---

export async function getRegionalOccupations() {
  return request('/regional/occupations');
}

export async function getRegionalOpportunity(anzsco4Code, state = '', limit = 50) {
  if (!anzsco4Code) throw new Error("anzsco4Code is required");
  
  const apiState = STATE_NAME_MAP[state] || state;
  const params = new URLSearchParams({ anzsco4: String(anzsco4Code), limit: String(limit) });
  if (apiState) params.append('state', apiState);

  return request(`/regional/opportunity?${params.toString()}`);
}

export async function getRegionalDemand(state = '') {
  const apiState = STATE_NAME_MAP[state] || state;
  const params = new URLSearchParams();
  if (apiState) params.append('state', apiState);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  return request(`/regional/demand${queryString}`);
}

/**
 * Aggregates employment numbers for selected regions to populate the comparison chart
 */
export async function getMultiRegionOpportunity(anzsco4Code, selectedStates = []) {
  if (!selectedStates || selectedStates.length === 0) return [];
  
  const promises = selectedStates.map(async (abbr) => {
    const fullState = STATE_NAME_MAP[abbr] || abbr;
    const records = await getRegionalOpportunity(anzsco4Code, fullState, 50);
    
    if (!records || records.length === 0) return { state: abbr, opportunities: 0 };
    
    // Extract most recent month in dataset
    const latestMonth = records[0].month;
    const latestRecords = records.filter(r => r.month === latestMonth);
    const totalJobs = latestRecords.reduce((sum, r) => sum + (Number(r.employment_value) || 0), 0);
    
    return {
      state: abbr,
      fullState,
      opportunities: totalJobs,
      month: latestMonth
    };
  });
  
  return Promise.all(promises);
}