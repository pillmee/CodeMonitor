import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiPlus, FiSettings, FiActivity, FiRefreshCw } from 'react-icons/fi';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AddRepoModal from './components/AddRepoModal';

// 현재 페이지의 호스트네임을 기반으로 API 주소 동적 생성
// 프록시 설정을 위해 기본값을 '/api'로 변경하여 같은 Origin으로 요청을 보내도록 함
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

function App() {
  const [repositories, setRepositories] = useState([]);
  // viewMode: 'all' (합산 단일선) or 'selected' (개별 multi-line)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('cm_view_mode') || 'all';
  });
  const [selectedRepoIds, setSelectedRepoIds] = useState(() => {
    try {
      const saved = localStorage.getItem('cm_selected_repos');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRepositories = async () => {
    try {
      const res = await axios.get(`${API_BASE}/repos`);
      const repos = res.data.repositories || [];
      setRepositories(repos);

      // 서버에서 가져온 목록에 없는 ID가 브라우저에 저장되어 있다면 필터링 (동기화)
      setSelectedRepoIds(prev => {
        const repoIds = repos.map(r => r.id);
        const filtered = prev.filter(id => repoIds.includes(id));
        return filtered.length !== prev.length ? filtered : prev;
      });
    } catch (err) {
      console.error('Failed to fetch repos', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    localStorage.setItem('cm_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('cm_selected_repos', JSON.stringify(selectedRepoIds));
  }, [selectedRepoIds]);

  const handleSelectAll = () => {
    setViewMode('all');
    setSelectedRepoIds([]);
  };

  const handleToggleRepo = (repoId) => {
    setSelectedRepoIds(prev => {
      const next = prev.includes(repoId)
        ? prev.filter(id => id !== repoId)
        : [...prev, repoId];
      return next;
    });
    setViewMode('selected');
  };

  const handleAddRepo = async (name, path, include_path) => {
    try {
      await axios.post(`${API_BASE}/repos`, { name, path, include_path });
      fetchRepositories();
      setIsModalOpen(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error adding repository');
    }
  };

  const handleDeleteRepo = async (repoId) => {
    if (!window.confirm('Are you sure you want to delete this repository and all its history?')) {
      return;
    }
    try {
      await axios.delete(`${API_BASE}/repos/${repoId}`);
      fetchRepositories();
      // 삭제된 저장소가 선택되어 있었다면 제거
      setSelectedRepoIds(prev => prev.filter(id => id !== repoId));
    } catch (err) {
      alert(err.response?.data?.detail || 'Error deleting repository');
    }
  };

  const handleSyncRepo = async (repoId) => {
    try {
      await axios.post(`${API_BASE}/repos/${repoId}/sync`);
      alert('Sync started in the background.');
      // 상태 업데이트를 위해 목록 리프레시 (optional, but good for status reflected)
      fetchRepositories();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error starting sync');
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        repositories={repositories}
        viewMode={viewMode}
        selectedRepoIds={selectedRepoIds}
        onSelectAll={handleSelectAll}
        onToggleRepo={handleToggleRepo}
        onAddClick={() => setIsModalOpen(true)}
        onDeleteRepo={handleDeleteRepo}
        onSyncRepo={handleSyncRepo}
      />

      <div className="main-content">
        <div className="header-actions">
          <button className="btn-icon" onClick={fetchRepositories} title="Refresh">
            <FiRefreshCw />
          </button>
          <button className="btn-icon" title="Settings">
            <FiSettings />
          </button>
        </div>

        <Dashboard
          viewMode={viewMode}
          selectedRepoIds={selectedRepoIds}
          apiBase={API_BASE}
          repositories={repositories}
        />
      </div>

      {isModalOpen && (
        <AddRepoModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleAddRepo}
        />
      )}
    </div>
  );
}

export default App;
