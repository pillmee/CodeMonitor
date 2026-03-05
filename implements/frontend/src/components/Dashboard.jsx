import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { subDays } from 'date-fns';
import ChartContainer from './ChartContainer';

const CustomSelect = ({ value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`custom-select ${isOpen ? 'open' : ''}`} ref={containerRef}>
            <div className="select-trigger" onClick={() => setIsOpen(!isOpen)}>
                <span>{selectedOption ? selectedOption.label : 'Select...'}</span>
                <span className="arrow">▼</span>
            </div>
            {isOpen && (
                <div className="select-options">
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            className={`select-option ${opt.value === value ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const Dashboard = ({ viewMode, selectedRepoIds, apiBase, repositories }) => {
    const [stats, setStats] = useState([]);          // 차트 표시용 (all→합산, selected→개별)
    const [rawDatasets, setRawDatasets] = useState([]); // 통계값 계산용 (항상 개별 저장소 데이터 유지)
    const [days, setDays] = useState(() => {
        return Number(localStorage.getItem('cm_days')) || 7;
    });

    // --- Comparison Feature States ---
    const [compStart, setCompStart] = useState('');
    const [compEnd, setCompEnd] = useState('');
    const [compStats, setCompStats] = useState({ startLOC: 0, endLOC: 0, delta: 0, percent: 0 });
    const [showHighlight, setShowHighlight] = useState(true);

    // --- Refinement Analysis States ---
    const [refinementDate, setRefinementDate] = useState('');
    const [refinementStats, setRefinementStats] = useState({ baselineLOC: 0, netChange: 0, ratio: 100 });

    const getTodayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    useEffect(() => {
        localStorage.setItem('cm_days', days);
    }, [days]);

    // Fetch settings from server on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axios.get(`${apiBase}/settings`);
                if (res.data.comparison_start) setCompStart(res.data.comparison_start);
                if (res.data.growth_target_date) setRefinementDate(res.data.growth_target_date);
                if (res.data.show_highlight !== undefined) setShowHighlight(res.data.show_highlight === 'true');

                if (res.data.comparison_end) {
                    if (res.data.comparison_end === 'today') {
                        setCompEnd(getTodayStr());
                    } else {
                        setCompEnd(res.data.comparison_end);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch settings', err);
            }
        };
        fetchSettings();
    }, [apiBase]);

    // Save settings to server
    const handleSettingChange = async (key, value) => {
        if (key === 'compStart') setCompStart(value);
        else if (key === 'compEnd') setCompEnd(value);
        else if (key === 'refinementDate') setRefinementDate(value);
        else if (key === 'showHighlight') setShowHighlight(value);

        let dbKey = '';
        let dbValue = value;

        if (key === 'compStart') dbKey = 'comparison_start';
        else if (key === 'compEnd') {
            dbKey = 'comparison_end';
            if (value === getTodayStr()) dbValue = 'today';
        }
        else if (key === 'refinementDate') dbKey = 'growth_target_date';
        else if (key === 'showHighlight') { dbKey = 'show_highlight'; dbValue = String(value); }

        try {
            await axios.patch(`${apiBase}/settings`, { key: dbKey, value: dbValue });
        } catch (err) {
            console.error('Failed to save setting', err);
        }
    };

    const title = viewMode === 'all'
        ? 'All Repositories (Total)'
        : selectedRepoIds.length > 0
            ? `${selectedRepoIds.length} Repositories Selected`
            : 'No Repository Selected';

    useEffect(() => {
        const fetchStats = async () => {
            let repoIdsParam;

            if (viewMode === 'all') {
                repoIdsParam = 'all';
            } else {
                if (selectedRepoIds.length === 0) {
                    setStats([]);
                    setRawDatasets([]);
                    return;
                }
                repoIdsParam = selectedRepoIds.join(',');
            }

            const now = new Date();
            const daysStart = subDays(now, days).getTime();

            let fetchStart = daysStart;
            let fetchEnd = now.getTime();

            // Comparison & Refinement dates influence fetch range
            [compStart, compEnd, refinementDate].forEach(dStr => {
                if (dStr) {
                    const ts = new Date(dStr).getTime();
                    if (ts < fetchStart) fetchStart = ts;
                    if (ts > fetchEnd) fetchEnd = ts;
                }
            });

            const formatDate = (dateTs) => {
                const d = new Date(dateTs);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            };

            try {
                const res = await axios.get(`${apiBase}/stats`, {
                    params: {
                        repo_ids: repoIdsParam,
                        start_date: formatDate(fetchStart),
                        end_date: formatDate(fetchEnd)
                    }
                });
                const processedDatasets = (res.data.datasets || []).map(ds => ({
                    ...ds,
                    data: ds.data
                        .map(p => ({
                            ...p,
                            x: new Date(p.x).getTime()
                        }))
                        .sort((a, b) => a.x - b.x)
                }));

                setRawDatasets(processedDatasets);

                if (viewMode === 'all' && processedDatasets.length > 0) {
                    const repoDateMaps = processedDatasets.map(ds => {
                        const map = new Map();
                        ds.data.forEach(point => {
                            const d = new Date(point.x);
                            const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            map.set(dayKey, point.y);
                        });
                        return map;
                    });

                    const allDates = new Set();
                    repoDateMaps.forEach(map => {
                        map.forEach((_, key) => allDates.add(key));
                    });
                    const sortedDates = Array.from(allDates).sort();

                    const lastKnown = new Array(processedDatasets.length).fill(0);
                    const combinedData = sortedDates.map(dayKey => {
                        let sum = 0;
                        repoDateMaps.forEach((map, idx) => {
                            if (map.has(dayKey)) {
                                lastKnown[idx] = map.get(dayKey);
                            }
                            sum += lastKnown[idx];
                        });
                        return { x: new Date(dayKey).getTime(), y: sum };
                    });

                    setStats([{
                        label: 'All Repositories (Total)',
                        data: combinedData
                    }]);
                } else {
                    setStats(processedDatasets);
                }
            } catch (err) {
                console.error('Failed to fetch stats', err);
            }
        };

        fetchStats();
    }, [viewMode, selectedRepoIds, days, compStart, compEnd, refinementDate, apiBase]);

    // Polling for cross-browser sync
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axios.get(`${apiBase}/settings`);
                if (res.data.comparison_start && res.data.comparison_start !== compStart) {
                    setCompStart(res.data.comparison_start);
                }
                if (res.data.growth_target_date && res.data.growth_target_date !== refinementDate) {
                    setRefinementDate(res.data.growth_target_date);
                }
                if (res.data.show_highlight !== undefined) {
                    const serverVal = res.data.show_highlight === 'true';
                    if (serverVal !== showHighlight) setShowHighlight(serverVal);
                }

                if (res.data.comparison_end) {
                    let resolvedEnd = res.data.comparison_end;
                    if (resolvedEnd === 'today') resolvedEnd = getTodayStr();

                    if (resolvedEnd !== compEnd) {
                        setCompEnd(resolvedEnd);
                    }
                }
            } catch (err) {
                console.error('Failed to poll settings', err);
            }
        };

        const interval = setInterval(fetchSettings, 10000);
        return () => clearInterval(interval);
    }, [apiBase, compStart, compEnd, refinementDate, showHighlight]);

    // Comparison & Refinement Calculation Logic
    useEffect(() => {
        if (rawDatasets.length === 0) return;

        // 1. Point Comparison
        if (compStart && compEnd) {
            const startDate = new Date(compStart).getTime();
            const endDate = new Date(compEnd).getTime();

            let startSum = 0;
            let endSum = 0;

            rawDatasets.forEach(dataset => {
                if (dataset.data.length === 0) return;
                const startIdx = dataset.data.findIndex(p => p.x >= startDate);
                const startVal = startIdx !== -1 ? dataset.data[startIdx].y : dataset.data[dataset.data.length - 1].y;
                const endIdx = dataset.data.findIndex(p => p.x >= endDate);
                const endVal = endIdx !== -1 ? dataset.data[endIdx].y : dataset.data[dataset.data.length - 1].y;
                startSum += startVal;
                endSum += endVal;
            });
            const delta = endSum - startSum;
            const percent = startSum !== 0 ? (delta / startSum) * 100 : 0;
            setCompStats({ startLOC: startSum, endLOC: endSum, delta, percent });
        }

        // 2. Code Refinement Analysis
        if (refinementDate) {
            const targetTs = new Date(refinementDate).getTime();
            let targetSum = 0;
            let currentSum = 0;

            rawDatasets.forEach(dataset => {
                if (!dataset.data || dataset.data.length === 0) return;

                // Baseline point (Target Date)
                const targetIdx = dataset.data.findIndex(p => p.x >= targetTs);
                const targetVal = targetIdx !== -1 ? dataset.data[targetIdx].y : dataset.data[dataset.data.length - 1].y;
                targetSum += targetVal;

                // Today point (Latest)
                currentSum += dataset.data[dataset.data.length - 1].y;
            });

            const netChange = currentSum - targetSum;
            const ratio = targetSum > 0 ? (currentSum / targetSum) * 100 : 100;

            setRefinementStats({ baselineLOC: targetSum, netChange, ratio });
        }
    }, [compStart, compEnd, refinementDate, rawDatasets]);

    let totalLOC = 0;
    let netChange = 0;

    rawDatasets.forEach(dataset => {
        if (dataset.data.length > 0) {
            const latest = dataset.data[dataset.data.length - 1].y;
            totalLOC += latest;
            const first = dataset.data[0].y;
            netChange += (latest - first);
        }
    });

    const timeRange = useMemo(() => ({
        min: subDays(new Date(), days).getTime(),
        max: new Date().getTime()
    }), [days]);

    return (
        <div className="dashboard-content">
            <div className="top-stats-row">
                <div className="summary-cards">
                    <div className="card mini">
                        <div className="card-title">{viewMode === 'all' ? 'Total (LOC)' : 'Total LOC'}</div>
                        <div className="card-value small">{totalLOC.toLocaleString()}</div>
                    </div>
                    <div className="card mini">
                        <div className="card-title">{days}D Net Change</div>
                        <div className="card-value small" style={{ color: netChange >= 0 ? 'var(--accent-color)' : 'var(--danger-color)' }}>
                            {netChange > 0 ? '+' : ''}{netChange.toLocaleString()}
                        </div>
                    </div>
                    <div className="card mini">
                        <div className="card-title">Time Range</div>
                        <CustomSelect
                            value={days}
                            onChange={setDays}
                            options={[
                                { value: 7, label: 'Last 7 Days' },
                                { value: 30, label: 'Last 30 Days' },
                                { value: 90, label: 'Last 90 Days' },
                                { value: 365, label: 'Last 1 Year' },
                                { value: 730, label: 'Last 2 Years' },
                                { value: 1095, label: 'Last 3 Years' },
                                { value: 1825, label: 'Last 5 Years' },
                                { value: 2555, label: 'Last 7 Years' },
                                { value: 3650, label: 'Last 10 Years' },
                                { value: 5475, label: 'Last 15 Years' },
                                { value: 7300, label: 'Last 20 Years' },
                            ]}
                        />
                    </div>
                </div>

                <div className="analysis-cards">
                    {/* Point Comparison */}
                    <div className="card analysis-card">
                        <div className="analysis-header">
                            <div className="card-title">Point Comparison</div>
                            <div className="analysis-controls">
                                <button
                                    className={`highlight-toggle ${showHighlight ? 'active' : ''}`}
                                    onClick={() => handleSettingChange('showHighlight', !showHighlight)}
                                    title={showHighlight ? 'Hide chart highlight' : 'Show chart highlight'}
                                >
                                    {showHighlight ? '◈ On' : '◇ Off'}
                                </button>
                                <div className="analysis-inputs">
                                    <input type="date" value={compStart} onChange={(e) => handleSettingChange('compStart', e.target.value)} className="date-input" />
                                    <span className="separator">vs</span>
                                    <input type="date" value={compEnd} onChange={(e) => handleSettingChange('compEnd', e.target.value)} className="date-input" />
                                </div>
                            </div>
                        </div>
                        <div className="analysis-results">
                            <div className="res-mini">
                                <span className="label">Diff:</span>
                                <span className={`value ${compStats.delta >= 0 ? 'plus' : 'minus'}`}>
                                    {compStats.delta >= 0 ? '+' : ''}{compStats.delta.toLocaleString()}
                                    <span className="pct">({compStats.percent.toFixed(1)}%)</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Code Refinement Analysis */}
                    <div className="card analysis-card highlighted">
                        <div className="analysis-header">
                            <div className="card-title">Code Refinement Analysis</div>
                            <div className="analysis-inputs">
                                <input type="date" value={refinementDate} onChange={(e) => handleSettingChange('refinementDate', e.target.value)} className="date-input highlighted" />
                            </div>
                        </div>
                        <div className="analysis-results">
                            <div className="res-grid">
                                <div className="res-mini">
                                    <span className="label">Baseline LOC:</span>
                                    <span className="value">{refinementStats.baselineLOC.toLocaleString()}</span>
                                </div>
                                <div className="res-mini">
                                    <span className="label">Net Change:</span>
                                    <span className={`value ${refinementStats.netChange >= 0 ? 'plus' : 'minus'}`}>
                                        {refinementStats.netChange >= 0 ? '+' : ''}{refinementStats.netChange.toLocaleString()}
                                    </span>
                                </div>
                                <div className="res-mini main">
                                    <span className="label">Refinement Ratio (vs Today):</span>
                                    <span className="value accent">{refinementStats.ratio.toFixed(2)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ChartContainer
                datasets={stats}
                title={`${title} LOC Trend`}
                timeRange={timeRange}
                comparisonRange={showHighlight && compStart && compEnd ? { start: compStart, end: compEnd } : null}
                refinementDate={refinementDate}
            />
        </div>
    );
};

export default Dashboard;
