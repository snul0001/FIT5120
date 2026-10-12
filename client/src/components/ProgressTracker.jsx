import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Loader2, CheckCircle2, Circle, ChevronDown, ChevronUp, KeyRound, RotateCcw } from 'lucide-react';
import { getPlanByCode, updatePlanProgress } from '../api/client';

function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

function PhaseBlock({ phase, phaseIndex, onToggleSkill }) {
  const [collapsed, setCollapsed] = useState(false);
  const skills = phase.months
    ? phase.months.flatMap(m => m.skills || [])
    : (phase.skills || []);
  const completed = skills.filter(s => s.completed).length;

  return (
    <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-4 p-5 sm:p-6 text-left hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-800 dark:text-zinc-200 shrink-0">
          {phaseIndex + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-zinc-900 dark:text-white">{phase.label || phase.phase_label || `Phase ${phaseIndex + 1}`}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{completed} of {skills.length} skills completed</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-20 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${skills.length ? (completed / skills.length) * 100 : 0}%` }} />
          </div>
          {collapsed ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronUp className="w-4 h-4 text-zinc-400" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 sm:px-6 pb-6 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          {/* handle months nesting */}
          {phase.months ? (
            phase.months.map((month, mi) => (
              <div key={mi} className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 pt-2">{month.label || `Month ${mi + 1}`}</p>
                {(month.skills || []).map((skill, si) => {
                  const globalIdx = phase.months.slice(0, mi).reduce((a, m) => a + (m.skills?.length || 0), 0) + si;
                  return (
                    <SkillCheckRow key={si} skill={skill} onToggle={() => onToggleSkill(phaseIndex, globalIdx, !skill.completed, true, mi, si)} />
                  );
                })}
              </div>
            ))
          ) : (
            skills.map((skill, si) => (
              <SkillCheckRow key={si} skill={skill} onToggle={() => onToggleSkill(phaseIndex, si, !skill.completed, false)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SkillCheckRow({ skill, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
        skill.completed
          ? 'bg-emerald-500/5 border-emerald-500/20 dark:border-emerald-500/20'
          : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
      }`}
    >
      {skill.completed
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        : <Circle className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0" />
      }
      <span className={`text-sm font-medium flex-1 ${skill.completed ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-800 dark:text-zinc-200'}`}>
        {skill.name || skill.skill_name}
      </span>
      {skill.hours && <span className="text-[10px] text-zinc-400 shrink-0">~{skill.hours}h</span>}
    </button>
  );
}

export default function ProgressTracker({ config, onBack, onNavigate }) {
  const initialCode = config?.planCode || '';

  const [mode, setMode] = useState(initialCode ? 'loading-initial' : 'entry');
  const [codeInput, setCodeInput] = useState(initialCode);
  const [plan, setPlan] = useState(null);
  const [phases, setPhases] = useState([]);
  const [planCode, setPlanCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(''); // 'saving' | 'saved' | ''

  // Auto-load if we arrived with a code
  React.useEffect(() => {
    if (initialCode) loadPlan(initialCode);
  }, []);

  const loadPlan = async (code) => {
    setMode('loading');
    setError('');
    try {
      const res = await getPlanByCode(code.trim().toUpperCase());
      setPlan(res);
      setPlanCode(code.trim().toUpperCase());
      setPhases(res.phases || []);
      setMode('tracker');
    } catch (err) {
      setError(err.status === 404 ? 'Plan not found. Check your code and try again.' : 'Could not load plan. Please try again.');
      setMode('entry');
    }
  };

  const persistUpdate = useDebounce(async (updatedPhases, code) => {
    setSaveStatus('saving');
    try {
      await updatePlanProgress(code, updatedPhases);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('[ProgressTracker] PATCH failed:', err);
      setSaveStatus('');
    }
  }, 800);

  const toggleSkill = (phaseIndex, skillIndex, newValue, isNested = false, monthIndex, nestedSkillIndex) => {
    setPhases(prev => {
      const next = prev.map((phase, pi) => {
        if (pi !== phaseIndex) return phase;
        if (isNested && phase.months) {
          return {
            ...phase,
            months: phase.months.map((month, mi) => {
              if (mi !== monthIndex) return month;
              return {
                ...month,
                skills: month.skills.map((s, si) =>
                  si === nestedSkillIndex ? { ...s, completed: newValue } : s
                )
              };
            })
          };
        }
        return {
          ...phase,
          skills: (phase.skills || []).map((s, si) =>
            si === skillIndex ? { ...s, completed: newValue } : s
          )
        };
      });
      persistUpdate(next, planCode);
      return next;
    });
  };

  const totalSkills = phases.reduce((sum, p) => {
    const skills = p.months ? p.months.flatMap(m => m.skills || []) : (p.skills || []);
    return sum + skills.length;
  }, 0);
  const completedSkills = phases.reduce((sum, p) => {
    const skills = p.months ? p.months.flatMap(m => m.skills || []) : (p.skills || []);
    return sum + skills.filter(s => s.completed).length;
  }, 0);
  const pct = totalSkills > 0 ? Math.round((completedSkills / totalSkills) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 sm:p-6 font-sans text-zinc-900 dark:text-zinc-100">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Entry mode */}
      {(mode === 'entry' || mode === 'loading') && (
        <div className="max-w-md mx-auto space-y-6 pt-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Progress Tracker</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Restore your plan</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Enter the plan code from your Learning Plan to continue tracking.</p>
          </div>

          <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <KeyRound className="w-4 h-4" />
              <label className="text-xs font-semibold uppercase tracking-wider">Plan Code</label>
            </div>
            <input
              type="text"
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && codeInput.trim() && loadPlan(codeInput)}
              placeholder="e.g. ABC123"
              className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-mono tracking-widest outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:tracking-normal"
            />
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <button
              onClick={() => codeInput.trim() && loadPlan(codeInput)}
              disabled={mode === 'loading' || !codeInput.trim()}
              className="w-full py-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {mode === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : 'Restore Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Tracker mode */}
      {mode === 'tracker' && (
        <>
          {/* Header */}
          <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Progress Tracker</p>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  {plan?.occupation_name || plan?.occupation_title || 'Your Learning Plan'}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs text-zinc-400">{planCode}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {saveStatus === 'saving' && <span className="text-xs text-zinc-400 animate-pulse">Saving…</span>}
                {saveStatus === 'saved' && <span className="text-xs text-emerald-500">✓ Saved</span>}
                <button
                  onClick={() => { setPlan(null); setPhases([]); setMode('entry'); setCodeInput(''); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Switch plan
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-500 dark:text-zinc-400">{completedSkills} of {totalSkills} skills</span>
                <span className={pct === 100 ? 'text-emerald-500' : 'text-zinc-900 dark:text-white'}>{pct}% complete</span>
              </div>
              <div className="h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-zinc-900 dark:bg-white'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Phases */}
          <div className="space-y-4">
            {phases.map((phase, i) => (
              <PhaseBlock key={i} phase={phase} phaseIndex={i} onToggleSkill={toggleSkill} />
            ))}
          </div>

          {pct === 100 && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-6 text-center space-y-2">
              <p className="text-2xl">🎉</p>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">Plan complete!</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">You've finished all skills in this learning plan.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}