import React from 'react';
import { FiPlus, FiBox, FiTrash2, FiRefreshCw } from 'react-icons/fi';

const Sidebar = ({ repositories, viewMode, selectedRepoIds, onSelectAll, onToggleRepo, onAddClick, onDeleteRepo, onSyncRepo }) => {
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
                        Total View
                    </div>
                </div>

                {repositories.map(repo => (
                    <div
                        key={repo.id}
                        className={`repo-item ${viewMode === 'selected' && selectedRepoIds.includes(repo.id) ? 'active' : ''}`}
                        onClick={() => onToggleRepo(repo.id)}
                        style={{ position: 'relative' }}
                    >
                        <div className="repo-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '24px' }}>
                            <input
                                type="checkbox"
                                checked={selectedRepoIds.includes(repo.id)}
                                onChange={() => onToggleRepo(repo.id)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                            />
                            {repo.name}
                        </div>
                        <div className="repo-path-info">
                            <span className="repo-path" title={repo.path}>{repo.path}</span>
                            {repo.include_path && (
                                <span className="sub-path" title={`Sub-directory: ${repo.include_path}`}>
                                    /{repo.include_path}
                                </span>
                            )}
                        </div>
                        <div className="repo-status">
                            <span className={`status-dot ${repo.status}`}></span>
                            {repo.status === 'backfilling' ? 'Analyzing...' : repo.status}
                        </div>
                        <div className="repo-actions">
                            <button
                                className="action-repo-btn sync"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSyncRepo(repo.id);
                                }}
                                title="Sync Now"
                            >
                                <FiRefreshCw size={13} />
                            </button>
                            <button
                                className="action-repo-btn delete"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteRepo(repo.id);
                                }}
                                title="Delete Repository"
                            >
                                <FiTrash2 size={13} />
                            </button>
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
