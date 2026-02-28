import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiPlus, FiSettings, FiActivity, FiRefreshCw } from 'react-icons/fi';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AddRepoModal from './components/AddRepoModal';

const API_BASE = 'http://127.0.0.1:8000/api';

function App() {
  const [repositories, setRepositories] = useState([]);
  const [activeRepoId, setActiveRepoId] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRepositories = async () => {
    try {
      const res = await axios.get(`${API_BASE}/repos`);
      setRepositories(res.data.repositories || []);
    } catch (err) {
      console.error('Failed to fetch repos', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositories();
    // 10초마다 풀링하여 상태(backfilling 등) 업데이트
    const interval = setInterval(fetchRepositories, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAddRepo = async (name, path) => {
    try {
      await axios.post(`${API_BASE}/repos`, { name, path });
      fetchRepositories();
      setIsModalOpen(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error adding repository');
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        repositories={repositories}
        activeRepoId={activeRepoId}
        onSelectRepo={setActiveRepoId}
        onAddClick={() => setIsModalOpen(true)}
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
          activeRepoId={activeRepoId}
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
