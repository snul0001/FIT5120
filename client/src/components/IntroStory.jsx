import React, { useEffect, useRef, useState } from 'react';
import { matchOccupations, getOccupationAI, getOccupationTasks, getSkillGap } from '../api/client';
import { ArrowRight, UserRound, Sparkles, Layers, MapPin, ShieldCheck, FileText, ClipboardCheck, Check } from 'lucide-react';

// ─── Example data (the live example is loaded from your API) ──────────────────
const EXAMPLE_INTERESTS = ['investigative', 'conventional'];
const EXAMPLE_REGION = 'VIC';
const INTEREST_LABELS = {
  realistic: 'Building & fixing systems', investigative: 'Solving problems & analysing',
  artistic: 'Creating & designing', social: 'Helping & working with people',
  enterprising: 'Leading & managing', conventional: 'Organising & planning'
};
const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const DURATIONS = [3, 6, 9];
const HOURS = [3, 5, 8, 12];

const toPercent = v => typeof v === 'number' ? (v <= 1 ? Math.round(v * 100) : Math.round(v)) : null;
const capitalise = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

// Tasks come back as { grouped: { 'AI-assisted': [...], ... } }
const flattenTasks = res => {
  const g = res?.grouped;
  if (g && typeof g === 'object') {
    return Object.entries(g).flatMap(([group, items]) =>
      (Array.isArray(items) ? items : []).map(t => ({ ...t, group: t.impact_group || group })));
  }
  const list = Array.isArray(res?.tasks) ? res.tasks : Array.isArray(res) ? res : [];
  return list.map(t => ({ ...t, group: t.impact_group || t.category || '' }));
};
const taskTitle = t => capitalise(String(t.task_core || t.plain_english || t.short_explanation || '').trim());
const pickTasks = tasks => {
  const withText = tasks.filter(t => taskTitle(t));
  const out = [];
  withText.forEach(t => { if (!out.some(o => o.group === t.group)) out.push(t); });
  withText.forEach(t => { if (!out.includes(t)) out.push(t); });
  return out.slice(0, 3);
};
const groupStyle = g => {
  const c = String(g || '').toLowerCase();
  if (c.includes('automat')) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  if (c.includes('assist') || c.includes('augment')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (c.includes('human')) return 'bg-blue-500/15 text-blue-700 dark:text-blue-300';
  return 'bg-slate-500/15 text-slate-600 dark:text-slate-300';
};
const extractSkills = res => {
  const raw = res?.all_skills || res?.required_skills || [...(res?.matched || []), ...(res?.missing || [])];
  return raw
    .map(s => ({
      name: String(s?.name || s?.skill_name || s || '').trim(),
      importance: typeof s?.importance === 'number' ? s.importance : typeof s?.importance_score === 'number' ? s.importance_score * 10 : 0
    }))
    .filter(s => s.name)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 6);
};

// ─── Small building blocks ────────────────────────────────────────────────────
// Fades content in as it scrolls into view (skipped when the user prefers reduced motion).
const Reveal = ({ children, className = '', delay = 0 }) => {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}>
      {children}
    </div>
  );
};

const PrimaryButton = ({ onClick, children, className = '', light = false }) => (
  <button type="button" onClick={onClick}
    className={`inline-flex items-center justify-center gap-3 rounded-xl px-7 py-3.5 text-sm font-semibold shadow-[0_12px_30px_-15px_rgba(8,33,61,0.5)] hover:-translate-y-0.5 transition-all ${light ? 'bg-white text-[#08213D]' : 'bg-[#08213D] dark:bg-white text-white dark:text-[#10233F]'} ${className}`}>
    {children}<ArrowRight className="w-4 h-4" />
  </button>
);

const TextButton = ({ onClick, children, className = '' }) => (
  <button type="button" onClick={onClick}
    className={`inline-flex items-center gap-1.5 text-sm font-semibold text-[#176BC0] dark:text-blue-300 hover:text-[#0F4F96] dark:hover:text-blue-200 transition-colors ${className}`}>
    {children}<ArrowRight className="w-4 h-4" />
  </button>
);

