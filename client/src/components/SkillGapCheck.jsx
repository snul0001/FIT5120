import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, ShieldAlert } from 'lucide-react';
import { getSkillGap } from '../api/client';

const CATEGORY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];

// Fallback Mock Data
const MOCK_GAP_DATA = {
  occupation_title: 'Cyber Security Architect',
  occupation_id: '273333',
  matched: [
    { id: 'm1', name: 'Python Scripting' },
    { id: 'm2', name: 'Critical Thinking' },
    { id: 'm3', name: 'Git & Version Control' },
    { id: 'm4', name: 'Linux Administration' },
  ],
  missing: [
    { id: 'x1', name: 'Identity & Access Management (IAM)', category: 'Identity & Access Management' },
    { id: 'x2', name: 'Cloud Security Architecture', category: 'Cloud Security' },
    { id: 'x3', name: 'NIST Compliance & Governance', category: 'Risk, Governance & Compliance' },
    { id: 'x4', name: 'Zero Trust Network Security', category: 'Network Security' },
  ],
  categories: [
    { name: 'Identity & Access Management', percentage: 35, color: '#3B82F6' },
    { name: 'Cloud Security', percentage: 25, color: '#10B981' },
    { name: 'Security Architecture', percentage: 20, color: '#F59E0B' },
    { name: 'Network Security', percentage: 10, color: '#8B5CF6' },
    { name: 'Risk, Governance & Compliance', percentage: 10, color: '#EC4899' },
  ],
  priorities: [
    { rank: 1, skill: 'Identity & Access Management (IAM)', rating: 5, link: 'https://learn.microsoft.com' },
    { rank: 2, skill: 'Cloud Security Architecture (AWS/Azure)', rating: 5, link: 'https://aws.amazon.com/training/' },
    { rank: 3, skill: 'Risk & Governance (NIST / ISO 27001)', rating: 4, link: 'https://www.nist.gov' },
    { rank: 4, skill: 'Zero Trust Network Design', rating: 3, link: 'https://www.cisa.gov' },
  ]
};

// Computes category distribution dynamically from missing skills API response
const computeCategories = (missingList) => {
  if (!missingList || missingList.length === 0) return MOCK_GAP_DATA.categories;

  const counts = {};
  missingList.forEach((item) => {
    const rawCat = typeof item === 'object' && item.category ? item.category : 'General';
    // Format category string (e.g. 'software' -> 'Software Requirements')
    const catName = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
    counts[catName] = (counts[catName] || 0) + 1;
  });

  const total = missingList.length;
  return Object.keys(counts).map((catName, idx) => ({
    name: catName,
    percentage: Math.round((counts[catName] / total) * 100),
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
  }));
};

