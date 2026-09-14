const BASE_URL = 'https://iresi.duckdns.org/api';

export async function fetchInterests() {
  try {
    const res = await fetch(`${BASE_URL}/profile/interests`);
    if (!res.ok) throw new Error('Failed to fetch interests');
    return await res.json();
  } catch (error) {
    return [
      { interest_id: 'investigative', label: 'Solving problems & analysing' },
      { interest_id: 'conventional', label: 'Organising & planning' },
      { interest_id: 'artistic', label: 'Creating & designing' },
      { interest_id: 'social', label: 'Helping & working with people' },
      { interest_id: 'enterprising', label: 'Leading & managing' },
      { interest_id: 'realistic', label: 'Building & fixing systems' }
    ];
  }
}

export async function matchOccupations({ interest_ids, skill_ids = [], region = 'Victoria' }) {
  try {
    const res = await fetch(`${BASE_URL}/occupations/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interest_ids, skill_ids, region })
    });
    if (!res.ok) throw new Error('Match API failed');
    return await res.json();
  } catch (error) {
    return [
      { rank: 1, occupation_id: '271133', title: 'Cyber Security Analyst', sector: 'Information and Communications Technology', match_score: 96, match_label: 'Strong match', skill_match_pct: 85, regional_demand_score: 90 },
      { rank: 2, occupation_id: '273333', title: 'Software Engineer', sector: 'Information and Communications Technology', match_score: 88, match_label: 'Strong match', skill_match_pct: 75, regional_demand_score: 82 },
      { rank: 3, occupation_id: '271134', title: 'Cloud Solutions Architect', sector: 'Information and Communications Technology', match_score: 84, match_label: 'Good match', skill_match_pct: 70, regional_demand_score: 78 },
      { rank: 4, occupation_id: '271135', title: 'Data Engineer', sector: 'Information and Communications Technology', match_score: 81, match_label: 'Good match', skill_match_pct: 65, regional_demand_score: 75 }
    ];
  }
}

export async function fetchOccupationAI(occupationId) {
  try {
    const res = await fetch(`${BASE_URL}/occupations/${occupationId}/ai`);
    if (!res.ok) throw new Error('AI data failed');
    return await res.json();
  } catch (error) {
    return {
      tasks: [
        { task_text: "Accepting responsibility for system security and disaster recovery planning", automation_score: 0.40, augmentation_score: 0.70 },
        { task_text: "Surveying computer site to determine future network needs and enhancements", automation_score: 0.50, augmentation_score: 0.70 },
        { task_text: "Designing and maintaining database architecture and data structures", automation_score: 0.40, augmentation_score: 0.70 }
      ],
      resilience_score: 78,
      resilience_label: "High",
      demand_label: "High — Currently in national shortage",
      avg_augmentation: 0.71,
      avg_automation: 0.48
    };
  }
}

export async function fetchSkillGap(occupationId, selectedSkills = ['python', 'critical thinking', 'git']) {
  try {
    const res = await fetch(`${BASE_URL}/skills/gap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ occupation_id: occupationId, selected_skills: selectedSkills })
    });
    if (!res.ok) throw new Error('Skill gap API failed');
    return await res.json();
  } catch (error) {
    return {
      occupation_id: occupationId,
      total_required: 12,
      matched_count: 4,
      missing_count: 8,
      match_percentage: 33,
      matched: [
        { id: 1, skill_id: "python", skill_name: "Python Programming", importance_score: 1.0, category: "software" },
        { id: 2, skill_id: "critical_thinking", skill_name: "Critical Thinking", importance_score: 0.9, category: "essential" },
        { id: 3, skill_id: "git", skill_name: "Version Control (Git)", importance_score: 0.85, category: "software" },
        { id: 4, skill_id: "problem_solving", skill_name: "Complex Problem Solving", importance_score: 0.8, category: "transferable" }
      ],
      missing: [
        { id: 5, skill_id: "aws", skill_name: "Amazon Web Services (AWS)", importance_score: 0.95, category: "software" },
        { id: 6, skill_id: "cyber_sec", skill_name: "Network Security Architecture", importance_score: 0.90, category: "software" },
        { id: 7, skill_id: "risk_mgmt", skill_name: "Risk Assessment & Compliance", importance_score: 0.85, category: "essential" },
        { id: 8, skill_id: "identity_mgmt", skill_name: "Identity & Access Management", importance_score: 0.75, category: "essential" }
      ]
    };
  }
}

export async function fetchRegionalOccupations() {
  try {
    const res = await fetch(`${BASE_URL}/regional/occupations`);
    if (!res.ok) throw new Error('Regional occupations failed');
    return await res.json();
  } catch (error) {
    return [
      { anzsco4_code: 2611, anzsco4_name: "ICT Business and Systems Analysts" },
      { anzsco4_code: 2612, anzsco4_name: "Multimedia Specialists and Web Developers" },
      { anzsco4_code: 2613, anzsco4_name: "Software and Applications Programmers" },
      { anzsco4_code: 2621, anzsco4_name: "Database and Systems Administrators, and ICT Security Specialists" },
      { anzsco4_code: 2631, anzsco4_name: "Computer Network Professionals" }
    ];
  }
}

export async function fetchRegionalOpportunity(anzsco4Code, stateName = '') {
  try {
    let url = `${BASE_URL}/regional/opportunity?anzsco4=${anzsco4Code}&limit=24`;
    if (stateName) url += `&state=${encodeURIComponent(stateName)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Opportunity API failed');
    return await res.json();
  } catch (error) {
    return [
      { state_name: 'NSW', employment_value: 1234 },
      { state_name: 'ACT', employment_value: 123 },
      { state_name: 'VIC', employment_value: 789 },
      { state_name: 'QLD', employment_value: 540 },
      { state_name: 'WA', employment_value: 410 }
    ];
  }
}