import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ArrowRight, ArrowLeft, Loader2, Check, 
  MapPin, Briefcase, ChevronDown, ChevronUp,
  Cpu, LayoutDashboard, Zap, Sun, Moon, Download, HelpCircle,
  BrainCircuit, Compass, Map, Sparkles
} from 'lucide-react';


import Intro from './components/Intro';
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
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);
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

  // Handle scrollable navbar
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Hide if scrolling down and past 80px. Show if scrolling up.
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsNavVisible(false);
      } else {
        setIsNavVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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
    try {
      if (!matches || matches.length === 0) {
        alert("No career matches available to export.");
        return;
      }

      const doc = new jsPDF();
      const dateStr = new Date().toLocaleDateString('en-AU', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      // 1. Header Banner
      doc.setFillColor(11, 17, 33);
      doc.rect(0, 0, 210, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('IResi AI CAREER PATHWAY REPORT', 14, 16);

      // 2. User Parameters
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('PARAMETERS & PREFERENCES', 14, 35);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`• Target Location : ${targetLocation || 'Not specified'}`, 14, 42);
      doc.text(`• Role Preference : ${workPreference || 'Not specified'}`, 14, 48);
      doc.text(`• Date Generated  : ${dateStr}`, 14, 54);

      let startY = 65;

      // 3. Matches Loop
      matches.forEach((m, index) => {
        const ai = (aiDetailsMap && aiDetailsMap[m.occupation_id]) || {};

        if (startY > 250) {
          doc.addPage();
          startY = 20;
        }

        // Title header bar for each role
        doc.setFillColor(240, 244, 248);
        doc.rect(14, startY - 4, 182, 9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(`[Rank ${m.rank || index + 1}] ${(m.title || 'Career Match').toUpperCase()}`, 16, startY + 2);

        startY += 10;

        // Stats Table using autoTable(doc, options)
        autoTable(doc, {
          startY: startY,
          theme: 'plain',
          styles: { fontSize: 9.5, cellPadding: 2, textColor: [51, 65, 85] },
          columnStyles: { 0: { fontStyle: 'bold', width: 45 } },
          body: [
            ['Sector', `: ${m.sector || 'ICT'}`],
            ['Match Fit', `: ${m.match_score ?? 'N/A'}% (${m.match_label || 'Good Fit'})`],
            ['AI Resilience Score', `: ${ai.resilience_score ?? 'N/A'}/100`],
            ['Resilience Status', `: ${typeof formatLabel === 'function' ? formatLabel(ai.resilience_label) : (ai.resilience_label || 'N/A')}`],
            ['National Demand', `: ${typeof formatLabel === 'function' ? formatLabel(ai.demand_label) : (ai.demand_label || 'N/A')}`],
            ['Avg Augmentation', `: ${ai.avg_augmentation ? Math.round(ai.avg_augmentation * 100) : 'N/A'}%`],
            ['Avg Automation', `: ${ai.avg_automation ? Math.round(ai.avg_automation * 100) : 'N/A'}%`],
          ],
          margin: { left: 14, right: 14 }
        });

        startY = doc.lastAutoTable.finalY + 4;

        // Tasks Breakdown Table
        if (ai.tasks && ai.tasks.length > 0) {
          const taskRows = ai.tasks.map((t, i) => [
            `${i + 1}. ${t.task_text}`,
            `${Math.round((t.augmentation_score || 0) * 100)}%`,
            `${Math.round((t.automation_score || 0) * 100)}%`
          ]);

          autoTable(doc, {
            startY: startY,
            head: [['Task Description', 'Augment', 'Automate']],
            body: taskRows,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8.5, cellPadding: 3 },
            columnStyles: {
              0: { cellWidth: 120 },
              1: { cellWidth: 31, halign: 'center' },
              2: { cellWidth: 31, halign: 'center' }
            },
            margin: { left: 14, right: 14 }
          });

          startY = doc.lastAutoTable.finalY + 12;
        } else {
          startY += 8;
        }
      });

      // 4. Page Numbering & Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `End of Report — Generated via IResi Career Platform  |  Page ${i} of ${pageCount}`,
          105,
          288,
          { align: 'center' }
        );
      }

      // 5. Save PDF File
      doc.save('IResi_Career_Pathway_Report.pdf');
      if (typeof setHasDownloaded === 'function') {
        setHasDownloaded(true);
      }
    } catch (error) {
      console.error("Failed to generate PDF report:", error);
      alert("An error occurred while building the PDF. Check console for details.");
    }
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
        
        /* Custom Scrollbar Styling */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #d4d4d8; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #a1a1aa; }
        
        /* Dark Mode Scrollbar */
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #3f3f46; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #52525b; }
      `}</style>

      <div className={`min-h-screen text-zinc-900 dark:text-zinc-100 font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-500 relative overflow-hidden ${pageBackground}`}>
        <div className="fixed inset-0 z-0 pointer-events-none moving-pattern-bg" />
        <div className="fixed -top-40 -left-40 w-[600px] h-[600px] bg-zinc-200/50 dark:bg-white/5 rounded-full blur-[140px] pointer-events-none" />

        <nav className={`fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-500 ${
          currentView === 'results' 
            ? 'bg-white dark:bg-[#0B1121] border-zinc-200 dark:border-white/10' 
            : 'bg-white dark:bg-[#09090B] border-zinc-200 dark:border-zinc-800'
          }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
            
            {/* 1. Brand / Logo Section (Left) */}
            <div onClick={() => confirmNavigation('home')} className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#3B82F6] flex items-center justify-center text-white transition-transform duration-300 group-hover:scale-105">
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
              </div>
              <span className="font-bold tracking-tight text-base sm:text-lg">IResi</span>
            </div>

            {/* 2. Navigation & Controls (Right) */}
            <div className="flex items-center gap-2 sm:gap-4">
              
              <div className="hidden md:flex items-center gap-1 sm:gap-2">
                <button 
                  onClick={() => { /* Implemented later */ }}
                  className="px-4 py-2 rounded-full text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white transition-all duration-200"
                >
                  Regional Insights
                </button>
                <button 
                  onClick={() => { /* Implemented later */ }}
                  className="px-4 py-2 rounded-full text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white transition-all duration-200"
                >
                  Career Simulator
                </button>
              </div>

              <div className="hidden md:block w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-2"></div>

              
             
            <button
              onClick={() => confirmNavigation('setup')}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-all"
            >
              Get started
            </button>

            {/* 3. Theme Toggle Button */}
            <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-full text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-all duration-200">
            {isDark ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            </div>
          </div>
        </nav>

        <div className="relative z-10">
          {currentView === 'home' && (
            <main key="home" className="view-enter-animation max-w-5xl mx-auto px-4 sm:px-6 pt-32 sm:pt-48 pb-24 sm:pb-32 flex flex-col items-center text-center">
              <div key="home" className="view-enter-animation">
                <Intro onConfigureProfile={() => confirmNavigation('setup')} />
              </div>
            </main>
          )}

          {currentView === 'setup' && (
            <main key="setup" className="view-enter-animation max-w-4xl mx-auto px-4 sm:px-6 pt-24 sm:pt-36 pb-24 sm:pb-32">
              <button onClick={() => confirmNavigation('home')} className="mb-8 sm:mb-12 inline-flex items-center gap-2 text-xs sm:text-sm text-zinc-400 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors">
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Go back
              </button>
              <div className="space-y-12 sm:space-y-16">
                <section>
                  <div className="flex items-center gap-2 mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">1. Work Parameters</h2>
                    
                    {/* Tooltip Wrapper */}
                    <div className="relative group flex items-center">
                      <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-help transition-colors" />
                      
                      {/* Tooltip Box */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 sm:w-56 p-2.5 bg-zinc-800 dark:bg-white text-white dark:text-zinc-900 text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 text-center shadow-xl pointer-events-none">
                        Set the boundaries for your job search, such as your location and preferred role type.
                        
                        {/* Tooltip Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800 dark:border-t-white"></div>
                      </div>
                    </div>
                  </div>
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
                    <div className="flex items-center gap-2 mb-6 sm:mb-8">
                      {/* Your original text is right here: */}
                      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">2. Career DNA</h2>
                      
                      {/* Tooltip Wrapper & Icon */}
                      <div className="relative group flex items-center">
                        <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-help transition-colors" />
                        
                        {/* Tooltip Box that appears on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 sm:w-64 p-2.5 bg-zinc-800 dark:bg-white text-white dark:text-zinc-900 text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 text-center shadow-xl pointer-events-none">
                          Select the core interests and tasks that best align with your natural working style.
                          
                          {/* Tooltip Arrow pointing down */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800 dark:border-t-white"></div>
                        </div>
                      </div>
                    </div>
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

                        {/* Resilience Score box */}
                        {ai && (
                          <div className={`hidden sm:flex flex-col items-start px-4 py-2 mr-4 rounded-xl border ${
                            ai.resilience_score >= 50 
                              ? 'bg-emerald-500/5 border-emerald-500/20' 
                              : 'bg-amber-500/5 border-amber-500/20'
                          }`}>
                            {/* Label is now INSIDE the box */}
                            <span className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${
                              ai.resilience_score >= 50 
                                ? 'text-emerald-700/80 dark:text-[#34D399]/80' 
                                : 'text-amber-700/80 dark:text-[#FBBF24]/80'
                            }`}>
                              Resilience Score
                            </span>
                            
                            <div className="flex items-baseline gap-1.5">
                              <span className={`text-base font-bold leading-none ${
                                ai.resilience_score >= 50 
                                  ? 'text-emerald-600 dark:text-[#34D399]' 
                                  : 'text-amber-600 dark:text-[#FBBF24]'
                              }`}>
                                {ai.resilience_score}%
                              </span>
                              <span className={`text-xs font-medium ${
                                ai.resilience_score >= 50 
                                  ? 'text-emerald-700 dark:text-[#6EE7B7]' 
                                  : 'text-amber-700 dark:text-[#FCD34D]'
                              }`}>
                                ({formatLabel(ai.resilience_label)})
                              </span>
                            </div>
                          </div>
                        )}

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
                                  JSA market assessment indicates <strong className="text-black dark:text-white font-semibold">{formatLabel(ai.demand_label).toLowerCase()} demand</strong> for this occupation.
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
                              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
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
