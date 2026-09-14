const BASE_URL = '/api';

/**
 * Core API request handler with logging and error checking
 */
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

  // 🚀 Log Outgoing Request
  console.group(`🌐 [API Request] ${method} ${url}`);
  console.log('📍 Endpoint:', endpoint);
  console.log('🛠️ Headers:', headers);
  if (config.body) {
    try {
      console.log('📦 Payload:', JSON.parse(config.body));
    } catch {
      console.log('📦 Payload (raw):', config.body);
    }
  }
  console.groupEnd();

  try {
    const res = await fetch(url, config);
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : null;

    if (!res.ok) {
      console.group(`❌ [API Error ${res.status}] ${method} ${url}`);
      console.log('Error Data:', data?.error || data);
      console.groupEnd();
      throw new Error(data?.error || `HTTP error ${res.status}`);
    }

    // ✅ Log Incoming Response
    console.group(`✅ [API Response ${res.status}] ${method} ${url}`);
    console.log('Response Payload:', data);
    console.groupEnd();

    return data;
  } catch (err) {
    console.error(`💥 [API Network Error] ${method} ${url}`, err.message);
    throw err;
  }
}

// --- ITERATION 1: CORE MATCHING & AI ---

export async function getInterests() {
  return request('/profile/interests');
}

// Endpoint to populate autocomplete suggestions when typing skills
export async function getSkills() {
  return request('/skills');
}

export async function matchOccupations({ interest_ids, skill_ids = [], region = '' }) {
  const payload = { interest_ids };
  if (skill_ids && skill_ids.length > 0) payload.skill_ids = skill_ids;
  if (region) payload.region = region;

  return request('/occupations/match', {
    method: 'POST',
    body: payload
  });
}

export async function getOccupationAI(occupationId) {
  if (!occupationId) throw new Error("occupationId is required");
  return request(`/occupations/${occupationId}/ai`);
}

// --- ITERATION 2: DEEP DIVES (SKILL GAP & REGIONAL) ---

export async function getSkillGap(occupationId, selectedSkills = []) {
  if (!occupationId) throw new Error("occupationId is required");
  
  return request('/skills/gap', {
    method: 'POST',
    body: {
      occupation_id: String(occupationId),
      selected_skills: selectedSkills
    }
  });
}

export async function getRegionalOccupations() {
  return request('/regional/occupations');
}

export async function getRegionalOpportunity(anzsco4Code, state = '', limit = 50) {
  if (!anzsco4Code) throw new Error("anzsco4Code is required");
  
  const params = new URLSearchParams({ anzsco4: String(anzsco4Code), limit: String(limit) });
  if (state) params.append('state', state);

  return request(`/regional/opportunity?${params.toString()}`);
}

export async function getRegionalDemand(state = '') {
  const params = new URLSearchParams();
  if (state) params.append('state', state);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  return request(`/regional/demand${queryString}`);
}

// HELPER: Fetch multiple regions concurrently for the comparison chart in the wireframe
export async function getMultiRegionOpportunity(anzsco4Code, selectedStates = [], limit = 50) {
  if (!selectedStates || selectedStates.length === 0) return [];
  
  const promises = selectedStates.map(state => 
    getRegionalOpportunity(anzsco4Code, state, limit)
  );
  
  const results = await Promise.all(promises);
  return results.flat();
}