import React, { useEffect, useState } from 'react';
import {
  matchOccupations, getOccupationAI, getOccupationTasks, getSkillGap,
  getMultiRegionOpportunity, getRegionalDemand
} from '../api/client';
import { ArrowRight, UserRound, MapPin, ShieldCheck } from 'lucide-react';

// ─── Example profile used to pick the live example ───────────────────────────
const EXAMPLE_INTERESTS = ['investigative', 'conventional'];
const EXAMPLE_REGION = 'VIC';
const EXAMPLE_REGION_LABEL = 'Victoria';
const INTEREST_LABELS = {
  realistic: 'Building & fixing systems', investigative: 'Solving problems & analysing',
  artistic: 'Creating & designing', social: 'Helping & working with people',
  enterprising: 'Leading & managing', conventional: 'Organising & planning'
};
const exampleInterestLabels = EXAMPLE_INTERESTS.map(id => INTEREST_LABELS[id] || id).join(', ');
const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const MAX_CANDIDATES = 8;

const toPercent = v => typeof v === 'number' ? (v <= 1 ? Math.round(v * 100) : Math.round(v)) : null;
const capitalise = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

// ─── Cache: the example is stored for a few hours so repeat visits load instantly ─
const CACHE_KEY = 'iresi_home_example_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000;
const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    return data && Date.now() - at < CACHE_TTL ? data : null;
  } catch { return null; }
};
const writeCache = data => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch { /* storage unavailable */ }
};

// ─── Turning API responses into the small pieces the page shows ──────────────
const TASK_GROUPS = [
  ['Human-led', /human/i, 'bg-blue-500'],
  ['AI Augmented', /assist|augment/i, 'bg-emerald-500'],
  ['AI Automated', /automat/i, 'bg-amber-500']
];

const flattenTasks = res => {
  const grouped = res?.grouped;
  if (grouped && typeof grouped === 'object') {
    return Object.entries(grouped).flatMap(([group, items]) =>
      (Array.isArray(items) ? items : []).map(t => ({ ...t, group: t.impact_group || group })));
  }
  const list = Array.isArray(res?.tasks) ? res.tasks : Array.isArray(res) ? res : [];
  return list.map(t => ({ ...t, group: t.impact_group || t.category || '' }));
};
const taskTitle = t => capitalise(String(t.task_core || t.plain_english || t.short_explanation || t.task_text || '').trim());

// One task per group, so the panel shows the full range from human-led to automated.
const pickTasks = tasks =>
  TASK_GROUPS.map(([label, re, dot]) => {
    const t = tasks.find(task => re.test(task.group) && taskTitle(task));
    return t ? { label, dot, title: taskTitle(t) } : null;
  }).filter(Boolean);

const extractSkills = res => {
  const raw = res?.all_skills || res?.required_skills || [...(res?.matched || []), ...(res?.missing || [])];
  const all = raw
    .map(s => ({
      name: String(s?.name || s?.skill_name || s || '').trim(),
      importance: typeof s?.importance === 'number' ? s.importance : typeof s?.importance_score === 'number' ? s.importance_score * 10 : 0
    }))
    .filter(s => s.name)
    .sort((a, b) => b.importance - a.importance);
  return { list: all.slice(0, 6), total: all.length };
};

