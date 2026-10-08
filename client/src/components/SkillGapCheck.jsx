import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Loader2, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { getSkillGap } from '../api/client';

// ─── Importance pill tier ─────────────────────────────────────────────────────
const tierStyle = (score) => {
  if (score >= 8) return { dot: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', label: 'high' };
  if (score >= 6) return { dot: 'bg-amber-400', badge: 'bg-amber-400/10 text-amber-700 dark:text-amber-400 border-amber-400/20', label: 'med' };
  return { dot: 'bg-zinc-400', badge: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700', label: 'low' };
};

// ─── Resilience colour ────────────────────────────────────────────────────────
const resilienceStyle = (score) => {
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Highly Resilient' };
  if (score >= 50) return { bar: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',    label: 'Moderately Resilient' };
  return              { bar: 'bg-amber-500',        text: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',  label: 'Needs Attention' };
};

const DURATION_OPTIONS = [3, 6, 9];
const HOURS_OPTIONS    = [3, 5, 8, 12];

// ─── Fallback mock ────────────────────────────────────────────────────────────
const MOCK_DATA = {
  all_skills: [
    { id: 's1',  name: 'AWS Security',         importance: 9.2, category: 'Cloud Security' },
    { id: 's2',  name: 'Incident Response',    importance: 8.8, category: 'Security Operations' },
    { id: 's3',  name: 'Network Forensics',    importance: 8.1, category: 'Network Security' },
    { id: 's4',  name: 'SIEM Tools',           importance: 7.5, category: 'Security Operations' },
    { id: 's5',  name: 'Penetration Testing',  importance: 7.2, category: 'Offensive Security' },
    { id: 's6',  name: 'Linux Security',       importance: 6.9, category: 'System Security' },
    { id: 's7',  name: 'Threat Intelligence',  importance: 6.5, category: 'Security Operations' },
    { id: 's8',  name: 'Cloud Security',       importance: 6.2, category: 'Cloud Security' },
    { id: 's9',  name: 'Python',               importance: 5.8, category: 'Programming' },
    { id: 's10', name: 'Risk Management',      importance: 5.5, category: 'Governance' },
    { id: 's11', name: 'Cryptography',         importance: 5.0, category: 'Security Architecture' },
    { id: 's12', name: 'Firewall Management',  importance: 4.8, category: 'Network Security' },
  ],
  resilience_score: 78,
  resilience_label: 'Medium-High',
  avg_augmentation: 0.71,
  avg_automation: 0.48,
};

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
      ? s.importance
      : typeof s.importance_score === 'number'
        ? s.importance_score * 10
        : 5,
    category:   s.category || 'General',
  }));

  return {
    all_skills,
    resilience_score: raw.resilience_score ?? MOCK_DATA.resilience_score,
    resilience_label: raw.resilience_label ?? MOCK_DATA.resilience_label,
    avg_augmentation: raw.avg_augmentation ?? MOCK_DATA.avg_augmentation,
    avg_automation:   raw.avg_automation   ?? MOCK_DATA.avg_automation,
  };
}

