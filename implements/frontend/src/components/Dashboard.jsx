import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, subDays } from 'date-fns';
import ChartContainer from './ChartContainer';

const Dashboard = ({ activeRepoId, apiBase, repositories }) => {
    const [stats, setStats] = useState([]);
    const [days, setDays] = useState(30);

    const activeRepo = repositories.find(r => r.id === activeRepoId);
    const title = activeRepoId === 'all' ? 'All Repositories Overview' : activeRepo?.name || 'Loading...';

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get(`${apiBase}/stats`, {
                    params: { repo_ids: activeRepoId, days }
                });
                setStats(res.data.datasets || []);
            } catch (err) {
                console.error('Failed to fetch stats', err);
            }
        };

        fetchStats();
    }, [activeRepoId, days, apiBase]);

    // 계산 (가장 최신 데이터 기준)
    let totalLOC = 0;
    let netChange = 0;

    stats.forEach(dataset => {
        if (dataset.data.length > 0) {
            const latest = dataset.data[dataset.data.length - 1].y;
            totalLOC += latest;

            // 24시간 전 (단순화: 두 번째 최근 데이터와 비교 또는 전체 데이터 중 1일전 데이터 찾기)
            // 여기서는 데모를 위해 첫 데이터와 마지막 데이터 비교
            const first = dataset.data[0].y;
            netChange += (latest - first);
        }
    });

    return (
        <>
            <div className="summary-cards">
                <div className="card">
                    <div className="card-title">Total Lines of Code</div>
                    <div className="card-value">{totalLOC.toLocaleString()}</div>
                </div>
                <div className="card">
                    <div className="card-title">{days} Days Net Change</div>
                    <div className="card-value" style={{ color: netChange >= 0 ? 'var(--accent-color)' : 'var(--danger-color)' }}>
                        {netChange > 0 ? '+' : ''}{netChange.toLocaleString()}
                    </div>
                </div>
                <div className="card">
                    <div className="card-title">Time Range</div>
                    <select
                        className="form-control"
                        style={{ width: '120px', marginTop: '10px' }}
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                    >
                        <option value={7}>Last 7 Days</option>
                        <option value={30}>Last 30 Days</option>
                        <option value={90}>Last 90 Days</option>
                        <option value={365}>Last 1 Year</option>
                        <option value={9999}>All Time</option>
                    </select>
                </div>
            </div>

            <ChartContainer
                datasets={stats}
                title={`${title} LOC Trend`}
            />
        </>
    );
};

export default Dashboard;
