import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, ArrowLeft, Loader2, Check, 
  MapPin, Briefcase, ChevronDown, ChevronUp,
  Cpu, LayoutDashboard, Zap, Sun, Moon, Download
} from 'lucide-react';

const BASE = '/api';
const INITIAL_MATCH_COUNT = 4;

const AU_LOCATIONS = ['Victoria', 'New South Wales', 'Queensland', 'Western Australia', 'South Australia', 'Remote'];
const WORK_PREFERENCES = ['Graduate Role', 'Part-time', 'Internship', 'Contract'];

const MOCK_INTERESTS = [
  { interest_id: "investigative", label: "Solving problems & analysing" },
  { interest_id: "conventional", label: "Organising & planning" },
  { interest_id: "artistic", label: "Creating & designing" },
  { interest_id: "social", label: "Helping & working with people" },
  { interest_id: "enterprising", label: "Leading & managing" },
  { interest_id: "realistic", label: "Building & fixing systems" }
];

const MOCK_MATCHES = [
  { occupation_id: "271133", rank: 1, title: "Cyber Security Analyst", sector: "ICT", match_score: 96, match_label: "Exceptional Fit" },
  { occupation_id: "271134", rank: 2, title: "Cloud Solutions Architect", sector: "ICT", match_score: 88, match_label: "Strong Fit" },
  { occupation_id: "271135", rank: 3, title: "Data Engineer", sector: "ICT", match_score: 84, match_label: "Strong Fit" },
  { occupation_id: "271136", rank: 4, title: "DevOps Engineer", sector: "ICT", match_score: 81, match_label: "Moderate Fit" }
];

const MOCK_AI_DATA = {
  tasks: [
    { task_text: "Accepting responsibility for the processes, procedures and operational management associated with system security and disaster recovery planning", automation_score: 0.40, augmentation_score: 0.70 },
    { task_text: "Continually surveying the current computer site to determine future network needs and making recommendations for enhancements in the implementation of future servers and networks", automation_score: 0.50, augmentation_score: 0.70 },
    { task_text: "Designing and maintaining database architecture, data structures, tables, dictionaries and naming conventions to ensure the accuracy and completeness of all data master files", automation_score: 0.40, augmentation_score: 0.70 }
  ],
  resilience_score: 78,
  resilience_label: "Medium",
  demand_label: "High",
  avg_augmentation: 0.71,
  avg_automation: 0.48
};

const formatLabel = (label) => {
  if (!label || label.includes("Not available") || label === "Pending Data") return "N/A";
  return label.split(/[—–-]/)[0].trim();
};

