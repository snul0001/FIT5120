import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, MapPin, TrendingUp, ShieldAlert } from 'lucide-react';
import { getRegionalOccupations, getMultiRegionOpportunity, getRegionalDemand, getOccupationAI } from '../api/client';

const REGION_CODE_TO_API_NAME = {
  ACT: 'ACT',
  NSW: 'NSW',
  NT: 'NT',
  QLD: 'QLD',
  SA: 'SA',
  TAS: 'TAS',
  VIC: 'VIC',
  WA: 'WA'
};
const ALL_REGIONS = Object.keys(REGION_CODE_TO_API_NAME);

const AU_STATE_PATHS = {
  WA: {
    name: 'Western Australia',
    path: 'M 207 85 L 185 72 L 163 72 L 141 98 L 119 137 L 97 150 L 64 150 L 42 163 L 31 176 L 20 202 L 31 228 L 42 267 L 53 313 L 75 339 L 97 345 L 119 339 L 141 326 L 163 313 L 185 303 L 207 299 L 207 228 L 207 85 Z'
  },
  NT: {
    name: 'Northern Territory',
    path: 'M 207 85 L 207 228 L 306 228 L 306 98 L 295 72 L 284 46 L 262 46 L 251 39 L 240 33 L 229 46 L 218 59 Z'
  },
  SA: {
    name: 'South Australia',
    path: 'M 207 228 L 207 299 L 229 299 L 262 332 L 284 352 L 290 332 L 300 352 L 300 332 L 295 358 L 306 352 L 317 358 L 339 384 L 339 332 L 339 267 L 306 267 L 306 228 Z'
  },
  QLD: {
    name: 'Queensland',
    path: 'M 306 98 L 306 228 L 306 267 L 339 267 L 471 260 L 460 228 L 449 189 L 438 176 L 427 163 L 416 137 L 405 124 L 394 111 L 383 85 L 372 72 L 361 72 L 350 33 L 339 39 L 328 53 L 317 72 Z'
  },
  NSW: {
    name: 'New South Wales',
    path: 'M 339 267 L 471 260 L 460 306 L 449 332 L 438 358 L 427 371 L 394 352 L 372 345 L 339 332 Z'
  },
  ACT: {
    name: 'Australian Capital Territory',
    path: 'M 425 348 L 432 348 L 432 355 L 425 355 Z'
  },
  VIC: {
    name: 'Victoria',
    path: 'M 339 332 L 339 384 L 350 390 L 361 390 L 372 397 L 394 397 L 416 384 L 427 371 L 394 352 L 372 345 Z'
  },
  TAS: {
    name: 'Tasmania',
    path: 'M 372 416 L 394 416 L 416 423 L 416 449 L 394 462 L 383 462 L 372 455 Z'
  }
};

// ─── Line graph ───────────────────────────────────────────────────────────────
// lines: [{ id, label, color, points: [{ x: '2024', y: 123 }] }]
const LINE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444', '#84CC16'];

