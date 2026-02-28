import React from 'react';
import { FiPlus, FiBox } from 'react-icons/fi';

const Sidebar = ({ repositories, activeRepoId, onSelectRepo, onAddClick }) => {
    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div className="logo">
                    <FiBox /> CodeMonitor
                </div>
            </div>

            <div className="repo-list">
                <div
                    className={`repo-item ${activeRepoId === 'all' ? 'active' : ''}`}
                    onClick={() => onSelectRepo('all')}
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
                        className={`repo-item ${activeRepoId === repo.id ? 'active' : ''}`}
                        onClick={() => onSelectRepo(repo.id)}
                    >
                        <div className="repo-name">{repo.name}</div>
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
