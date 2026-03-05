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

    useEffect(() => {
        localStorage.setItem('cm_days', days);
    }, [days]);

    // Fetch comparison dates from server on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axios.get(`${apiBase}/settings`);
                if (res.data.comparison_start) setCompStart(res.data.comparison_start);
                if (res.data.comparison_end) setCompEnd(res.data.comparison_end);
            } catch (err) {
                console.error('Failed to fetch settings', err);
            }
        };
        fetchSettings();
    }, [apiBase]);

    // Save comparison dates to server when they change
    const handleCompDateChange = async (key, value) => {
        if (key === 'start') setCompStart(value);
        else setCompEnd(value);

        try {
            await axios.patch(`${apiBase}/settings`, {
                key: key === 'start' ? 'comparison_start' : 'comparison_end',
                value: value
            });
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

            try {
                const res = await axios.get(`${apiBase}/stats`, {
                    params: { repo_ids: repoIdsParam, days }
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

                // 통계값(Total LOC, Net Change)은 항상 개별 저장소 데이터로 계산
                setRawDatasets(processedDatasets);

                if (viewMode === 'all' && processedDatasets.length > 0) {
                    // 모든 데이터셋을 일별 합산하여 단일 선으로 변환
                    // 각 저장소에 대해 날짜별로 "마지막 알려진 값"을 유지하여
                    // 특정 날짜에 한 저장소의 데이터가 없어도 합산이 누락되지 않도록 처리

                    // 1. 각 저장소별 날짜→값 맵 구축
                    const repoDateMaps = processedDatasets.map(ds => {
                        const map = new Map();
                        ds.data.forEach(point => {
                            const d = new Date(point.x);
                            const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            map.set(dayKey, point.y);
                        });
                        return map;
                    });

                    // 2. 전체 고유 날짜 수집 및 정렬
                    const allDates = new Set();
                    repoDateMaps.forEach(map => {
                        map.forEach((_, key) => allDates.add(key));
                    });
                    const sortedDates = Array.from(allDates).sort();

                    // 3. 각 날짜에 대해 모든 저장소의 값을 합산 (없으면 마지막 알려진 값 유지)
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
    }, [viewMode, selectedRepoIds, days, apiBase]);

    // Comparison Calculation Logic
    useEffect(() => {
        if (!compStart || !compEnd || rawDatasets.length === 0) return;

        const startDate = new Date(compStart).getTime();
        const endDate = new Date(compEnd).getTime();

        let startSum = 0;
        let endSum = 0;

        rawDatasets.forEach(dataset => {
            if (dataset.data.length === 0) return;

            // Find value at/before start date
            let startVal = 0;
            const startIdx = dataset.data.findIndex(p => p.x >= startDate);
            if (startIdx !== -1) {
                // 만약 첫 데이터가 시작일 이후라면 첫 데이터 사용, 아니면 시작일 직전 데이터 사용
                startVal = dataset.data[startIdx].y;
            } else {
                startVal = dataset.data[dataset.data.length - 1].y;
            }

            // Find value at/before end date
            let endVal = 0;
            const endIdx = dataset.data.findIndex(p => p.x >= endDate);
            if (endIdx !== -1) {
                endVal = dataset.data[endIdx].y;
            } else {
                endVal = dataset.data[dataset.data.length - 1].y;
            }

            startSum += startVal;
            endSum += endVal;
        });

        const delta = endSum - startSum;
        const percent = startSum !== 0 ? (delta / startSum) * 100 : 0;

        setCompStats({ startLOC: startSum, endLOC: endSum, delta, percent });
    }, [compStart, compEnd, rawDatasets]);

    // 통계값은 rawDatasets (개별 저장소)에서 계산 → 정확한 per-repo Net Change 보장
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
        <>
            <div className="summary-cards">
                <div className="card">
                    <div className="card-title">
                        {viewMode === 'all' ? 'Total LOC (Total)' : 'Total Lines of Code'}
                    </div>
                    <div className="card-value">{totalLOC.toLocaleString()}</div>
                </div>
                <div className="card">
                    <div className="card-title">
                        {viewMode === 'all' ? `${days}D Net Change (Total)` : `${days} Days Net Change`}
                    </div>
                    <div className="card-value" style={{ color: netChange >= 0 ? 'var(--accent-color)' : 'var(--danger-color)' }}>
                        {netChange > 0 ? '+' : ''}{netChange.toLocaleString()}
                    </div>
                </div>
                <div className="card">
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

            {/* Comparison Controls */}
            <div className="comparison-container">
                <div className="card comparison-card">
                    <div className="comparison-header">
                        <div className="card-title">Point Comparison</div>
                        <div className="comparison-inputs">
                            <input
                                type="date"
                                value={compStart}
                                onChange={(e) => handleCompDateChange('start', e.target.value)}
                                className="date-input"
                            />
                            <span className="separator">vs</span>
                            <input
                                type="date"
                                value={compEnd}
                                onChange={(e) => handleCompDateChange('end', e.target.value)}
                                className="date-input"
                            />
                        </div>
                    </div>
                    <div className="comparison-results">
                        <div className="res-item">
                            <span className="label">Start:</span>
                            <span className="value">{compStats.startLOC.toLocaleString()}</span>
                        </div>
                        <div className="res-item">
                            <span className="label">End:</span>
                            <span className="value">{compStats.endLOC.toLocaleString()}</span>
                        </div>
                        <div className="res-item divider"></div>
                        <div className="res-item main">
                            <span className="label">Diff:</span>
                            <span className={`value ${compStats.delta >= 0 ? 'plus' : 'minus'}`}>
                                {compStats.delta >= 0 ? '+' : ''}{compStats.delta.toLocaleString()}
                                <span className="pct">({compStats.percent.toFixed(2)}%)</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <ChartContainer
                datasets={stats}
                title={`${title} LOC Trend`}
                timeRange={timeRange}
                comparisonRange={compStart && compEnd ? { start: compStart, end: compEnd } : null}
            />
        </>
    );
};

export default Dashboard;
