import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  ArrowRight, 
  ArrowLeft,
  BookOpen, 
  RotateCcw,
  Loader2,
  CheckCircle2,
  Briefcase,
  MapPin,
  Sparkles,
  SlidersHorizontal,
  Sun,
  Moon,
  TrendingUp,
  AlertCircle,
  GraduationCap,
  Building2,
  Compass
} from 'lucide-react';

// Datasets
const AVAILABLE_INTERESTS = [
  'Artificial Intelligence', 'Cyber Security', 'Cloud Infrastructure', 
  'Data Analytics', 'FinTech', 'Green Energy & Sustainability', 
  'Healthcare Tech', 'Product Design', 'Robotics & Automation', 
  'Software Architecture', 'UX/UI Research', 'Venture Capital'
];

const AVAILABLE_SKILLS = [
  'Python', 'Pandas & NumPy', 'Project Management', 'Public Speaking', 
  'PostgreSQL', 'Prompt Engineering', 'PyTorch', 'React.js', 
  'REST API Design', 'Strategic Planning', 'System Design', 
  'TypeScript', 'User Research'
];

const AU_LOCATIONS = ['Victoria (VIC)', 'New South Wales (NSW)', 'Queensland (QLD)', 'Western Australia (WA)', 'South Australia (SA)', 'Remote / Flexible'];
const WORK_PREFERENCES = ['Full-time Graduate', 'Part-time', 'Internship / Co-op', 'Contract / Project-based'];

