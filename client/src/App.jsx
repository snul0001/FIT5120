import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Cpu, Download,
  ExternalLink, LayoutDashboard, Loader2, MapPin, Moon, Sun, X, Zap
} from 'lucide-react';

import Intro from './components/Intro';
import PasswordGate from './components/PasswordGate';
import WorkInProgress from './components/WorkInProgress';
import SkillGapCheck from './components/SkillGapCheck';
import RegionalInsights from './components/RegionalInsights';
import { matchOccupations, getOccupationAI, getSkills, getSkillGap, BASE_URL } from './api/client';
import { RIASEC_QUESTIONS, getTopHollandCodes } from './utils/riasecQuestions';
import Chatbot from './components/Chatbot';

const INITIAL_MATCH_COUNT = 4;
const AU_LOCATIONS = [
  'NSW', 'Victoria', 'Queensland', 'Western Australia', 'South Australia',
  'Tasmania', 'Northern Territory', 'Australian Capital Territory'
];
const DATA_SOURCES = [
  ['O*NET Database', 'https://www.onetcenter.org/database.html'],
  ['Jobs & Skills Australia (JSA)', 'https://www.jobsandskills.gov.au/data']
];
const SUGGESTED_SKILLS = [];

// Fallback data keeps the app usable when the API is unavailable locally.
const MOCK_MATCHES = [
  { occupation_id: '271133', rank: 1, title: 'Cyber Security Analyst', sector: 'ICT', match_score: 96, match_label: 'Exceptional Fit' },
  { occupation_id: '271134', rank: 2, title: 'Cloud Solutions Architect', sector: 'ICT', match_score: 88, match_label: 'Strong Fit' },
  { occupation_id: '271135', rank: 3, title: 'Data Engineer', sector: 'ICT', match_score: 84, match_label: 'Strong Fit' },
  { occupation_id: '271136', rank: 4, title: 'DevOps Engineer', sector: 'ICT', match_score: 81, match_label: 'Moderate Fit' }
];
const MOCK_INTERESTS = [
  { interest_id: 'investigative', label: 'Solving problems & analysing' },
  { interest_id: 'conventional', label: 'Organising & planning' },
  { interest_id: 'artistic', label: 'Creating & designing' },
  { interest_id: 'social', label: 'Helping & working with people' },
  { interest_id: 'enterprising', label: 'Leading & managing' },
  { interest_id: 'realistic', label: 'Building & fixing systems' }
];
const MOCK_AI_DATA = {
  tasks: [
    { task_text: 'Accepting responsibility for the processes, procedures and operational management associated with system security and disaster recovery planning', automation_score: 0.4, augmentation_score: 0.7 },
    { task_text: 'Continually surveying the current computer site to determine future network needs and making recommendations for enhancements in the implementation of future servers and networks', automation_score: 0.5, augmentation_score: 0.7 },
    { task_text: 'Designing and maintaining database architecture, data structures, tables, dictionaries and naming conventions to ensure the accuracy and completeness of all data master files', automation_score: 0.4, augmentation_score: 0.7 }
  ],
  resilience_score: 78, resilience_label: 'Medium', demand_label: 'High', avg_augmentation: 0.71, avg_automation: 0.48
};

const TOOLTIP_TEXT = {
  resilience: 'Measures how adaptable a role is to AI disruption based on high task augmentation versus lower overall automation risk.',
  augmentation: 'The percentage of tasks where AI boosts human capability and productivity rather than displacing the job entirely.',
  automation: 'The percentage of core role tasks that can be fully performed by automated systems without direct human intervention.'
};

const getSkillResourceUrl = skill =>
  `https://www.google.com/search?udm=50&q=Can+you+please+give+me+relevant+resources+with+links+to+learn+${encodeURIComponent(skill)}`;

const formatLabel = label =>
  !label || label.includes('Not available') || label === 'Pending Data' ? 'N/A' : label.split(/[—–-]/)[0].trim();

const getSkillName = item => item?.skill_name || item?.name || (item ? String(item) : '');

const computeSkillGapCategories = (items = []) => {
  if (!items.length) return [];
  const counts = items.reduce((acc, item) => {
    const raw = typeof item === 'object' && item?.category ? item.category : 'General';
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, count]) => ({ name, percentage: Math.round(count / items.length * 100) }));
};

const getSkillGapRating = (item, index) =>
  typeof item?.importance_score === 'number'
    ? Math.max(1, Math.round(item.importance_score * 5))
    : Math.max(1, 5 - Math.floor(index / 2));

