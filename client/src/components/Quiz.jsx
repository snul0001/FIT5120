import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, HelpCircle, Sparkles } from 'lucide-react';

const AU_LOCATIONS = ['Victoria', 'NSW', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania', 'ACT', 'NT'];
const WORK_PREFERENCES = ['Graduate Role', 'Part-time', 'Internship', 'Contract'];

const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "Your uni's network drops mid-presentation. What's your role in fixing it?",
    options: [
      { letter: 'R', title: 'Computer Network Support Specialist', text: 'Physically check the switches and routers' },
      { letter: 'I', title: 'Computer Network Architect', text: 'Trace the root cause through the network logs' },
      { letter: 'A', title: 'Web & Digital Interface Designer', text: "Redesign the clunky status page everyone's staring at" },
      { letter: 'S', title: 'IT Support Coordinator', text: 'Calmly help panicking classmates find a workaround' },
      { letter: 'E', title: 'ICT Project Manager', text: 'Message IT proposing how they could prevent this next time' },
      { letter: 'C', title: 'Database Administrator', text: 'Log the incident with timestamps for the official report' }
    ]
  },
  {
    id: 2,
    question: "You're handed a messy, undocumented group project codebase. What do you tackle first?",
    options: [
      { letter: 'R', title: 'Telecommunications Specialist', text: "Check if it's actually a hardware or network config issue" },
      { letter: 'I', title: 'Software Developer', text: 'Trace the logic line by line to understand what it does' },
      { letter: 'A', title: 'Video Game / UX Designer', text: 'Mock up how much better this could look and feel' },
      { letter: 'S', title: 'Scrum Facilitator', text: 'Get the group together to agree on clear next steps' },
      { letter: 'E', title: 'Product Manager', text: 'Push to cut unnecessary scope so the team actually ships' },
      { letter: 'C', title: 'Software QA Tester', text: 'Write a proper README and start testing systematically' }
    ]
  },
  {
    id: 3,
    question: "Your team's 24-hour hackathon project just crashed with 2 hours left. What's your immediate reaction?",
    options: [
      { letter: 'R', title: 'Systems Administrator', text: 'Check if the server or hosting environment fell over' },
      { letter: 'I', title: 'Systems Analyst', text: 'Trace back through the code to find exactly where it broke' },
      { letter: 'A', title: 'Web Developer', text: "Fixate on making sure the demo slides look finished regardless" },
      { letter: 'S', title: 'Team Lead', text: 'Check in on the team — keep morale up and stress down' },
      { letter: 'E', title: 'ICT Business Analyst', text: 'Rework the pitch so the live crash doesn\'t sink the demo' },
      { letter: 'C', title: 'Web Administrator', text: 'Make a rapid checklist of what functionality absolutely must work' }
    ]
  },
  {
    id: 4,
    question: "You have to choose ONE elective and can never take the others. Which one call to you?",
    options: [
      { letter: 'R', title: 'Telecommunications Engineering', text: 'Hands-on labs wiring and configuring real network gear' },
      { letter: 'I', title: 'Penetration Testing', text: 'Breaking into systems (legally) to find hidden vulnerabilities' },
      { letter: 'A', title: 'Game Development', text: 'Designing and building an interactive game from scratch' },
      { letter: 'S', title: 'IT Training & Support', text: 'Learning to teach non-technical people how complex systems work' },
      { letter: 'E', title: 'ICT Business Analysis', text: 'Translating business problems into tech requirements and pitching' },
      { letter: 'C', title: 'Database Systems', text: 'Designing and maintaining data structures everything runs on' }
    ]
  },
  {
    id: 5,
    question: "A friend's laptop is glitching right before a major exam. How do you assist?",
    options: [
      { letter: 'R', title: 'Computer Support Specialist', text: 'Physically inspect hardware, cables, and connections' },
      { letter: 'I', title: 'Information Security Analyst', text: 'Check if the machine has been malware-compromised' },
      { letter: 'A', title: 'UI/UX Specialist', text: 'Suggest a cleaner reinstall and OS workspace setup' },
      { letter: 'S', title: 'IT Helpdesk Lead', text: 'Patiently walk them through troubleshooting step-by-step' },
      { letter: 'E', title: 'Tech Consultant', text: 'Evaluate specs and tell them which new laptop to buy' },
      { letter: 'C', title: 'Database Architect', text: 'Methodically back up all their essential files first' }
    ]
  },
  {
    id: 6,
    question: "At a graduate career fair, which industry booth do you linger at the longest?",
    options: [
      { letter: 'R', title: 'Network Infrastructure', text: 'Telecom & Hardware Infrastructure team' },
      { letter: 'I', title: 'Cyber Security', text: 'Security & Penetration Testing team' },
      { letter: 'A', title: 'Interactive Media', text: 'Game Design & Digital Media team' },
      { letter: 'S', title: 'User Enablement', text: 'ICT Customer Success & Training team' },
      { letter: 'E', title: 'Business Tech', text: 'Business Intelligence & Strategy team' },
      { letter: 'C', title: 'Database Operations', text: 'Systems & Database Administration team' }
    ]
  },
  {
    id: 7,
    question: "Your student club needs a working event sign-up system by Friday. What part do you own?",
    options: [
      { letter: 'R', title: 'Support Specialist', text: 'Make sure the web server and form can handle traffic spikes' },
      { letter: 'I', title: 'Data Analyst', text: "Analyze last year's sign-up data to predict peak turnout" },
      { letter: 'A', title: 'UX Designer', text: 'Design a registration flow that people actually enjoy using' },
      { letter: 'S', title: 'Community Lead', text: "Gather feedback on what annoyed members about last year's form" },
      { letter: 'E', title: 'Partnership Lead', text: 'Pitch local sponsors to fund a premium event management tool' },
      { letter: 'C', title: 'Web Administrator', text: 'Build a rigorous validation checklist so zero submissions are missed' }
    ]
  },
  {
    id: 8,
    question: "What made your best university tech project deeply satisfying?",
    options: [
      { letter: 'R', title: 'Infrastructure', text: 'It ran flawlessly under load — hardware and server config combined' },
      { letter: 'I', title: 'QA & Testing', text: 'You discovered and patched the edge-case bug nobody else could find' },
      { letter: 'A', title: 'Frontend & Design', text: 'Every user commented on how sleek and visually polished it was' },
      { letter: 'S', title: 'Peer Mentorship', text: 'You successfully unblocked a teammate and helped them understand' },
      { letter: 'E', title: 'Commercialization', text: 'It solved a real market gap and could become a real commercial product' },
      { letter: 'C', title: 'Data Governance', text: 'The codebase was clean, well-tested, modular, and fully documented' }
    ]
  },
  {
    id: 9,
    question: "11 PM, two days before submission. Shared project folder is total chaos. What do you do?",
    options: [
      { letter: 'R', title: 'Support Specialist', text: "Hop on a call to audit everyone's local dev environments" },
      { letter: 'I', title: 'Systems Analyst', text: 'Audit the directory file by file to discover missing code' },
      { letter: 'A', title: 'Web Designer', text: 'Rebuild the file structure and index into a clean navigable hub' },
      { letter: 'S', title: 'Team Facilitator', text: 'Directly message the most stressed teammate to ensure they are OK' },
      { letter: 'E', title: 'Project Lead', text: 'Take charge, assign explicit sub-tasks, and set a hard deadline' },
      { letter: 'C', title: 'Database Administrator', text: 'Create a strict file-naming convention and delivery tracker' }
    ]
  },
  {
    id: 10,
    question: "Which LinkedIn headline would you be proudest to display after graduation?",
    options: [
      { letter: 'R', title: 'Infrastructure Engineer', text: '"Keeping high-availability infrastructure running at scale"' },
      { letter: 'I', title: 'Security Analyst', text: '"Finding vulnerability patterns that others miss"' },
      { letter: 'A', title: 'Interface Designer', text: '"Crafting digital products that people genuinely love using"' },
      { letter: 'S', title: 'Tech Specialist', text: '"Empowering teams & helping users overcome tech hurdles"' },
      { letter: 'E', title: 'ICT Business Analyst', text: '"Translating technical innovation into measurable business wins"' },
      { letter: 'C', title: 'Database Engineer', text: '"Architecting clean data systems — zero critical failures"' }
    ]
  }
];