function LineChart({ lines, highlighted = null, onHighlight = () => {}, yFormat = v => v.toLocaleString(), tipFormat, showLegend = true, ariaLabel }) {
  const [hover, setHover] = useState(null); // { id, i } = the point under the mouse / finger
  const W = 640, H = 270, P = { l: 56, r: 18, t: 18, b: 34 };
  const xs = Array.from(new Set(lines.flatMap(l => l.points.map(p => p.x)))).sort();
  const ys = lines.flatMap(l => l.points.map(p => p.y));
  const max = Math.max(...ys, 1);

  // Round the top of the axis to a tidy number so the gridlines read well.
  const rawStep = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= rawStep) || rawStep;
  const top = step * 4;

  const x = i => P.l + (xs.length <= 1 ? 0 : (i / (xs.length - 1)) * (W - P.l - P.r));
  const y = v => P.t + (1 - v / top) * (H - P.t - P.b);
  const tickEvery = Math.max(1, Math.ceil(xs.length / 6));
  const tip = tipFormat || yFormat;

  // Tooltip for the hovered point: exact value, drawn above the point (below it if there is no room).
  const renderTooltip = () => {
    if (!hover) return null;
    const line = lines.find(l => l.id === hover.id);
    const point = line?.points.find(p => xs.indexOf(p.x) === hover.i);
    if (!point) return null;
    const rows = [String(point.x).slice(0, 10), lines.length > 1 ? `${line.label}: ${tip(point.y)}` : tip(point.y)];
    const w = Math.max(...rows.map(r => r.length)) * 6.4 + 20;
    const h = 40;
    const cx = x(hover.i), cy = y(point.y);
    const tx = Math.min(Math.max(cx - w / 2, P.l - 4), W - P.r + 4 - w);
    const ty = cy - h - 12 < 2 ? cy + 12 : cy - h - 12;
    return (
      <g pointerEvents="none">
        <line x1={cx} x2={cx} y1={P.t} y2={H - P.b} className="stroke-zinc-400/50" strokeWidth="1" strokeDasharray="3 3" />
        <rect x={tx} y={ty} width={w} height={h} rx="8" className="fill-zinc-900 stroke-zinc-600" strokeWidth="1" />
        <text x={tx + 10} y={ty + 16} className="fill-zinc-400 text-[10px]">{rows[0]}</text>
        <text x={tx + 10} y={ty + 31} className="fill-white text-[12px] font-semibold">{rows[1]}</text>
      </g>
    );
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map(i => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(step * i)} y2={y(step * i)} className="stroke-zinc-200 dark:stroke-zinc-700/60" strokeWidth="1" strokeDasharray={i === 0 ? undefined : '3 4'} />
            <text x={P.l - 8} y={y(step * i) + 4} textAnchor="end" className="fill-zinc-400 text-[10px]">{yFormat(step * i)}</text>
          </g>
        ))}
        {xs.map((label, i) => (i % tickEvery === 0 || i === xs.length - 1) && (
          <text key={label} x={x(i)} y={H - 10} textAnchor="middle" className="fill-zinc-400 text-[10px]">{String(label).slice(0, 7)}</text>
        ))}

        {lines.map(line => {
          const pts = line.points.map(p => ({ i: xs.indexOf(p.x), v: p.y })).filter(p => p.i >= 0);
          if (!pts.length) return null;
          const dim = highlighted && highlighted !== line.id;
          const active = highlighted === line.id;
          return (
            <g key={line.id} opacity={dim ? 0.2 : 1} style={{ transition: 'opacity 0.2s' }}>
              <path d={pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
                fill="none" stroke={line.color} strokeWidth={active ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" />
              {pts.map(p => {
                const isHover = hover?.id === line.id && hover.i === p.i;
                return (
                  <g key={p.i}>
                    <circle cx={x(p.i)} cy={y(p.v)} r={isHover ? 6 : active ? 4.5 : 3.5} fill={line.color} />
                    {/* Larger invisible target so the point is easy to hover or tap */}
                    <circle cx={x(p.i)} cy={y(p.v)} r="14" fill="transparent" className="cursor-pointer"
                      onMouseEnter={() => setHover({ id: line.id, i: p.i })}
                      onClick={() => setHover(isHover ? null : { id: line.id, i: p.i })} />
                  </g>
                );
              })}
            </g>
          );
        })}
        {renderTooltip()}
      </svg>

      {showLegend && (
        <div className="mt-4 flex flex-wrap gap-2">
          {lines.map(line => {
            const latest = line.points.length ? line.points[line.points.length - 1].y : null;
            return (
              <button key={line.id} type="button"
                onMouseEnter={() => onHighlight(line.id)} onMouseLeave={() => onHighlight(null)}
                onFocus={() => onHighlight(line.id)} onBlur={() => onHighlight(null)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors text-zinc-700 dark:text-zinc-200 ${highlighted === line.id ? 'border-zinc-400 dark:border-zinc-500 bg-zinc-100 dark:bg-white/10' : 'border-zinc-200 dark:border-white/10'}`}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: line.color }} />
                {line.label}
                <span className="text-zinc-400 font-medium tabular-nums">{latest !== null ? yFormat(Math.round(latest)) : 'N/A'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RegionalInsights({ onBack, initialGroupCode }) {
  const [occupationGroups, setOccupationGroups] = useState([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedRegions, setSelectedRegions] = useState([...ALL_REGIONS]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [series, setSeries] = useState({});
  const [trend, setTrend] = useState([]);
  const [trendState, setTrendState] = useState('idle'); // idle | loading | done | error
  const [hoveredState, setHoveredState] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [demandMap, setDemandMap] = useState({});

  useEffect(() => {
    (async () => {
      setIsLoadingGroups(true);
      setGroupsError('');
      try {
        const groups = await getRegionalOccupations();
        setOccupationGroups(groups || []);
        if (groups && groups.length > 0) {
          setSelectedGroup(groups.find(g => String(g.anzsco4_code) === String(initialGroupCode)) || groups[0]);
        }
      } catch (err) {
        console.error('Could not load occupation groups:', err);
        setGroupsError(err?.message || 'The occupation group list could not be loaded.');
      } finally { 
        setIsLoadingGroups(false);
      }
    })();
  }, []);

  // National employment by year for the selected occupation (same data the results cards used to show as tiles).
  useEffect(() => {
    if (!selectedGroup) return undefined;
    let cancelled = false;
    setTrendState('loading');
    getOccupationAI(selectedGroup.anzsco4_code)
      .then(res => {
        if (cancelled) return;
        const rows = Array.isArray(res?.employment_trend) ? res.employment_trend : [];
        setTrend(rows.map(r => ({ year: String(r.year), value: Number(r.employed_k) })).filter(r => r.year && Number.isFinite(r.value)));
        setTrendState('done');
      })
      .catch(() => { if (!cancelled) { setTrend([]); setTrendState('error'); } });
    return () => { cancelled = true; };
  }, [selectedGroup]);

  const toggleRegion = (region) => {
    setSelectedRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  const handleGenerateComparison = async () => {
    if (!selectedGroup || selectedRegions.length < 2) return;
    setIsGenerating(true);
    setCompareError('');

    try {
      const [results, demandResults] = await Promise.all([
        getMultiRegionOpportunity(selectedGroup.anzsco4_code, selectedRegions),
        Promise.all(
          selectedRegions.map(async (region) => {
            try {
              const res = await getRegionalDemand(region, selectedGroup.anzsco4_code);
              const records = Array.isArray(res) ? res : (res ? [res] : []);
              if (records.length === 0) return { region, vacancies: null, points: [] };

              const points = records
                .map(r => ({ month: String(r.month ?? ''), value: Number(r.vacancy_3m_moving_average) }))
                .filter(p => p.month && Number.isFinite(p.value))
                .sort((a, b) => a.month.localeCompare(b.month));

              // Extract the record corresponding to the latest month
              const latestRecord = records.reduce((latest, current) => 
                (current.month > latest.month) ? current : latest, records[0]
              );

              return {
                region,
                vacancies: latestRecord?.vacancy_3m_moving_average ? Number(latestRecord.vacancy_3m_moving_average) : null,
                points
              };
            } catch {
              return { region, vacancies: null, points: [] };
            }
          })
        )
      ]);

      const newDemandMap = {};
      const newSeries = {};
      demandResults.forEach(item => {
        if (item.vacancies !== null) newDemandMap[item.region] = item.vacancies;
        newSeries[item.region] = item.points || [];
      });
      setDemandMap(newDemandMap);
      setSeries(newSeries);

      const aggregated = results.map(data => ({
        state: data.state,
        opportunities: data.opportunities || 0
      }));

      const hasRealData = aggregated.some(d => d.opportunities > 0);
      if (!hasRealData) throw { status: 404 };
      
      setChartData(aggregated);
    } catch (err) {
      console.error("Failed to fetch regional data:", err);
      setChartData(null);
      setSeries({});
      setCompareError(
        err?.status === 404
          ? 'No regional data was returned for this occupation group and these regions.'
          : (err?.message || 'Regional data could not be loaded.')
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const maxOpps = chartData ? Math.max(...chartData.map(d => d.opportunities), 1) : 1;
  const totalOpps = chartData ? chartData.reduce((acc, curr) => acc + curr.opportunities, 0) : 0;

  const getStateFillStyle = (stateCode) => {
    const data = chartData?.find(d => d.state === stateCode);
    if (!data || !selectedRegions.includes(stateCode)) {
      return { fill: '#3f3f46', fillOpacity: 0.3 };
    }

    const ratio = Math.min(Math.max(data.opportunities / maxOpps, 0), 1);

    const r = Math.round(147 + (30 - 147) * ratio);
    const g = Math.round(197 + (58 - 197) * ratio);
    const b = Math.round(253 + (138 - 253) * ratio);

    return { fill: `rgb(${r}, ${g}, ${b})` };
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24 space-y-8 text-zinc-900 dark:text-zinc-100">
      <div>
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
          Regional Employment Insights
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base">
          Compare job demand and market density for specific occupation groups across Australia.
        </p>
      </div>

      {compareError && (
        <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{compareError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">1</span>
            <h2 className="font-bold text-base text-zinc-900 dark:text-white">Target Occupation Group</h2>
          </div>

          {isLoadingGroups ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading occupation groups...
            </div>
          ) : groupsError || occupationGroups.length === 0 ? (
            <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              {groupsError
                ? `Occupation groups could not be loaded (${groupsError}).`
                : 'No occupation groups were returned by the API.'}
            </div>
          ) : (
            <select
              value={selectedGroup?.anzsco4_code || ''}
              onChange={(e) => {
                const group = occupationGroups.find(g => String(g.anzsco4_code) === e.target.value);
                setSelectedGroup(group || null);
              }}
              className="w-full px-3 py-2.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-[#131B2F] text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light_dark]"
            >
              {occupationGroups.map(group => (
                <option 
                  key={group.anzsco4_code} 
                  value={group.anzsco4_code}
                  className="bg-white dark:bg-[#131B2F] text-zinc-900 dark:text-white"
                >
                  {group.anzsco4_name}
                </option>
              ))}
            </select>
          )}
          {selectedGroup && (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Selected: <strong className="text-zinc-900 dark:text-white">{selectedGroup.anzsco4_name}</strong>
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">2</span>
              <h2 className="font-bold text-base text-zinc-900 dark:text-white">Select Regions</h2>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{selectedRegions.length} selected</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {ALL_REGIONS.map(region => {
              const active = selectedRegions.includes(region);
              return (
                <button
                  key={region}
                  onClick={() => toggleRegion(region)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {region}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleGenerateComparison}
            disabled={!selectedGroup || selectedRegions.length < 2 || isGenerating}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            Generate Comparison
          </button>
          {selectedRegions.length < 2 && (
            <p className="mt-2 text-[11px] text-zinc-400">Select at least 2 regions to compare.</p>
          )}
        </div>
      </div>

      {chartData && (
        <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white mb-6 sm:mb-8">
            Comparison results for {selectedGroup?.anzsco4_name}
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start min-w-0">
            {/* Left Bar Chart */}
            <div className="lg:col-span-7 min-w-0 relative pt-4 sm:pt-8 pb-4 pl-0 sm:pl-14 pr-0 sm:pr-4 border-b sm:border-l border-zinc-200 dark:border-zinc-800 flex items-end overflow-hidden">
              <div
                className="hidden sm:block absolute left-1 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest whitespace-nowrap pointer-events-none"
                style={{ transform: 'translate(-40%, -50%) rotate(-90deg)' }}
              >
                EMPLOYMENT (LATEST MONTH)
              </div>

              <div className="flex items-end justify-between h-56 sm:h-64 w-full min-w-0 gap-1.5 sm:gap-3">
                {chartData.map((data) => {
                  const heightPercent = maxOpps > 0 ? (data.opportunities / maxOpps) * 100 : 0;
                  const isHovered = hoveredState === data.state;

                  return (
                    <div
                      key={data.state}
                      onMouseEnter={() => setHoveredState(data.state)}
                      onMouseLeave={() => setHoveredState(null)}
                      className="flex flex-col items-center gap-1.5 sm:gap-2 flex-1 min-w-0 h-full justify-end group cursor-pointer"
                    >
                      <span className={`text-[10px] sm:text-xs font-bold transition-colors tabular-nums ${isHovered ? 'text-blue-500 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {data.opportunities.toLocaleString()}
                      </span>

                      <div className="w-full bg-zinc-100 dark:bg-zinc-800/80 rounded-t-lg h-full max-h-[200px] flex items-end p-1">
                        <div
                          className={`w-full rounded-md transition-all duration-300 ${
                            isHovered
                              ? 'bg-blue-400 shadow-lg shadow-blue-500/30'
                              : 'bg-zinc-400 dark:bg-zinc-700'
                          }`}
                          style={{ height: `${Math.max(heightPercent, 5)}%` }}
                        />
                      </div>

                      <span className={`text-[10px] sm:text-xs font-bold uppercase transition-colors ${isHovered ? 'text-blue-500 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {data.state}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Geographic Australia Map */}
            <div className="lg:col-span-5 min-w-0 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl p-4 sm:p-6 relative flex flex-col items-center justify-center min-h-[300px] sm:min-h-[340px] border border-zinc-200 dark:border-white/5 overflow-hidden">
              <div className="static sm:absolute top-4 right-4 self-end mb-2 sm:mb-0 bg-white/90 dark:bg-[#131B2F]/90 backdrop-blur-sm p-3 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm z-10 max-w-full">
                <p className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">Employment Level</p>
                <div 
                  className="h-2 w-28 rounded-full mb-1" 
                  style={{ background: 'linear-gradient(to right, #93c5fd, #2563eb, #1e3a8a)' }} 
                />
                <div className="flex justify-between text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>

              <svg viewBox="0 0 500 480" preserveAspectRatio="xMidYMid meet" className="block w-full max-w-[430px] h-auto max-h-[250px] sm:max-h-[280px] drop-shadow-xl">
                {Object.entries(AU_STATE_PATHS).map(([code, { name, path }]) => {
                  const isHovered = hoveredState === code;

                  return (
                    <path
                      key={code}
                      d={path}
                      onMouseEnter={() => setHoveredState(code)}
                      onMouseLeave={() => setHoveredState(null)}
                      onClick={() =>
                        setHoveredState(prev => (prev === code ? null : code))
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setHoveredState(prev => (prev === code ? null : code));
                        }
                      }}
                      aria-label={`${name} regional data`}
                      style={getStateFillStyle(code)}
                      className={`transition-all duration-300 cursor-pointer ${
                        isHovered
                          ? 'brightness-125 stroke-white stroke-2 scale-[1.01]'
                          : 'stroke-blue-900/60 dark:stroke-zinc-500/80 stroke-[1.5]'
                      }`}
                    >
                      <title>{`${name} (${code})`}</title>
                    </path>
                  );
                })}
              </svg>

              {hoveredState && (() => {
                const stateOpps = chartData?.find(d => d.state === hoveredState)?.opportunities ?? 0;
                const vacancies = demandMap[hoveredState];
                const share = totalOpps > 0 ? Math.round((stateOpps / totalOpps) * 100) : 0;

                return (
                  <div className="static sm:absolute bottom-4 left-4 right-4 mt-3 sm:mt-0 w-full sm:w-auto bg-white/95 dark:bg-[#1A233A]/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 justify-between pointer-events-none">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">
                          {AU_STATE_PATHS[hoveredState]?.name || hoveredState}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-white/10">
                            <strong className="font-bold text-zinc-900 dark:text-white">{stateOpps.toLocaleString()}</strong> Employment
                          </span>

                          {vacancies !== undefined && vacancies !== null && (
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <strong className="font-bold">{vacancies.toLocaleString()}</strong> Vacancies
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                      {share}% of selected employment
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {selectedGroup && (
        <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">Employment trend</h3>
          <p className="mt-1 mb-6 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {selectedGroup.anzsco4_name}: employment estimates by year, Australia (thousands of people).
          </p>
          {trendState === 'loading' ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading employment trend...</div>
          ) : trend.length >= 2 ? (
            <>
              <LineChart
                ariaLabel={`Line graph of employment by year for ${selectedGroup.anzsco4_name}`}
                showLegend={false}
                yFormat={v => `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}k`}
                tipFormat={v => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}k (${Math.round(v * 1000).toLocaleString()} people)`}
                lines={[{ id: 'employment', label: selectedGroup.anzsco4_name, color: LINE_COLORS[0], points: trend.map(t => ({ x: t.year, y: t.value })) }]}
              />
              {(() => {
                const first = trend[0], last = trend[trend.length - 1];
                const change = last.value - first.value;
                const pct = first.value ? (change / first.value) * 100 : null;
                return (
                  <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                    {first.year} to {last.year}: <strong className="text-zinc-900 dark:text-white">{change >= 0 ? '+' : ''}{change.toFixed(1)}k</strong>
                    {pct !== null && <> ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</>}
                  </p>
                );
              })()}
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {trendState === 'error' ? 'Employment trend could not be loaded.' : 'Employment trend data is not available for this occupation.'}
            </p>
          )}
        </div>
      )}

      {chartData && selectedRegions.some(r => (series[r] || []).length >= 2) && (
        <div className="bg-white dark:bg-[#131B2F] border border-zinc-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white">Vacancy trend by region</h3>
          <p className="mt-1 mb-6 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">3-month moving average of job vacancies. Hover a region to highlight its line.</p>
          <LineChart
            ariaLabel="Line graph of job vacancies over time for each selected region"
            highlighted={hoveredState}
            onHighlight={setHoveredState}
            lines={selectedRegions.map((region, i) => ({
              id: region, label: region, color: LINE_COLORS[i % LINE_COLORS.length],
              points: (series[region] || []).map(p => ({ x: p.month, y: p.value }))
            }))}
          />
        </div>
      )}
    </div>
  );
}