const getMatchColor = (score, label = '') => {
  const l = label.toLowerCase();
  if (score >= 90 || l.includes('exceptional')) {
    return {
      badge: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30',
      cardBorder: 'border-l-4 border-l-emerald-500 dark:border-l-emerald-500',
      rankBg: 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-white font-bold',
      cardHover: 'hover:bg-emerald-500/[0.02] dark:hover:bg-white/[0.02]'
    };
  }
  if (score >= 84 || l.includes('strong')) {
    return {
      badge: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30',
      cardBorder: 'border-l-4 border-l-blue-500 dark:border-l-blue-500',
      rankBg: 'bg-blue-600 dark:bg-blue-500 text-white dark:text-white font-bold',
      cardHover: 'hover:bg-blue-500/[0.02] dark:hover:bg-white/[0.02]'
    };
  }
  if (score >= 70 || l.includes('moderate')) {
    return {
      badge: 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30',
      cardBorder: 'border-l-4 border-l-amber-500 dark:border-l-amber-500',
      rankBg: 'bg-amber-600 dark:bg-amber-500 text-white dark:text-white font-bold',
      cardHover: 'hover:bg-amber-500/[0.02] dark:hover:bg-white/[0.02]'
    };
  }
  return {
    badge: 'bg-zinc-500/15 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300 border border-zinc-500/30',
    cardBorder: 'border-l-4 border-l-zinc-400 dark:border-l-zinc-500',
    rankBg: 'bg-zinc-700 text-white dark:bg-zinc-600 dark:text-white font-bold',
    cardHover: 'hover:bg-zinc-500/[0.02] dark:hover:bg-white/[0.02]'
  };
};

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [currentView, setCurrentView] = useState('home');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedRoleId, setExpandedRoleId] = useState(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  const [targetLocation, setTargetLocation] = useState('Victoria');
  const [workPreference, setWorkPreference] = useState('Graduate Role');
  const [selectedInterests, setSelectedInterests] = useState([]);

  const [apiInterests, setApiInterests] = useState([]);
  const [matches, setMatches] = useState([]);
  const [aiDetailsMap, setAiDetailsMap] = useState({});

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const fetchInterests = async () => {
      try {
        const res = await fetch(`${BASE}/profile/interests`);
        if (!res.ok) throw new Error();
        setApiInterests(await res.json());
      } catch {
        setApiInterests(MOCK_INTERESTS);
      }
    };
    fetchInterests();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (currentView === 'results' && !hasDownloaded) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentView, hasDownloaded]);

  const confirmNavigation = (targetView) => {
    if (currentView === 'results' && !hasDownloaded) {
      const confirmLeave = window.confirm(
        "Warning: You have not downloaded your career results yet. Leaving now will reset your session. Are you sure you want to exit?"
      );
      if (!confirmLeave) return;
    }
    setCurrentView(targetView);
  };

  const toggleInterest = (id) => {
    setSelectedInterests(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleExpand = (occupationId) => {
    setExpandedRoleId(prev => prev === occupationId ? null : occupationId);
  };

  const handleAnalyze = async () => {
    setIsSubmitting(true);
    setShowAllMatches(false);
    setExpandedRoleId(null);
    setHasDownloaded(false);

    try {
      const matchRes = await fetch(`${BASE}/occupations/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest_ids: selectedInterests })
      });
      if (!matchRes.ok) throw new Error();
      const matchData = await matchRes.json();
      setMatches(matchData);

      const aiPromises = matchData.map(async (role) => {
        try {
          const aiRes = await fetch(`${BASE}/occupations/${role.occupation_id}/ai`);
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            return { id: role.occupation_id, data: aiData };
          }
        } catch {}
        return { id: role.occupation_id, data: MOCK_AI_DATA };
      });

      const aiResults = await Promise.all(aiPromises);
      const aiMap = {};
      aiResults.forEach(item => { aiMap[item.id] = item.data; });
      setAiDetailsMap(aiMap);
    } catch {
      setMatches(MOCK_MATCHES);
      const mockMap = {};
      MOCK_MATCHES.forEach(m => { mockMap[m.occupation_id] = MOCK_AI_DATA; });
      setAiDetailsMap(mockMap);
    } finally {
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrentView('results');
    }
  };

  const handleDownload = () => {
    const headers = [
      "Rank", "Occupation Title", "Sector", "Match Score", "Match Level", 
      "AI Resilience Score", "AI Resilience Label", "Market Demand", 
      "Avg Augmentation (%)", "Avg Automation (%)"
    ];

    const rows = matches.map(m => {
      const ai = aiDetailsMap[m.occupation_id] || {};
      return [
        m.rank,
        `"${m.title}"`,
        `"${m.sector || ''}"`,
        m.match_score,
        `"${m.match_label}"`,
        ai.resilience_score ?? 'N/A',
        `"${formatLabel(ai.resilience_label)}"`,
        `"${formatLabel(ai.demand_label)}"`,
        ai.avg_augmentation ? Math.round(ai.avg_augmentation * 100) : 'N/A',
        ai.avg_automation ? Math.round(ai.avg_automation * 100) : 'N/A'
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "IResi_AI_Career_Matches.csv");
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link);
    setHasDownloaded(true);
  };

  const visibleMatches = showAllMatches ? matches : matches.slice(0, INITIAL_MATCH_COUNT);

  // Dynamic Background: Retains original #09090B on Home/Setup, switches to the deep navy #0B1121 on Results page.
  const pageBackground =  'bg-[#FAFAFA] dark:bg-[#0B1121]';

  return (
    <>
      <style>{`
        @keyframes continuousMove { 0% { background-position: 0 0; } 100% { background-position: 40px 40px; } }
        @keyframes pageFadeIn { 0% { opacity: 0; transform: translateY(10px) scale(0.99); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes accordionExpand { 0% { opacity: 0; max-height: 0px; transform: translateY(-6px); } 100% { opacity: 1; max-height: 1000px; transform: translateY(0); } }
        .moving-pattern-bg { background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 40L40 0M0 0l40 40' stroke='%23000000' stroke-width='1' stroke-opacity='0.14'/%3E%3C/svg%3E"); animation: continuousMove 20s linear infinite; }
        .dark .moving-pattern-bg { background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 40L40 0M0 0l40 40' stroke='%23ffffff' stroke-width='1' stroke-opacity='0.12'/%3E%3C/svg%3E"); }
        .view-enter-animation { animation: pageFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .accordion-enter-animation { animation: accordionExpand 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div className={`min-h-screen text-zinc-900 dark:text-zinc-100 font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-500 relative overflow-hidden ${pageBackground}`}>
        <div className="fixed inset-0 z-0 pointer-events-none moving-pattern-bg" />
        <div className="fixed -top-40 -left-40 w-[600px] h-[600px] bg-zinc-200/50 dark:bg-white/5 rounded-full blur-[140px] pointer-events-none" />

        <nav className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b transition-colors duration-500 ${currentView === 'results' ? 'bg-white/70 dark:bg-[#0B1121]/70 border-zinc-200/50 dark:border-white/5' : 'bg-white/70 dark:bg-[#09090B]/70 border-zinc-200/50 dark:border-zinc-800/50'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
            <div onClick={() => confirmNavigation('home')} className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#3B82F6] flex items-center justify-center text-white transition-transform duration-300 group-hover:scale-105">
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              </div>
              <span className="font-bold tracking-tight text-base sm:text-lg">IResi</span>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-full text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                {isDark ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
        </nav>

        <div className="relative z-10">
          {currentView === 'home' && (
            <main key="home" className="view-enter-animation max-w-5xl mx-auto px-4 sm:px-6 pt-32 sm:pt-48 pb-24 sm:pb-32 flex flex-col items-center text-center">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tighter text-zinc-950 dark:text-white leading-[1.1] sm:leading-[1.05] max-w-4xl transition-colors duration-500">
                Navigate the AI shift with <span className="text-zinc-400 dark:text-zinc-600 block sm:inline">precision.</span>
              </h1>
              <p className="mt-6 sm:mt-8 text-base sm:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl font-light leading-relaxed transition-colors duration-500">
                Map your interests to high-resilience tech careers. We analyze official national data to show exactly where AI will automate or elevate your future role.
              </p>
              <button 
                onClick={() => confirmNavigation('setup')}
                className="mt-10 sm:mt-12 px-6 py-3 sm:px-8 sm:py-4 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium flex items-center gap-3 hover:scale-[1.02] transition-all duration-300"
              >
                Configure Profile <ArrowRight className="w-4 h-4" />
              </button>
            </main>
          )}

          {currentView === 'setup' && (
            <main key="setup" className="view-enter-animation max-w-4xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32">
              <button onClick={() => confirmNavigation('home')} className="mb-8 sm:mb-12 inline-flex items-center gap-2 text-xs sm:text-sm text-zinc-400 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Go back
              </button>
              <div className="space-y-12 sm:space-y-16">
                <section>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-6 sm:mb-8">1. Work Parameters</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Region</label>
                      <select value={targetLocation} onChange={(e) => setTargetLocation(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-transparent dark:border-zinc-800 text-zinc-900 dark:text-white rounded-xl sm:rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none cursor-pointer appearance-none">
                        {AU_LOCATIONS.map(loc => <option key={loc}>{loc}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Role Type</label>
                      <select value={workPreference} onChange={(e) => setWorkPreference(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-transparent dark:border-zinc-800 text-zinc-900 dark:text-white rounded-xl sm:rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-sm focus:ring-2 focus:ring-black dark:focus:ring-white outline-none cursor-pointer appearance-none">
                        {WORK_PREFERENCES.map(pref => <option key={pref}>{pref}</option>)}
                      </select>
                    </div>
                  </div>
                </section>
                <section>
                  <div className="flex items-end justify-between mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">2. Career DNA</h2>
                    <span className="text-xs sm:text-sm text-zinc-400 dark:text-zinc-500">{selectedInterests.length} selected</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    {apiInterests.map((item) => {
                      const isSelected = selectedInterests.includes(item.interest_id);
                      return (
                        <div
                          key={item.interest_id}
                          onClick={() => toggleInterest(item.interest_id)}
                          className={`relative p-5 sm:p-6 rounded-2xl sm:rounded-3xl cursor-pointer transition-all duration-300 ease-out flex flex-col gap-3 sm:gap-4 border ${
                            isSelected 
                              ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-lg sm:scale-[1.02]' 
                              : 'bg-white/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 border-transparent dark:border-zinc-800'
                          }`}
                        >
                          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border transition-colors ${isSelected ? 'border-zinc-700 bg-zinc-800 dark:border-zinc-300 dark:bg-zinc-200' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950'}`}>
                            {isSelected && <Check className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isDark ? 'text-black' : 'text-white'}`} strokeWidth={3} />}
                          </div>
                          <span className="font-medium text-xs sm:text-sm leading-snug">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
              <div className="mt-12 sm:mt-16 flex justify-end">
                <button
                  onClick={handleAnalyze}
                  disabled={isSubmitting || selectedInterests.length === 0}
                  className="w-full sm:w-auto justify-center px-8 py-3.5 sm:px-10 sm:py-4 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium flex items-center gap-3 disabled:opacity-30 transition-colors"
                >
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Compiling Data</> : 'Generate Pathway'}
                </button>
              </div>
            </main>
          )}

          {currentView === 'results' && (
            <main key="results" className="view-enter-animation max-w-5xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32">
              <header className="mb-10 sm:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-200/60 dark:border-white/10 pb-8 sm:pb-10">
                <div>
                  <button onClick={() => confirmNavigation('setup')} className="mb-4 sm:mb-6 inline-flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Edit Parameters
                  </button>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black dark:text-white">Matches & AI Impact</h1>
                  <div className="flex flex-wrap gap-3 sm:gap-4 mt-3 sm:mt-4 text-xs sm:text-sm text-zinc-500 dark:text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {targetLocation}</span>
                    <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {workPreference}</span>
                  </div>
                </div>
                
                <button 
                  onClick={handleDownload}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm ${
                    hasDownloaded 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-[#1A233A]'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  {hasDownloaded ? 'Downloaded' : 'Export Data'}
                </button>
              </header>

              <div className="space-y-4 sm:space-y-6">
                {visibleMatches.map((role) => {
                  const ai = aiDetailsMap[role.occupation_id];
                  const isExpanded = expandedRoleId === role.occupation_id;
                  const colors = getMatchColor(role.match_score, role.match_label);

                  return (
                    <div 
                      key={role.occupation_id} 
                      className={`bg-white/90 dark:bg-[#131B2F]/90 backdrop-blur-sm border-t border-r border-b border-zinc-200/80 dark:border-white/5 ${colors.cardBorder} rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] dark:shadow-none overflow-hidden transition-all duration-300`}
                    >
                      <div 
                        onClick={() => handleToggleExpand(role.occupation_id)}
                        className={`p-5 sm:p-8 cursor-pointer flex items-center gap-4 sm:gap-6 transition-colors ${colors.cardHover}`}
                      >
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center text-base sm:text-lg shadow-sm ${colors.rankBg}`}>
                          #{role.rank}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold tracking-wide ${colors.badge}`}>
                              {role.match_label} • {role.match_score}%
                            </span>
                          </div>
                          <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white truncate">{role.title}</h3>
                        </div>

                        <div className="shrink-0 p-2 sm:p-3 rounded-full border border-zinc-200 dark:border-white/10 text-zinc-400 dark:text-slate-500">
                          {isExpanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </div>
                      </div>

                      {/* Expanded Section matches the Image styling precisely in dark mode */}
                      {isExpanded && ai && (
                        <div className="accordion-enter-animation px-5 sm:px-8 pb-6 sm:pb-8 pt-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0E1525]">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
                            
                            {/* Left Column: Market Intelligence */}
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                                  <LayoutDashboard className="w-4 h-4" /> MARKET INTELLIGENCE
                                </h4>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                  Status: <strong className="text-black dark:text-white font-semibold">{formatLabel(ai.resilience_label)}</strong>. JSA market assessment indicates <strong className="text-black dark:text-white font-semibold">{formatLabel(ai.demand_label).toLowerCase()}</strong>.
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Augmentation Box */}
                                <div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between">
                                  <div className="flex justify-between items-start mb-4">
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-[#34D399] uppercase tracking-widest">Augmentation</span>
                                    <span className="text-[9px] font-bold text-emerald-700 dark:text-[#6EE7B7] bg-emerald-500/20 px-2 py-0.5 rounded uppercase">Support</span>
                                  </div>
                                  <div>
                                    <div className="text-4xl font-bold tracking-tight text-emerald-600 dark:text-[#34D399]">{Math.round((ai.avg_augmentation || 0.75) * 100)}%</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Human capacity elevated</div>
                                  </div>
                                </div>
                                
                                {/* Automation Box */}
                                <div className="p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col justify-between">
                                  <div className="flex justify-between items-start mb-4">
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-[#FBBF24] uppercase tracking-widest">Automation</span>
                                    <span className="text-[9px] font-bold text-amber-700 dark:text-[#FCD34D] bg-amber-500/20 px-2 py-0.5 rounded uppercase">Replace</span>
                                  </div>
                                  <div>
                                    <div className="text-4xl font-bold tracking-tight text-amber-600 dark:text-[#FBBF24]">{Math.round((ai.avg_automation || 0.25) * 100)}%</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Tasks fully automated</div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right Column: Task Impact Analysis */}
                            <div>
                              <h4 className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <Cpu className="w-4 h-4" /> TASK IMPACT ANALYSIS
                              </h4>
                              <div className="space-y-4">
                                {ai.tasks?.map((task, idx) => (
                                  <div key={idx} className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] space-y-5">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">{task.task_text}</p>
                                    
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-4">
                                        <span className="w-16 text-[10px] font-bold text-emerald-600 dark:text-[#34D399] uppercase tracking-wider">Augment</span>
                                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-[#1E293B] rounded-full overflow-hidden">
                                          <div className="h-full bg-emerald-500 dark:bg-[#34D399] rounded-full" style={{ width: `${task.augmentation_score * 100}%` }} />
                                        </div>
                                        <span className="w-8 text-right text-xs font-bold text-emerald-600 dark:text-[#34D399]">{Math.round(task.augmentation_score * 100)}%</span>
                                      </div>
                                      
                                      <div className="flex items-center gap-4">
                                        <span className="w-16 text-[10px] font-bold text-amber-600 dark:text-[#FBBF24] uppercase tracking-wider">Automate</span>
                                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-[#1E293B] rounded-full overflow-hidden">
                                          <div className="h-full bg-amber-500 dark:bg-[#FBBF24] rounded-full" style={{ width: `${task.automation_score * 100}%` }} />
                                        </div>
                                        <span className="w-8 text-right text-xs font-bold text-amber-600 dark:text-[#FBBF24]">{Math.round(task.automation_score * 100)}%</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {matches.length > INITIAL_MATCH_COUNT && (
                <div className="mt-8 sm:mt-10 flex justify-center">
                  <button
                    onClick={() => setShowAllMatches(!showAllMatches)}
                    className="px-6 py-3 rounded-full border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-[#131B2F]/80 hover:bg-zinc-100 dark:hover:bg-[#1A233A] text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-2 shadow-sm"
                  >
                    {showAllMatches ? (
                      <>Show Less <ChevronUp className="w-4 h-4" /></>
                    ) : (
                      <>Show {matches.length - INITIAL_MATCH_COUNT} More Roles <ChevronDown className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              )}
            </main>
          )}
        </div>
      </div>
    </>
  );
}