const MATCH_COLORS = [
  { test: (score, label) => score >= 90 || label.includes('exceptional'), badge: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30', cardBorder: 'border-l-4 border-l-emerald-500 dark:border-l-emerald-500', rankBg: 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-white font-bold', cardHover: 'hover:bg-emerald-500/[0.02] dark:hover:bg-white/[0.02]' },
  { test: (score, label) => score >= 84 || label.includes('strong'), badge: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30', cardBorder: 'border-l-4 border-l-blue-500 dark:border-l-blue-500', rankBg: 'bg-blue-600 dark:bg-blue-500 text-white dark:text-white font-bold', cardHover: 'hover:bg-blue-500/[0.02] dark:hover:bg-white/[0.02]' },
  { test: (score, label) => score >= 70 || label.includes('moderate'), badge: 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30', cardBorder: 'border-l-4 border-l-amber-500 dark:border-l-amber-500', rankBg: 'bg-amber-600 dark:bg-amber-500 text-white dark:text-white font-bold', cardHover: 'hover:bg-amber-500/[0.02] dark:hover:bg-white/[0.02]' },
  { test: () => true, badge: 'bg-zinc-500/15 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300 border border-zinc-500/30', cardBorder: 'border-l-4 border-l-zinc-400 dark:border-l-zinc-500', rankBg: 'bg-zinc-700 text-white dark:bg-zinc-600 dark:text-white font-bold', cardHover: 'hover:bg-zinc-500/[0.02] dark:hover:bg-white/[0.02]' }
];
const getMatchColor = (score = 0, label = '') => MATCH_COLORS.find(x => x.test(score, label.toLowerCase()));
const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const SourceLinks = ({ mobile = false, onClick }) => (
  <div className={mobile ? 'border-t border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.03]' : 'py-2'}>
    {DATA_SOURCES.map(([label, href]) => (
      <a key={href} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}
        className={mobile ? 'flex items-center justify-between px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5' : 'flex items-center justify-between px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors'}>
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

const ProgressBar = ({ label, value, color = 'bg-emerald-500 dark:bg-[#34D399]', textColor = 'text-emerald-600 dark:text-[#34D399]' }) => (
  <div className="flex items-center gap-4">
    <span className={`w-16 text-[10px] font-bold uppercase tracking-wider ${textColor}`}>{label}</span>
    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-[#1E293B] rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${value * 100}%` }} /></div>
    <span className={`w-8 text-right text-xs font-bold ${textColor}`}>{Math.round(value * 100)}%</span>
  </div>
);

const ResultCard = ({ role, ai, expanded, colors, onToggle, onSkillGap, tooltip }) => (
  <div className={`bg-white/90 dark:bg-[#131B2F]/90 backdrop-blur-sm border-t border-r border-b border-zinc-200/80 dark:border-white/5 ${colors.cardBorder} rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-none overflow-hidden transition-all duration-300`}>
    <div onClick={() => onToggle(role.occupation_id)} className={`p-5 sm:p-8 cursor-pointer flex items-center gap-4 sm:gap-6 transition-colors ${colors.cardHover}`}>
      <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center text-base sm:text-lg shadow-sm ${colors.rankBg}`}>#{role.rank}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5"><span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold tracking-wide ${colors.badge}`}>{role.match_label} {role.match_score ? `• ${role.match_score}%` : ''}</span></div>
        <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white truncate">{role.title}</h3>
      </div>
      {ai && (
        <div {...tooltip('Resilience Score', TOOLTIP_TEXT.resilience)} className={`cursor-help hidden sm:flex flex-col items-start px-4 py-2 mr-4 rounded-xl border transition-colors ${ai.resilience_score >= 50 ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20'}`}>
          <span className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${ai.resilience_score >= 50 ? 'text-emerald-700/80 dark:text-[#34D399]/80' : 'text-amber-700/80 dark:text-[#FBBF24]/80'}`}>Resilience Score</span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-base font-bold leading-none ${ai.resilience_score >= 50 ? 'text-emerald-600 dark:text-[#34D399]' : 'text-amber-600 dark:text-[#FBBF24]'}`}>{ai.resilience_score}%</span>
            <span className={`text-xs font-medium ${ai.resilience_score >= 50 ? 'text-emerald-700 dark:text-[#6EE7B7]' : 'text-amber-700 dark:text-[#FCD34D]'}`}>({formatLabel(ai.resilience_label)})</span>
          </div>
        </div>
      )}
      <div className="shrink-0 p-2 sm:p-3 rounded-full border border-zinc-200 dark:border-white/10 text-zinc-400 dark:text-slate-500">{expanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}</div>
    </div>

    {expanded && ai && (
      <div className="accordion-enter-animation px-5 sm:px-8 pb-6 sm:pb-8 pt-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0E1525]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
          <div className="space-y-6">
            <div>
              <h4 className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-1"><LayoutDashboard className="w-4 h-4" /> MARKET INTELLIGENCE</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300">JSA market assessment indicates <strong className="text-black dark:text-white font-semibold">{formatLabel(ai.demand_label).toLowerCase()} demand</strong> for this occupation.</p>
            </div>

            <button onClick={() => onSkillGap(role)} className="group inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 dark:text-slate-200 dark:border-white/10 transition-all cursor-pointer">
              Check Skill Gap <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Augmentation', tag: 'Support', value: ai.avg_augmentation || 0.75, copy: 'Human capacity elevated', tip: TOOLTIP_TEXT.augmentation, box: 'border-emerald-500/20 bg-emerald-500/5', labelColor: 'text-emerald-600 dark:text-[#34D399]', tagColor: 'text-emerald-700 dark:text-[#6EE7B7] bg-emerald-500/20' },
                { label: 'Automation', tag: 'Replace', value: ai.avg_automation || 0.25, copy: 'Tasks fully automated', tip: TOOLTIP_TEXT.automation, box: 'border-amber-500/20 bg-amber-500/5', labelColor: 'text-amber-600 dark:text-[#FBBF24]', tagColor: 'text-amber-700 dark:text-[#FCD34D] bg-amber-500/20' }
              ].map(stat => (
                <div key={stat.label} {...tooltip(stat.label === 'Augmentation' ? 'Augmentation Rate' : 'Automation Risk', stat.tip)} className={`p-5 rounded-xl border ${stat.box} flex flex-col justify-between`}>
                  <div className="flex justify-between items-start mb-4"><span className={`text-[10px] font-bold ${stat.labelColor} uppercase tracking-widest`}>{stat.label}</span><span className={`text-[9px] font-bold ${stat.tagColor} px-2 py-0.5 rounded uppercase`}>{stat.tag}</span></div>
                  <div><div className={`text-4xl font-bold tracking-tight ${stat.labelColor}`}>{Math.round(stat.value * 100)}%</div><div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{stat.copy}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Cpu className="w-4 h-4" /> TASK IMPACT ANALYSIS</h4>
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
              {ai.tasks?.map((task, idx) => (
                <div key={idx} className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] space-y-5">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{task.task_text}</p>
                  <div className="space-y-3"><ProgressBar label="Augment" value={task.augmentation_score} /><ProgressBar label="Automate" value={task.automation_score} color="bg-amber-500 dark:bg-[#FBBF24]" textColor="text-amber-600 dark:text-[#FBBF24]" /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

const Tooltip = ({ info }) => {
  if (!info.show || typeof document === 'undefined') return null;
  return createPortal(canHover() ? (
    <div id="app-tooltip" role="tooltip" style={{ left: info.x, top: info.y, width: `${info.width || 280}px` }} className={`fixed z-[10000] max-w-[calc(100vw-32px)] p-4 bg-white dark:bg-[#1A233A] rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-zinc-200 dark:border-white/10 text-left -translate-x-1/2 transition-opacity duration-150 ${info.isTop ? '-translate-y-full' : ''}`}>
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1.5 tracking-tight">{info.title}</h4>
      <p className="text-[12px] text-zinc-600 dark:text-slate-300 leading-relaxed">{info.text}</p>
      <div style={{ transform: `translateX(calc(-50% + ${info.arrowOffset || 0}px))` }} className={`absolute left-1/2 border-[6px] border-transparent ${info.isTop ? 'top-full border-t-white dark:border-t-[#1A233A]' : 'bottom-full border-b-white dark:border-b-[#1A233A]'}`} />
    </div>
  ) : (
    <div id="app-tooltip" role="dialog" aria-label={info.title} className="fixed left-3 right-3 bottom-3 z-[10000] rounded-2xl bg-white dark:bg-[#1A233A] border border-zinc-200 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] p-4">
      <div className="flex items-start gap-3"><div className="flex-1 min-w-0"><h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">{info.title}</h4><p className="text-[13px] text-zinc-600 dark:text-slate-300 leading-relaxed">{info.text}</p></div>
        <button type="button" onClick={info.close} className="shrink-0 w-8 h-8 rounded-full border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10" aria-label="Close information"><X className="w-4 h-4" /></button>
      </div>
    </div>
  ), document.body);
};

const AppNav = ({ isDark, isNavVisible, currentView, mobileMenu, mobileSources, actions }) => (
  <nav className={`fixed top-0 left-0 right-0 z-50 border-b transition-transform duration-300 ${isNavVisible ? 'translate-y-0' : 'translate-y-0 md:-translate-y-full'} ${['results', 'skill-gap', 'regional-insights'].includes(currentView) ? 'bg-white dark:bg-[#0B1121] border-zinc-200 dark:border-white/10' : 'bg-white dark:bg-[#09090B] border-zinc-200 dark:border-zinc-800'}`}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
      <div onClick={() => actions.navigate('home')} className="flex items-center gap-2 sm:gap-3 cursor-pointer group"><div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#3B82F6] flex items-center justify-center text-white transition-transform group-hover:scale-105"><Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" /></div><span className="font-bold tracking-tight text-base sm:text-lg">IResi</span></div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden md:flex items-center gap-1 sm:gap-2">
          <NavItem label="Regional Insights" active={currentView === 'regional-insights'} onClick={() => actions.navigate('regional-insights')} />
          <NavItem label="Career Simulator" active={currentView === 'wip'} onClick={() => actions.navigate('wip')} />
          <div className="relative group"><button className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"><span>Data Sources</span><ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:rotate-180 transition-transform" /></button><div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-[#131B2F] rounded-xl shadow-xl border border-zinc-200 dark:border-white/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[999]"><SourceLinks /></div></div>
        </div>
        <div className="hidden md:block w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-2" />
        <button onClick={actions.startQuiz} className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80">Get started</button>
        <button type="button" onClick={actions.toggleMobileMenu} aria-label={mobileMenu ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenu} className="md:hidden w-10 h-10 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#131B2F] flex items-center justify-center text-zinc-700 dark:text-zinc-200">{mobileMenu ? <X className="w-5 h-5" /> : <span className="flex flex-col gap-[4px]"><span className="w-5 h-[2px] rounded-full bg-current" /><span className="w-5 h-[2px] rounded-full bg-current" /><span className="w-5 h-[2px] rounded-full bg-current" /></span>}</button>
        <button onClick={actions.toggleTheme} className="p-2 rounded-full text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10">{isDark ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}</button>
      </div>
    </div>

    {mobileMenu && <div className="md:hidden absolute top-full left-0 right-0 border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0B1121] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]"><div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-4"><div className="flex items-center justify-between px-1 pb-3"><span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Menu</span></div><div className="space-y-2">
      {['regional-insights', 'wip'].map((view, i) => <button key={view} type="button" onClick={() => actions.navigate(view)} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold text-left border transition-colors ${currentView === view ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300' : 'border-transparent text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10'}`}><span>{i ? 'Career Simulator' : 'Regional Insights'}</span>{currentView === view && <span className="w-2 h-2 rounded-full bg-blue-500" />}</button>)}
      <div className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden"><button type="button" onClick={actions.toggleSources} className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10" aria-expanded={mobileSources}><span>Data Sources</span>{mobileSources ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}</button>{mobileSources && <SourceLinks mobile onClick={actions.closeMobile} />}</div>
      <button type="button" onClick={actions.startQuiz} className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold bg-black dark:bg-white text-white dark:text-black">Get started <ArrowRight className="w-4 h-4" /></button>
    </div></div></div>}
  </nav>
);

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSourcesOpen, setIsMobileSourcesOpen] = useState(false);
  const lastScrollY = useRef(0);
  const [currentView, setCurrentView] = useState('home');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRoleId, setExpandedRoleId] = useState(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [, setApiInterests] = useState([]);
  const [activeOccupation, setActiveOccupation] = useState(null);
  const [targetLocation, setTargetLocation] = useState('Victoria');
  const [matches, setMatches] = useState([]);
  const [aiDetailsMap, setAiDetailsMap] = useState({});
  const [tooltipPos, setTooltipPos] = useState({ show: false, x: 0, y: 0, width: 280, isTop: false, arrowOffset: 0, title: '', text: '' });
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [hollandCode, setHollandCode] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [userSkills, setUserSkills] = useState([]);
  const [suggestedSkills, setSuggestedSkills] = useState(SUGGESTED_SKILLS);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [chatSessionId, setChatSessionId] = useState(0);

  useEffect(() => {
    const close = e => dropdownRef.current && !dropdownRef.current.contains(e.target) && setIsDropdownOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Skills are loaded once so the refine screen searches real entries from the API.
  useEffect(() => {
    getSkills(400).then(setSuggestedSkills).catch(err => console.error('Failed to fetch skills:', err));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const scroll = () => { const y = window.scrollY; setIsNavVisible(y <= lastScrollY.current || y <= 80); lastScrollY.current = y; };
    window.addEventListener('scroll', scroll, { passive: true });
    return () => window.removeEventListener('scroll', scroll);
  }, []);

  useEffect(() => {
    fetch(`${BASE_URL}/profile/interests`)
      .then(res => { if (!res.ok) { const e = new Error(); e.status = res.status; throw e; } return res.json(); })
      .then(setApiInterests)
      .catch(err => err.status === 404 && setApiInterests(MOCK_INTERESTS));
  }, []);

  useEffect(() => {
    const warn = e => {
      if (currentView === 'results' && !hasDownloaded) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [currentView, hasDownloaded]);

  const confirmNavigation = target => {
    if (currentView === 'results' && !hasDownloaded && !window.confirm('Warning: You have not downloaded your career results yet. Leaving now will reset your session. Are you sure you want to exit?')) return;
    setCurrentView(target);
    setIsMobileMenuOpen(false);
    setIsMobileSourcesOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const handleStartQuiz = () => {
    setIsMobileMenuOpen(false);
    setIsMobileSourcesOpen(false);
    setQuizIndex(0);
    setQuizAnswers({});
    setHollandCode('');
    setMatches([]);
    setAiDetailsMap({});
    setExpandedRoleId(null);
    setShowAllMatches(false);
    setChatSessionId((id) => id + 1);
    setCurrentView('quiz');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMatchCareers = async (code) => {
    setIsSubmitting(true);
    setShowAllMatches(false);
    setExpandedRoleId(null);
    setHasDownloaded(false);

    const map = {
      R: 'realistic',
      I: 'investigative',
      A: 'artistic',
      S: 'social',
      E: 'enterprising',
      C: 'conventional'
    };

    const interest_ids = code
      .split('')
      .map(letter => map[letter])
      .filter(Boolean);

    try {
      // Step 1: match careers using the RIASEC result only.
      const data = await matchOccupations({ interest_ids });

      setMatches(Array.isArray(data) ? data : []);

      // AI details will be replaced with the v3 task/occupation endpoints
      // as part of the next Results-page iteration.
      const ai = await Promise.all(
        (Array.isArray(data) ? data : []).map(async role => {
          try {
            return {
              id: role.occupation_id,
              data: await getOccupationAI(role.occupation_id)
            };
          } catch (err) {
            return {
              id: role.occupation_id,
              data: err.status === 404 ? MOCK_AI_DATA : null
            };
          }
        })
      );

      setAiDetailsMap(
        Object.fromEntries(
          ai
            .filter(item => item.data)
            .map(item => [item.id, item.data])
        )
      );

      setCurrentView('results');
    } catch (err) {
      if (err.status === 404) {
        setMatches(MOCK_MATCHES);
        setAiDetailsMap(
          Object.fromEntries(
            MOCK_MATCHES.map(role => [role.occupation_id, MOCK_AI_DATA])
          )
        );
        setCurrentView('results');
      } else {
        setMatches([]);
        setAiDetailsMap({});
        setCurrentView('results');
      }
    } finally {
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectOption = async (letter) => {
    const answers = { ...quizAnswers, [quizIndex]: letter };
    setQuizAnswers(answers);

    if (quizIndex < RIASEC_QUESTIONS.length - 1) {
      setQuizIndex((index) => index + 1);
      return;
    }

    const code = getTopHollandCodes(answers);
    setHollandCode(code);

    await handleMatchCareers(code);
  };

  // Matching first gets the careers; AI details are fetched in parallel for each one.
  const handleAnalyze = async (code = hollandCode) => {
  setIsSubmitting(true);
  setShowAllMatches(false);
  setExpandedRoleId(null);
  setHasDownloaded(false);

  const map = {
    R: 'realistic',
    I: 'investigative',
    A: 'artistic',
    S: 'social',
    E: 'enterprising',
    C: 'conventional'
  };

  const interest_ids = code
    .split('')
    .map((letter) => map[letter])
    .filter(Boolean);

  try {
    const data = await matchOccupations({
      interest_ids
    });

    setMatches(Array.isArray(data) ? data : []);

    // Temporary compatibility with the current Results screen.
    // We'll replace this with the new v3 task endpoint next.
    const ai = await Promise.all(
      (Array.isArray(data) ? data : []).map(async (role) => {
        try {
          return {
            id: role.occupation_id,
            data: await getOccupationAI(role.occupation_id)
          };
        } catch (err) {
          return {
            id: role.occupation_id,
            data: err.status === 404 ? MOCK_AI_DATA : null
          };
        }
      })
    );

    setAiDetailsMap(
      Object.fromEntries(
        ai
          .filter((item) => item.data)
          .map((item) => [item.id, item.data])
      )
    );
  } catch (err) {
    if (err.status === 404) {
      setMatches(MOCK_MATCHES);

      setAiDetailsMap(
        Object.fromEntries(
          MOCK_MATCHES.map((role) => [
            role.occupation_id,
            MOCK_AI_DATA
          ])
        )
      );
    } else {
      setMatches([]);
      setAiDetailsMap({});
    }
  } finally {
    setIsSubmitting(false);
    setCurrentView('results');

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
};

  const openSkillGap = role => { setActiveOccupation(role); setCurrentView('skill-gap'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const visibleMatches = showAllMatches ? matches : matches.slice(0, INITIAL_MATCH_COUNT);
  const pageBackground = 'bg-[#FAFAFA] dark:bg-[#0B1121]';

  const handleShowTooltip = (e, title, text) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!canHover()) return setTooltipPos({ show: true, x: 12, y: 0, width: Math.max(0, innerWidth - 24), isTop: false, arrowOffset: 0, title, text });
    const padding = 16, gap = 12, width = Math.min(320, Math.max(240, innerWidth - padding * 2)), half = width / 2, center = rect.left + rect.width / 2;
    const x = Math.max(half + padding, Math.min(center, innerWidth - half - padding));
    const top = innerHeight - rect.bottom < 162 && rect.top > 162;
    const y = top ? rect.top - gap : rect.bottom + gap;
    setTooltipPos({ show: true, x, y, width, isTop: top, arrowOffset: Math.max(-(half - 18), Math.min(half - 18, center - x)), title, text });
  };
  const handleTooltipClick = (e, title, text) => {
    e.stopPropagation();
    if (canHover()) return;
    setTooltipPos(p => p.show && p.title === title ? { ...p, show: false } : p);
    if (!tooltipPos.show || tooltipPos.title !== title) handleShowTooltip(e, title, text);
  };
  const tooltip = (title, text) => ({
    onMouseEnter: e => canHover() && handleShowTooltip(e, title, text),
    onMouseLeave: () => canHover() && setTooltipPos(p => ({ ...p, show: false })),
    onClick: e => handleTooltipClick(e, title, text),
    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTooltipClick(e, title, text); } },
    'data-tooltip-trigger': 'true', role: 'button', tabIndex: 0
  });

  // Tooltips close when the page moves so they never float away from their trigger.
  useEffect(() => {
    if (!tooltipPos.show) return;
    const close = () => setTooltipPos(p => ({ ...p, show: false }));
    window.addEventListener('scroll', close, true); window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [tooltipPos.show]);

  useEffect(() => {
    const close = e => {
      if (e.target instanceof Element && (e.target.closest('[data-tooltip-trigger="true"]') || e.target.closest('#app-tooltip'))) return;
      setTooltipPos(p => p.show ? { ...p, show: false } : p);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  // PDF export keeps the existing report structure, but the repeated table setup lives in helpers below.
  const handleDownload = async () => {
    try {
      if (!matches.length) return alert('No career matches available to export.');
      const doc = new jsPDF();
      const date = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.setFillColor(11, 17, 33); doc.rect(0, 0, 210, 25, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('IResi AI CAREER PATHWAY REPORT', 14, 16);
      doc.setTextColor(40, 40, 40); doc.setFontSize(11); doc.text('PARAMETERS & PREFERENCES', 14, 35); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(`• Target Location : ${targetLocation || 'Not specified'}`, 14, 42); doc.text(`• Date Generated  : ${date}`, 14, 48);

      let startY = 65;
      const reportMatches = [...matches].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).slice(0, 5);
      const skillGapPairs = await Promise.all(reportMatches.map(async role => {
        try { const data = await getSkillGap(role.occupation_id, userSkills); return { id: role.occupation_id, data: data && !data.error && (data.matched || data.missing) ? data : null }; }
        catch (error) { console.warn(`Skill gap data unavailable for ${role.title}:`, error); return { id: role.occupation_id, data: null }; }
      }));
      const skillGapMap = Object.fromEntries(skillGapPairs.filter(x => x.data).map(x => [x.id, x.data]));
      const ensurePage = () => { if (startY > 250) { doc.addPage(); startY = 20; } };
      const sectionHeader = text => { ensurePage(); doc.setFillColor(240, 244, 248); doc.rect(14, startY - 4, 182, 9, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.text(text, 16, startY + 2); startY += 10; };
      const table = opts => { autoTable(doc, { margin: { left: 14, right: 14 }, ...opts }); startY = doc.lastAutoTable.finalY + (opts.gap ?? 5); };

      for (const [index, m] of reportMatches.entries()) {
        const ai = aiDetailsMap[m.occupation_id] || {};
        const skillGap = skillGapMap[m.occupation_id];
        sectionHeader(`[Rank ${m.rank || index + 1}] ${(m.title || 'Career Match').toUpperCase()}`);
        table({ theme: 'plain', styles: { fontSize: 9.5, cellPadding: 2, textColor: [51, 65, 85], overflow: 'linebreak', valign: 'top' }, columnStyles: { 0: { fontStyle: 'bold', width: 45 }, 1: { cellWidth: 135 } }, body: [
          ['Sector', `: ${m.sector || 'ICT'}`], ['Match Fit', `: ${m.match_score ?? 'N/A'}% (${m.match_label || 'Good Fit'})`],
          ['AI Resilience Score', `: ${ai.resilience_score ?? 'N/A'}/100`], ['Resilience Status', `: ${formatLabel(ai.resilience_label)}`],
          ['National Demand', `: ${formatLabel(ai.demand_label)}`], ['Avg Augmentation', `: ${ai.avg_augmentation ? Math.round(ai.avg_augmentation * 100) : 'N/A'}%`],
          ['Avg Automation', `: ${ai.avg_automation ? Math.round(ai.avg_automation * 100) : 'N/A'}%`]
        ], gap: 4 });

        if (ai.tasks?.length) table({ head: [['Task Description', 'Augment', 'Automate']], body: ai.tasks.map((t, i) => [`${i + 1}. ${t.task_text}`, `${Math.round((t.augmentation_score || 0) * 100)}%`, `${Math.round((t.automation_score || 0) * 100)}%`]), theme: 'striped', headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' }, styles: { fontSize: 8.5, cellPadding: 3, overflow: 'linebreak', valign: 'top' }, columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 31, halign: 'center' }, 2: { cellWidth: 31, halign: 'center' } }, rowPageBreak: 'avoid', gap: 10 });
        else startY += 8;

        if (!skillGap) continue;
        sectionHeader('SKILL GAP CHECK');
        const matched = Array.isArray(skillGap.matched) ? skillGap.matched : [], missing = Array.isArray(skillGap.missing) ? skillGap.missing : [];
        const rows = Math.max(matched.length, missing.length);
        if (rows) table({ head: [['Matched Skills', 'Missing Skills']], body: Array.from({ length: rows }, (_, i) => [getSkillName(matched[i]), getSkillName(missing[i])]), theme: 'striped', headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' }, styles: { fontSize: 8.5, cellPadding: 3, overflow: 'linebreak', valign: 'top' }, columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } }, rowPageBreak: 'avoid' });

        const categories = computeSkillGapCategories(missing);
        if (categories.length) table({ head: [['Missing Skill Category', 'Share of Gaps']], body: categories.map(c => [c.name, `${c.percentage}%`]), theme: 'plain', headStyles: { fillColor: [240, 244, 248], textColor: [15, 23, 42], fontStyle: 'bold' }, styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [51, 65, 85], overflow: 'linebreak', valign: 'top' }, columnStyles: { 0: { cellWidth: 145 }, 1: { cellWidth: 37, halign: 'center' } } });

        if (missing.length) {
          const priorityRows = missing.map((item, i) => [String(i + 1), getSkillName(item), `${getSkillGapRating(item, i)}/5`]);
          autoTable(doc, {
            startY, margin: { left: 14, right: 14 }, head: [['Rank', 'Priority Skill', 'Rating', 'Suggestions']],
            body: priorityRows, theme: 'striped', headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8.5, cellPadding: 3, overflow: 'linebreak', valign: 'top' }, columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 89 }, 2: { cellWidth: 24, halign: 'center' }, 3: { cellWidth: 54, halign: 'center' } }, rowPageBreak: 'avoid',
            didDrawCell: data => {
              if (data.section !== 'body' || data.column.index !== 3) return;
              const skill = priorityRows[data.row.index]?.[1]; if (!skill) return;
              const linkText = 'View resources', linkWidth = doc.getTextWidth(linkText), x = data.cell.x + (data.cell.width - linkWidth) / 2, y = data.cell.y + data.cell.height / 2 + 2.5;
              doc.setTextColor(37, 99, 235); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(linkText, x, y);
              doc.link(x, data.cell.y + 1, linkWidth, Math.max(data.cell.height - 2, 6), { url: getSkillResourceUrl(skill) });
            }
          });
          startY = doc.lastAutoTable.finalY + 10;
        }
      }

      const pages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`End of Report — Generated via IResi Career Platform  |  Page ${i} of ${pages}`, 105, 288, { align: 'center' }); }
      doc.save('IResi_Career_Pathway_Report.pdf'); setHasDownloaded(true);
    } catch (error) { console.error('Failed to generate PDF report:', error); alert('An error occurred while building the PDF.'); }
  };

  const navActions = {
    navigate: confirmNavigation,
    startQuiz: handleStartQuiz,
    toggleTheme: () => setIsDark(v => !v),
    toggleMobileMenu: () => { setIsMobileMenuOpen(v => !v); setIsMobileSourcesOpen(false); },
    toggleSources: () => setIsMobileSourcesOpen(v => !v),
    closeMobile: () => { setIsMobileMenuOpen(false); setIsMobileSourcesOpen(false); }
  };

  return (
    <PasswordGate>
      <style>{`
        @keyframes continuousMove { 0% { background-position: 0 0; } 100% { background-position: 40px 40px; } }
        @keyframes pageFadeIn { 0% { opacity: 0; transform: translateY(10px) scale(0.99); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes accordionExpand { 0% { opacity: 0; max-height: 0; transform: translateY(-6px); } 100% { opacity: 1; max-height: 1000px; transform: translateY(0); } }
        .moving-pattern-bg { background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 40L40 0M0 0l40 40' stroke='%23000000' stroke-width='1' stroke-opacity='0.14'/%3E%3C/svg%3E"); animation: continuousMove 20s linear infinite; }
        .dark .moving-pattern-bg { background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 40L40 0M0 0l40 40' stroke='%23ffffff' stroke-width='1' stroke-opacity='0.12'/%3E%3C/svg%3E"); }
        .view-enter-animation { animation: pageFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .accordion-enter-animation { animation: accordionExpand 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #d4d4d8; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #3f3f46; }
      `}</style>

      <div className={`min-h-screen text-zinc-900 dark:text-zinc-100 font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-500 relative overflow-hidden ${pageBackground}`}>
        <div className="fixed inset-0 z-0 pointer-events-none moving-pattern-bg" />
        <div className="fixed -top-40 -left-40 w-[600px] h-[600px] bg-zinc-200/50 dark:bg-white/5 rounded-full blur-[140px] pointer-events-none" />

        <AppNav isDark={isDark} isNavVisible={isNavVisible} currentView={currentView} mobileMenu={isMobileMenuOpen} mobileSources={isMobileSourcesOpen} actions={navActions} />

        <div className="relative z-10">
          {currentView === 'wip' && <div key="wip" className="view-enter-animation"><WorkInProgress onBack={() => confirmNavigation('home')} /></div>}
          {currentView === 'regional-insights' && <div key="regional-insights" className="view-enter-animation pt-20"><RegionalInsights onBack={() => confirmNavigation('home')} /></div>}
          {currentView === 'home' && <main key="home" className="view-enter-animation w-full px-4 sm:px-6 pt-8 sm:pt-12 pb-24 sm:pb-32"><Intro onConfigureProfile={handleStartQuiz} onNavigate={confirmNavigation} /></main>}

          {currentView === 'quiz' && (
            <main key="quiz" className="view-enter-animation max-w-2xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32 space-y-8">
              <div className="space-y-2"><div className="flex justify-between text-xs font-semibold text-zinc-500 uppercase tracking-wider"><span>Question {quizIndex + 1} of {RIASEC_QUESTIONS.length}</span></div><div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden"><div className="bg-black dark:bg-white h-full transition-all duration-300" style={{ width: `${(quizIndex + 1) / RIASEC_QUESTIONS.length * 100}%` }} /></div></div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white leading-snug">{RIASEC_QUESTIONS[quizIndex].question}</h2>
              <div className="space-y-3">{RIASEC_QUESTIONS[quizIndex].options.map(opt => <button key={opt.letter} onClick={() => handleSelectOption(opt.letter)} className="w-full text-left p-4 sm:p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-black dark:hover:border-white transition-all group"><span className="text-sm sm:text-base font-medium text-zinc-800 dark:text-zinc-200">{opt.text}</span></button>)}</div>
            </main>
          )}

          {currentView === 'results' && (
            <main key="results" className="view-enter-animation max-w-5xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32">
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
                  className="..."
                >
                  <Download className="w-4 h-4" />
                  {hasDownloaded ? 'Downloaded' : 'Download Data'}
                </button>
              </header>
              <div className="space-y-4 sm:space-y-6">{visibleMatches.map(role => <ResultCard key={role.occupation_id} role={role} ai={aiDetailsMap[role.occupation_id]} expanded={expandedRoleId === role.occupation_id} colors={getMatchColor(role.match_score, role.match_label)} onToggle={id => setExpandedRoleId(p => p === id ? null : id)} onSkillGap={openSkillGap} tooltip={tooltip} />)}</div>
              {matches.length > INITIAL_MATCH_COUNT && <div className="mt-8 sm:mt-10 flex justify-center"><button onClick={() => setShowAllMatches(v => !v)} className="px-6 py-3 rounded-full border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-[#131B2F]/80 text-xs sm:text-sm font-medium flex items-center gap-2">{showAllMatches ? <>Show Less <ChevronUp className="w-4 h-4" /></> : <>Show {matches.length - INITIAL_MATCH_COUNT} More Roles <ChevronDown className="w-4 h-4" /></>}</button></div>}
            </main>
          )}

          {currentView === 'skill-gap' && <main key="skill-gap" className="view-enter-animation max-w-5xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32"><SkillGapCheck targetOccupation={activeOccupation} userSkills={userSkills} onBack={() => setCurrentView('results')} onNavigate={confirmNavigation} /></main>}
        </div>
        <Tooltip info={{ ...tooltipPos, close: () => setTooltipPos(p => ({ ...p, show: false })) }} />
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
