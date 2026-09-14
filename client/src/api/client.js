const BASE_URL = 'https://iresi.duckdns.org/api';

async function handleResponse(res) {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }
  return res.json();
}

// --- ITERATION 1 ENDPOINTS ---

export async function getInterests() {
  const res = await fetch(`${BASE_URL}/profile/interests`);
  return handleResponse(res);
}

export async function matchOccupations({ interest_ids, skill_ids = [], region = '' }) {
  const payload = { interest_ids };
  // Only attach optional fields if they contain data to prevent 400 errors
  if (skill_ids && skill_ids.length > 0) payload.skill_ids = skill_ids;
  if (region) payload.region = region;

  const res = await fetch(`${BASE_URL}/occupations/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function getOccupationAI(occupationId) {
  const res = await fetch(`${BASE_URL}/occupations/${occupationId}/ai`);
  return handleResponse(res);
}

// --- ITERATION 2 ENDPOINTS ---

export async function getSkillGap(occupationId, selectedSkills = []) {
  const res = await fetch(`${BASE_URL}/skills/gap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      occupation_id: occupationId,
      selected_skills: selectedSkills
    })
  });
  return handleResponse(res);
}

export async function getRegionalOccupations() {
  const res = await fetch(`${BASE_URL}/regional/occupations`);
  return handleResponse(res);
}

export async function getRegionalOpportunity(anzsco4Code, state = '', limit = 50) {
  const params = new URLSearchParams({ anzsco4: anzsco4Code, limit });
  if (state) params.append('state', state);

  const res = await fetch(`${BASE_URL}/regional/opportunity?${params.toString()}`);
  return handleResponse(res);
}

export async function getRegionalDemand(state = '') {
  const params = new URLSearchParams();
  if (state) params.append('state', state);

  const res = await fetch(`${BASE_URL}/regional/demand?${params.toString()}`);
  return handleResponse(res);
}