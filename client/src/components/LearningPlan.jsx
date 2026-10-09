import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Copy, Check, Loader2, ChevronDown, ChevronUp, BookOpen, Brain, Zap, Bot } from 'lucide-react';
import jsPDF from 'jspdf';
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

// Shown when the API gives no AI category for a skill (don't invent one)
const NEUTRAL_META = { icon: BookOpen, label: '', color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' };

// ─── Plan response helpers ────────────────────────────────────────────────────
// API shape: phases[] → months[] → skills[] { name, hours: "20 hrs", why, resource: "LinkedIn Learning" }
const getSkillName = skill =>
  skill?.name || skill?.skill_name || (typeof skill === 'string' ? skill : '');

// "20 hrs", "~20h", 20 → 20 (first number found), otherwise null
const parseHours = value => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value).match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const getPhaseSkills = phase =>
  Array.isArray(phase?.months)
    ? phase.months.flatMap(month => month.skills || [])
    : (phase?.skills || []);

const getPhaseLabel = (phase, index) =>
  phase?.label || phase?.phase_label || (phase?.phase ? `Months ${phase.phase}` : `Phase ${index + 1}`);

// resource can be a URL or just a provider name such as "LinkedIn Learning"
const getResource = skill => {
  const resource = String(skill?.resource || '').trim();
  if (!resource) return null;
  if (/^https?:\/\//i.test(resource)) return { href: resource, label: 'Suggested resource' };
  return {
    href: `https://www.google.com/search?q=${encodeURIComponent(`${getSkillName(skill)} ${resource}`)}`,
    label: `Find on ${resource}`
  };
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
    <div className="flex flex-col items-center justify-center py-24 sm:py-40 gap-6 text-center">
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
  const category = skill.ai_category || skill.category || '';
  const meta = category ? getAIMeta(category) : NEUTRAL_META;
  const Icon = meta.icon;
  const hours = parseHours(skill.hours);
  const explanation = skill.why || skill.rationale || skill.description;
  const resource = getResource(skill);

  // Pills sit under the name on phones and to the right on larger screens.
  const pills = (
    <>
      {hours != null && (
        <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full whitespace-nowrap">
          ~{hours}h
        </span>
      )}
      {meta.label && (
        <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border whitespace-nowrap ${meta.bg} ${meta.color}`}>
          {meta.label}
        </span>
      )}
    </>
  );

  return (
    <div className={`rounded-xl border ${meta.bg} overflow-hidden`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-3 sm:px-4 py-3 text-left"
      >
        <div className={`w-7 h-7 mt-0.5 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
          <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white break-words">{getSkillName(skill)}</p>
          {monthLabel && <p className="text-[10px] text-zinc-400 mt-0.5">{monthLabel}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">{pills}</div>
        </div>
        <div className="hidden sm:flex items-center gap-3 shrink-0 mt-0.5">{pills}</div>
        <span className="shrink-0 mt-1.5">
          {open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
        </span>
      </button>

      {open && (explanation || resource) && (
        <div className="px-3 sm:px-4 pb-4 pt-3 border-t border-inherit space-y-2">
          {explanation && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{explanation}</p>
          )}
          {resource && (
            <a
              href={resource.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 py-1 text-xs font-semibold text-blue-500 hover:underline"
            >
              {resource.label} →
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
  const skills = getPhaseSkills(phase);
  const totalHours = skills.reduce((sum, s) => sum + (parseHours(s.hours) || 0), 0);

  return (
    <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-6 text-left hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-800 dark:text-zinc-200 shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-zinc-900 dark:text-white">{getPhaseLabel(phase, index)}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {skills.length} skill{skills.length === 1 ? '' : 's'}
            {totalHours > 0 && ` · ~${totalHours}h total`}
            {phase.focus && ` · ${phase.focus}`}
          </p>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />}
      </button>

      {!collapsed && (
        <div className="px-3 sm:px-6 pb-5 sm:pb-6 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
          {Array.isArray(phase.months) ? (
            phase.months.map((month, mi) => {
              const monthHours = parseHours(month.total_hrs);
              return (
                <div key={mi} className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    {month.label || month.month || `Month ${mi + 1}`}
                    {monthHours != null && ` · ~${monthHours}h`}
                  </p>
                  {(month.skills || []).map((skill, si) => (
                    <SkillRow key={si} skill={skill} />
                  ))}
                </div>
              );
            })
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
const PDF_COLORS = {
  navy: [11, 17, 33], blue: [59, 130, 246], ink: [15, 23, 42], muted: [100, 116, 139],
  line: [226, 232, 240], soft: [241, 245, 249], white: [255, 255, 255], link: [37, 99, 235],
  green: [16, 185, 129], violet: [139, 92, 246], amber: [245, 158, 11]
};
const PDF_PHASE_COLORS = [PDF_COLORS.blue, PDF_COLORS.green, PDF_COLORS.violet, PDF_COLORS.amber];

// jsPDF's built-in fonts only cover Latin characters, so strip anything else.
const pdfSafe = text =>
  String(text ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u2022]/g, '').trim();

function exportPDF(plan, occupationTitle, planCode, opts = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const C = PDF_COLORS;
  const W = 210, H = 297, M = 14, CW = W - M * 2, BOTTOM = H - 20, TOP = 22;
  const date = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const trackerUrl = origin
    ? `${origin}${window.location.pathname}?view=progress-tracker${planCode ? `&code=${encodeURIComponent(planCode)}` : ''}`
    : '';

  const phases = plan.phases || [];
  const allSkills = phases.flatMap(getPhaseSkills);
  const totalHours = allSkills.reduce((sum, s) => sum + (parseHours(s.hours) || 0), 0);
  const durationMonths = plan.duration_months ?? opts.duration;
  const weeklyHours = plan.hrs_per_week ?? opts.hrsPerWeek;

  const fill = c => doc.setFillColor(c[0], c[1], c[2]);
  const ink = c => doc.setTextColor(c[0], c[1], c[2]);
  const stroke = c => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size); };

  const phaseStartPage = {};
  const linkTargets = []; // roadmap rows that jump to a phase page
  let y = 0;

  // ── Cover header ──────────────────────────────────────────────────────────
  fill(C.navy); doc.rect(0, 0, W, 54, 'F');
  fill(C.blue); doc.circle(M + 4, 14, 4, 'F');
  font('bold', 8); ink(C.white); doc.text('i', M + 3.4, 15.2);
  font('bold', 13); doc.text('IResi', M + 11, 15.5);

  font('bold', 8); ink([147, 197, 253]); doc.text('PERSONALISED LEARNING PLAN', M, 28);
  font('bold', 20); ink(C.white);
  const titleLines = doc.splitTextToSize(pdfSafe(occupationTitle), CW - 62).slice(0, 2);
  doc.text(titleLines, M, 37);
  font('normal', 9); ink([203, 213, 225]);
  const subtitle = [
    durationMonths ? `${durationMonths}-month plan` : null,
    weeklyHours ? `${weeklyHours} hrs per week` : null,
    `Created ${date}`
  ].filter(Boolean).join('   |   ');
  doc.text(subtitle, M, 37 + titleLines.length * 8 + 1);

  // Plan code badge
  fill([30, 41, 59]); doc.roundedRect(W - M - 54, 9, 54, 22, 3, 3, 'F');
  font('bold', 7); ink([147, 197, 253]); doc.text('PLAN CODE', W - M - 27, 16, { align: 'center' });
  doc.setFont('courier', 'bold'); doc.setFontSize(13); ink(C.white);
  doc.text(pdfSafe(planCode || 'N/A'), W - M - 27, 25, { align: 'center' });

  // ── Stat cards ────────────────────────────────────────────────────────────
  y = 62;
  const stats = [
    [durationMonths ? `${durationMonths} months` : 'N/A', 'Duration'],
    [weeklyHours ? `${weeklyHours} hrs/wk` : 'N/A', 'Weekly effort'],
    [String(allSkills.length), 'Skills to build'],
    [totalHours ? `~${totalHours}h` : 'N/A', 'Total learning time']
  ];
  const gap = 4, cardW = (CW - gap * 3) / 4;
  stats.forEach(([value, label], i) => {
    const x = M + i * (cardW + gap);
    fill(C.soft); doc.roundedRect(x, y, cardW, 18, 2.5, 2.5, 'F');
    font('bold', 13); ink(C.ink); doc.text(value, x + cardW / 2, y + 8.5, { align: 'center' });
    font('bold', 6.5); ink(C.muted); doc.text(label.toUpperCase(), x + cardW / 2, y + 14, { align: 'center' });
  });
  y += 26;

  // ── Save-your-code callout ────────────────────────────────────────────────
  fill([239, 246, 255]); doc.roundedRect(M, y, CW, 17, 2.5, 2.5, 'F');
  fill(C.blue); doc.rect(M, y + 2, 1.4, 13, 'F');
  font('bold', 9.5); ink(C.ink); doc.text('Keep your plan code safe', M + 6, y + 7);
  font('normal', 8.5); ink(C.muted);
  doc.text(`Use ${pdfSafe(planCode || 'your code')} in the IResi Progress Tracker to restore this plan and tick off skills.`, M + 6, y + 12.5);
  if (trackerUrl) {
    font('bold', 8.5); ink(C.link);
    const label = 'Open my plan in Progress Tracker >';
    const lw = doc.getTextWidth(label);
    doc.textWithLink(label, W - M - 4 - lw, y + 7, { url: trackerUrl });
    stroke(C.link); doc.setLineWidth(0.2); doc.line(W - M - 4 - lw, y + 7.8, W - M - 4, y + 7.8);
  }
  y += 25;

  // ── Roadmap overview (each row jumps to its phase) ────────────────────────
  font('bold', 11); ink(C.ink); doc.text('Your roadmap at a glance', M, y);
  font('normal', 8); ink(C.muted); doc.text('Click a phase to jump to it', W - M, y, { align: 'right' });
  y += 6;
  phases.forEach((phase, pi) => {
    const skills = getPhaseSkills(phase);
    const hrs = skills.reduce((sum, s) => sum + (parseHours(s.hours) || 0), 0);
    const color = PDF_PHASE_COLORS[pi % PDF_PHASE_COLORS.length];
    if (y + 13 > BOTTOM) { doc.addPage(); y = TOP; }
    fill(C.white); stroke(C.line); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, CW, 12, 2.5, 2.5, 'FD');
    fill(color); doc.circle(M + 6.5, y + 6, 3.4, 'F');
    font('bold', 8.5); ink(C.white); doc.text(String(pi + 1), M + 6.5, y + 7.4, { align: 'center' });
    font('bold', 9.5); ink(C.ink);
    doc.text(pdfSafe(getPhaseLabel(phase, pi)), M + 13, y + 5.2);
    font('normal', 8); ink(C.muted);
    doc.text(pdfSafe(phase.focus || 'Learning phase'), M + 13, y + 9.4);
    doc.text(`${skills.length} skill${skills.length === 1 ? '' : 's'}${hrs ? `  |  ~${hrs}h` : ''}`, W - M - 4, y + 7.2, { align: 'right' });
    linkTargets.push({ page: doc.internal.getCurrentPageInfo().pageNumber, x: M, y, w: CW, h: 12, phaseIndex: pi });
    y += 15;
  });

  // ── Layout helpers for the phase pages ────────────────────────────────────
  const drawPhaseHeader = (pi, continued) => {
    const phase = phases[pi];
    const skills = getPhaseSkills(phase);
    const hrs = skills.reduce((sum, s) => sum + (parseHours(s.hours) || 0), 0);
    const color = PDF_PHASE_COLORS[pi % PDF_PHASE_COLORS.length];
    fill(color); doc.roundedRect(M, y, CW, 13, 2.5, 2.5, 'F');
    fill(C.white); doc.circle(M + 7, y + 6.5, 3.8, 'F');
    font('bold', 9); ink(color); doc.text(String(pi + 1), M + 7, y + 7.9, { align: 'center' });
    font('bold', 11); ink(C.white);
    doc.text(pdfSafe(`${getPhaseLabel(phase, pi)}${phase.focus ? ` - ${phase.focus}` : ''}${continued ? ' (cont.)' : ''}`), M + 14, y + 8.2);
    font('normal', 8.5);
    doc.text(`${skills.length} skill${skills.length === 1 ? '' : 's'}${hrs ? `  |  ~${hrs}h` : ''}`, W - M - 4, y + 8.2, { align: 'right' });
    y += 19;
  };

  const ensureSpace = (needed, pi) => {
    if (y + needed <= BOTTOM) return;
    doc.addPage(); y = TOP;
    if (pi != null) drawPhaseHeader(pi, true);
  };

  const drawSkill = (skill, pi) => {
    const color = PDF_PHASE_COLORS[pi % PDF_PHASE_COLORS.length];
    const name = pdfSafe(getSkillName(skill));
    const hours = parseHours(skill.hours);
    const category = pdfSafe(skill.ai_category || skill.category || '');
    const explanation = pdfSafe(skill.why || skill.rationale || skill.description);
    const resource = getResource(skill);

    font('bold', 10);
    const titleLines = doc.splitTextToSize(name, CW - 8 - 42);
    font('normal', 8.5);
    const whyLines = explanation ? doc.splitTextToSize(explanation, CW - 12) : [];

    const h = 5.5 + titleLines.length * 4.6
      + (whyLines.length ? 1.5 + whyLines.length * 4.1 : 0)
      + (resource ? 7 : 0) + 3;
    ensureSpace(h + 3, pi);

    fill(C.soft); doc.roundedRect(M, y, CW, h, 2.5, 2.5, 'F');
    fill(color); doc.rect(M, y + 2.5, 1.3, h - 5, 'F');

    let ty = y + 7.2;
    font('bold', 10); ink(C.ink);
    doc.text(titleLines, M + 6, ty);
    ty += (titleLines.length - 1) * 4.6;

    // Pills (hours, optional AI category) on the right
    let px = W - M - 3;
    const pill = (label, textColor, bg) => {
      font('bold', 7.5);
      const pw = doc.getTextWidth(label) + 5;
      fill(bg); doc.roundedRect(px - pw, y + 3.2, pw, 5.2, 2.6, 2.6, 'F');
      ink(textColor); doc.text(label, px - pw / 2, y + 6.8, { align: 'center' });
      px -= pw + 2;
    };
    if (hours != null) pill(`~${hours}h`, C.ink, [226, 232, 240]);
    if (category) pill(category.toUpperCase(), C.link, [219, 234, 254]);

    ty += 5;
    if (whyLines.length) {
      font('normal', 8.5); ink(C.muted);
      doc.text(whyLines, M + 6, ty);
      ty += whyLines.length * 4.1;
    }
    if (resource) {
      ty += 1.2;
      font('normal', 8); ink(C.muted); doc.text('Resource:', M + 6, ty);
      const lx = M + 6 + doc.getTextWidth('Resource:') + 2;
      const label = `${pdfSafe(resource.label)} >`;
      font('bold', 8); ink(C.link);
      doc.textWithLink(label, lx, ty, { url: resource.href });
      stroke(C.link); doc.setLineWidth(0.2);
      doc.line(lx, ty + 0.8, lx + doc.getTextWidth(label), ty + 0.8);
    }
    y += h + 3;
  };

  // ── Phase pages ───────────────────────────────────────────────────────────
  phases.forEach((phase, pi) => {
    doc.addPage(); y = TOP;
    phaseStartPage[pi] = doc.internal.getCurrentPageInfo().pageNumber;
    drawPhaseHeader(pi, false);

    if (Array.isArray(phase.months) && phase.months.length) {
      phase.months.forEach((month, mi) => {
        ensureSpace(26, pi);
        const monthHours = parseHours(month.total_hrs);
        font('bold', 8.5); ink(C.muted);
        doc.text(pdfSafe(month.label || month.month || `Month ${mi + 1}`).toUpperCase(), M, y);
        if (monthHours != null) { font('normal', 8); doc.text(`~${monthHours}h this month`, W - M, y, { align: 'right' }); }
        stroke(C.line); doc.setLineWidth(0.3); doc.line(M, y + 2, W - M, y + 2);
        y += 6;
        (month.skills || []).forEach(skill => drawSkill(skill, pi));
        y += 2;
      });
    } else {
      (phase.skills || []).forEach(skill => drawSkill(skill, pi));
    }
  });

  if (!phases.length) {
    font('normal', 10); ink(C.muted); doc.text('No phases were returned for this plan.', M, y + 4);
  }

  // ── Headers, footers and clickable roadmap links ──────────────────────────
  linkTargets.forEach(t => {
    const target = phaseStartPage[t.phaseIndex];
    if (!target) return;
    doc.setPage(t.page);
    doc.link(t.x, t.y, t.w, t.h, { pageNumber: target });
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (i > 1) {
      font('bold', 8); ink(C.blue); doc.text('IResi', M, 11);
      font('normal', 8); ink(C.muted);
      doc.text(pdfSafe(`Learning plan  |  ${occupationTitle}`), M + 10, 11);
      stroke(C.line); doc.setLineWidth(0.3); doc.line(M, 14, W - M, 14);
    }
    stroke(C.line); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
    font('normal', 7.5); ink(C.muted);
    doc.text(pdfSafe(`Plan ${planCode || ''}  |  Generated ${date}`), M, H - 9);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 9, { align: 'right' });
  }

  doc.save(`IResi_Plan_${planCode || 'export'}.pdf`);
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LearningPlan({ config, onBack, onNavigate }) {
  const { occupation, missingSkills = [], duration = 6, hrsPerWeek = 5 } = config || {};
  const anzscoCode      = String(occupation?.anzsco_code || occupation?.id || '');
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
          missingSkills:   missingSkills.map(getSkillName),
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
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 py-2 sm:p-6 font-sans text-zinc-900 dark:text-zinc-100">

      {/* Back */}
      <button onClick={onBack} className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to skill gap
      </button>

      {isLoading ? (
        <LoadingScreen />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 sm:py-32 gap-4 text-center">
          <p className="text-sm text-rose-500">{error}</p>
          <button onClick={() => { hasFetched.current = false; setIsLoading(true); setError(null); }}
            className="px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ── Hero ────────────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Learning Plan</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white break-words">{occupationTitle}</h1>
                <div className="grid grid-cols-3 gap-2 mt-3 sm:flex sm:flex-wrap sm:gap-3">
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
              <div className="flex flex-wrap items-center gap-2 pt-5 border-t border-zinc-100 dark:border-zinc-800">
                {planCode && (
                  <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Plan code</span>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white font-mono">{planCode}</span>
                    <CopyButton text={planCode} />
                  </div>
                )}
                <button
                  onClick={() => exportPDF(plan, occupationTitle, planCode, { duration, hrsPerWeek })}
                  className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('progress-tracker', { planCode })}
                    className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 transition-colors"
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base font-bold break-all text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
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