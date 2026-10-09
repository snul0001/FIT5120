import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Cpu, Download,
  ExternalLink, LayoutDashboard, Loader2, Moon, Sun, X, Zap
} from 'lucide-react';

import Intro from './components/Intro';
import PasswordGate from './components/PasswordGate';
import WorkInProgress from './components/WorkInProgress';
import SkillGapCheck from './components/SkillGapCheck';
import LearningPlan from './components/LearningPlan';
import ProgressTracker from './components/ProgressTracker';
import RegionalInsights from './components/RegionalInsights';
import Chatbot from './components/Chatbot';
import { matchOccupations, getOccupationAI, getSkillGap, getOccupationTasks } from './api/client';
import { RIASEC_QUESTIONS, getTopHollandCodes } from './utils/riasecQuestions';

const BASE_URL = 'https://iresi.duckdns.org/api';
const INITIAL_MATCH_COUNT = 4;
const DATA_SOURCES = [
  ['O*NET Database', 'https://www.onetcenter.org/database.html'],
  ['Jobs & Skills Australia (JSA)', 'https://www.jobsandskills.gov.au/data']
];

const MOCK_MATCHES = [
  { occupation_id: '271133', rank: 1, title: 'Cyber Security Analyst', sector: 'ICT', match_score: 96, match_label: 'Exceptional Fit' },
  { occupation_id: '271134', rank: 2, title: 'Cloud Solutions Architect', sector: 'ICT', match_score: 88, match_label: 'Strong Fit' },
  { occupation_id: '271135', rank: 3, title: 'Data Engineer', sector: 'ICT', match_score: 84, match_label: 'Strong Fit' },
  { occupation_id: '271136', rank: 4, title: 'DevOps Engineer', sector: 'ICT', match_score: 81, match_label: 'Moderate Fit' }
];
const MOCK_AI_DATA = {
  tasks: [
    { task_text: 'Accepting responsibility for system security and disaster recovery planning', automation_score: 0.4, augmentation_score: 0.7 },
    { task_text: 'Surveying current infrastructure and recommending network enhancements', automation_score: 0.5, augmentation_score: 0.7 },
    { task_text: 'Designing and maintaining database architecture and data structures', automation_score: 0.4, augmentation_score: 0.7 }
  ],
  resilience_score: 78, resilience_label: 'Medium', demand_label: 'High', avg_augmentation: 0.71, avg_automation: 0.48
};
const TOOLTIP_TEXT = {
  resilience: 'Measures how adaptable a role is to AI disruption based on high task augmentation versus lower automation risk.',
  augmentation: 'The percentage of tasks where AI boosts human capability rather than replacing the job.',
  automation: 'The percentage of core role tasks that can be fully automated without human intervention.'
};

const formatLabel = label =>
  !label || label.includes('Not available') || label === 'Pending Data' ? 'N/A' : label.split(/[—–-]/)[0].trim();

// ─── Task helpers ─────────────────────────────────────────────────────────────
// The API can return tasks as strings or objects with different field names,
// and scores as 0-1 or 0-100. Normalise everything to one shape for the UI and PDF.
const pickFirst = (obj, keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value != null && value !== '') return value;
  }
  return null;
};