// Picks the first career whose data is complete, so no panel ever shows N/A.
// ICT careers go first because vacancy data only exists for ICT.
async function buildExample() {
  const matches = await matchOccupations({ interest_ids: EXAMPLE_INTERESTS, region: EXAMPLE_REGION });
  if (!Array.isArray(matches) || !matches.length) return null;

  const top = [...matches].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).slice(0, MAX_CANDIDATES);
  const isIct = m => String(m.anzsco_code).startsWith('26');
  const ordered = [...top.filter(isIct), ...top.filter(m => !isIct(m))];

  let best = null;
  for (const role of ordered) {
    const code = role.anzsco_code;
    const settled = await Promise.allSettled([
      getOccupationAI(code), getOccupationTasks(code), getSkillGap(code, []),
      getMultiRegionOpportunity(String(code).slice(0, 4), STATES), getRegionalDemand(EXAMPLE_REGION, code)
    ]);
    const [ai, tasksRes, gap, regional, demand] = settled.map(r => (r.status === 'fulfilled' ? r.value : null));

    const metrics = {
      resilience: toPercent(ai?.resilience_score), augmentation: toPercent(ai?.avg_augmentation), automation: toPercent(ai?.avg_automation)
    };
    const tasks = pickTasks(flattenTasks(tasksRes));
    const skills = extractSkills(gap);
    const states = (Array.isArray(regional) ? regional : []).filter(s => Number(s.opportunities) > 0).map(s => ({ state: s.state, value: Number(s.opportunities) }));
    const trend = (Array.isArray(ai?.employment_trend) ? ai.employment_trend : [])
      .map(r => ({ year: String(r.year), value: Number(r.employed_k) })).filter(r => r.year && Number.isFinite(r.value));
    const vacancy = Array.isArray(demand) && demand[0]?.vacancy_3m_moving_average != null ? Number(demand[0].vacancy_3m_moving_average) : null;

    // Core data every example must have.
    const core = Object.values(metrics).every(v => v !== null) && tasks.length >= 2 && skills.list.length >= 4;
    if (!core) continue;

    const score = (states.length >= 3 ? 1 : 0) + (trend.length >= 2 ? 1 : 0);
    const example = {
      role: { title: role.title, match_score: toPercent(role.match_score) },
      metrics, tasks, skills,
      states: states.length >= 3 ? states : [],
      trend: trend.length >= 2 ? trend : [],
      vacancy
    };
    if (!best || score > best.score) best = { score, example };
    if (score === 2) break;
  }
  return best ? best.example : null;
}