export default function SkillGapCheck({ targetOccupation, onBack, onNavigate }) {
  const anzscoCode   = String(targetOccupation?.occupation_id || targetOccupation?.id || '271133');
  const occupationTitle = targetOccupation?.title || targetOccupation?.name || 'Selected Career';

  const [isLoading,  setIsLoading]  = useState(true);
  const [isMock,     setIsMock]     = useState(false);
  const [data,       setData]       = useState(null);
  const [selected,   setSelected]   = useState(new Set()); // skill ids user has
  const [duration,   setDuration]   = useState(6);
  const [hrsPerWeek, setHrsPerWeek] = useState(5);

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchGap = useCallback(async () => {
    setIsLoading(true);
    setIsMock(false);
    try {
      const res = await getSkillGap(anzscoCode, []);
      if (!res || res.error) throw new Error('empty response');
      setData(normalizeResponse(res));
    } catch (err) {
      console.warn('[SkillGapCheck] API unavailable, using mock data', err);
      setData(MOCK_DATA);
      setIsMock(true);
    } finally {
      setIsLoading(false);
    }
  }, [anzscoCode]);

  useEffect(() => { fetchGap(); }, [fetchGap]);

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const haveSkills    = data?.all_skills.filter(s => selected.has(s.id))  || [];
  const missingSkills = data?.all_skills.filter(s => !selected.has(s.id)) || [];
  const rs            = data ? resilienceStyle(data.resilience_score) : null;

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

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Analysing skill requirements…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 sm:p-6 font-sans text-zinc-900 dark:text-zinc-100">

      {/* Back */}
      <button onClick={onBack} className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to results
      </button>

      {/* Mock warning */}
      {isMock && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Preview data — API unavailable for this occupation.
        </div>
      )}

      {/* ── Resilience Banner ──────────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-6 ${rs.bg}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Skill Gap Check</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{occupationTitle}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Tap the skills you already have — we'll build your gap and plan from the rest.
            </p>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            {/* Resilience score */}
            <div className="text-center">
              <div className={`text-4xl font-bold tabular-nums ${rs.text}`}>{data.resilience_score}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mt-0.5">Resilience</div>
              <div className={`text-xs font-medium mt-0.5 ${rs.text}`}>{rs.label}</div>
            </div>
            {/* Augmentation / Automation */}
            <div className="space-y-3 min-w-[140px]">
              <div>
                <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  <span>Augmentation</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{Math.round(data.avg_augmentation * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-200/60 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${data.avg_augmentation * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  <span>Automation</span>
                  <span className="text-amber-600 dark:text-amber-400">{Math.round(data.avg_automation * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-200/60 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${data.avg_automation * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive Skill Selector ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Select skills you already have</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {selected.size} of {data.all_skills.length} selected · {missingSkills.length} missing
            </p>
          </div>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors shrink-0"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5">
          {data.all_skills.map(skill => {
            const tier = tierStyle(skill.importance);
            const isSelected = selected.has(skill.id);
            return (
              <button
                key={skill.id}
                onClick={() => toggleSkill(skill.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-white dark:bg-zinc-900' : tier.dot}`} />
                {skill.name}
                <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ml-0.5 ${isSelected ? 'bg-white/20 dark:bg-black/20 text-white dark:text-zinc-900 border-transparent' : tier.badge}`}>
                  {skill.importance.toFixed(1)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Gap Result Boxes ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Skills you have */}
        <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Skills you have</h3>
            <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {haveSkills.length}
            </span>
          </div>
          {haveSkills.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">Tap any skill above to add it here.</p>
          ) : (
            <div className="space-y-2">
              {haveSkills.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-700 dark:text-zinc-300">{s.name}</span>
                  <span className="text-zinc-400 text-[10px]">{s.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skills missing */}
        <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Skills to build</h3>
            <span className="ml-auto text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
              {missingSkills.length}
            </span>
          </div>
          {missingSkills.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">You've covered all required skills 🎉</p>
          ) : (
            <div className="space-y-2">
              {missingSkills.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-700 dark:text-zinc-300">{s.name}</span>
                  <span className={`text-[9px] font-semibold ${tierStyle(s.importance).text || 'text-zinc-400'}`}>
                    {s.importance.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Plan Config ───────────────────────────────────────────────────── */}
      {missingSkills.length > 0 && (
        <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Build a learning plan</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Choose your timeline and availability.</p>
          </div>

          {/* Duration */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Duration</p>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map(m => (
                <button
                  key={m}
                  onClick={() => setDuration(m)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                    duration === m
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                  }`}
                >
                  {m} months
                </button>
              ))}
            </div>
          </div>

          {/* Hours per week */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Hours per week</p>
            <div className="flex gap-2 flex-wrap">
              {HOURS_OPTIONS.map(h => (
                <button
                  key={h}
                  onClick={() => setHrsPerWeek(h)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                    hrsPerWeek === h
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                  }`}
                >
                  {h} hrs/wk
                </button>
              ))}
            </div>
          </div>

          {/* Summary sentence */}
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 p-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              You'll have{' '}
              <span className="font-semibold text-zinc-900 dark:text-white">{totalHours} hours</span> over{' '}
              <span className="font-semibold text-zinc-900 dark:text-white">{duration} months</span> to build{' '}
              <span className="font-semibold text-zinc-900 dark:text-white">{missingSkills.length} skills</span>.
              {hoursPerSkill > 0 && (
                <> That's roughly <span className="font-semibold text-zinc-900 dark:text-white">~{hoursPerSkill} hrs</span> per skill.</>
              )}
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={handleGeneratePlan}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            Generate learning plan <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}