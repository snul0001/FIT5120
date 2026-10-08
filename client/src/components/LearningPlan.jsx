import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Copy, Check, Loader2, ChevronDown, ChevronUp, BookOpen, Brain, Zap, Bot } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createLearningPlan } from '../api/client';

// ─── AI category metadata ─────────────────────────────────────────────────────
const AI_META = {
  human:     { icon: Brain, label: 'Human-led',    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  augmented: { icon: Zap,   label: 'AI Augmented', color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10 border-blue-500/20' },
  automated: { icon: Bot,   label: 'AI Automated', color: 'text-rose-500 dark:text-rose-400',       bg: 'bg-rose-500/10 border-rose-500/20' },
};

const getAIMeta = (category = '') => {
  const c = category.toLowerCase();
  if (c.includes('human'))     return AI_META.human;
  if (c.includes('auto'))      return AI_META.automated;
  return AI_META.augmented;
};

// ─── Loading screen ───────────────────────────────────────────────────────────
const LOADING_STEPS = [
  'Analysing skill requirements…',
  'Mapping AI impact across tasks…',
  'Sequencing learning phases…',
  'Generating your personalised plan…',
];

function LoadingScreen() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-40 gap-6 text-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-white dark:text-zinc-900" />
        </div>
        <Loader2 className="absolute -bottom-2 -right-2 w-6 h-6 animate-spin text-zinc-500" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Building your plan</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 transition-all duration-500">{LOADING_STEPS[step]}</p>
      </div>
      <div className="flex gap-1.5 mt-2">
        {LOADING_STEPS.map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Skill row inside a phase ─────────────────────────────────────────────────
function SkillRow({ skill, monthLabel }) {
  const [open, setOpen] = useState(false);
  const meta = getAIMeta(skill.ai_category || skill.category || '');
  const Icon = meta.icon;

  return (
    <div className={`rounded-xl border ${meta.bg} overflow-hidden`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
          <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{skill.name || skill.skill_name}</p>
          {monthLabel && <p className="text-[10px] text-zinc-400 mt-0.5">{monthLabel}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {skill.hours != null && (
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              ~{skill.hours}h
            </span>
          )}
          <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${meta.bg} ${meta.color}`}>
            {meta.label}
          </span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
        </div>
      </button>

      {open && (skill.rationale || skill.description || skill.resource) && (
        <div className="px-4 pb-4 pt-1 border-t border-inherit space-y-2">
          {(skill.rationale || skill.description) && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {skill.rationale || skill.description}
            </p>
          )}
          {skill.resource && (
            <a
              href={skill.resource}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:underline"
            >
              Suggested resource →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Phase block ──────────────────────────────────────────────────────────────
function PhaseBlock({ phase, index }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalHours = phase.skills?.reduce((sum, s) => sum + (s.hours || 0), 0) || 0;

  return (
    <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-4 p-5 sm:p-6 text-left hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-800 dark:text-zinc-200 shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-zinc-900 dark:text-white">{phase.label || phase.phase_label || `Phase ${index + 1}`}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {phase.skills?.length || 0} skills
            {totalHours > 0 && ` · ~${totalHours}h total`}
            {phase.focus && ` · ${phase.focus}`}
          </p>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />}
      </button>

      {!collapsed && (
        <div className="px-5 sm:px-6 pb-6 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          {/* Months inside phase (if API returns nested months) */}
          {phase.months ? (
            phase.months.map((month, mi) => (
              <div key={mi} className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{month.label || `Month ${mi + 1}`}</p>
                {(month.skills || []).map((skill, si) => (
                  <SkillRow key={si} skill={skill} />
                ))}
              </div>
            ))
          ) : (
            (phase.skills || []).map((skill, si) => (
              <SkillRow key={si} skill={skill} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 transition-all"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy code'}
    </button>
  );
}

// ─── PDF export ───────────────────────────────────────────────────────────────
function exportPDF(plan, occupationTitle, planCode) {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });

  doc.setFillColor(11, 17, 33);
  doc.rect(0, 0, 210, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('IRESI LEARNING PLAN', 14, 16);

  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Career: ${occupationTitle}`, 14, 35);
  doc.text(`Plan Code: ${planCode || 'N/A'}`, 14, 41);
  doc.text(`Generated: ${date}`, 14, 47);

  let y = 58;
  const phases = plan.phases || [];

  phases.forEach((phase, pi) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFillColor(240, 244, 248);
    doc.rect(14, y - 4, 182, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Phase ${pi + 1}: ${phase.label || phase.phase_label || ''}`, 16, y + 2);
    y += 12;

    const skillRows = [];
    const flatSkills = phase.months
      ? phase.months.flatMap(m => m.skills || [])
      : (phase.skills || []);

    flatSkills.forEach((s, i) => {
      skillRows.push([String(i + 1), s.name || s.skill_name || '', s.ai_category || s.category || '', s.hours ? `~${s.hours}h` : '']);
    });

    if (skillRows.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['#', 'Skill', 'AI Category', 'Est. Hours']],
        body: skillRows,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 3, overflow: 'linebreak', valign: 'top' },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 100 }, 2: { cellWidth: 45 }, 3: { cellWidth: 27, halign: 'center' } },
        rowPageBreak: 'avoid',
      });
      y = doc.lastAutoTable.finalY + 10;
    }
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`IResi Learning Plan · ${planCode || ''} · Page ${i} of ${pages}`, 105, 288, { align: 'center' });
  }

  doc.save(`IResi_Plan_${planCode || 'export'}.pdf`);
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LearningPlan({ config, onBack, onNavigate }) {
  const { occupation, missingSkills = [], duration = 6, hrsPerWeek = 5 } = config || {};
  const anzscoCode      = String(occupation?.occupation_id || occupation?.id || '');
  const occupationTitle = occupation?.title || occupation?.name || 'Career';

  const [isLoading, setIsLoading] = useState(true);
  const [plan,      setPlan]      = useState(null);
  const [planCode,  setPlanCode]  = useState(null);
  const [error,     setError]     = useState(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetch = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await createLearningPlan({
          anzscoCode,
          occupationName:  occupationTitle,
          durationMonths:  duration,
          hrsPerWeek,
          missingSkills:   missingSkills.map(s => s.name || s.skill_name || s),
        });
        setPlan(res);
        setPlanCode(res.code || res.plan_code || null);
      } catch (err) {
        console.error('[LearningPlan] API error:', err);
        setError('Could not generate the plan. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetch();
  }, []);

  const totalWeeks  = duration * 4.33;
  const totalHours  = Math.round(totalWeeks * hrsPerWeek);
  const phases      = plan?.phases || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 sm:p-6 font-sans text-zinc-900 dark:text-zinc-100">

      {/* Back */}
      <button onClick={onBack} className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to skill gap
      </button>

      {isLoading ? (
        <LoadingScreen />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
          <p className="text-sm text-rose-500">{error}</p>
          <button onClick={() => { hasFetched.current = false; setIsLoading(true); setError(null); }}
            className="px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ── Hero ────────────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Learning Plan</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{occupationTitle}</h1>
                <div className="flex flex-wrap gap-3 mt-3">
                  {[
                    [`${duration} months`, 'Duration'],
                    [`${hrsPerWeek} hrs/wk`, 'Weekly effort'],
                    [`${totalHours}h`, 'Total hours'],
                    [`${missingSkills.length} skills`, 'To build'],
                    [`${phases.length}`, 'Phases'],
                  ].map(([val, lbl]) => (
                    <div key={lbl} className="text-center px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{val}</p>
                      <p className="text-[9px] text-zinc-400 uppercase tracking-wider">{lbl}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 shrink-0">
                {planCode && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Plan code</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white font-mono">{planCode}</span>
                    <CopyButton text={planCode} />
                  </div>
                )}
                <button
                  onClick={() => exportPDF(plan, occupationTitle, planCode)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('progress-tracker', { planCode })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 transition-colors"
                  >
                    Track progress →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Phases ──────────────────────────────────────────────────────── */}
          <div className="space-y-4">
            {phases.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-12">No phases returned from the plan.</p>
            ) : (
              phases.map((phase, i) => <PhaseBlock key={i} phase={phase} index={i} />)
            )}
          </div>

          {/* ── Plan code callout ────────────────────────────────────────────── */}
          {planCode && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Save this plan code</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">You can restore your plan anytime from the Progress Tracker using this code.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  {planCode}
                </span>
                <CopyButton text={planCode} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}