import React from 'react';
import { BrainCircuit, Compass, Map, ArrowRight, Sparkles } from 'lucide-react';

// 1. Updated hrefs with real-world authoritative links
const FEATURES = [
  {
    id: 1,
    title: "Analyze AI Impact",
    description: "See which skills are likely to be automated and which will be augmented by AI tools in your desired tech field.",
    icon: <BrainCircuit className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
    linkText: "Explore AI Analysis",
    href: "https://www.pwc.com.au/services/artificial-intelligence/ai-jobs-barometer.html"
  },
  {
    id: 2,
    title: "Map Resilient Careers",
    description: "We translate national data into tailored roadmaps, showing you where the most secure and high-growth opportunities lie.",
    icon: <Compass className="w-6 h-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />,
    linkText: "View Skill Mapping",
    href: "https://jiangren.com.au/en/career-impact-map"
  },
  {
    id: 3,
    title: "Local Market Data",
    description: "Access real-time, official data on job demand and resilient tech roles specific to your city or desired relocation area.",
    icon: <Map className="w-6 h-6 text-teal-600 dark:text-teal-400" aria-hidden="true" />,
    linkText: "See Local Data",
    href: "https://www.dewr.gov.au/download/17666/ai-and-employment-australia/43205/ai-and-employment-australia/pdf"
  }
];

const Intro = ({ onConfigureProfile }) => {
  return (
    <section className="relative w-full min-h-screen bg-transparent transition-colors duration-300 overflow-hidden font-sans flex flex-col items-center pt-20 pb-24">
      
      <div className="relative z-10 max-w-5xl mx-auto px-6 w-full flex flex-col items-center">
        {/* Header */}
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white text-center tracking-tight mb-3">
          Navigate the AI shift with <br className="hidden md:block"/>
          <span className="text-slate-400 dark:text-slate-500">precision.</span>
        </h1>
        <p className="text-center text-slate-600 dark:text-slate-400 max-w-2xl text-base md:text-lg mb-12 leading-relaxed">
          Map your interests to high-resilience tech careers. We analyze official national data to show exactly where AI will automate or elevate your future role.
        </p>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-6">
          {FEATURES.map(({ id, title, description, icon, linkText, href }) => (
            <div key={id} className="flex flex-col bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-7 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 group shadow-sm dark:shadow-none text-left">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300">
                {icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                {title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6 flex-grow">
                {description}
              </p>
              {/* 2. Added target="_blank" and rel="noopener noreferrer" here */}
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mt-auto w-max"
              >
                {linkText}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </a>
            </div>
          ))}
        </div>

        {/* Article Callout */}
        <div className="w-full relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-14 text-left py-4">
          <div className="max-w-2xl relative z-10">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              The Future of AI-Human Collaboration
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              Understand the enduring human capacities that AI cannot replicate. Learn how integrating automation tools responsibly empowers your career trajectory.
            </p>
          </div>
          <a 
            href="https://www.id.com.au/insights/articles/ai-is-transforming-how-we-work/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="relative z-10 whitespace-nowrap inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-200/50 text-slate-900 dark:bg-white/5 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 border border-transparent dark:border-white/10 rounded-lg text-sm font-medium transition-all"
          >
            Read Full Article
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>

        {/* CTA Button */}
        <button 
          onClick={onConfigureProfile}
          className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-full px-8 py-3.5 font-semibold text-sm flex items-center gap-2 shadow-lg dark:shadow-white/10 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-white/50"
        >
          Configure Profile
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

export default Intro;