const Label = ({ children, className = '' }) => (
  <p className={`text-[10px] font-bold tracking-[0.16em] uppercase text-[#74889C] dark:text-slate-500 ${className}`}>{children}</p>
);

const Panel = ({ children }) => (
  <div className="rounded-2xl border border-[#D7E4EE] dark:border-white/10 bg-white/90 dark:bg-[#121C2D]/90 p-5 sm:p-6 shadow-[0_15px_40px_-32px_rgba(15,35,63,0.5)]">{children}</div>
);

const Chip = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={!!active}
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active
      ? 'bg-[#08213D] dark:bg-white text-white dark:text-[#10233F] border-transparent'
      : 'bg-white dark:bg-white/5 text-[#425D76] dark:text-slate-300 border-[#D7E4EE] dark:border-white/10 hover:border-[#347FE5]'}`}>
    {children}
  </button>
);

const Metric = ({ label, value, color = 'bg-[#347FE5]' }) => (
  <div>
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-semibold text-[#425D76] dark:text-slate-400">{label}</span>
      <span className="text-xs font-bold text-[#173A5E] dark:text-slate-200 tabular-nums">{value !== null ? `${value}%` : 'N/A'}</span>
    </div>
    <div className="mt-1.5 h-2 rounded-full bg-[#E9EFF5] dark:bg-white/5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value ?? 0}%` }} />
    </div>
  </div>
);

