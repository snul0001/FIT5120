import React from 'react';
import { BrainCircuit, Compass, Map, ArrowRight } from 'lucide-react';

const FEATURES = [
  {
    id: 1,
    title: "Analyze AI Impact",
    description: "See which skills are likely to be automated and which will be augmented by AI tools in your desired tech field.",
    icon: <BrainCircuit className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
    linkText: "Explore AI Analysis",
  },
  {
    id: 2,
    title: "Map Resilient Careers",
    description: "We translate national data into tailored roadmaps, showing you where the most secure and high-growth opportunities lie.",
    icon: <Compass className="w-6 h-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />,
    linkText: "View Skill Mapping",
  },
  {
    id: 3,
    title: "Local Market Data",
    description: "Access real-time, official data on job demand and resilient tech roles specific to your city or desired relocation area.",
    icon: <Map className="w-6 h-6 text-teal-600 dark:text-teal-400" aria-hidden="true" />,
    linkText: "See Local Data",
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

        {/* Tagline */}
        <p className="text-center text-slate-600 dark:text-slate-400 max-w-2xl text-base md:text-lg mb-10 leading-relaxed">
          Map your interests to high-resilience tech careers. We analyze official national data to show exactly where AI will automate or elevate your future role.
        </p>

        {/* Configure Profile CTA — right after tagline */}
        <button
          onClick={onConfigureProfile}
          className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-full px-8 py-3.5 font-semibold text-sm flex items-center gap-2 shadow-lg dark:shadow-white/10 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-white/50 mb-24"
        >
          Configure Profile
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Feature Cards — pushed below fold */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {FEATURES.map(({ id, title, description, icon, linkText }) => (
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
              {/* Dummy skeleton button — no link, no action */}
              <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 dark:text-slate-600 cursor-not-allowed mt-auto w-max select-none">
                {linkText}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Intro;
