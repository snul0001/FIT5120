import React, { useEffect, useState } from 'react';
import { matchOccupations, getOccupationAI, getRegionalDemand } from '../api/client';
import { ArrowRight, UserRound, MapPin, ShieldCheck } from 'lucide-react';

const EXAMPLE_INTERESTS = ['investigative', 'conventional'];
const EXAMPLE_REGION = 'VIC';
const EXAMPLE_REGION_LABEL = 'Victoria';
const INTEREST_LABELS = {
  realistic: 'Building & fixing systems', investigative: 'Solving problems & analysing',
  artistic: 'Creating & designing', social: 'Helping & working with people',
  enterprising: 'Leading & managing', conventional: 'Organising & planning'
};
const exampleInterestLabels = EXAMPLE_INTERESTS.map(id => INTEREST_LABELS[id] || id).join(', ');
const toPercent = v => typeof v === 'number' ? (v <= 1 ? Math.round(v * 100) : Math.round(v)) : null;

const Button = ({ onClick, children = 'Get started', className = '' }) => (
  <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 text-sm font-semibold text-[#176BC0] dark:text-blue-300 hover:text-[#0F4F96] dark:hover:text-blue-200 transition-colors ${className}`}>
    {children}<ArrowRight className="w-4 h-4" />
  </button>
);

const PrimaryButton = ({ onClick, children = 'Get started', className = '' }) => (
  <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-3 rounded-xl bg-[#08213D] dark:bg-white px-7 py-3.5 text-sm font-semibold text-white dark:text-[#10233F] shadow-[0_12px_30px_-15px_rgba(8,33,61,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-transform ${className}`}>
    {children}<ArrowRight className="w-4 h-4" />
  </button>
);

const Chapter = ({ reverse = false, first = false, shadow = false, label, title, text, action, onClick, children }) => (
  <section className={`${first ? '' : 'mt-5'} rounded-2xl border border-[#DDE8F1] dark:border-white/10 bg-white/80 dark:bg-[#111B2D]/70 overflow-hidden`}>
    <div className="grid grid-cols-1 lg:grid-cols-2">
      <div className={`${reverse ? 'order-2 lg:order-1' : ''} p-6 sm:p-8 lg:p-10 flex flex-col justify-center`}>
        <p className="text-[10px] font-bold tracking-[0.16em] text-[#347FE5] dark:text-blue-300 uppercase">{label}</p>
        <h3 className="mt-2 text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-[#10233F] dark:text-white">{title}</h3>
        <p className="mt-3 max-w-md text-sm leading-6 text-[#617991] dark:text-slate-400">{text}</p>
        <Button onClick={onClick} className="mt-5">{action}</Button>
      </div>
      <div className={`${reverse ? 'order-1 lg:order-2 border-t lg:border-t-0' : 'border-t lg:border-t-0 lg:border-l'} border-[#DDE8F1] dark:border-white/10 bg-[#F8FBFE] dark:bg-white/[0.02] p-6 sm:p-8 flex items-center`}>
        <div className={`w-full rounded-xl border border-[#D7E4EE] dark:border-white/10 bg-white dark:bg-[#121C2D] p-5 ${shadow ? 'shadow-[0_15px_40px_-32px_rgba(15,35,63,0.5)]' : ''}`}>{children}</div>
      </div>
    </div>
  </section>
);

const Metric = ({ label, value, color = 'bg-[#347FE5]' }) => (
  <div>
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-semibold text-[#425D76] dark:text-slate-400">{label}</span>
      <span className="text-xs font-bold text-[#173A5E] dark:text-slate-200 tabular-nums">{value !== null ? `${value}%` : 'N/A'}</span>
    </div>
    <div className="mt-1.5 h-2 rounded-full bg-[#E9EFF5] dark:bg-white/5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value ?? 0}%` }} />
    </div>
  </div>
);

const Signal = ({ children }) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 w-4 h-4 rounded-full bg-[#E7F7ED] text-[#109154] flex items-center justify-center text-[9px] font-bold shrink-0">✓</span>
    <p className="text-xs leading-5 text-[#48627D] dark:text-slate-400">{children}</p>
  </div>
);

const Intro = ({ onConfigureProfile, onNavigate }) => {
  const [exampleRole, setExampleRole] = useState(null), [aiData, setAiData] = useState(null);
  const [regionalDemand, setRegionalDemand] = useState([]), [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadExample = async () => {
      setIsLoadingPreview(true); setPreviewError(false);
      try {
        const matches = await matchOccupations({ interest_ids: EXAMPLE_INTERESTS, region: EXAMPLE_REGION });
        if (!Array.isArray(matches) || !matches.length) throw new Error('No occupation returned');
        const role = [...matches].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))[0];
        const [ai, demand] = await Promise.all([getOccupationAI(role.occupation_id), getRegionalDemand(EXAMPLE_REGION)]);
        if (cancelled) return;
        setExampleRole(role); setAiData(ai || null); setRegionalDemand(Array.isArray(demand) ? demand : demand ? [demand] : []);
      } catch (error) {
        console.error('Landing-page example data unavailable:', error);
        if (!cancelled) { setExampleRole(null); setAiData(null); setRegionalDemand([]); setPreviewError(true); }
      } finally { if (!cancelled) setIsLoadingPreview(false); }
    };
    loadExample();
    return () => { cancelled = true; };
  }, []);

  const sortedDemand = [...regionalDemand].filter(Boolean).sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')));
  const latestDemand = sortedDemand[sortedDemand.length - 1] || null;
  const vacancyAverage = latestDemand?.vacancy_3m_moving_average != null ? Number(latestDemand.vacancy_3m_moving_average) : null;
  const demandSeries = sortedDemand.filter(item => item.vacancy_3m_moving_average != null).slice(-8).map(item => Number(item.vacancy_3m_moving_average) || 0);
  const maxDemand = Math.max(...demandSeries, 1);
  const matchScore = toPercent(exampleRole?.match_score);
  const resilience = toPercent(aiData?.resilience_score);
  const augmentation = toPercent(aiData?.avg_augmentation);
  const automation = toPercent(aiData?.avg_automation);

  const chart = demandSeries.length ? demandSeries.map((value, i) => (
    <div key={i} className="flex-1 rounded-t-[3px] bg-[#C4D8EF] dark:bg-blue-400/20" style={{ height: `${Math.max(7, (value / maxDemand) * 62)}px` }} />
  )) : <div className="w-full text-center text-[10px] text-[#8093A6] dark:text-slate-500">Regional series unavailable</div>;

  return (
    <section className="w-full bg-transparent text-[#10233F] dark:text-white">
      <div className="relative overflow-hidden bg-transparent">
        <div className="absolute inset-0 pointer-events-none"><div className="absolute -right-28 -top-40 w-[580px] h-[580px] rounded-full bg-blue-500/5 dark:bg-blue-500/5 blur-[120px]" /></div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-[0.96fr_1.04fr] min-h-[520px] sm:min-h-[560px] items-center gap-4 lg:gap-10 pt-20 sm:pt-24">
            <div className="max-w-[560px] py-12 sm:py-16">
              <h1 className="text-[3rem] sm:text-[3.65rem] lg:text-[4rem] leading-[1.04] tracking-[-0.05em] font-bold text-[#10233F] dark:text-white">Navigate the AI shift with precision.</h1>
              <p className="mt-6 max-w-[545px] text-base sm:text-lg leading-7 sm:leading-8 text-[#294665] dark:text-slate-400">Discover tech careers that fit your interests, understand how AI is changing the work, and see where demand exists.</p>
              <PrimaryButton onClick={onConfigureProfile} className="mt-8">Get started</PrimaryButton>
            </div>
            <div className="relative min-h-[300px] sm:min-h-[380px] flex items-center justify-center lg:justify-end">
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center lg:justify-end"><div className="w-[380px] h-[300px] sm:w-[520px] sm:h-[390px] rounded-full bg-blue-100/25 dark:bg-blue-500/5 blur-[70px]" /></div>
              <img src="/iresi_australia_visual_light.png" alt="" aria-hidden="true" draggable="false" className="relative z-10 block dark:hidden w-full max-w-[520px] sm:max-w-[580px] h-auto object-contain select-none pointer-events-none" />
              <img src="/iresi_australia_visual_clean.png" alt="" aria-hidden="true" draggable="false" className="relative z-10 hidden dark:block w-full max-w-[520px] sm:max-w-[580px] h-auto object-contain select-none pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-transparent">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-14 sm:pt-16 pb-16 sm:pb-20">
          <div className="max-w-2xl mb-10 sm:mb-12">
            <p className="text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] text-[#2C5077] dark:text-blue-300 uppercase">WHAT IRESI SHOWS YOU</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-[-0.035em] text-[#10233F] dark:text-white">Four perspectives. One complete picture.</h2>
            <p className="mt-3 text-sm sm:text-base leading-6 font-medium text-[#3A5169] dark:text-slate-400 max-w-[620px]">Take a short interest quiz, then see your career matches, how AI may change them, the skills to build, and where demand is.</p>
          </div>

          <Chapter first shadow label="CHAPTER 01 · CAREER MATCHES" title="Start with you, not the job title" text="Answer a short interest quiz and see which tech careers match how you like to work." action="Take the interest quiz" onClick={onConfigureProfile}>
            {isLoadingPreview ? <div className="h-32 flex items-center justify-center text-xs text-[#7890A8] dark:text-slate-500">Loading example career...</div> : previewError || !exampleRole ? <div className="h-32 flex items-center justify-center text-xs text-[#7890A8] dark:text-slate-500">Example career data unavailable</div> : <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#EDF5FC] dark:bg-blue-500/10 flex items-center justify-center"><UserRound className="w-4 h-4 text-[#176BC0] dark:text-blue-300" /></div>
                  <div><p className="text-sm font-semibold text-[#173A5E] dark:text-white">{exampleRole.title}</p><p className="text-[10px] text-[#7C91A6] dark:text-slate-500">Example career match</p></div>
                </div>
                <div className="rounded-full bg-[#E7F7ED] border border-[#BFE8CC] px-2.5 py-1 text-[10px] font-semibold text-[#168247]">{matchScore !== null ? `${matchScore}% match` : 'Match'}</div>
              </div>
              <div className="mt-5 pt-4 border-t border-[#E2EAF1] dark:border-white/10">
                <p className="text-[10px] font-bold tracking-[0.14em] text-[#74889C] dark:text-slate-500 uppercase">What this match uses</p>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {[['Interests', exampleInterestLabels], ['Skills', 'Optional'], ['Region', EXAMPLE_REGION_LABEL]].map(([label, value]) => <div key={label}><p className="text-[10px] text-[#7C91A6] dark:text-slate-500">{label}</p><p className="mt-1 text-xs font-semibold leading-snug text-[#173A5E] dark:text-slate-200">{value}</p></div>)}
                </div>
              </div>
            </>}
          </Chapter>

          <Chapter reverse label="CHAPTER 02 · AI IMPACT" title="See which parts of the work AI may change" text="Understand how likely work in the occupation is to be supported by AI or fully automated." action="See AI impact for your matches" onClick={onConfigureProfile}>
            <div className="flex items-center justify-between"><p className="text-[10px] font-bold tracking-[0.14em] text-[#74889C] dark:text-slate-500 uppercase">AI IMPACT</p><span className="text-[10px] text-[#7C91A6] dark:text-slate-500">Occupation-level signals</span></div>
            <div className="mt-5 space-y-4"><Metric label="Augmentation" value={augmentation} /><Metric label="Automation" value={automation} color="bg-[#735CE6]" /><Metric label="Resilience score" value={resilience} /></div>
          </Chapter>

          <Chapter label="CHAPTER 03 · SKILL GAP CHECK" title="Know what to build next" text="Compare the skills you add with the skills a matched career needs, then see which to build first." action="Check your skill gap" onClick={onConfigureProfile}>
            <p className="text-[10px] font-bold tracking-[0.14em] text-[#74889C] dark:text-slate-500 uppercase">SKILL COMPARISON</p>
            <div className="mt-4 space-y-4">
              <div><p className="text-xs font-semibold text-[#425D76] dark:text-slate-400">Skills you have</p><div className="mt-2 flex flex-wrap gap-2"><span className="px-2.5 py-1 rounded-full bg-[#E8F7ED] text-[#168247] border border-[#BFE8CC] text-[10px]">Skills you add</span><span className="px-2.5 py-1 rounded-full bg-[#F2F6FA] text-[#71869B] border border-[#DCE6EF] text-[10px]">Compared with each match</span></div></div>
              <div className="pt-3 border-t border-[#E2EAF1] dark:border-white/10"><p className="text-xs font-semibold text-[#425D76] dark:text-slate-400">Skills to build</p><p className="mt-1.5 text-[11px] leading-5 text-[#7A8EA2] dark:text-slate-500">Add your skills after the interest quiz, then open Check Skill Gap on any matched career.</p></div>
            </div>
          </Chapter>

          <Chapter reverse label="CHAPTER 04 · REGIONAL INSIGHTS" title="Find where the opportunity is" text="Explore employment and vacancy trends across Australian regions before you decide where to build your career." action="Explore Regional Insights" onClick={() => onNavigate?.('regional-insights')}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[#EDF5FC] dark:bg-blue-500/10 flex items-center justify-center"><MapPin className="w-4 h-4 text-[#176BC0] dark:text-blue-300" /></div><div><p className="text-sm font-semibold text-[#173A5E] dark:text-white">{EXAMPLE_REGION_LABEL}</p><p className="text-[10px] text-[#7C91A6] dark:text-slate-500">Latest regional data</p></div></div>
              <span className="inline-flex items-center rounded-full bg-[#EEF5FC] border border-[#D2E3F2] px-2.5 py-1 text-[10px] font-semibold text-[#416785]">Vacancy trend</span>
            </div>
            <div className="mt-5 pt-4 border-t border-[#E2EAF1] dark:border-white/10">
              <div className="flex items-end gap-1.5 h-16">{chart}</div>
              <div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-[10px] text-[#7A8EA2] dark:text-slate-500">Latest 3-month vacancy average</p><p className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#102A48] dark:text-white">{vacancyAverage !== null ? vacancyAverage.toLocaleString() : 'N/A'}</p></div></div>
            </div>
          </Chapter>
        </div>
      </div>

      <div id="iresi-about" className="bg-transparent border-t border-[#EDF2F7]/60 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-9 sm:py-10"><div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#6F879F]" /><p className="text-sm font-semibold text-[#10233F] dark:text-white">This analysis uses data from</p></div><p className="mt-1.5 text-xs font-medium text-[#4E637B] dark:text-slate-500">Career and labour-market information used throughout IResi.</p></div>
          <div className="flex flex-wrap items-center gap-2.5">{[['https://www.jobsandskills.gov.au/data', 'Jobs & Skills Australia'], ['https://www.onetcenter.org/database.html', 'O*NET Database']].map(([href, label]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-[#D4E2EE] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-[#1762B1] dark:text-blue-300 hover:bg-[#F4F8FC] dark:hover:bg-white/5 transition-colors">{label}</a>)}</div>
        </div></div>
      </div>

      <div className="relative overflow-hidden bg-transparent border-t border-[#E1EBF4]/50 dark:border-white/5">
        <div className="absolute inset-0 pointer-events-none"><div className="absolute -left-20 -bottom-44 w-[430px] h-[430px] rounded-full bg-blue-500/5 dark:bg-blue-500/5 blur-3xl" /><div className="absolute -right-20 -top-44 w-[430px] h-[430px] rounded-full bg-indigo-500/5 dark:bg-indigo-500/5 blur-3xl" /></div>
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 sm:py-24 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.04em] text-[#10233F] dark:text-white">Make your next career move with more clarity.</h2>
          <p className="mt-4 text-sm sm:text-base leading-7 text-[#536C86] dark:text-slate-400 max-w-xl mx-auto">Take the interest quiz to see your career matches, AI impact, skill gaps and regional demand.</p>
          <PrimaryButton onClick={onConfigureProfile} className="mt-7">Get started</PrimaryButton>
        </div>
      </div>
    </section>
  );
};

export default Intro;