// One step of the story: step number on a vertical rail, copy on the left, a live visual on the right.
const Chapter = ({ step, kicker, title, text, action, onClick, children }) => (
  <Reveal className="relative md:pl-16">
    <span className="hidden md:flex absolute left-0 top-1 w-10 h-10 rounded-full bg-[#F4F8FC] dark:bg-[#0B1121] border-2 border-[#347FE5] text-[#347FE5] font-bold text-sm items-center justify-center">{step}</span>
    <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-6 lg:gap-12 items-center">
      <div>
        <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] text-[#347FE5] dark:text-blue-300 uppercase">Step {step} · {kicker}</p>
        <h3 className="mt-2 text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#10233F] dark:text-white">{title}</h3>
        <p className="mt-3 max-w-md text-sm sm:text-base leading-7 text-[#3A5169] dark:text-slate-400">{text}</p>
        <TextButton onClick={onClick} className="mt-5">{action}</TextButton>
      </div>
      <Panel>{children}</Panel>
    </div>
  </Reveal>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const IntroStory = ({ onConfigureProfile, onNavigate }) => {
  const [role, setRole] = useState(null);
  const [ai, setAi] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  const [have, setHave] = useState(() => new Set());
  const [done, setDone] = useState(() => new Set());
  const [duration, setDuration] = useState(6);
  const [hrs, setHrs] = useState(5);

  // Load one real example so every demo on the page uses live data.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const matches = await matchOccupations({ interest_ids: EXAMPLE_INTERESTS, region: EXAMPLE_REGION });
        if (!Array.isArray(matches) || !matches.length) throw new Error('No occupation returned');
        const top = [...matches].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))[0];
        const code = top.anzsco_code;
        const [aiRes, taskRes, gapRes] = await Promise.allSettled([getOccupationAI(code), getOccupationTasks(code), getSkillGap(code, [])]);
        if (cancelled) return;
        setRole(top);
        if (aiRes.status === 'fulfilled') setAi(aiRes.value || null);
        if (taskRes.status === 'fulfilled') setTasks(pickTasks(flattenTasks(taskRes.value)));
        if (gapRes.status === 'fulfilled') setSkills(extractSkills(gapRes.value));
      } catch (err) {
        console.error('Story home: example data unavailable', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = (setter, key) => setter(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const go = target => onNavigate?.(target);
  const scrollToStory = () => document.getElementById('story')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const matchScore = toPercent(role?.match_score);
  const resilience = toPercent(ai?.resilience_score);
  const augmentation = toPercent(ai?.avg_augmentation);
  const automation = toPercent(ai?.avg_automation);
  const toBuild = Math.max(0, skills.length - have.size);
  const totalHours = Math.round(duration * 4.33 * hrs);
  const checklist = skills.length ? skills.slice(0, 4).map(s => s.name) : ['First skill', 'Second skill', 'Third skill'];
  const progress = Math.round((checklist.filter(n => done.has(n)).length / checklist.length) * 100);
  const placeholder = msg => <p className="text-sm text-[#7890A8] dark:text-slate-500">{loading ? 'Loading a live example…' : msg}</p>;

  const features = [
    { icon: UserRound, title: 'Career matches', text: 'A short interest quiz ranks tech careers by how well they fit you.', onClick: onConfigureProfile },
    { icon: Sparkles, title: 'AI task impact', text: 'See which tasks AI may support, automate or leave to people.', onClick: onConfigureProfile },
    { icon: Layers, title: 'Skill gap check', text: 'Tap the skills you have and see exactly what to build next.', onClick: onConfigureProfile },
    { icon: FileText, title: 'Learning plan and PDF', text: 'A 3, 6 or 9-month plan with course search links you can download.', onClick: onConfigureProfile },
    { icon: ClipboardCheck, title: 'Progress tracker', text: 'Restore any plan with its code and tick off skills as you learn.', onClick: () => go('progress-tracker') },
    { icon: MapPin, title: 'Regional insights', text: 'Compare opportunity across Australian states and territories.', onClick: () => go('regional-insights') }
  ];

  return (
    <section className="w-full bg-transparent text-[#10233F] dark:text-white">
      {/* ── Opening: the hook ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"><div className="absolute -right-28 -top-40 w-[580px] h-[580px] rounded-full bg-blue-500/5 blur-[120px]" /></div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-[0.96fr_1.04fr] min-h-[520px] items-center gap-4 lg:gap-10 pt-16 sm:pt-24">
            <div className="max-w-[580px] py-10 sm:py-16">
              <span className="inline-block rounded-full bg-[#DCE8FF] dark:bg-blue-500/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#1A5FD6] dark:text-blue-300">A career story, told with real data</span>
              <h1 className="mt-5 text-[2.6rem] sm:text-[3.4rem] lg:text-[3.9rem] leading-[1.05] tracking-[-0.05em] font-bold">AI is rewriting the work. Write your next chapter.</h1>
              <p className="mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-[#294665] dark:text-slate-400">IResi follows one question from start to finish: where do you fit, what will AI change, and what should you learn next?</p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <PrimaryButton onClick={onConfigureProfile}>Start your story</PrimaryButton>
                <button type="button" onClick={scrollToStory} className="text-sm font-semibold text-[#294665] dark:text-slate-300 hover:underline underline-offset-4">See how it works ↓</button>
              </div>
            </div>
            <div className="relative min-h-[280px] sm:min-h-[380px] flex items-center justify-center lg:justify-end">
              <img src="/iresi_australia_visual_light.png" alt="" aria-hidden="true" draggable="false" className="relative z-10 block dark:hidden w-full max-w-[520px] sm:max-w-[580px] h-auto object-contain select-none pointer-events-none" />
              <img src="/iresi_australia_visual_clean.png" alt="" aria-hidden="true" draggable="false" className="relative z-10 hidden dark:block w-full max-w-[520px] sm:max-w-[580px] h-auto object-contain select-none pointer-events-none" />
              {role && (
                <div className="absolute z-20 left-2 sm:left-6 bottom-2 sm:bottom-8 rounded-xl border border-[#D7E4EE] dark:border-white/10 bg-white/95 dark:bg-[#121C2D]/95 px-3.5 py-2.5 shadow-lg max-w-[240px]">
                  <p className="text-[9px] font-bold tracking-widest uppercase text-[#74889C]">Live example</p>
                  <p className="mt-0.5 text-sm font-semibold truncate">{role.title}</p>
                  {matchScore !== null && <p className="text-[11px] font-semibold text-[#168247] dark:text-emerald-400">{matchScore}% match</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── The shift: why this matters ───────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 sm:py-12">
        <Reveal>
          <div className="rounded-3xl bg-[#08213D] text-white p-7 sm:p-12">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#8FB4FF]">The shift</p>
            <h2 className="mt-3 max-w-2xl text-2xl sm:text-4xl font-bold tracking-[-0.03em] leading-tight">AI won&apos;t end careers. It will change the tasks inside them.</h2>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {[
                ['A job is a bundle of tasks', 'Every occupation is many tasks, and AI treats each one differently.'],
                ['Some tasks get support', 'Others get automated, and some stay firmly human. The mix decides how a role changes.'],
                ['So ask a better question', 'Not "will AI take my job?" but "what happens to the work I would actually do?"']
              ].map(([title, text], i) => (
                <div key={title} className="border-t border-white/15 pt-4">
                  <p className="text-xs font-bold text-[#8FB4FF]">0{i + 1}</p>
                  <p className="mt-1.5 text-base font-semibold">{title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-[#B8C8E8]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── The journey: six steps ────────────────────────────────────────── */}
      <div id="story" className="max-w-7xl mx-auto px-6 lg:px-10 pt-10 sm:pt-16 pb-12 scroll-mt-24">
        <Reveal className="max-w-2xl mb-10 sm:mb-14">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#2C5077] dark:text-blue-300">Your journey</p>
          <h2 className="mt-2 text-2xl sm:text-4xl font-bold tracking-[-0.035em]">Six steps from &ldquo;where do I fit?&rdquo; to a plan you can follow.</h2>
          <p className="mt-3 text-sm sm:text-base leading-7 font-medium text-[#3A5169] dark:text-slate-400">Everything below is a live preview. Tap, pick and tick to try it, using real data from the same sources as the full app.</p>
        </Reveal>

        <div className="relative space-y-14 sm:space-y-20">
          <div aria-hidden="true" className="hidden md:block absolute left-5 top-2 bottom-2 w-px bg-[#CFE0F3] dark:bg-white/10" />

          <Chapter step="1" kicker="Career matches" title="Start with you, not the job title"
            text="Answer a short interest quiz. IResi ranks tech careers by how closely they match the way you like to work."
            action="Take the interest quiz" onClick={onConfigureProfile}>
            <Label>You tell us what you enjoy</Label>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(INTEREST_LABELS).map(([id, label]) => (
                <span key={id} className={`rounded-full border px-3 py-1 text-xs font-medium ${EXAMPLE_INTERESTS.includes(id) ? 'bg-[#E7F1FD] dark:bg-blue-500/15 text-[#176BC0] dark:text-blue-300 border-[#BBD6F5] dark:border-blue-400/30' : 'text-[#7C91A6] dark:text-slate-500 border-[#E2EAF1] dark:border-white/10'}`}>{label}</span>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-[#E2EAF1] dark:border-white/10">
              <Label>We show your best match</Label>
              {role ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#EDF5FC] dark:bg-blue-500/10 flex items-center justify-center shrink-0"><UserRound className="w-4 h-4 text-[#176BC0] dark:text-blue-300" /></div>
                    <p className="text-sm font-semibold truncate">{role.title}</p>
                  </div>
                  <span className="rounded-full bg-[#E7F7ED] border border-[#BFE8CC] px-2.5 py-1 text-[10px] font-semibold text-[#168247] shrink-0">{matchScore !== null ? `${matchScore}% match` : 'Match'}</span>
                </div>
              ) : <div className="mt-3">{placeholder('Live example unavailable right now.')}</div>}
            </div>
          </Chapter>

          <Chapter step="2" kicker="AI impact" title="See which tasks AI may change"
            text="Every career is broken into tasks. See which ones AI could support, which could be automated, and which stay human-led."
            action="See AI impact for your matches" onClick={onConfigureProfile}>
            <Label>{role ? `Example: ${role.title}` : 'AI impact'}</Label>
            <div className="mt-4 space-y-4">
              <Metric label="Augmentation" value={augmentation} />
              <Metric label="Automation" value={automation} color="bg-[#735CE6]" />
              <Metric label="Resilience score" value={resilience} />
            </div>
            {tasks.length > 0 && (
              <div className="mt-5 pt-4 border-t border-[#E2EAF1] dark:border-white/10 space-y-2.5">
                <Label>A few of its tasks</Label>
                {tasks.map((t, i) => (
                  <div key={t.task_id ?? i} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${groupStyle(t.group)}`}>{t.group || 'Task'}</span>
                    <p className="text-xs leading-5 text-[#48627D] dark:text-slate-400 line-clamp-2">{taskTitle(t)}</p>
                  </div>
                ))}
              </div>
            )}
          </Chapter>

          <Chapter step="3" kicker="Skill gap" title="Know exactly what to build next"
            text="Tap the skills you already have. IResi shows what is left, so you stop guessing what to learn."
            action="Check your skill gap" onClick={onConfigureProfile}>
            <Label>Tap the skills you already have</Label>
            {skills.length ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {skills.map(s => (
                    <Chip key={s.name} active={have.has(s.name)} onClick={() => toggle(setHave, s.name)}>
                      {have.has(s.name) && <Check className="w-3 h-3" />}{s.name}
                    </Chip>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-[#E8F7ED] dark:bg-emerald-500/10 py-3"><p className="text-xl font-bold text-[#168247] dark:text-emerald-400 tabular-nums">{have.size}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-[#168247] dark:text-emerald-400">You have</p></div>
                  <div className="rounded-xl bg-[#FFF3E0] dark:bg-amber-500/10 py-3"><p className="text-xl font-bold text-[#B26A00] dark:text-amber-400 tabular-nums">{toBuild}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-[#B26A00] dark:text-amber-400">To build</p></div>
                </div>
              </>
            ) : <div className="mt-3">{placeholder('Skills for the example career are unavailable right now.')}</div>}
          </Chapter>

          <Chapter step="4" kicker="Learning plan" title="Turn the gap into a plan"
            text="Pick how long you have and how many hours a week. IResi builds a phased plan with course search links, and you can download it as a PDF."
            action="Build my plan" onClick={onConfigureProfile}>
            <Label>How long do you have?</Label>
            <div className="mt-3 flex flex-wrap gap-2">{DURATIONS.map(m => <Chip key={m} active={duration === m} onClick={() => setDuration(m)}>{m} months</Chip>)}</div>
            <Label className="mt-5">Hours per week</Label>
            <div className="mt-3 flex flex-wrap gap-2">{HOURS.map(h => <Chip key={h} active={hrs === h} onClick={() => setHrs(h)}>{h} hrs/wk</Chip>)}</div>
            <div className="mt-5 rounded-xl bg-[#F1F6FC] dark:bg-white/5 p-4">
              <p className="text-sm leading-6 text-[#294665] dark:text-slate-300">
                That&apos;s about <strong className="text-[#10233F] dark:text-white">{totalHours} hours</strong> over <strong className="text-[#10233F] dark:text-white">{duration} months</strong>
                {toBuild > 0 && <>, roughly <strong className="text-[#10233F] dark:text-white">{Math.round(totalHours / toBuild)} hours</strong> per skill for the {toBuild} you still need</>}.
              </p>
            </div>
          </Chapter>

          <Chapter step="5" kicker="Progress tracker" title="Keep going, one skill at a time"
            text="Every plan comes with a code. Come back any time, enter it in the Progress Tracker and tick off skills as you learn."
            action="Open the Progress Tracker" onClick={() => go('progress-tracker')}>
            <div className="flex items-center justify-between gap-3">
              <Label>Try ticking a skill</Label>
              <span className="font-mono text-[11px] font-bold text-[#176BC0] dark:text-blue-300">{progress}% done</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#E9EFF5] dark:bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-[#168247] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
            <ul className="mt-4 space-y-2">
              {checklist.map(name => (
                <li key={name}>
                  <button type="button" onClick={() => toggle(setDone, name)} aria-pressed={done.has(name)}
                    className="w-full flex items-center gap-3 rounded-xl border border-[#E2EAF1] dark:border-white/10 px-3 py-2.5 text-left hover:border-[#347FE5] transition-colors">
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${done.has(name) ? 'bg-[#168247] border-[#168247] text-white' : 'border-[#B9C9DA] dark:border-white/20'}`}>{done.has(name) && <Check className="w-3 h-3" />}</span>
                    <span className={`text-sm ${done.has(name) ? 'line-through text-[#7C91A6] dark:text-slate-500' : 'text-[#173A5E] dark:text-slate-200'}`}>{name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Chapter>

          <Chapter step="6" kicker="Regional insights" title="Find where the opportunity is"
            text="Compare job opportunity and vacancy trends across Australian states and territories before you decide where to build your career."
            action="Explore Regional Insights" onClick={() => go('regional-insights')}>
            <Label>Compare across Australia</Label>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {STATES.map(code => (
                <button key={code} type="button" onClick={() => go('regional-insights')}
                  className="rounded-xl border border-[#D7E4EE] dark:border-white/10 bg-[#F4F8FC] dark:bg-white/5 py-3 text-sm font-bold text-[#176BC0] dark:text-blue-300 hover:border-[#347FE5] hover:bg-white dark:hover:bg-white/10 transition-colors">{code}</button>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-[#7A8EA2] dark:text-slate-500">Pick an occupation group and any states you like to see where the opportunity is greatest.</p>
          </Chapter>
        </div>
      </div>

      {/* ── Everything in one place ───────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 sm:py-16">
        <Reveal className="max-w-2xl mb-8">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#2C5077] dark:text-blue-300">Everything in one place</p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-[-0.035em]">What you get with IResi</h2>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, text, onClick }, i) => (
            <Reveal key={title} delay={i * 60}>
              <button type="button" onClick={onClick}
                className="group h-full w-full text-left rounded-2xl border border-[#D7E4EE] dark:border-white/10 bg-white/85 dark:bg-[#121C2D]/80 p-5 hover:-translate-y-1 hover:border-[#347FE5] transition-all">
                <span className="w-10 h-10 rounded-xl bg-[#EDF5FC] dark:bg-blue-500/10 flex items-center justify-center"><Icon className="w-5 h-5 text-[#176BC0] dark:text-blue-300" /></span>
                <p className="mt-4 text-base font-semibold">{title}</p>
                <p className="mt-1.5 text-sm leading-6 text-[#48627D] dark:text-slate-400">{text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#176BC0] dark:text-blue-300">Open <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" /></span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── Trust ─────────────────────────────────────────────────────────── */}
      <div id="iresi-about" className="border-t border-[#EDF2F7]/60 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-9 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#6F879F]" /><p className="text-sm font-semibold">Built on trusted labour-market data</p></div>
            <p className="mt-1.5 text-xs font-medium text-[#4E637B] dark:text-slate-500">Career, skills and vacancy information used throughout IResi.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {[['https://www.jobsandskills.gov.au/data', 'Jobs & Skills Australia'], ['https://www.onetcenter.org/database.html', 'O*NET Database']].map(([href, label]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#D7E4EE] dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2 text-xs font-semibold text-[#294665] dark:text-slate-300 hover:border-[#347FE5] transition-colors">{label}</a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Closing call to action ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-20 sm:pb-24">
        <Reveal>
          <div className="rounded-3xl bg-[#08213D] px-6 py-14 sm:py-16 text-center">
            <h2 className="mx-auto max-w-2xl text-3xl sm:text-4xl font-bold tracking-[-0.04em] text-white">Ready to write your next chapter?</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base leading-7 text-[#B8C8E8]">Take the interest quiz to see your career matches, AI impact, skill gaps and regional demand.</p>
            <PrimaryButton onClick={onConfigureProfile} light className="mt-7">Start your story</PrimaryButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default IntroStory;
