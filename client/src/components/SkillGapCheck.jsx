import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Loader2, ShieldAlert, CheckCircle2, AlertCircle, Check, MapPin } from 'lucide-react';
import { getSkillGap } from '../api/client';

// ─── Importance pill tier ─────────────────────────────────────────────────────
const tierStyle = (score) => {
<<<<<<< HEAD
  if (score >= 8) return { dot: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', label: 'high' };
  if (score >= 6) return { dot: 'bg-amber-400', badge: 'bg-amber-400/10 text-amber-700 dark:text-amber-400 border-amber-400/20', label: 'med' };
=======
  if (score >= 80) return { dot: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', label: 'high' };
  if (score >= 60) return { dot: 'bg-amber-400', badge: 'bg-amber-400/10 text-amber-700 dark:text-amber-400 border-amber-400/20', label: 'med' };
>>>>>>> origin/main
  return { dot: 'bg-zinc-400', badge: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700', label: 'low' };
};

// ─── Resilience colour ────────────────────────────────────────────────────────
const resilienceStyle = (score) => {
  if (score == null) return { bar: 'bg-zinc-400', text: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-500/5 border-zinc-500/20', label: 'Not available' };
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Highly Resilient' };
  if (score >= 50) return { bar: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',    label: 'Moderately Resilient' };
  return              { bar: 'bg-amber-500',        text: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',  label: 'Needs Attention' };
};

const DURATION_OPTIONS = [3, 6, 9];
const HOURS_OPTIONS    = [3, 5, 8, 12];
const DURATION_META = { 3: 'Sprint', 6: 'Balanced', 9: 'Deep dive' };
const HOURS_META    = { 3: 'Light', 5: 'Steady', 8: 'Focused', 12: 'Intensive' };

// ─── Normalize API response → internal shape ──────────────────────────────────
function normalizeResponse(raw) {
  // raw.all_skills OR raw.required_skills OR derive from raw.matched + raw.missing
  const rawSkills =
    raw.all_skills ||
    raw.required_skills ||
    [...(raw.matched || []), ...(raw.missing || [])];

  const all_skills = rawSkills.map((s, i) => ({
    id:         s.id || s.skill_id || `s${i}`,
    name:       s.name || s.skill_name || String(s),
    importance: typeof s.importance === 'number'
<<<<<<< HEAD
      ? s.importance
      : typeof s.importance_score === 'number'
        ? s.importance_score * 10
=======
    ? s.importance
    : typeof s.importance_score === 'number'
      ? s.importance_score * 10
      : typeof s.score === 'number'
        ? s.score
>>>>>>> origin/main
        : 5,
    category:   s.category || 'General',
  }));

  return {
    all_skills,
    resilience_score: raw.resilience_score ?? null,
    resilience_label: raw.resilience_label ?? null,
    avg_augmentation: raw.avg_augmentation ?? null,
    avg_automation:   raw.avg_automation   ?? null,
  };
}

export default function SkillGapCheck({ targetOccupation, ai, onBack, onNavigate, onSkillGapChange }) {
  const anzscoCode   = targetOccupation?.anzsco_code ? String(targetOccupation.anzsco_code) : '';
  const occupationTitle = targetOccupation?.title || targetOccupation?.name || 'Selected Career';

  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState('');
  const [data,       setData]       = useState(null);
  const [selected,   setSelected]   = useState(new Set()); // skill ids user has
  const [duration,   setDuration]   = useState(6);
  const [hrsPerWeek, setHrsPerWeek] = useState(5);

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchGap = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      if (!anzscoCode) throw new Error('No occupation was selected.');
      const res = await getSkillGap(anzscoCode, []);
      if (!res || res.error) throw new Error(res?.error || 'The API returned an empty response.');
      setData(normalizeResponse(res));
    } catch (err) {
      console.warn('[SkillGapCheck] Could not load skill gap data', err);
      setData(normalizeResponse({}));
      setError(err?.message || 'Could not load skill data.');
    } finally {
      setIsLoading(false);
    }
  }, [anzscoCode]);

  useEffect(() => { fetchGap(); }, [fetchGap]);

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const haveSkills    = data?.all_skills.filter(s => selected.has(s.id))  || [];
  const missingSkills = data?.all_skills.filter(s => !selected.has(s.id)) || [];
  // Use the real AI data from the results page; never substitute placeholder numbers.
  const metrics = {
    resilience_score: ai?.resilience_score ?? data?.resilience_score ?? null,
    avg_augmentation: ai?.avg_augmentation ?? data?.avg_augmentation ?? null,
    avg_automation:   ai?.avg_automation   ?? data?.avg_automation   ?? null,
  };
  const toPct = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Math.max(0, Math.min(1, Number(v))) * 100));
  const augPct = toPct(metrics.avg_augmentation);
  const autoPct = toPct(metrics.avg_automation);
  const rs = resilienceStyle(metrics.resilience_score);

  const totalWeeks   = duration * 4.33;
  const totalHours   = Math.round(totalWeeks * hrsPerWeek);
  const hoursPerSkill = missingSkills.length > 0 ? Math.round(totalHours / missingSkills.length) : 0;

  const toggleSkill = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleGeneratePlan = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('learning-plan', {
        occupation: targetOccupation,
        missingSkills,
        duration,
        hrsPerWeek,
      });
    }
  };

  const anzsco4 = anzscoCode.slice(0, 4);

  // Let the chatbot know what the user has told us about their skills.
  useEffect(() => {
    if (!data) return;
    onSkillGapChange?.({
      occupation: occupationTitle,
      skillsHave: data.all_skills.filter(s => selected.has(s.id)).map(s => s.name),
<<<<<<< HEAD
      skillsToBuild: data.all_skills.filter(s => !selected.has(s.id)).map(s => s.name),
=======
      skillsToBuild: data.all_skills.filter(s => !selected.has(s.id)).slice(0, 12).map(s => s.name),
>>>>>>> origin/main
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selected]);

  const coverage = data?.all_skills.length ? Math.round((haveSkills.length / data.all_skills.length) * 100) : 0;
  const stepBadge = 'flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-sm shrink-0';
  const card = 'bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-sm';
  const optionBase = 'rounded-xl border px-3 py-3 text-center text-sm font-semibold transition-colors';
  const optionOn = 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white';
  const optionOff = 'border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/30';

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 py-2 sm:p-6">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex flex-col items-center justify-center py-24 sm:py-32 gap-4 text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm">Analysing skill requirements…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 py-2 sm:p-6 font-sans text-zinc-900 dark:text-zinc-100">

      <div>
        <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Skill gap check</p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white break-words">{occupationTitle}</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-slate-400">Tick the skills you already have. We&apos;ll show what&apos;s left and help you plan for it.</p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="flex-1">Skill data could not be loaded for this occupation ({error}).</span>
          <button onClick={fetchGap} className="font-semibold underline underline-offset-2 shrink-0">Try again</button>
        </div>
      )}

      {/* AI context for this career */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
<<<<<<< HEAD
          ['Resilience', metrics.resilience_score != null ? `${metrics.resilience_score}%` : 'N/A', rs.label, 'text-zinc-900 dark:text-white'],
          ['Augmentation', augPct != null ? `${augPct}%` : 'N/A', 'Human capacity elevated', 'text-emerald-600 dark:text-emerald-400'],
          ['Automation risk', autoPct != null ? `${autoPct}%` : 'N/A', 'Tasks fully automated', 'text-amber-600 dark:text-amber-400'],
        ].map(([label, value, copy, color]) => (
          <div key={label} className={`${card} p-4 sm:p-5`}>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
            <p className={`mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${value === 'N/A' ? 'text-zinc-400' : color}`}>{value}</p>
            <p className="mt-1 hidden sm:block text-[11px] text-slate-500 dark:text-slate-400">{copy}</p>
=======
          ['AI Resilience score', metrics.resilience_score != null ? `${metrics.resilience_score}%` : 'N/A', rs.label, 'text-zinc-900 dark:text-white', 'Measures how adaptable a role is to AI disruption based on high task augmentation versus lower automation risk.'],
          ['AI Augmentation score', augPct != null ? `${augPct}%` : 'N/A', 'Potential for AI to support human work', 'text-emerald-600 dark:text-emerald-400', 'The percentage of tasks where AI boosts human capability rather than replacing the job.'],
          ['AI Automation risk score', autoPct != null ? `${autoPct}%` : 'N/A', 'Potential for AI to automate tasks', 'text-amber-600 dark:text-amber-400', 'The percentage of core role tasks that can be fully automated without human intervention.'],
        ].map(([label, value, copy, color, tip]) => (
          <div key={label} title={tip} tabIndex={0} className={`${card} group relative cursor-help p-4 sm:p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
            <p className={`mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${value === 'N/A' ? 'text-zinc-400' : color}`}>{value}</p>
            <p className="mt-1 hidden sm:block text-[11px] text-slate-500 dark:text-slate-400">{copy}</p>
            <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-64 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-zinc-600 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-white/10 dark:bg-[#1A233A] dark:text-slate-300">
              <span className="mb-1 block text-sm font-semibold text-zinc-900 dark:text-white">{label}</span>
              {tip}
            </span>
>>>>>>> origin/main
          </div>
        ))}
      </div>

      {/* 1. Skill selector */}
      <div className={`${card} p-5 sm:p-6`}>
        <div className="flex items-start gap-3">
          <span className={stepBadge}>1</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Select the skills you already have</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{haveSkills.length} of {data.all_skills.length} selected</p>
          </div>
          {haveSkills.length > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors shrink-0">Clear</button>
          )}
        </div>

        <div className="mt-4 h-1.5 rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={coverage} aria-valuemin={0} aria-valuemax={100} aria-label="Skills covered">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${coverage}%` }} />
        </div>

        {data.all_skills.length === 0 && (
          <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
            {error ? 'Skills could not be loaded for this occupation.' : 'No skill data is available for this occupation.'}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {data.all_skills.map(skill => {
            const tier = tierStyle(skill.importance);
            const isSelected = selected.has(skill.id);
            return (
              <button key={skill.id} type="button" aria-pressed={isSelected} onClick={() => toggleSkill(skill.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-semibold transition-colors ${isSelected ? optionOn : optionOff}`}>
                {isSelected ? <Check className="w-3.5 h-3.5" /> : <span className={`w-2 h-2 rounded-full shrink-0 ${tier.dot}`} />}
                {skill.name}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          {[['bg-rose-500', 'High importance'], ['bg-amber-400', 'Medium'], ['bg-zinc-400', 'Lower']].map(([dot, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${dot}`} />{label}</span>
          ))}
        </div>
      </div>

      {/* 2. Result */}
      <div className={`${card} p-5 sm:p-6`}>
        <div className="flex items-center gap-3">
          <span className={stepBadge}>2</span>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Your skill comparison</h2>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
          <div className="md:pr-6">
            <h3 className="flex items-center justify-between text-sm font-bold text-zinc-900 dark:text-white">
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Skills you have</span>
              <span className="text-xs font-semibold text-zinc-400 tabular-nums">{haveSkills.length}</span>
            </h3>
            {haveSkills.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-400 italic">Select skills above to see them here.</p>
            ) : (
              <ol className="mt-3 space-y-2.5">
                {haveSkills.map((s, i) => (
                  <li key={s.id} className="text-sm text-zinc-700 dark:text-zinc-300"><span className="font-semibold mr-2 text-zinc-400 tabular-nums">{i + 1}.</span>{s.name}</li>
                ))}
              </ol>
            )}
          </div>

          <div className="md:pl-6">
            <h3 className="flex items-center justify-between text-sm font-bold text-zinc-900 dark:text-white">
              <span className="inline-flex items-center gap-2"><AlertCircle className="w-4 h-4 text-rose-500" /> Skills to build</span>
              <span className="text-xs font-semibold text-zinc-400 tabular-nums">{missingSkills.length}</span>
            </h3>
            {missingSkills.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-400 italic">You&apos;ve covered every required skill.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {missingSkills.map((s, i) => (
                  <li key={s.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                      <span className="min-w-0 break-words"><span className="font-semibold mr-2 text-zinc-400 tabular-nums">{i + 1}.</span>{s.name}</span>
                      {/* <span className="text-[10px] font-semibold tabular-nums text-zinc-400 shrink-0">{s.importance.toFixed(1)}</span> */}
                    </div>
<<<<<<< HEAD
                    <div className="mt-1.5 h-1 rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${tierStyle(s.importance).dot}`} style={{ width: `${Math.min(100, s.importance * 10)}%` }} />
                    </div>
=======
                    {/* THE BAR REMOVED HERE DONT ADD IF NOT NEEDED */}
                    {/* <div className="mt-1.5 h-1 rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${tierStyle(s.importance).dot}`} style={{ width: `${Math.min(100, s.importance * 10)}%` }} />
                    </div> */}
>>>>>>> origin/main
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* 3. Build a plan */}
      {missingSkills.length > 0 && (
        <div className={`${card} p-5 sm:p-6 space-y-6`}>
          <div className="flex items-start gap-3">
            <span className={stepBadge}>3</span>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Build your learning plan</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Choose your pace. We&apos;ll spread {missingSkills.length} skill{missingSkills.length === 1 ? '' : 's'} across a phased plan.</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-2.5">Duration</p>
            <div className="grid grid-cols-3 gap-2.5">
              {DURATION_OPTIONS.map(m => (
                <button key={m} type="button" aria-pressed={duration === m} onClick={() => setDuration(m)} className={`${optionBase} ${duration === m ? optionOn : optionOff}`}>
                  {m} months
                  <span className="block mt-0.5 text-[10px] font-medium opacity-60">{DURATION_META[m]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-2.5">Hours per week</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {HOURS_OPTIONS.map(h => (
                <button key={h} type="button" aria-pressed={hrsPerWeek === h} onClick={() => setHrsPerWeek(h)} className={`${optionBase} ${hrsPerWeek === h ? optionOn : optionOff}`}>
                  {h} hrs
                  <span className="block mt-0.5 text-[10px] font-medium opacity-60">{HOURS_META[h]}</span>
                </button>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] text-center">
            {[[totalHours, 'Total hours'], [missingSkills.length, 'Skills'], [hoursPerSkill > 0 ? `~${hoursPerSkill}` : '-', 'Hours per skill']].map(([value, label]) => (
              <div key={label} className="py-4 px-2">
                <dd className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{value}</dd>
                <dt className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</dt>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('regional-insights', { anzsco4 })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
<<<<<<< HEAD
                <MapPin className="w-3.5 h-3.5" /> See regional demand for this career
=======
                {/* DONT ADD ANYTHING HERE, THIS KEEPS THE Generate learning plan towards right */}
>>>>>>> origin/main
              </button>
            )}
            <button type="button" onClick={handleGeneratePlan}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors">
              Generate learning plan <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