// Fallback Payload generator when backend API fails
const generateFallbackData = (userProfile) => ({
  isFallback: true,
  timestamp: new Date().toISOString(),
  profileSummary: {
    course: userProfile.preferredCourse || 'Computer Science / Engineering',
    location: userProfile.targetLocation || 'Victoria (VIC)',
    workPreference: userProfile.workPreference || 'Full-time Graduate',
  },
  metrics: {
    matchScore: 92,
    regionalDemandIndex: 'High',
    estGraduateSalary: '$82,000 - $95,000 AUD',
    activeListings: 1420
  },
  recommendedRoles: [
    {
      title: 'Junior Cloud & AI Integration Engineer',
      matchPercentage: 94,
      demandLevel: 'Very High',
      growthRate: '+18.4% YoY',
      avgSalary: '$88,000 AUD',
      keySkillsRequired: ['Python', 'System Design', 'Cloud Infrastructure'],
      description: 'Design and deploy localized machine learning workflows for enterprise infrastructure across Australian cloud hubs.'
    },
    {
      title: 'Data & Systems Analyst',
      matchPercentage: 88,
      demandLevel: 'High',
      growthRate: '+12.1% YoY',
      avgSalary: '$82,000 AUD',
      keySkillsRequired: ['SQL / PostgreSQL', 'Data Analytics', 'REST APIs'],
      description: 'Synthesize complex relational telemetry for government and private enterprise partners.'
    },
    {
      title: 'Product Technology Associate',
      matchPercentage: 81,
      demandLevel: 'Moderate',
      growthRate: '+9.5% YoY',
      avgSalary: '$78,000 AUD',
      keySkillsRequired: ['Project Management', 'UX Research', 'TypeScript'],
      description: 'Bridge software engineering teams with market needs in fast-scaling technology startups.'
    }
  ],
  recommendedSkillUpskill: [
    { skill: 'AWS / Azure Fundamentals', importance: 'Critical', effort: '2-4 weeks' },
    { skill: 'CI/CD Pipeline Automation', importance: 'Recommended', effort: '1-2 weeks' },
    { skill: 'Agile / Scrum Operations', importance: 'Nice to have', effort: '1 week' }
  ]
});

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('fw_theme') === 'dark');
  const [sessionToken, setSessionToken] = useState('');
  
  // Navigation & View State: 'home' | 'results'
  const [currentView, setCurrentView] = useState('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // API & Recommendation Response Data
  const [recommendationData, setRecommendationData] = useState(null);

  // Form State
  const [preferredCourse, setPreferredCourse] = useState('');
  const [targetLocation, setTargetLocation] = useState('Victoria (VIC)');
  const [workPreference, setWorkPreference] = useState('Full-time Graduate');

  // Search State
  const [interestSearch, setInterestSearch] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);

  useEffect(() => {
    let token = sessionStorage.getItem('fw_session_id');
    if (!token) {
      token = `fw_${crypto.randomUUID()}`;
      sessionStorage.setItem('fw_session_id', token);
    }
    setSessionToken(token);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const nextTheme = !prev;
      localStorage.setItem('fw_theme', nextTheme ? 'dark' : 'light');
      return nextTheme;
    });
  };

  const filteredInterests = useMemo(() => {
    if (!interestSearch.trim()) return [];
    return AVAILABLE_INTERESTS.filter(
      item => item.toLowerCase().includes(interestSearch.toLowerCase()) && !selectedInterests.includes(item)
    );
  }, [interestSearch, selectedInterests]);

  const filteredSkills = useMemo(() => {
    if (!skillSearch.trim()) return [];
    return AVAILABLE_SKILLS.filter(
      item => item.toLowerCase().includes(skillSearch.toLowerCase()) && !selectedSkills.includes(item)
    );
  }, [skillSearch, selectedSkills]);

  const addInterest = (item) => { setSelectedInterests([...selectedInterests, item]); setInterestSearch(''); };
  const removeInterest = (item) => { setSelectedInterests(selectedInterests.filter(i => i !== item)); };
  const addSkill = (item) => { setSelectedSkills([...selectedSkills, item]); setSkillSearch(''); };
  const removeSkill = (item) => { setSelectedSkills(selectedSkills.filter(s => s !== item)); };

  // Form Submit / API Execution with Fallback Strategy
  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const userProfile = {
      preferredCourse,
      targetLocation,
      workPreference,
      interests: selectedInterests,
      skills: selectedSkills,
    };

    try {
      const response = await fetch('/api/v1/profile/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify({ profile: userProfile })
      });

      if (!response.ok) throw new Error('API server returned error status');

      const data = await response.json();
      setRecommendationData(data);
    } catch (err) {
      // API call failed -> Fallback content injection
      console.warn('Backend API unreachable. Loading offline recommendations telemetry fallback.');
      const fallback = generateFallbackData(userProfile);
      setRecommendationData(fallback);
    } finally {
      setIsSubmitting(false);
      setIsDrawerOpen(false);
      setCurrentView('results');
    }
  };

  const themeClasses = {
    bg: isDarkMode ? 'bg-[#0B0C0E] text-slate-100' : 'bg-[#FAF9F6] text-slate-900',
    navBg: isDarkMode ? 'bg-[#0B0C0E]/90 border-slate-800' : 'bg-[#FAF9F6]/90 border-slate-200/80',
    cardBg: isDarkMode ? 'bg-[#12141C] border-slate-800' : 'bg-white border-slate-200/80',
    drawerBg: isDarkMode ? 'bg-[#12141C] border-slate-800' : 'bg-white border-slate-200',
    inputBg: isDarkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100 focus:border-emerald-400' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-950',
    primaryBtn: isDarkMode ? 'bg-white text-slate-950 hover:bg-slate-200' : 'bg-slate-950 text-white hover:bg-slate-800',
    secondaryText: isDarkMode ? 'text-slate-400' : 'text-slate-600',
    subtleBorder: isDarkMode ? 'border-slate-800' : 'border-slate-100',
    dropdownBg: isDarkMode ? 'bg-[#181B26] border-slate-800' : 'bg-white border-slate-200',
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 font-sans selection:bg-emerald-200 selection:text-slate-950 ${themeClasses.bg}`}>
      
      {/* Navigation Bar */}
      <nav className={`border-b sticky top-0 z-30 backdrop-blur-md transition-colors duration-200 ${themeClasses.navBg}`}>
        <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between">
          <div 
            onClick={() => setCurrentView('home')} 
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs ${isDarkMode ? 'bg-white text-slate-950' : 'bg-slate-900 text-white'}`}>
              FW
            </div>
            <span className={`font-bold tracking-tight text-lg ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
              FutureWork
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`p-2 rounded-lg border transition-colors ${
                isDarkMode 
                  ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button 
              onClick={() => setIsDrawerOpen(true)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${themeClasses.primaryBtn}`}
            >
              <span>{currentView === 'results' ? 'Modify Profile' : 'Set Up Profile'}</span>
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* VIEW 1: HOME LANDING */}
      {currentView === 'home' && (
        <main className="max-w-6xl mx-auto px-6 pt-16 pb-24">
          <div className="max-w-3xl space-y-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold tracking-wide border ${
              isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Australian Tertiary Career Intelligence</span>
            </div>

            <h1 className={`text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
              Bridge your studies to real workforce opportunities.
            </h1>

            <p className={`text-lg leading-relaxed font-normal ${themeClasses.secondaryText}`}>
              FutureWork provides direct, data-backed career trajectory matching for university students across Australia—without requiring account sign-ups or tracking cookies.
            </p>

            <div className="pt-2">
              <button 
                onClick={() => setIsDrawerOpen(true)}
                className={`px-6 py-3.5 font-semibold text-sm rounded-xl transition-all shadow-sm flex items-center gap-3 ${themeClasses.primaryBtn}`}
              >
                <span>Launch Profile Builder</span>
                <ArrowRight className="w-4 h-4 text-emerald-500" />
              </button>
            </div>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className={`md:col-span-7 p-8 rounded-2xl border shadow-sm space-y-4 transition-colors ${themeClasses.cardBg}`}>
              <h2 className="text-xs uppercase tracking-widest font-mono font-bold text-slate-400">About FutureWork</h2>
              <h3 className={`text-xl font-bold leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Built specifically for Australian higher education students.
              </h3>
              <p className={`text-sm leading-relaxed ${themeClasses.secondaryText}`}>
                Navigating course completion into the labor force can feel unguided. FutureWork continuously ingests Australian workforce telemetry to evaluate high-growth roles, location demands, and skill match indexes.
              </p>
            </div>

            <div className="md:col-span-5 space-y-4">
              <div className={`p-6 rounded-2xl border shadow-sm transition-colors ${themeClasses.cardBg}`}>
                <span className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-wider">01. Privacy First</span>
                <h4 className={`text-base font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Zero Sign-Ups</h4>
                <p className={`text-xs mt-1 leading-relaxed ${themeClasses.secondaryText}`}>
                  Session state is managed cryptographically in local browser memory.
                </p>
              </div>

              <div className={`p-6 rounded-2xl border shadow-sm transition-colors ${themeClasses.cardBg}`}>
                <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-950'}`}>02. State Specific</span>
                <h4 className={`text-base font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Regional Labor Data</h4>
                <p className={`text-xs mt-1 leading-relaxed ${themeClasses.secondaryText}`}>
                  Filters predictions based on specific state demands across VIC, NSW, QLD, WA, and SA.
                </p>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* VIEW 2: RESULTS DASHBOARD */}
      {currentView === 'results' && recommendationData && (
        <main className="max-w-6xl mx-auto px-6 pt-10 pb-24 space-y-8">
          
          {/* Top Return Navigation & Status Notice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button 
              onClick={() => setCurrentView('home')}
              className={`inline-flex items-center gap-2 text-xs font-semibold ${themeClasses.secondaryText} hover:text-emerald-500 transition-colors`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Overview</span>
            </button>

            {/* Offline/Fallback Banner Alert if API failed */}
            {recommendationData.isFallback && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>API Offline: Rendering cached regional labor telemetry fallback.</span>
              </div>
            )}
          </div>

          {/* Results Summary Header */}
          <div className={`p-8 rounded-2xl border ${themeClasses.cardBg} space-y-6`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-500">
                  Career Trajectory Analysis
                </span>
                <h1 className={`text-2xl sm:text-3xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                  {recommendationData.profileSummary.course}
                </h1>
                <div className={`flex flex-wrap items-center gap-4 mt-2 text-xs ${themeClasses.secondaryText}`}>
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {recommendationData.profileSummary.location}</span>
                  <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-slate-400" /> {recommendationData.profileSummary.workPreference}</span>
                </div>
              </div>

              <button
                onClick={() => setIsDrawerOpen(true)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-white' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-900'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Adjust Parameters</span>
              </button>
            </div>

            {/* Metrics Matrix Bar */}
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t ${themeClasses.subtleBorder}`}>
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase">Profile Match</span>
                <p className="text-xl font-bold text-emerald-500 mt-0.5">{recommendationData.metrics.matchScore}% Index</p>
              </div>
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase">Regional Demand</span>
                <p className={`text-xl font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{recommendationData.metrics.regionalDemandIndex}</p>
              </div>
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase">Est. Graduate Salary</span>
                <p className={`text-xl font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{recommendationData.metrics.estGraduateSalary}</p>
              </div>
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase">Active State Opportunities</span>
                <p className={`text-xl font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{recommendationData.metrics.activeListings}</p>
              </div>
            </div>
          </div>

          {/* Main Grid: Recommended Roles + Skill Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Left 8 Cols: Matched Roles */}
            <div className="md:col-span-8 space-y-4">
              <h2 className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Matched Career Trajectories ({recommendationData.recommendedRoles.length})
              </h2>

              {recommendationData.recommendedRoles.map((role, idx) => (
                <div key={idx} className={`p-6 rounded-2xl border transition-all shadow-sm ${themeClasses.cardBg} space-y-4`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono font-semibold text-emerald-500">{role.growthRate}</span>
                      <h3 className={`text-lg font-bold mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                        {role.title}
                      </h3>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                      {role.matchPercentage}% Match
                    </span>
                  </div>

                  <p className={`text-xs leading-relaxed ${themeClasses.secondaryText}`}>
                    {role.description}
                  </p>

                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Core Requirements</span>
                    <div className="flex flex-wrap gap-2">
                      {role.keySkillsRequired.map(skill => (
                        <span key={skill} className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-800'
                        }`}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right 4 Cols: Recommended Skill Upskilling */}
            <div className="md:col-span-4 space-y-4">
              <h2 className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Recommended Competencies
              </h2>

              <div className={`p-6 rounded-2xl border ${themeClasses.cardBg} space-y-4`}>
                <p className={`text-xs leading-relaxed ${themeClasses.secondaryText}`}>
                  Acquiring these key market skills increases your regional match score by up to 24%.
                </p>

                <div className="space-y-3 pt-2">
                  {recommendationData.recommendedSkillUpskill.map((item, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${themeClasses.subtleBorder} flex items-center justify-between`}>
                      <div>
                        <h4 className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.skill}</h4>
                        <span className="text-[10px] text-slate-400">Est. Time: {item.effort}</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                        {item.importance}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </main>
      )}

      {/* SLIDE-OVER SIDE DRAWER FORM */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div className={`pointer-events-auto w-screen max-w-xl border-l shadow-2xl flex flex-col justify-between transition-colors ${themeClasses.drawerBg}`}>
              
              <div className={`px-8 py-6 border-b flex items-center justify-between ${themeClasses.subtleBorder}`}>
                <div>
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>Career Profile Setup</h3>
                  <p className={`text-xs mt-0.5 ${themeClasses.secondaryText}`}>Enter your academic background and skills.</p>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <form id="profile-form" onSubmit={handleSubmitProfile} className="space-y-7">
                  
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Preferred Course or Career Vector
                    </label>
                    <div className="relative">
                      <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input 
                        type="text"
                        required
                        placeholder="e.g. Bachelor of Computer Science or Finance"
                        value={preferredCourse}
                        onChange={(e) => setPreferredCourse(e.target.value)}
                        className={`w-full rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none transition-all border ${themeClasses.inputBg}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        Target Location
                      </label>
                      <select
                        value={targetLocation}
                        onChange={(e) => setTargetLocation(e.target.value)}
                        className={`w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition-all border ${themeClasses.inputBg}`}
                      >
                        {AU_LOCATIONS.map(loc => <option key={loc} value={loc} className={isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}>{loc}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        Work Type
                      </label>
                      <select
                        value={workPreference}
                        onChange={(e) => setWorkPreference(e.target.value)}
                        className={`w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition-all border ${themeClasses.inputBg}`}
                      >
                        {WORK_PREFERENCES.map(pref => <option key={pref} value={pref} className={isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}>{pref}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Interests */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        Student Interests
                      </label>
                      {selectedInterests.length > 0 && (
                        <button 
                          type="button" 
                          onClick={() => setSelectedInterests([])}
                          className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" /> Clear
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedInterests.map(item => (
                        <span key={item} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-900 text-white border-slate-900'
                        }`}>
                          {item}
                          <button type="button" onClick={() => removeInterest(item)} className="hover:text-emerald-400">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input 
                        type="text"
                        placeholder="Search interests (e.g. AI, Cyber Security...)"
                        value={interestSearch}
                        onChange={(e) => setInterestSearch(e.target.value)}
                        className={`w-full rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none transition-all border ${themeClasses.inputBg}`}
                      />
                    </div>

                    {filteredInterests.length > 0 && (
                      <div className={`mt-1 border rounded-xl p-1.5 shadow-lg max-h-36 overflow-y-auto space-y-1 ${themeClasses.dropdownBg}`}>
                        {filteredInterests.map(suggestion => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => addInterest(suggestion)}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors flex justify-between items-center ${
                              isDarkMode ? 'text-slate-300 hover:bg-slate-800 hover:text-emerald-400' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                            }`}
                          >
                            <span>{suggestion}</span>
                            <span className="text-slate-400 text-[10px]">+ Add</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Skills */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        Current Skills
                      </label>
                      {selectedSkills.length > 0 && (
                        <button 
                          type="button" 
                          onClick={() => setSelectedSkills([])}
                          className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" /> Clear
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedSkills.map(item => (
                        <span key={item} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-medium ${
                          isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-100 border-emerald-200 text-emerald-900'
                        }`}>
                          {item}
                          <button type="button" onClick={() => removeSkill(item)} className="hover:text-emerald-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input 
                        type="text"
                        placeholder="Type a skill (e.g. Type 'P' for Python...)"
                        value={skillSearch}
                        onChange={(e) => setSkillSearch(e.target.value)}
                        className={`w-full rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none transition-all border ${themeClasses.inputBg}`}
                      />
                    </div>

                    {filteredSkills.length > 0 && (
                      <div className={`mt-1 border rounded-xl p-1.5 shadow-lg max-h-36 overflow-y-auto space-y-1 ${themeClasses.dropdownBg}`}>
                        {filteredSkills.map(suggestion => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => addSkill(suggestion)}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors flex justify-between items-center ${
                              isDarkMode ? 'text-slate-300 hover:bg-slate-800 hover:text-emerald-400' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                            }`}
                          >
                            <span>{suggestion}</span>
                            <span className="text-slate-400 text-[10px]">+ Add</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </form>
              </div>

              <div className={`px-8 py-5 border-t flex items-center justify-end gap-3 ${themeClasses.subtleBorder} ${isDarkMode ? 'bg-slate-900/40' : 'bg-slate-50/50'}`}>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className={`px-4 py-2 text-xs font-semibold transition-colors ${themeClasses.secondaryText} hover:text-white`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="profile-form"
                  disabled={isSubmitting || !preferredCourse}
                  className={`px-6 py-2.5 disabled:bg-slate-700 disabled:text-slate-500 font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 ${themeClasses.primaryBtn}`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze Profile</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}