const LETTER_TO_INTEREST_ID = {
  R: 'realistic',
  I: 'investigative',
  A: 'artistic',
  S: 'social',
  E: 'enterprising',
  C: 'conventional'
};

export default function Quiz({ onBack, onSubmitQuiz, targetLocation, setTargetLocation, workPreference, setWorkPreference }) {
  const [currentStep, setCurrentStep] = useState(0); // 0 = Parameters, 1-10 = Questions
  const [answers, setAnswers] = useState({});

  const handleSelectOption = (questionId, letter) => {
    setAnswers(prev => ({ ...prev, [questionId]: letter }));
  };

  const calculateResults = () => {
    const counts = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    Object.values(answers).forEach(letter => {
      if (counts[letter] !== undefined) counts[letter] += 1;
    });

    const sortedLetters = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const top2Letters = sortedLetters.slice(0, 2);
    const topInterestIds = top2Letters.map(letter => LETTER_TO_INTEREST_ID[letter]);

    onSubmitQuiz({
      interest_ids: topInterestIds,
      hollandCode: top2Letters.join(''),
      tally: counts
    });
  };

  const isCurrentQuestionAnswered = currentStep > 0 ? Boolean(answers[QUIZ_QUESTIONS[currentStep - 1].id]) : true;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-24 sm:pb-32">
      <button onClick={onBack} className="mb-6 sm:mb-8 inline-flex items-center gap-2 text-xs sm:text-sm text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Exit Quiz
      </button>

      {/* Header & Progress */}
      <div className="mb-8 bg-white/80 dark:bg-[#131B2F]/90 backdrop-blur-md p-6 rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">ICT Career DNA Quiz</h1>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            {currentStep === 0 ? 'Parameters' : `Question ${currentStep} of 10`}
          </span>
        </div>

        <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 0: Regional & Role Preferences */}
      {currentStep === 0 && (
        <div className="bg-white/90 dark:bg-[#131B2F]/90 border border-zinc-200/80 dark:border-white/10 p-6 sm:p-8 rounded-3xl space-y-6 shadow-sm">
          <div>
            <h2 className="text-xl font-bold mb-1 text-zinc-900 dark:text-white">1. Target Preferences</h2>
            <p className="text-xs text-zinc-500 dark:text-slate-400">Set location & role parameters to refine demand weighting.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">Target Region</label>
              <select 
                value={targetLocation} 
                onChange={(e) => setTargetLocation(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {AU_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-slate-400">Work Preference</label>
              <select 
                value={workPreference} 
                onChange={(e) => setWorkPreference(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {WORK_PREFERENCES.map(pref => <option key={pref} value={pref}>{pref}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={() => setCurrentStep(1)}
            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md"
          >
            Start 10-Question Quiz <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Steps 1 - 10: Quiz Questions */}
      {currentStep > 0 && currentStep <= 10 && (
        <div className="bg-white/90 dark:bg-[#131B2F]/90 border border-zinc-200/80 dark:border-white/10 p-6 sm:p-8 rounded-3xl space-y-6 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white leading-snug">
            {QUIZ_QUESTIONS[currentStep - 1].question}
          </h2>

          <div className="space-y-3">
            {QUIZ_QUESTIONS[currentStep - 1].options.map((option) => {
              const qId = QUIZ_QUESTIONS[currentStep - 1].id;
              const isSelected = answers[qId] === option.letter;

              return (
                <div
                  key={option.letter}
                  onClick={() => handleSelectOption(qId, option.letter)}
                  className={`p-4 sm:p-5 rounded-2xl cursor-pointer border transition-all duration-200 flex items-start gap-4 ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500 text-zinc-900 dark:text-white shadow-sm'
                      : 'bg-zinc-50/50 dark:bg-white/[0.02] border-zinc-200/70 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center border text-xs font-bold mt-0.5 ${
                    isSelected ? 'bg-blue-600 text-white border-blue-600' : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-slate-400'
                  }`}>
                    {isSelected ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : option.letter}
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide block">{option.title}</span>
                    <p className="text-sm font-medium text-zinc-800 dark:text-slate-200 leading-snug">{option.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              className="px-5 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Previous
            </button>

            {currentStep < 10 ? (
              <button
                disabled={!isCurrentQuestionAnswered}
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="px-6 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-semibold disabled:opacity-30 flex items-center gap-2"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                disabled={!isCurrentQuestionAnswered}
                onClick={calculateResults}
                className="px-8 py-3 rounded-full bg-emerald-600 text-white font-semibold text-xs disabled:opacity-30 flex items-center gap-2 shadow-lg hover:bg-emerald-500 transition-all"
              >
                Analyze Career Pathways <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}