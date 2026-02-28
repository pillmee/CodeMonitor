import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { subDays } from 'date-fns';
import ChartContainer from './ChartContainer';

const Dashboard = ({ viewMode, selectedRepoIds, apiBase, repositories }) => {
    const [stats, setStats] = useState([]);          // 차트 표시용 (all→합산, selected→개별)
    const [rawDatasets, setRawDatasets] = useState([]); // 통계값 계산용 (항상 개별 저장소 데이터 유지)
    const [days, setDays] = useState(() => {
        return Number(localStorage.getItem('cm_days')) || 7;
    });

    useEffect(() => {
        localStorage.setItem('cm_days', days);
    }, [days]);

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
                    <select
                        className="form-control"
                        style={{ width: '160px', marginTop: '10px' }}
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                    >
                        <option value={7}>Last 7 Days</option>
                        <option value={30}>Last 30 Days</option>
                        <option value={90}>Last 90 Days</option>
                        <option value={365}>Last 1 Year</option>
                        <option value={730}>Last 2 Years</option>
                        <option value={1095}>Last 3 Years</option>
                        <option value={1825}>Last 5 Years</option>
                        <option value={2555}>Last 7 Years</option>
                        <option value={3650}>Last 10 Years</option>
                        <option value={5475}>Last 15 Years</option>
                        <option value={7300}>Last 20 Years</option>
                    </select>
                </div>
            </div>

            <ChartContainer
                datasets={stats}
                title={`${title} LOC Trend`}
                timeRange={timeRange}
            />
        </>
    );
};

export default Dashboard;
