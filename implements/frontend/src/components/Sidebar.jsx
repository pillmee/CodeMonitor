import React from 'react';
import { FiPlus, FiBox } from 'react-icons/fi';

const Sidebar = ({ repositories, viewMode, selectedRepoIds, onSelectAll, onToggleRepo, onAddClick }) => {
    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div className="logo">
                    <FiBox /> CodeMonitor
                </div>
            </div>

            <div className="repo-list">
                <div
                    className={`repo-item ${viewMode === 'all' ? 'active' : ''}`}
                    onClick={onSelectAll}
                >
                    <div className="repo-name">All Repositories</div>
                    <div className="repo-status">
                        <span className="status-dot idle"></span>
                        Combined View
                    </div>
                </div>

                {repositories.map(repo => (
                    <div
                        key={repo.id}
                        className={`repo-item ${viewMode === 'selected' && selectedRepoIds.includes(repo.id) ? 'active' : ''}`}
                        onClick={() => onToggleRepo(repo.id)}
                    >
                        <div className="repo-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="checkbox"
                                checked={selectedRepoIds.includes(repo.id)}
                                onChange={() => onToggleRepo(repo.id)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                            />
                            {repo.name}
                        </div>
                        <div className="repo-status">
                            <span className={`status-dot ${repo.status}`}></span>
                            {repo.status === 'backfilling' ? 'Analyzing...' : repo.status}
                        </div>
                    </div>
                ))}
            </div>

            <button className="add-repo-btn" onClick={onAddClick}>
                <FiPlus /> Add Repository
            </button>
        </div>
    );
};

export default Sidebar;