const toUnit = value => {
  const n = Number(value);
  if (value == null || value === '' || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
};

const extractTaskList = res => {
  if (Array.isArray(res)) return res;
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;

  // Tasks endpoint shape: { total, grouped: { 'Human-led': [], 'AI-assisted': [...], ... } }
  const grouped = payload?.grouped;
  if (grouped && typeof grouped === 'object' && !Array.isArray(grouped)) {
    return Object.entries(grouped).flatMap(([group, items]) =>
      Array.isArray(items)
        ? items.map(item => (item && typeof item === 'object' ? { impact_group: group, ...item } : item))
        : []
    );
  }

  for (const key of ['tasks', 'items', 'results', 'data']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
};

const normalizeTasks = list =>
  list
    .map((raw, index) => {
      if (typeof raw === 'string') {
        return { id: `task_${index}`, task_text: raw.trim(), category: null, augmentation_score: null, automation_score: null };
      }
      const t = { ...raw, ...(raw?.scores || {}) };
      const text = pickFirst(t, ['plain_english', 'short_explanation', 'task_text', 'task_description', 'description', 'statement', 'task', 'text', 'task_core', 'task_name', 'name', 'title']);
      const core = pickFirst(t, ['task_core']);
      const need = pickFirst(t, ['human_need_type']);
      return {
        ...raw,
        id: raw?.id ?? raw?.task_id ?? `task_${index}`,
        task_text: text ? String(text).trim() : '',
        task_core: core ? String(core).trim() : '',
        impact_level: pickFirst(t, ['impact_level']),
        human_need_type: need && !/^none stated$/i.test(String(need)) ? String(need).trim() : '',
        category: pickFirst(t, ['impact_group', 'category', 'task_category', 'ai_impact', 'impact_type', 'classification']),
        augmentation_score: toUnit(pickFirst(t, ['augmentation_score', 'augmentation', 'augment_score', 'ai_augmentation'])),
        automation_score: toUnit(pickFirst(t, ['automation_score', 'automation', 'automate_score', 'ai_automation']))
      };
    })
    .filter(task => task.task_text);

const capitalise = text => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');

const getImpactStyle = category => {
  const c = String(category || '').toLowerCase();
  if (c.includes('automat')) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  if (c.includes('assist') || c.includes('augment')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (c.includes('human')) return 'bg-blue-500/15 text-blue-700 dark:text-blue-300';
  return 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
};

const formatCategory = category => String(category).replace(/[_]+/g, ' ').trim();

const getSkillName = item => item?.skill_name || item?.name || (item ? String(item) : '');

const getSkillResourceUrl = skill =>
  `https://www.google.com/search?udm=50&q=resources+to+learn+${encodeURIComponent(skill)}`;

const MATCH_COLORS = [
  { test: (s, l) => s >= 90 || l.includes('exceptional'), badge: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30', cardBorder: 'border-l-4 border-l-emerald-500', rankBg: 'bg-emerald-600 text-white font-bold', cardHover: 'hover:bg-emerald-500/[0.02] dark:hover:bg-white/[0.02]' },
  { test: (s, l) => s >= 84 || l.includes('strong'), badge: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30', cardBorder: 'border-l-4 border-l-blue-500', rankBg: 'bg-blue-600 text-white font-bold', cardHover: 'hover:bg-blue-500/[0.02] dark:hover:bg-white/[0.02]' },
  { test: (s, l) => s >= 70 || l.includes('moderate'), badge: 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30', cardBorder: 'border-l-4 border-l-amber-500', rankBg: 'bg-amber-600 text-white font-bold', cardHover: 'hover:bg-amber-500/[0.02] dark:hover:bg-white/[0.02]' },
  { test: () => true, badge: 'bg-zinc-500/15 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300 border border-zinc-500/30', cardBorder: 'border-l-4 border-l-zinc-400', rankBg: 'bg-zinc-700 text-white font-bold', cardHover: 'hover:bg-zinc-500/[0.02] dark:hover:bg-white/[0.02]' }
];
const getMatchColor = (score = 0, label = '') => MATCH_COLORS.find(x => x.test(score, label.toLowerCase()));
const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ─── Sub-components ───────────────────────────────────────────────────────────

const SourceLinks = ({ mobile = false, onClick }) => (
  <div className={mobile ? 'border-t border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.03]' : 'py-2'}>
    {DATA_SOURCES.map(([label, href]) => (
      <a key={href} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}
        className={mobile
          ? 'flex items-center justify-between px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
          : 'flex items-center justify-between px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors'}>
        <span>{label}</span><ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
      </a>
    ))}
  </div>
);

const NavItem = ({ label, active, onClick }) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${active ? 'bg-zinc-100 dark:bg-white/10 text-black dark:text-white' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10'}`}>
    {label}
  </button>
);

const ProgressBar = ({ label, value, color = 'bg-emerald-500', textColor = 'text-emerald-600 dark:text-[#34D399]' }) => {
  const pct = Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className={`w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider ${textColor}`}>{label}</span>
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-[#1E293B] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-10 shrink-0 text-right text-xs font-bold tabular-nums ${textColor}`}>{pct}%</span>
    </div>
  );
};

const ResultCard = ({
  role, ai, expanded, colors, onToggle, onSkillGap, tooltip,
  aiLoading = false, aiError = '', onRetry
}) => {
  const taskCounts = ai?.task_counts || {};
  const employmentTrend = Array.isArray(ai?.employment_trend) ? ai.employment_trend : [];
  const tasks = Array.isArray(ai?.tasks) ? ai.tasks : [];
  const hasAugmentation = ai?.avg_augmentation != null;
  const hasAutomation = ai?.avg_automation != null;
  const hasResilience = ai?.resilience_score != null;
  const hasAIData = Boolean(ai && (
    hasResilience || hasAugmentation || hasAutomation ||
    Object.keys(taskCounts).length > 0 || tasks.length || employmentTrend.length
  ));

  return (
    <div className={`bg-white/90 dark:bg-[#131B2F]/90 backdrop-blur-sm border-t border-r border-b border-zinc-200/80 dark:border-white/5 ${colors.cardBorder} rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-none overflow-hidden transition-all duration-300`}>
      <div onClick={() => onToggle(role.anzsco_code)} className={`p-5 sm:p-8 cursor-pointer flex items-center gap-4 sm:gap-6 transition-colors ${colors.cardHover}`}>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center text-base sm:text-lg shadow-sm ${colors.rankBg}`}>#{role.rank}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold tracking-wide ${colors.badge}`}>
              {role.match_label} {role.match_score != null ? `• ${role.match_score}%` : ''}
            </span>
          </div>
          <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white truncate">{role.title}</h3>
        </div>
        {ai && (
          <div {...tooltip('Resilience Score', TOOLTIP_TEXT.resilience)} className={`cursor-help hidden sm:flex flex-col items-start px-4 py-2 mr-4 rounded-xl border transition-colors ${hasResilience && ai.resilience_score >= 50 ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20'}`}>
            <span className="text-[9px] font-bold uppercase tracking-widest mb-1 text-slate-500 dark:text-slate-400">Resilience Score</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold leading-none text-zinc-800 dark:text-white">{hasResilience ? `${ai.resilience_score}%` : 'N/A'}</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">({formatLabel(ai.resilience_label)})</span>
            </div>
          </div>
        )}
        <div className="shrink-0 p-2 sm:p-3 rounded-full border border-zinc-200 dark:border-white/10 text-zinc-400">
          {expanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
        </div>
      </div>

      {expanded && (
        <div className="accordion-enter-animation px-5 sm:px-8 pb-6 sm:pb-8 pt-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0E1525]">
          {aiLoading ? (
            <div className="flex items-center justify-center gap-3 py-10 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading AI impact and market data…</span>
            </div>
          ) : aiError ? (
            <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400">
              <p className="font-semibold">Could not load AI impact data</p>
              <p className="mt-1">{aiError}</p>
              <button type="button" onClick={() => onRetry?.(role.anzsco_code)} className="mt-3 font-semibold underline underline-offset-2">Try again</button>
            </div>
          ) : ai ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-1"><LayoutDashboard className="w-4 h-4" /> MARKET INTELLIGENCE</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300">JSA market assessment indicates <strong className="text-black dark:text-white font-semibold">{formatLabel(ai.demand_label).toLowerCase()}</strong> demand for this occupation.</p>
                  </div>
                  <button onClick={() => onSkillGap(role)} className="group inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 dark:text-slate-200 dark:border-white/10 transition-all cursor-pointer">
                    Check Skill Gap <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: 'Augmentation', tag: 'Support', value: ai.avg_augmentation, available: hasAugmentation, copy: 'Human capacity elevated', tip: TOOLTIP_TEXT.augmentation, box: 'border-emerald-500/20 bg-emerald-500/5', labelColor: 'text-emerald-600 dark:text-[#34D399]', tagColor: 'text-emerald-700 dark:text-[#6EE7B7] bg-emerald-500/20' },
                      { label: 'Automation', tag: 'Replace', value: ai.avg_automation, available: hasAutomation, copy: 'Tasks fully automated', tip: TOOLTIP_TEXT.automation, box: 'border-amber-500/20 bg-amber-500/5', labelColor: 'text-amber-600 dark:text-[#FBBF24]', tagColor: 'text-amber-700 dark:text-[#FCD34D] bg-amber-500/20' }
                    ].map(stat => (
                      <div key={stat.label} {...tooltip(stat.label, stat.tip)} className={`p-5 rounded-xl border ${stat.box} flex flex-col justify-between`}>
                        <div className="flex justify-between items-start mb-4">
                          <span className={`text-[10px] font-bold ${stat.labelColor} uppercase tracking-widest`}>{stat.label}</span>
                          <span className={`text-[9px] font-bold ${stat.tagColor} px-2 py-0.5 rounded uppercase`}>{stat.tag}</span>
                        </div>
                        <div>
                          <div className={`text-4xl font-bold tracking-tight ${stat.labelColor}`}>{stat.available ? `${Math.round(stat.value * 100)}%` : 'N/A'}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{stat.available ? stat.copy : 'Score not available from the API'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Cpu className="w-4 h-4" /> TASK IMPACT ANALYSIS</h4>
                  {tasks.length ? (
                    <>
                      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2 mb-4">
                        {tasks.length} task{tasks.length === 1 ? '' : 's'} in this role, grouped by how AI may change them.
                      </p>
                      <ol className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                        {tasks.map((task, idx) => (
                          <li key={task.id ?? idx} className="flex gap-3 p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-white/70 dark:bg-white/[0.02]">
                            <span className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1 space-y-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                {task.category && (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${getImpactStyle(task.category)}`}>
                                    {formatCategory(task.category)}
                                  </span>
                                )}
                                {task.impact_level && (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 text-[10px] font-semibold uppercase tracking-wide">
                                    {task.impact_level} impact
                                  </span>
                                )}
                              </div>
                              {task.task_core && task.task_core !== task.task_text && (
                                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug break-words">{capitalise(task.task_core)}</p>
                              )}
                              <p className={`leading-relaxed break-words ${task.task_core && task.task_core !== task.task_text ? 'text-[13px] text-slate-600 dark:text-slate-400' : 'text-sm font-medium text-slate-800 dark:text-slate-200'}`}>{task.task_text}</p>
                              {task.human_need_type && (
                                <p className="text-xs text-slate-500 dark:text-slate-400"><span className="font-semibold">Human role:</span> {task.human_need_type}</p>
                              )}
                              {(task.augmentation_score != null || task.automation_score != null) && (
                                <div className="space-y-2 pt-1">
                                  {task.augmentation_score != null && <ProgressBar label="Augment" value={task.augmentation_score} />}
                                  {task.automation_score != null && <ProgressBar label="Automate" value={task.automation_score} color="bg-amber-500" textColor="text-amber-600 dark:text-[#FBBF24]" />}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-white/[0.02] p-5">
                      <p className="text-sm text-slate-600 dark:text-slate-300">Individual task descriptions are not included in this response.</p>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        {[
                          ['Human-led', taskCounts.human_led ?? 0],
                          ['AI-assisted', taskCounts.ai_assisted ?? 0],
                          ['AI-automated', taskCounts.ai_automated ?? 0]
                        ].map(([label, count]) => (
                          <div key={label} className="rounded-lg bg-slate-100 dark:bg-white/5 p-3 text-center">
                            <div className="text-xl font-bold text-zinc-900 dark:text-white">{count}</div>
                            <div className="mt-1 text-[10px] leading-tight text-slate-500 dark:text-slate-400">{label}</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Total tasks: {taskCounts.total ?? (tasks.length || 'N/A')}</p>
                    </div>
                  )}
                </div>
              </div>

              {employmentTrend.length > 0 && (
                <section className="border-t border-zinc-200 dark:border-white/10 pt-6">
                  <h4 className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">EMPLOYMENT TREND</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Employment estimates by year (in thousands).</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {employmentTrend.map(item => {
                      const employment = Number(item.employed_k);
                      const maxEmployment = Math.max(...employmentTrend.map(point => Number(point.employed_k) || 0), 1);
                      const width = Number.isFinite(employment) ? Math.max(0, Math.min(100, employment / maxEmployment * 100)) : 0;
                      return (
                        <div key={item.year} className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-3">
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.year}</div>
                          <div className="text-sm font-bold text-zinc-900 dark:text-white mt-1">{Number.isFinite(employment) ? employment.toFixed(1) : 'N/A'}k</div>
                          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-3 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              {!hasAIData && <p className="text-sm text-slate-500">No additional AI or market data is available for this occupation yet.</p>}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 py-8 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Preparing occupation details…</span></div>
          )}
        </div>
      )}
    </div>
  );
};

const Tooltip = ({ info }) => {
  if (!info.show || typeof document === 'undefined') return null;
  return createPortal(canHover() ? (
    <div id="app-tooltip" role="tooltip" style={{ left: info.x, top: info.y, width: `${info.width || 280}px` }} className={`fixed z-[10000] max-w-[calc(100vw-32px)] p-4 bg-white dark:bg-[#1A233A] rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-zinc-200 dark:border-white/10 text-left -translate-x-1/2 transition-opacity duration-150 ${info.isTop ? '-translate-y-full' : ''}`}>
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1.5 tracking-tight">{info.title}</h4>
      <p className="text-[12px] text-zinc-600 dark:text-slate-300 leading-relaxed">{info.text}</p>
      <div style={{ transform: `translateX(calc(-50% + ${info.arrowOffset || 0}px))` }} className={`absolute left-1/2 border-[6px] border-transparent ${info.isTop ? 'top-full border-t-white dark:border-t-[#1A233A]' : 'bottom-full border-b-white dark:border-b-[#1A233A]'}`} />
    </div>
  ) : (
    <div id="app-tooltip" role="dialog" className="fixed left-3 right-3 bottom-3 z-[10000] rounded-2xl bg-white dark:bg-[#1A233A] border border-zinc-200 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">{info.title}</h4>
          <p className="text-[13px] text-zinc-600 dark:text-slate-300 leading-relaxed">{info.text}</p>
        </div>
        <button type="button" onClick={info.close} className="shrink-0 w-8 h-8 rounded-full border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  ), document.body);
};

const NAV_VIEWS = ['results', 'skill-gap', 'learning-plan', 'progress-tracker'];

const AppNav = ({ isDark, currentView, mobileMenu, mobileSources, actions, quizDone }) => (
  <nav className={`fixed top-0 left-0 right-0 z-50 border-b transition-transform duration-300 ${NAV_VIEWS.includes(currentView) ? 'bg-white dark:bg-[#0B1121] border-zinc-200 dark:border-white/10' : 'bg-white dark:bg-[#09090B] border-zinc-200 dark:border-zinc-800'}`}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
      <div onClick={() => actions.navigate('home')} className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#3B82F6] flex items-center justify-center text-white transition-transform group-hover:scale-105">
          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
        </div>
        <span className="font-bold tracking-tight text-base sm:text-lg">IResi</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden md:flex items-center gap-1 sm:gap-2">
          <NavItem label="Progress Tracker" active={currentView === 'progress-tracker'} onClick={() => actions.navigate('progress-tracker')} />
          <NavItem label="Regional Insights" active={currentView === 'regional-insights'} onClick={() => actions.navigate('regional-insights')} />
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all">
              <span>Data Sources</span><ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:rotate-180 transition-transform" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-[#131B2F] rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[999]">
              <SourceLinks />
            </div>
          </div>
        </div>
        <div className="hidden md:block w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-2" />
        <button onClick={actions.startQuiz} className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80">
          Get started
        </button>
        <button type="button" onClick={actions.toggleMobileMenu} className="md:hidden w-10 h-10 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#131B2F] flex items-center justify-center text-zinc-700 dark:text-zinc-200">
          {mobileMenu ? <X className="w-5 h-5" /> : <span className="flex flex-col gap-[4px]"><span className="w-5 h-[2px] rounded-full bg-current" /><span className="w-5 h-[2px] rounded-full bg-current" /><span className="w-5 h-[2px] rounded-full bg-current" /></span>}
        </button>
        <button onClick={actions.toggleTheme} className="p-2 rounded-full text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10">
          {isDark ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>
      </div>
    </div>

    {mobileMenu && (
      <div className="md:hidden absolute top-full left-0 right-0 border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0B1121] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]">
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <button type="button" onClick={() => actions.navigate('progress-tracker')} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold text-left border transition-colors ${currentView === 'progress-tracker' ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300' : 'border-transparent text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10'}`}>
                Progress Tracker
              </button>
            <button type="button" onClick={() => actions.navigate('regional-insights')} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold text-left border transition-colors ${currentView === 'regional-insights' ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300' : 'border-transparent text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10'}`}>
              Regional Insights
            </button>
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
              <button type="button" onClick={actions.toggleSources} className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10">
                <span>Data Sources</span>
                {mobileSources ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
              </button>
              {mobileSources && <SourceLinks mobile onClick={actions.closeMobile} />}
            </div>
            <button type="button" onClick={actions.startQuiz} className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold bg-black dark:bg-white text-white dark:text-black">
              Get started <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )}
  </nav>
);

// ─── Deep link ────────────────────────────────────────────────────────────────
// e.g. https://your-site/?view=progress-tracker&code=252-6M-U25P (used by the plan PDF)
const getDeepLink = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') !== 'progress-tracker') return null;
  const code = (params.get('code') || '').trim().toUpperCase();
  return { view: 'progress-tracker', planCode: /^[A-Z0-9-]{4,32}$/.test(code) ? code : '' };
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [deepLink] = useState(getDeepLink);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSourcesOpen, setIsMobileSourcesOpen] = useState(false);
  const [currentView, setCurrentView] = useState(deepLink?.view || 'home');
  const [navContext, setNavContext] = useState(deepLink?.planCode ? { planCode: deepLink.planCode } : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRoleId, setExpandedRoleId] = useState(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [activeOccupation, setActiveOccupation] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchError, setMatchError] = useState('');
  const [aiDetailsMap, setAiDetailsMap] = useState({});
  const [aiLoadingMap, setAiLoadingMap] = useState({});
  const [aiErrorMap, setAiErrorMap] = useState({});
  const [tooltipPos, setTooltipPos] = useState({ show: false, x: 0, y: 0, width: 280, isTop: false, arrowOffset: 0, title: '', text: '' });
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [hollandCode, setHollandCode] = useState('');
  const [quizDone, setQuizDone] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(0);

  // The deep link has been used; remove it from the address bar so a refresh doesn't re-trigger it.
  useEffect(() => {
    if (deepLink) window.history.replaceState({}, '', window.location.pathname);
  }, [deepLink]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (currentView !== 'results' || hasDownloaded) return;
    const warn = e => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [currentView, hasDownloaded]);

  const confirmNavigation = (target, ctx = null) => {
    if (currentView === 'results' && !hasDownloaded && !window.confirm('You haven\'t downloaded your results yet. Leave anyway?')) return;
    if (ctx) setNavContext(ctx);
    setCurrentView(target);
    setIsMobileMenuOpen(false);
    setIsMobileSourcesOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleStartQuiz = () => {
    setIsMobileMenuOpen(false);
    setQuizIndex(0);
    setQuizAnswers({});
    setHollandCode('');
    setMatches([]);
    setAiDetailsMap({});
    setAiLoadingMap({});
    setAiErrorMap({});
    setExpandedRoleId(null);
    setShowAllMatches(false);
    setChatSessionId(id => id + 1);
    setCurrentView('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runMatch = async (code) => {
    setIsSubmitting(true);
    setMatchError('');
    setMatches([]);
    setAiDetailsMap({});
    setAiLoadingMap({});
    setAiErrorMap({});
    setExpandedRoleId(null);
    setShowAllMatches(false);
    setHasDownloaded(false);

    try {
      const interestCodes = [
        ...new Set(
          String(code || '')
            .toUpperCase()
            .split('')
            .filter(letter => /^[RIASEC]$/.test(letter))
        ),
      ];

      if (!interestCodes.length) {
        throw new Error('No valid RIASEC interest codes were selected.');
      }

      const response = await fetch('/api/v3/occupations/match', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interest_codes: interestCodes,
        }),
      });

      const responseText = await response.text();
      let data = null;

      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        data = responseText;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
          data?.message ||
          `Career matching failed (${response.status})`
        );
      }

      const results = Array.isArray(data)
        ? data
        : data?.occupations;

      if (!Array.isArray(results)) {
        throw new Error(
          'The matching API did not return an occupation array.'
        );
      }

      const normalizedMatches = results
        .map((role, index) => {
          const anzscoCode = String(
            role.anzsco_code || ''
          ).trim();

          if (!anzscoCode) return null;

          return {
            ...role,
            anzsco_code: anzscoCode,
            occupation_id: anzscoCode,
            title: role.name || 'Unnamed occupation',
            sector: role.category || 'Other',
            rank: Number(role.rank) || index + 1,
            match_score: role.match_score ?? null,
            match_label: role.match_label || 'Career match',
          };
        })
        .filter(Boolean);

      if (!normalizedMatches.length) {
        throw new Error('No valid occupations were returned.');
      }

      setMatches(normalizedMatches);
      setQuizDone(true);
      setCurrentView('results');
    } catch (error) {
      console.error('[IResi] Matching API error:', error);

      setMatches([]);
      setMatchError(
        error.message || 'Could not load career matches.'
      );
      setQuizDone(true);
      setCurrentView('results');
    } finally {
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectOption = async (letter) => {
    const answers = { ...quizAnswers, [quizIndex]: letter };
    setQuizAnswers(answers);

    if (quizIndex < RIASEC_QUESTIONS.length - 1) {
      setQuizIndex(i => i + 1);
      return;
    }

    const code = getTopHollandCodes(answers);
    setHollandCode(code);
    await runMatch(code);
  };

  const openSkillGap = role => {
    setActiveOccupation(role);
    setNavContext(null);
    setCurrentView('skill-gap');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Loads AI details only when a match is expanded.
  // Each occupation's result, loading state, and error are stored by ANZSCO code.
  const handleToggleRole = async code => {
    if (expandedRoleId === code && !aiErrorMap[code]) {
      setExpandedRoleId(null);
      return;
    }

    setExpandedRoleId(code);

    if (aiDetailsMap[code] || aiLoadingMap[code]) return;

    setAiLoadingMap(previous => ({ ...previous, [code]: true }));
    setAiErrorMap(previous => ({ ...previous, [code]: '' }));

    try {
      const response = await getOccupationAI(code);
      const payload = response?.data ?? response?.occupation ?? response;

      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('The occupation AI endpoint returned an unexpected response.');
      }

      const taskCounts = payload.task_counts || {};
      let tasks = normalizeTasks(extractTaskList(payload.tasks));

      // The occupation endpoint may only return counts, so fall back to the tasks endpoint.
      if (!tasks.length) {
        try {
          const taskResponse = await getOccupationTasks(code);
          tasks = normalizeTasks(extractTaskList(taskResponse));
        } catch (taskError) {
          console.warn('[IResi] Could not load task descriptions:', taskError);
        }
      }

      const normalized = {
        ...payload,
        anzsco_code: payload.anzsco_code || code,
        title: payload.name || payload.title || '',
        resilience_score: payload.resilience_score ?? null,
        resilience_label: payload.resilience_label || 'Not available',
        demand_label: payload.demand_label || payload.demand || 'Not available',
        avg_augmentation: payload.avg_augmentation ?? null,
        avg_automation: payload.avg_automation ?? null,
        task_counts: Number(taskCounts.total) > 0
          ? {
              total: taskCounts.total,
              human_led: taskCounts.human_led ?? 0,
              ai_assisted: taskCounts.ai_assisted ?? 0,
              ai_automated: taskCounts.ai_automated ?? 0
            }
          : {
              total: tasks.length,
              human_led: tasks.filter(t => /human/i.test(t.category || '')).length,
              ai_assisted: tasks.filter(t => /assist|augment/i.test(t.category || '')).length,
              ai_automated: tasks.filter(t => /automat/i.test(t.category || '')).length
            },
        tasks,
        employment_trend: Array.isArray(payload.employment_trend)
          ? payload.employment_trend
          : []
      };

      setAiDetailsMap(previous => ({
        ...previous,
        [code]: normalized
      }));
    } catch (error) {
      console.error('[IResi] Occupation AI error:', error);

      setAiErrorMap(previous => ({
        ...previous,
        [code]: error?.message || 'Could not load AI impact data.'
      }));
    } finally {
      setAiLoadingMap(previous => ({
        ...previous,
        [code]: false
      }));
    }
  };

  // Tooltip
  const handleShowTooltip = (e, title, text) => {
    const rect = e.currentTarget.getBoundingClientRect();

    if (!canHover()) {
      return setTooltipPos({
        show: true,
        x: 12,
        y: 0,
        width: Math.max(0, innerWidth - 24),
        isTop: false,
        arrowOffset: 0,
        title,
        text
      });
    }

    const width = Math.min(320, Math.max(240, innerWidth - 32));
    const half = width / 2;
    const center = rect.left + rect.width / 2;
    const x = Math.max(half + 16, Math.min(center, innerWidth - half - 16));
    const top = innerHeight - rect.bottom < 162 && rect.top > 162;

    setTooltipPos({
      show: true,
      x,
      y: top ? rect.top - 12 : rect.bottom + 12,
      width,
      isTop: top,
      arrowOffset: Math.max(-(half - 18), Math.min(half - 18, center - x)),
      title,
      text
    });
  };

  const tooltip = (title, text) => ({
    onMouseEnter: e => canHover() && handleShowTooltip(e, title, text),
    onMouseLeave: () => canHover() && setTooltipPos(p => ({ ...p, show: false })),
    onClick: e => {
      e.stopPropagation();
      if (!canHover()) handleShowTooltip(e, title, text);
    },
    'data-tooltip-trigger': 'true',
    role: 'button',
    tabIndex: 0
  });

  useEffect(() => {
    if (!tooltipPos.show) return;

    const close = () => setTooltipPos(p => ({ ...p, show: false }));

    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);

    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [tooltipPos.show]);

  useEffect(() => {
    const close = e => {
      if (
        e.target instanceof Element &&
        (e.target.closest('[data-tooltip-trigger]') ||
          e.target.closest('#app-tooltip'))
      ) return;

      setTooltipPos(p => p.show ? { ...p, show: false } : p);
    };

    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  // PDF export

  const handleDownload = async () => {
    if (!matches.length) {
      alert('No career matches are available to export.');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const margin = 16;
      const contentWidth = pageWidth - margin * 2;

      const ink = [15, 23, 42];
      const muted = [100, 116, 139];
      const blue = [59, 130, 246];
      const pale = [241, 245, 249];
      const border = [226, 232, 240];
      const green = [5, 150, 105];
      const amber = [217, 119, 6];

      const date = new Date().toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

      let y = margin;

      const textOrNA = value =>
        value === null || value === undefined || value === ''
          ? 'Not available'
          : String(value);

      const percentOrNA = value =>
        value === null || value === undefined || !Number.isFinite(Number(value))
          ? 'Not available'
          : `${Math.round(Number(value) * 100)}%`;

      const writeSectionTitle = title => {
        if (y > pageHeight - 35) {
          doc.addPage();
          y = margin;
        }

        doc.setFillColor(...pale);
        doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, 'F');

        doc.setTextColor(...ink);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(title.toUpperCase(), margin + 3, y + 6);

        y += 14;
      };

      const writeParagraph = (text, options = {}) => {
        const fontSize = options.fontSize || 9;
        const lineHeight = options.lineHeight || 4.5;
        const maxWidth = contentWidth - (options.indent || 0);
        const lines = doc.splitTextToSize(String(text), maxWidth);
        const needed = lines.length * lineHeight + 2;

        if (y + needed > pageHeight - 18) {
          doc.addPage();
          y = margin;
        }

        doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(...(options.color || ink));
        doc.text(lines, margin + (options.indent || 0), y);

        y += needed;
      };

      const addFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();

        for (let page = 1; page <= pageCount; page++) {
          doc.setPage(page);

          doc.setDrawColor(...border);
          doc.setLineWidth(0.25);
          doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...muted);

          doc.text('IResi | Career Pathway Report', margin, pageHeight - 7);
          doc.text(
            `Page ${page} of ${pageCount}`,
            pageWidth - margin,
            pageHeight - 7,
            { align: 'right' }
          );
        }
      };

      const addTable = (head, body, options = {}) => {
        autoTable(doc, {
          startY: y,
          head: [head],
          body,
          margin: {
            left: margin,
            right: margin,
            bottom: 20
          },
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: 3,
            textColor: ink,
            lineColor: border,
            lineWidth: 0.2,
            overflow: 'linebreak',
            valign: 'middle'
          },
          headStyles: {
            fillColor: ink,
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          columnStyles: options.columnStyles || {},
          ...options.tableOptions
        });

        y = doc.lastAutoTable.finalY + 8;
      };

      // ── COVER / REPORT HEADER ──────────────────────────────

      doc.setFillColor(...ink);
      doc.rect(0, 0, pageWidth, 49, 'F');

      doc.setFillColor(...blue);
      doc.roundedRect(margin, 11, 10, 10, 2, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('IResi', margin + 14, 18);

      doc.setFontSize(19);
      doc.text('Career Pathway Report', margin, 33);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text(`Generated ${date}`, margin, 41);

      y = 59;

      writeParagraph(
        'Your career matches, AI task impact, and employment indicators in one report.',
        { fontSize: 10, color: muted }
      );

      // ── MATCH SUMMARY ──────────────────────────────────────

      writeSectionTitle('Career match summary');

      const orderedMatches = [...matches].sort(
        (a, b) => (a.rank ?? 999) - (b.rank ?? 999)
      );

      addTable(
        ['Rank', 'Occupation', 'Category', 'Match score', 'Match label'],
        orderedMatches.map(role => [
          role.rank ?? '—',
          role.title || role.name || 'Unnamed occupation',
          role.sector || role.category || 'Not available',
          role.match_score == null ? 'Not available' : `${role.match_score}%`,
          role.match_label || 'Not available'
        ]),
        {
          columnStyles: {
            0: { cellWidth: 13 },
            1: { cellWidth: 51 },
            2: { cellWidth: 30 },
            3: { cellWidth: 25 },
            4: { cellWidth: 'auto' }
          }
        }
      );

      // ── INDIVIDUAL OCCUPATION DETAILS ───────────────────────

      for (const role of orderedMatches) {
        const code = role.anzsco_code || role.occupation_id;
        const ai = aiDetailsMap[code] || {};
        const taskCounts = ai.task_counts || {};
        const tasks = Array.isArray(ai.tasks) ? ai.tasks : [];
        const trend = Array.isArray(ai.employment_trend)
          ? ai.employment_trend
          : [];

        doc.addPage();
        y = margin;

        doc.setFillColor(...ink);
        doc.roundedRect(margin, y, contentWidth, 25, 2, 2, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);

        const titleLines = doc.splitTextToSize(
          role.title || role.name || 'Occupation',
          contentWidth - 8
        );

        doc.text(titleLines.slice(0, 2), margin + 4, y + 8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(203, 213, 225);

        doc.text(
          `Rank ${role.rank ?? '—'}  |  ANZSCO ${textOrNA(code)}  |  Match ${role.match_score == null ? 'N/A' : `${role.match_score}%`}`,
          margin + 4,
          y + 20
        );

        y += 33;

        writeSectionTitle('AI impact and resilience');

        addTable(
          ['Indicator', 'Value', 'Interpretation'],
          [
            [
              'Resilience score',
              ai.resilience_score == null ? 'Not available' : `${ai.resilience_score}`,
              textOrNA(ai.resilience_label)
            ],
            [
              'AI augmentation',
              percentOrNA(ai.avg_augmentation),
              'Tasks supported or enhanced by AI'
            ],
            [
              'AI automation',
              percentOrNA(ai.avg_automation),
              'Tasks that may be automated'
            ],
            [
              'Market demand',
              textOrNA(ai.demand_label),
              'Demand indicator returned by the API'
            ]
          ],
          {
            columnStyles: {
              0: { cellWidth: 38 },
              1: { cellWidth: 33 },
              2: { cellWidth: 'auto' }
            }
          }
        );

        writeSectionTitle('Task breakdown');

        addTable(
          ['Task category', 'Number of tasks'],
          [
            ['Human-led', taskCounts.human_led ?? 0],
            ['AI-assisted', taskCounts.ai_assisted ?? 0],
            ['AI-automated', taskCounts.ai_automated ?? 0],
            ['Total tasks', taskCounts.total ?? tasks.length]
          ],
          {
            columnStyles: {
              0: { cellWidth: 75 },
              1: { cellWidth: 'auto' }
            }
          }
        );

        if (tasks.length > 0) {
          writeSectionTitle('Individual task details');

          const taskRows = tasks.map((task, index) => [
            index + 1,
            task.task_text ||
              task.description ||
              task.task_description ||
              task.name ||
              task.title ||
              'Task description not provided',
            task.category ||
              task.task_category ||
              task.ai_impact ||
              task.impact_type ||
              'Unclassified',
            task.augmentation_score == null
              ? 'N/A'
              : percentOrNA(task.augmentation_score),
            task.automation_score == null
              ? 'N/A'
              : percentOrNA(task.automation_score)
          ]);

          addTable(
            ['#', 'Task description', 'Category', 'Augment', 'Automate'],
            taskRows,
            {
              columnStyles: {
                0: { cellWidth: 9 },
                1: { cellWidth: 77 },
                2: { cellWidth: 31 },
                3: { cellWidth: 25 },
                4: { cellWidth: 'auto' }
              }
            }
          );
        } else {
          writeParagraph(
            'Individual task descriptions were not included in the API response. This report therefore shows the available category counts without inventing task names.',
            { fontSize: 9, color: muted }
          );
          y += 2;
        }

        if (trend.length > 0) {
          writeSectionTitle('Employment trend');

          addTable(
            ['Year', 'Employment (thousands)'],
            trend.map(item => [
              item.year ?? '—',
              item.employed_k == null ||
              !Number.isFinite(Number(item.employed_k))
                ? 'Not available'
                : Number(item.employed_k).toFixed(1)
            ]),
            {
              columnStyles: {
                0: { cellWidth: 45 },
                1: { cellWidth: 'auto' }
              }
            }
          );
        }
      }

      // ── DATA SOURCES / METHODOLOGY ─────────────────────────

      doc.addPage();
      y = margin;

      writeSectionTitle('Sources and notes');

      writeParagraph(
        'This report reflects the occupation match and AI-impact data available from the IResi application at the time of export.'
      );

      y += 2;

      writeParagraph(
        'Unavailable or null values are shown as “Not available”. Task descriptions and scores are included only when returned by the API.'
      );

      y += 4;

      writeParagraph('Reference sources:', { bold: true });

      writeParagraph('O*NET Database — https://www.onetcenter.org/database.html', {
        fontSize: 9,
        color: blue
      });

      writeParagraph('Jobs and Skills Australia — https://www.jobsandskills.gov.au/data', {
        fontSize: 9,
        color: blue
      });

      addFooter();

      doc.save('IResi_Career_Pathway_Report.pdf');
      setHasDownloaded(true);
    } catch (error) {
      console.error('[IResi] PDF export error:', error);
      alert('The PDF could not be generated. Please try again.');
    }
  };

  const visibleMatches = showAllMatches
    ? matches
    : matches.slice(0, INITIAL_MATCH_COUNT);

  const navActions = {
    navigate: confirmNavigation,
    startQuiz: handleStartQuiz,
    toggleTheme: () => setIsDark(v => !v),
    toggleMobileMenu: () => {
      setIsMobileMenuOpen(v => !v);
      setIsMobileSourcesOpen(false);
    },
    toggleSources: () => setIsMobileSourcesOpen(v => !v),
    closeMobile: () => {
      setIsMobileMenuOpen(false);
      setIsMobileSourcesOpen(false);
    }
  };

  return (
        <PasswordGate>
      <style>{`
        @keyframes continuousMove {
          0% { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        @keyframes pageFadeIn {
          0% { opacity: 0; transform: translateY(10px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes accordionExpand {
          0% { opacity: 0; max-height: 0; transform: translateY(-6px); }
          100% { opacity: 1; max-height: 1000px; transform: translateY(0); }
        }
        .moving-pattern-bg {
          background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 40L40 0M0 0l40 40' stroke='%23000000' stroke-width='1' stroke-opacity='0.14'/%3E%3C/svg%3E");
          animation: continuousMove 20s linear infinite;
        }
        .dark .moving-pattern-bg {
          background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 40L40 0M0 0l40 40' stroke='%23ffffff' stroke-width='1' stroke-opacity='0.12'/%3E%3C/svg%3E");
        }
        .view-enter-animation {
          animation: pageFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .accordion-enter-animation {
          animation: accordionExpand 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #d4d4d8;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #3f3f46;
        }
      `}</style>

      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B1121] text-zinc-900 dark:text-zinc-100 font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-500 relative overflow-hidden">
        <div className="fixed inset-0 z-0 pointer-events-none moving-pattern-bg" />
        <div className="fixed -top-40 -left-40 w-[600px] h-[600px] bg-zinc-200/50 dark:bg-white/5 rounded-full blur-[140px] pointer-events-none" />

        <AppNav
          isDark={isDark}
          currentView={currentView}
          mobileMenu={isMobileMenuOpen}
          mobileSources={isMobileSourcesOpen}
          actions={navActions}
          quizDone={quizDone}
        />

        <div className="relative z-10">
          {/* Home */}
          {currentView === 'home' && (
            <main
              key="home"
              className="view-enter-animation w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-24 sm:pb-32"
            >
              <Intro
                onConfigureProfile={handleStartQuiz}
                onNavigate={confirmNavigation}
              />
            </main>
          )}

          {/* Career Simulator */}
          {currentView === 'wip' && (
            <div key="wip" className="view-enter-animation">
              <WorkInProgress onBack={() => confirmNavigation('home')} />
            </div>
          )}

          {/* Regional Insights */}
          {currentView === 'regional-insights' && (
            <main
              key="regional-insights"
              className="view-enter-animation max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32"
            >
              <RegionalInsights onBack={() => confirmNavigation(quizDone ? 'results' : 'home')} />
            </main>
          )}

          {/* RIASEC Quiz */}
          {currentView === 'quiz' && (
            <main
              key="quiz"
              className="view-enter-animation max-w-2xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32 space-y-8"
            >
              {isSubmitting ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                  <p className="text-sm text-zinc-500">
                    Matching your profile to careers…
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <span>
                        Question {quizIndex + 1} of {RIASEC_QUESTIONS.length}
                      </span>
                    </div>

                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-black dark:bg-white h-full transition-all duration-300"
                        style={{
                          width: `${((quizIndex + 1) / RIASEC_QUESTIONS.length) * 100}%`
                        }}
                      />
                    </div>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white leading-snug">
                    {RIASEC_QUESTIONS[quizIndex].question}
                  </h2>

                  <div className="space-y-3">
                    {RIASEC_QUESTIONS[quizIndex].options.map(opt => (
                      <button
                        key={opt.letter}
                        onClick={() => handleSelectOption(opt.letter)}
                        className="w-full text-left p-4 sm:p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-black dark:hover:border-white transition-all"
                      >
                        <span className="text-sm sm:text-base font-medium text-zinc-800 dark:text-zinc-200">
                          {opt.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </main>
          )}

          {/* Matches & AI Impact */}
          {currentView === 'results' && (
            <main
              key="results"
              className="view-enter-animation max-w-5xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32"
            >
              <header className="mb-10 sm:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-200/60 dark:border-white/10 pb-8 sm:pb-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-2">
                    Your Career Matches
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black dark:text-white">
                    Matches & AI Impact
                  </h1>
                  <p className="mt-3 text-xs sm:text-sm text-zinc-500 dark:text-slate-400">
                    Based on your RIASEC profile
                  </p>
                </div>

                <button
                  onClick={handleDownload}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium shadow-sm ${
                    hasDownloaded
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-slate-300'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  {hasDownloaded ? 'Downloaded' : 'Download Data'}
                </button>
              </header>

              {matchError && (
                <div
                  role="alert"
                  className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-600 dark:text-rose-400"
                >
                  <p className="font-semibold">
                    Could not load career matches
                  </p>
                  <p className="mt-1">{matchError}</p>

                  <button
                    onClick={() => runMatch(hollandCode)}
                    className="mt-3 font-semibold underline underline-offset-2"
                  >
                    Try again
                  </button>
                </div>
              )}

              {isSubmitting ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-zinc-500">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <p className="text-sm">
                    Finding careers that match your interests…
                  </p>
                </div>
              ) : matches.length > 0 ? (
                <div className="space-y-4 sm:space-y-6">
                  {visibleMatches.map(role => (
                    <ResultCard
                      key={role.anzsco_code}
                      role={role}
                      ai={aiDetailsMap[role.anzsco_code]}
                      expanded={expandedRoleId === role.anzsco_code}
                      colors={getMatchColor(
                        role.match_score ?? 0,
                        role.match_label || ''
                      )}
                      onToggle={handleToggleRole}
                      onSkillGap={openSkillGap}
                      tooltip={tooltip}
                      aiLoading={Boolean(aiLoadingMap[role.anzsco_code])}
                      aiError={aiErrorMap[role.anzsco_code] || ''}
                      onRetry={handleToggleRole}
                    />
                  ))}
                </div>
              ) : !matchError ? (
                <p className="py-16 text-center text-sm text-zinc-500">
                  No occupation matches were returned.
                </p>
              ) : null}

              {matches.length > INITIAL_MATCH_COUNT && (
                <div className="mt-8 sm:mt-10 flex justify-center">
                  <button
                    onClick={() => setShowAllMatches(v => !v)}
                    className="px-6 py-3 rounded-full border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-[#131B2F]/80 text-xs sm:text-sm font-medium flex items-center gap-2"
                  >
                    {showAllMatches ? (
                      <>
                        Show Less <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Show {matches.length - INITIAL_MATCH_COUNT} More
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </main>
          )}

          {/* Skill Gap */}
          {currentView === 'skill-gap' && (
            <main
              key="skill-gap"
              className="view-enter-animation max-w-5xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32"
            >
              <SkillGapCheck
                targetOccupation={activeOccupation}
                ai={aiDetailsMap[activeOccupation?.anzsco_code]}
                onBack={() => confirmNavigation('results')}
                onNavigate={confirmNavigation}
              />
            </main>
          )}

          {/* Learning Plan */}
          {currentView === 'learning-plan' && (
            <main
              key="learning-plan"
              className="view-enter-animation max-w-5xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32"
            >
              <LearningPlan
                config={navContext}
                onBack={() => confirmNavigation('skill-gap')}
                onNavigate={confirmNavigation}
              />
            </main>
          )}

          {/* Progress Tracker */}
          {currentView === 'progress-tracker' && (
            <main
              key="progress-tracker"
              className="view-enter-animation max-w-5xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32"
            >
              <ProgressTracker
                config={navContext}
                onBack={() => confirmNavigation(quizDone ? 'results' : 'home')}
                onNavigate={confirmNavigation}
              />
            </main>
          )}
        </div>

        <Tooltip
          info={{
            ...tooltipPos,
            close: () => setTooltipPos(p => ({ ...p, show: false }))
          }}
        />
      </div>

      <Chatbot
        visible={!['home', 'quiz'].includes(currentView)}
        currentPage={currentView}
        matchedCareers={matches}
        selectedOccupation={activeOccupation}
        skillGap={null}
        region={null}
        sessionId={chatSessionId}
      />
    </PasswordGate>
  );
}