export default function SkillGapCheck({ targetOccupation, userSkills = ['python', 'critical thinking', 'git'], onBack, onNavigate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingMock, setIsUsingMock] = useState(false);
  
  const activeRole = targetOccupation?.title || targetOccupation?.name || MOCK_GAP_DATA.occupation_title;
  // Ensure we pass a valid 6-digit occupation_id to the API contract
  const activeId = String(targetOccupation?.occupation_id || targetOccupation?.id || MOCK_GAP_DATA.occupation_id);

  const [data, setData] = useState(MOCK_GAP_DATA);

  useEffect(() => {
    fetchData(activeId);
  }, [activeId]);

  const fetchData = async (occId) => {
    setIsLoading(true);
    setIsUsingMock(false);

    try {
      const res = await getSkillGap(occId, userSkills);

      // Handle 404 / error response objects from client.js
      if (!res || res.error || (!res.matched && !res.missing)) {
        throw new Error(res?.error || 'No skill data found');
      }

      const matchedItems = res.matched || [];
      const missingItems = res.missing || [];

      setData({
        occupation_title: activeRole,
        occupation_id: occId,
        matched: matchedItems.length 
          ? matchedItems.map((s, i) => ({ id: s.id || `m_${i}`, name: s.skill_name || s })) 
          : [],
        missing: missingItems.length 
          ? missingItems.map((s, i) => ({ id: s.id || `x_${i}`, name: s.skill_name || s, category: s.category })) 
          : [],
        categories: missingItems.length 
          ? computeCategories(missingItems) 
          : MOCK_GAP_DATA.categories,
        priorities: missingItems.length 
          ? missingItems.map((s, idx) => ({
              rank: idx + 1,
              skill: s.skill_name || s,
              // Convert API importance_score (0.0 - 1.0) directly to 1-5 star ratings
              rating: typeof s.importance_score === 'number' 
                ? Math.max(1, Math.round(s.importance_score * 5)) 
                : Math.max(1, 5 - Math.floor(idx / 2)),
              link: '#'
            }))
          : MOCK_GAP_DATA.priorities
      });
    } catch (err) {
      if (err.status === 404) {
        console.warn('⚠️ API fetch failed. Displaying fallback mock preview data.', err);
        setIsUsingMock(true);
        setData(MOCK_GAP_DATA);
      } else {
        console.error('API Error:', err);
        setIsUsingMock(false);
        setData({ matched: [], missing: [], categories: [], priorities: [] });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-700'}`}
      />
    ));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 text-zinc-900 dark:text-zinc-100 font-sans">
      
      {/* Header Section */}
      <div>
        <button 
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Skill gap check
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-slate-400">
          Compare your current skills with the skills required for your target career.
        </p>
      </div>

      {/* Mock Data Warning Banner */}
      {isUsingMock && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>API disconnected or missing skill data for ID ({activeId}) — displaying fallback preview data.</span>
        </div>
      )}

      {/* STEP 1: Target Career Badge */}
      <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-sm flex-shrink-0">
              1
            </span>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Selected career target
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Evaluating skill gap metrics for this role
              </p>
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-[#0E1525] px-6 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
              Current Selected Career
            </span>
            <span className="text-lg font-bold text-zinc-900 dark:text-white">
              {activeRole}
            </span>
          </div>

        </div>
      </div>

      {/* STEP 2: Your Skill Comparison */}
      <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-sm">
            2
          </span>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Your skill comparison
          </h2>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-zinc-400 text-sm animate-pulse">
            Loading skill metrics from backend...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
            
            {/* Matched Skills */}
            <div className="space-y-4 pt-4 md:pt-0 md:pr-4">
              <h3 className="text-sm font-bold text-center text-zinc-900 dark:text-white">
                Matched skills
              </h3>
              <ol className="space-y-3 pl-2">
                {data.matched.map((item, idx) => (
                  <li key={item.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-semibold mr-2">{idx + 1}.</span> {item.name}
                  </li>
                ))}
              </ol>
            </div>

            {/* Missing Skills */}
            <div className="space-y-4 pt-4 md:pt-0 md:px-4">
              <h3 className="text-sm font-bold text-center text-zinc-900 dark:text-white">
                Missing skills
              </h3>
              <ol className="space-y-3 pl-2">
                {data.missing.map((item, idx) => (
                  <li key={item.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-semibold mr-2">{idx + 1}.</span> {item.name}
                  </li>
                ))}
              </ol>
            </div>

            {/* Dynamic Category Donut */}
            <div className="space-y-4 pt-4 md:pt-0 md:pl-6 flex flex-col items-center">
              <h3 className="text-sm font-bold text-center text-zinc-900 dark:text-white">
                Overview of missing skill categories
              </h3>
              
              <div className="relative w-44 h-44 flex items-center justify-center my-2">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#E5E7EB" strokeWidth="4" />
                  {data.categories.reduce((acc, cat, idx) => {
                    const strokeDasharray = `${cat.percentage} ${100 - cat.percentage}`;
                    const strokeDashoffset = acc.offset;
                    acc.offset -= cat.percentage;
                    acc.elements.push(
                      <circle
                        key={idx}
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="transparent"
                        stroke={cat.color}
                        strokeWidth="4"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                      />
                    );
                    return acc;
                  }, { offset: 25, elements: [] }).elements}
                </svg>
              </div>

              <div className="w-full space-y-1.5 text-xs">
                {data.categories.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-[170px]">{cat.name}</span>
                    </div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{cat.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* STEP 3: Priority Skills Table */}
      <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-sm">
            3
          </span>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Priority skills to improve
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Skill</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4 text-right">Suggestions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 text-sm">
              {data.priorities.map((row) => (
                <tr key={row.rank} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="py-4 px-4 font-semibold text-zinc-900 dark:text-white">
                    {row.rank}
                  </td>
                  <td className="py-4 px-4 font-medium text-zinc-800 dark:text-zinc-200">
                    {row.skill}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1">
                      {renderStars(row.rating)}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                        onClick={() => onNavigate('wip')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:underline cursor-pointer bg-transparent border-none p-0"
                    >
                        View resources &rarr;
                    </button>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}