// ─── UI pieces (same look as before) ─────────────────────────────────────────
const Button = ({ onClick, children = 'Get started', className = '' }) => (
  <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 text-sm font-semibold text-[#176BC0] dark:text-blue-300 hover:text-[#0F4F96] dark:hover:text-blue-200 transition-colors ${className}`}>
    {children}<ArrowRight className="w-4 h-4" />
  </button>
);

const PrimaryButton = ({ onClick, children = 'Get started', className = '' }) => (
  <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-3 rounded-xl bg-[#08213D] dark:bg-white px-7 py-3.5 text-sm font-semibold text-white dark:text-[#10233F] shadow-[0_12px_30px_-15px_rgba(8,33,61,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-transform ${className}`}>
    {children}<ArrowRight className="w-4 h-4" />
  </button>
);

const Chapter = ({ reverse = false, first = false, shadow = false, label, title, text, action, onClick, children }) => (
  <section className={`${first ? '' : 'mt-5'} rounded-2xl border border-[#DDE8F1] dark:border-white/10 bg-white/80 dark:bg-[#111B2D]/70 overflow-hidden`}>
    <div className="grid grid-cols-1 lg:grid-cols-2">
      <div className={`${reverse ? 'order-2 lg:order-1' : ''} p-6 sm:p-8 lg:p-10 flex flex-col justify-center`}>
        <p className="text-[10px] font-bold tracking-[0.16em] text-[#347FE5] dark:text-blue-300 uppercase">{label}</p>
        <h3 className="mt-2 text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#10233F] dark:text-white">{title}</h3>
        <p className="mt-3 max-w-md text-sm leading-6 text-[#617991] dark:text-slate-400">{text}</p>
        <Button onClick={onClick} className="mt-5">{action}</Button>
      </div>
      <div className={`${reverse ? 'order-1 lg:order-2 border-t lg:border-t-0' : 'border-t lg:border-t-0 lg:border-l'} border-[#DDE8F1] dark:border-white/10 bg-[#F8FBFE] dark:bg-white/[0.02] p-6 sm:p-8 flex items-center`}>
        <div className={`w-full rounded-xl border border-[#D7E4EE] dark:border-white/10 bg-white dark:bg-[#121C2D] p-5 ${shadow ? 'shadow-[0_15px_40px_-32px_rgba(15,35,63,0.5)]' : ''}`}>{children}</div>
      </div>
    </div>
  </section>
);

const Label = ({ children }) => (
  <p className="text-[10px] font-bold tracking-[0.14em] text-[#74889C] dark:text-slate-500 uppercase">{children}</p>
);

const Metric = ({ label, value, color = 'bg-[#347FE5]' }) => (
  <div>
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-semibold text-[#425D76] dark:text-slate-400">{label}</span>
      <span className="text-xs font-bold text-[#173A5E] dark:text-slate-200 tabular-nums">{value}%</span>
    </div>
    <div className="mt-1.5 h-2 rounded-full bg-[#E9EFF5] dark:bg-white/5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

// Placeholder lines shown while the example loads, or if it cannot load (no numbers, no error text).
const Skeleton = ({ rows = 4, pulse = false }) => (
  <div className={`space-y-3 ${pulse ? 'animate-pulse' : ''}`} aria-hidden="true">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-3 rounded-full bg-[#E9EFF5] dark:bg-white/10" style={{ width: `${92 - i * 12}%` }} />
    ))}
  </div>
);

const Sparkline = ({ points }) => {
  const W = 200, H = 52;
  const values = points.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = i => 4 + (i / (points.length - 1)) * (W - 8);
  const y = v => 4 + (1 - (v - min) / span) * (H - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" role="img" aria-label="Employment trend by year">
      <polyline fill="none" stroke="#347FE5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')} />
      {points.map((p, i) => <circle key={p.year} cx={x(i)} cy={y(p.value)} r="2.5" fill="#347FE5" />)}
    </svg>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────
const Intro = ({ onConfigureProfile, onNavigate }) => {
  const [example, setExample] = useState(readCache);
  const [failed, setFailed] = useState(false);
  const loading = !example && !failed;

  useEffect(() => {
    if (example) return undefined;
    let cancelled = false;
    buildExample()
      .then(result => {
        if (cancelled) return;
        if (result) { setExample(result); writeCache(result); } else setFailed(true);
      })
      .catch(error => { console.error('Home page example unavailable:', error); if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxState = example?.states.length ? Math.max(...example.states.map(s => s.value)) : 1;
  const topState = example?.states.length ? example.states.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const maxImportance = example ? Math.max(...example.skills.list.map(s => s.importance), 0) : 0;

  return (
    <section className="w-full bg-transparent text-[#10233F] dark:text-white">
      {/* Hero */}
      <div className="relative overflow-hidden bg-transparent">
        <div className="absolute inset-0 pointer-events-none"><div className="absolute -right-28 -top-40 w-[580px] h-[580px] rounded-full bg-blue-500/5 dark:bg-blue-500/5 blur-[120px]" /></div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-[0.96fr_1.04fr] min-h-[520px] sm:min-h-[560px] items-center gap-4 lg:gap-10 pt-20 sm:pt-24">
            <div className="max-w-[560px] py-12 sm:py-16">
              <h1 className="text-[3rem] sm:text-[3.65rem] lg:text-[4rem] leading-[1.04] tracking-[-0.05em] font-bold text-[#10233F] dark:text-white">Navigate the AI shift with precision.</h1>
              <p className="mt-6 max-w-[545px] text-base sm:text-lg leading-7 sm:leading-8 text-[#294665] dark:text-slate-400">Discover careers that fit your interests, understand how AI is changing the work, and get a learning plan you can follow.</p>
              <PrimaryButton onClick={onConfigureProfile} className="mt-8">Get started</PrimaryButton>
            </div>
            <div className="relative min-h-[300px] sm:min-h-[380px] flex items-center justify-center lg:justify-end">
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center lg:justify-end"><div className="w-[380px] h-[300px] sm:w-[520px] sm:h-[390px] rounded-full bg-blue-100/25 dark:bg-blue-500/5 blur-[70px]" /></div>
              <img src="/iresi_australia_visual_light.png" alt="" aria-hidden="true" draggable="false" className="relative z-10 block dark:hidden w-full max-w-[520px] sm:max-w-[580px] h-auto object-contain select-none pointer-events-none" />
              <img src="/iresi_australia_visual_clean.png" alt="" aria-hidden="true" draggable="false" className="relative z-10 hidden dark:block w-full max-w-[520px] sm:max-w-[580px] h-auto object-contain select-none pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Six chapters */}
      <div className="relative bg-transparent">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-14 sm:pt-16 pb-16 sm:pb-20">
          <div className="max-w-2xl mb-10 sm:mb-12">
            <p className="text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] text-[#2C5077] dark:text-blue-300 uppercase">WHAT IRESI SHOWS YOU</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-[-0.035em] text-[#10233F] dark:text-white">Six steps. One complete picture.</h2>
            <p className="mt-3 text-sm sm:text-base leading-6 font-medium text-[#3A5169] dark:text-slate-400 max-w-[620px]">Take a short interest quiz, then see your career matches, how AI may change them, the skills to build, a learning plan to follow, and where demand is.</p>
            {/* {example && <p className="mt-3 text-xs text-[#6F879F] dark:text-slate-500">Live example from IResi data: <span className="font-semibold text-[#3A5169] dark:text-slate-300">{example.role.title}</span></p>} */}
          </div>

          {/* 1. Career matches */}
          <Chapter first shadow label="CHAPTER 01 · CAREER MATCHES" title="Start with you, not the job title" text="Answer a short interest quiz and see which careers match how you like to work." action="Take the interest quiz" onClick={onConfigureProfile}>
            {example ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#EDF5FC] dark:bg-blue-500/10 flex items-center justify-center shrink-0"><UserRound className="w-4 h-4 text-[#176BC0] dark:text-blue-300" /></div>
                    <div className="min-w-0"><p className="text-sm font-semibold text-[#173A5E] dark:text-white truncate">{example.role.title}</p><p className="text-[10px] text-[#7C91A6] dark:text-slate-500">Example career match</p></div>
                  </div>
                  {example.role.match_score !== null && <span className="rounded-full bg-[#E7F7ED] border border-[#BFE8CC] px-2.5 py-1 text-[10px] font-semibold text-[#168247] shrink-0">{example.role.match_score}% match</span>}
                </div>
                <div className="mt-5 pt-4 border-t border-[#E2EAF1] dark:border-white/10 text-center">
                <div className="flex justify-center">
                  <Label>What this match uses</Label>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 justify-items-center">
                  {[['Interests', exampleInterestLabels]].map(([label, value]) => (
                    <div key={label} className="text-center">
                      <p className="text-s text-[#7C91A6] dark:text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-snug text-[#173A5E] dark:text-slate-200">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              </>
            ) : <Skeleton rows={5} pulse={loading} />}
          </Chapter>

          {/* 2. AI impact */}
          <Chapter reverse label="CHAPTER 02 · AI IMPACT" title="See which parts of the work AI may change" text="Every career is split into tasks, grouped as Human-led, AI Augmented or AI Automated, so you can see which parts of the work AI may change. Ask the built-in assistant about any career." action="See AI impact for your matches" onClick={onConfigureProfile}>
            {example ? (
              <>
                <Label>AI impact · {example.role.title}</Label>
                <div className="mt-4 space-y-4">
                  <Metric label="AI Augmentation score" value={example.metrics.augmentation} />
                  <Metric label="AI Automation risk score" value={example.metrics.automation} color="bg-[#735CE6]" />
                  <Metric label="AI Resilience score" value={example.metrics.resilience} />
                </div>
                <div className="mt-5 pt-4 border-t border-[#E2EAF1] dark:border-white/10 space-y-2.5">
                  <Label>How its tasks are affected</Label>
                  {example.tasks.map(t => (
                    <div key={t.label} className="flex items-start gap-2.5">
                      <span className="mt-1.5 flex items-center gap-1.5 shrink-0 w-[96px] text-[10px] font-bold uppercase tracking-wide text-[#425D76] dark:text-slate-400"><span className={`w-2 h-2 rounded-full ${t.dot}`} />{t.label}</span>
                      <p className="text-xs leading-5 text-[#48627D] dark:text-slate-400 line-clamp-2">{t.title}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : <Skeleton rows={6} pulse={loading} />}
          </Chapter>

          {/* 3. Skill gap */}
          <Chapter label="CHAPTER 03 · SKILL GAP CHECK" title="Know what to build next" text="Tick the skills you already have and see what is left to build, ranked by how much the career needs each one." action="Check your skill gap" onClick={onConfigureProfile}>
            {example ? (
              <>
                <Label>Skills this career needs</Label>
                <div className="mt-4 space-y-3.5">
                  {example.skills.list.map(s => (
                    <div key={s.name}>
                      <p className="text-xs font-semibold text-[#425D76] dark:text-slate-300">{s.name}</p>
                      {maxImportance > 0 && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-[#E9EFF5] dark:bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-[#347FE5]" style={{ width: `${Math.min(100, s.importance * 10)}%` }} /></div>
                      )}
                    </div>
                  ))}
                </div>
                {example.skills.total > example.skills.list.length && <p className="mt-4 text-[11px] text-[#7A8EA2] dark:text-slate-500">Top {example.skills.list.length} of {example.skills.total} skills shown.</p>}
              </>
            ) : <Skeleton rows={6} pulse={loading} />}
          </Chapter>

          {/* 4. Regional insights */}
          <Chapter label="CHAPTER 04 · REGIONAL INSIGHTS" title="Find where the opportunity is" text="See employment trends by year, and compare employment and vacancies across states and territories." action="Explore Regional Insights" onClick={() => onNavigate?.('regional-insights')}>
            {example && (example.states.length || example.trend.length) ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#EDF5FC] dark:bg-blue-500/10 flex items-center justify-center"><MapPin className="w-4 h-4 text-[#176BC0] dark:text-blue-300" /></div>
                  <p className="text-sm font-semibold text-[#173A5E] dark:text-white">{example.role.title}</p>
                </div>
                {example.states.length > 0 && (
                  <div className="mt-5">
                    <Label>Employment by state{topState ? ` · highest in ${topState.state}` : ''}</Label>
                    <div className="mt-3 flex items-end gap-1.5 h-20">
                      {example.states.map(s => (
                        <div key={s.state} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                          <div className={`w-full rounded-t-[3px] ${s.state === topState?.state ? 'bg-[#347FE5]' : 'bg-[#C4D8EF] dark:bg-blue-400/20'}`} style={{ height: `${Math.max(6, (s.value / maxState) * 100)}%` }} />
                          <span className="text-[9px] font-semibold text-[#7C91A6] dark:text-slate-500">{s.state}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {example.trend.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[#E2EAF1] dark:border-white/10">
                    <Label>Employment trend, {example.trend[0].year} to {example.trend[example.trend.length - 1].year}</Label>
                    <div className="mt-2"><Sparkline points={example.trend} /></div>
                  </div>
                )}
                {example.vacancy !== null && <p className="mt-3 text-[11px] text-[#7A8EA2] dark:text-slate-500">Latest 3-month vacancy average in {EXAMPLE_REGION_LABEL}: <span className="font-semibold text-[#173A5E] dark:text-slate-200 tabular-nums">{Math.round(example.vacancy).toLocaleString()}</span></p>}
              </>
            ) : <Skeleton rows={5} pulse={loading} />}
          </Chapter>

          {/* 5. Learning plan: a structural illustration (generating a real plan here would write to your database) */}
          <Chapter reverse label="CHAPTER 05 · LEARNING PLAN" title="Turn the gap into a plan" text="Choose 3, 6 or 9 months and 3 to 12 hours a week. IResi builds a phased plan with course search links, and you can download it as a PDF." action="Build my plan" onClick={onConfigureProfile}>
            <Label>How it works</Label>
            <div className="mt-4 space-y-2.5">
              {[['1', 'Choose your pace', '3, 6 or 9 months · 3 to 12 hours a week'], ['2', 'Get a phased plan', 'Foundation first, then the next phases'], ['3', 'Take it with you', 'Download a PDF or track progress online']].map(([n, title, copy]) => (
                <div key={n} className="flex items-center gap-3 rounded-lg border border-[#E2EAF1] dark:border-white/10 px-3 py-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#EDF5FC] dark:bg-blue-500/10 text-[11px] font-bold text-[#176BC0] dark:text-blue-300 flex items-center justify-center shrink-0">{n}</span>
                  <div className="min-w-0"><p className="text-xs font-semibold text-[#173A5E] dark:text-white">{title}</p><p className="text-[11px] text-[#7C91A6] dark:text-slate-500">{copy}</p></div>
                </div>
              ))}
            </div>
            {example && <p className="mt-4 text-[11px] text-[#7A8EA2] dark:text-slate-500">Built from the {example.skills.total} skills for {example.role.title}.</p>}
          </Chapter>

          {/* 6. Progress tracker: a neutral illustration */}
          <Chapter reverse label="CHAPTER 06 · PROGRESS TRACKER" title="Keep going, one skill at a time" text="Every plan comes with a code. Enter it in the Progress Tracker any time to restore your plan and tick off skills as you learn." action="Open Progress Tracker" onClick={() => onNavigate?.('progress-tracker')}>
            <Label>Restore your plan</Label>
            <div className="mt-3 rounded-lg border border-dashed border-[#C8D8E6] dark:border-white/15 px-3 py-2.5 text-xs text-[#8093A6] dark:text-slate-500">Enter your plan code</div>
            <div className="mt-4 space-y-2.5">
              {[88, 72, 80].map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded border border-[#B9C9DA] dark:border-white/20 shrink-0" />
                  <div className="h-2.5 rounded-full bg-[#E9EFF5] dark:bg-white/10" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-[#7A8EA2] dark:text-slate-500">Illustration. Your PDF also links straight to your plan in the tracker.</p>
          </Chapter>
        </div>
      </div>

      {/* Final CTA */}
      <div className="relative overflow-hidden bg-transparent border-t border-[#E1EBF4]/50 dark:border-white/5">
        <div className="absolute inset-0 pointer-events-none"><div className="absolute -left-20 -bottom-44 w-[430px] h-[430px] rounded-full bg-blue-500/5 dark:bg-blue-500/5 blur-3xl" /><div className="absolute -right-20 -top-44 w-[430px] h-[430px] rounded-full bg-indigo-500/5 dark:bg-indigo-500/5 blur-3xl" /></div>
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-14 sm:py-16 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.04em] text-[#10233F] dark:text-white">Make your next career move with more clarity.</h2>
          <p className="mt-4 text-sm sm:text-base leading-7 text-[#536C86] dark:text-slate-400 max-w-xl mx-auto">Take the interest quiz to see your career matches, AI impact, skill gaps, regional demand and a learning plan.</p>
          <PrimaryButton onClick={onConfigureProfile} className="mt-7">Get started</PrimaryButton>
        </div>
      </div>

      {/* Sources */}
      <div id="iresi-about" className="bg-transparent border-t border-[#EDF2F7]/60 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-9 sm:py-10"><div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#6F879F]" /><p className="text-sm font-semibold text-[#10233F] dark:text-white">This analysis uses data from</p></div><p className="mt-1.5 text-xs font-medium text-[#4E637B] dark:text-slate-500">Career and labour-market information used throughout IResi.</p></div>
          <div className="flex flex-wrap items-center gap-2.5">{[['https://www.jobsandskills.gov.au/data', 'Jobs & Skills Australia'], ['https://www.onetcenter.org/database.html', 'O*NET Database']].map(([href, label]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-[#D4E2EE] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-[#1762B1] dark:text-blue-300 hover:bg-[#F4F8FC] dark:hover:bg-white/[0.06] transition-colors">{label}</a>)}</div>
        </div></div>
      </div>
    </section>
  );
};

export default Intro;
