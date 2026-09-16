import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, MapPin, TrendingUp, ShieldAlert } from 'lucide-react';
import { getRegionalOccupations, getMultiRegionOpportunity } from '../api/client';

// Map UI short codes to the full state names expected by the API endpoint.
const REGION_CODE_TO_API_NAME = {
  ACT: 'Australian Capital Territory',
  NSW: 'NSW',
  NT: 'Northern Territory',
  QLD: 'Queensland',
  SA: 'South Australia',
  TAS: 'Tasmania',
  VIC: 'Victoria',
  WA: 'Western Australia'
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

function summariseByState(records, regionCode) {
  const stateName = REGION_CODE_TO_API_NAME[regionCode];
  const rows = records.filter(r => r.state_name === stateName || r.state_name === regionCode);
  if (rows.length === 0) return 0;

  const latestMonth = rows.reduce((max, r) => (r.month > max ? r.month : max), rows[0].month);
  return rows
    .filter(r => r.month === latestMonth)
    .reduce((sum, r) => sum + (r.employment_value || 0), 0);
}

export default function RegionalInsights({ onBack }) {
  const [occupationGroups, setOccupationGroups] = useState([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedRegions, setSelectedRegions] = useState([...ALL_REGIONS]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [hoveredState, setHoveredState] = useState(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    (async () => {
      setIsLoadingGroups(true);
      try {
        const groups = await getRegionalOccupations();
        setOccupationGroups(groups || []);
        if (groups && groups.length > 0) {
          setSelectedGroup(groups[0]);
        }
      } catch (err) {
        if (err.status === 404) setIsUsingMock(true);
      } finally { 
        setIsLoadingGroups(false);
      }
    })();
  }, []);

  const toggleRegion = (region) => {
    setSelectedRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  const handleGenerateComparison = async () => {
    if (!selectedGroup || selectedRegions.length < 2) return;
    setIsGenerating(true);
    setIsUsingMock(false);

    try {
      // 1. Pass the raw abbreviations directly to the client.
      // client.js already handles the mapping to full API state names and aggregates the totals.
      const results = await getMultiRegionOpportunity(selectedGroup.anzsco4_code, selectedRegions);
      
      // 2. Map the client's pre-aggregated results directly to the chart format.
      const aggregated = results.map(data => ({
        state: data.state, // This is the state abbreviation returned by the client
        opportunities: data.opportunities || 0
      }));

      const hasRealData = aggregated.some(d => d.opportunities > 0);
      if (!hasRealData) throw { status: 404 }; // Force mock fallback logic below if empty
      
      setChartData(aggregated);
    } catch (err) {
      console.error("Failed to fetch regional data:", err);
      if (err.status === 404) {
        setIsUsingMock(true);
        setChartData(
          selectedRegions.map(state => ({
            state,
            opportunities: Math.floor(Math.random() * 600) + 350
          }))
        );
      } else {
        setIsUsingMock(false);
        setChartData([]);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const maxOpps = chartData ? Math.max(...chartData.map(d => d.opportunities), 1) : 1;
  const totalOpps = chartData ? chartData.reduce((acc, curr) => acc + curr.opportunities, 0) : 0;

  const getStateFill = (stateCode) => {
    const data = chartData?.find(d => d.state === stateCode);
    if (!data || !selectedRegions.includes(stateCode)) {
      return 'fill-zinc-200 dark:fill-zinc-800/40 stroke-zinc-300 dark:stroke-zinc-700/50';
    }

    const ratio = data.opportunities / maxOpps;
    if (ratio > 0.8) return 'fill-blue-900 stroke-blue-700';       // High: Dark blue
    if (ratio > 0.5) return 'fill-blue-600/90 stroke-blue-400';    // Medium: Mid blue
    return 'fill-blue-300/80 stroke-blue-400/50';                  // Low: Light blue
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

      {isUsingMock && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>API disconnected or no data for this selection — displaying fallback preview data.</span>
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
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-8">
            Comparison results for {selectedGroup?.anzsco4_name}
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Bar Chart */}
            <div className="lg:col-span-7 relative pt-8 pb-4 pl-14 pr-4 border-l border-b border-zinc-200 dark:border-zinc-800 flex items-end">
              <div
                className="absolute left-1 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest whitespace-nowrap pointer-events-none"
                style={{ transform: 'translate(-40%, -50%) rotate(-90deg)' }}
              >
                EMPLOYED (LATEST MONTH)
              </div>

              <div className="flex items-end justify-between h-64 w-full gap-3">
                {chartData.map((data) => {
                  const heightPercent = maxOpps > 0 ? (data.opportunities / maxOpps) * 100 : 0;
                  const isHovered = hoveredState === data.state;

                  return (
                    <div
                      key={data.state}
                      onMouseEnter={() => setHoveredState(data.state)}
                      onMouseLeave={() => setHoveredState(null)}
                      className="flex flex-col items-center gap-2 flex-1 h-full justify-end group cursor-pointer"
                    >
                      <span className={`text-xs font-bold transition-colors ${isHovered ? 'text-blue-500 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
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

                      <span className={`text-xs font-bold uppercase transition-colors ${isHovered ? 'text-blue-500 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {data.state}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Geographic Australia Map */}
            <div className="lg:col-span-5 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl p-6 relative flex flex-col items-center justify-center min-h-[340px] border border-zinc-200 dark:border-white/5">
              <div className="absolute top-4 right-4 bg-white/90 dark:bg-[#131B2F]/90 backdrop-blur-sm p-3 rounded-xl border border-zinc-200 dark:border-white/10 shadow-sm z-10">
                <p className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">Employment Level</p>
                <div className="h-2 w-28 rounded-full mb-1" 
                    style={{ background: 'linear-gradient(to right, #93c5fd, #2563eb, #1e3a8a)' }}  />
                <div className="flex justify-between text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>

              <svg viewBox="0 0 500 480" className="w-full h-auto max-h-[280px] drop-shadow-xl">
                {Object.entries(AU_STATE_PATHS).map(([code, { name, path }]) => {
                  const isHovered = hoveredState === code;

                  return (
                    <path
                      key={code}
                      d={path}
                      onMouseEnter={() => setHoveredState(code)}
                      onMouseLeave={() => setHoveredState(null)}
                      className={`transition-all duration-300 cursor-pointer ${getStateFill(code)} ${
                        isHovered ? 'brightness-125 stroke-white stroke-2 scale-[1.01]' : 'stroke-1'
                      }`}
                    >
                      <title>{`${name} (${code})`}</title>
                    </path>
                  );
                })}
              </svg>

              {hoveredState && (
                <div className="absolute bottom-4 left-4 right-4 bg-white dark:bg-[#1A233A] p-3 rounded-xl shadow-lg border border-zinc-200 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">
                        {AU_STATE_PATHS[hoveredState]?.name || hoveredState}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {(chartData.find(d => d.state === hoveredState)?.opportunities ?? 0).toLocaleString()} employed
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md">
                    {totalOpps > 0 ? Math.round(((chartData.find(d => d.state === hoveredState)?.opportunities || 0) / totalOpps) * 100) : 0}% Share
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}