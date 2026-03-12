import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../Modal';
import { getWebSocketService } from '../../services';
import './DebugModal.css';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface JobStats {
  running: Record<string, number>;
  finished: Record<string, number>;
  timing: Record<string, number>;
}

type TabId = 'job-stats';

export function DebugModal({ isOpen, onClose }: DebugModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('job-stats');
  const [stats, setStats] = useState<JobStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    const ws = getWebSocketService();
    if (!ws) return;

    try {
      setLoading(true);
      setError(null);
      const response = await ws.getJobStats();
      if (response.success && response.data) {
        setStats(response.data as JobStats);
        setLastUpdate(new Date());
      }
    } catch (err) {
      setError('Failed to fetch job stats');
      console.error('Failed to fetch job stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = async () => {
    const ws = getWebSocketService();
    if (!ws) return;

    try {
      await ws.resetJobStats();
      await fetchStats();
    } catch (err) {
      setError('Failed to reset job stats');
      console.error('Failed to reset job stats:', err);
    }
  };

  // Fetch stats when modal opens and set up auto-refresh
  useEffect(() => {
    if (!isOpen) return;

    fetchStats();
    const interval = setInterval(fetchStats, 3000);

    return () => clearInterval(interval);
  }, [isOpen, fetchStats]);

  // Get all unique function names across all stat types
  const getAllFunctions = (): string[] => {
    if (!stats) return [];
    const functions = new Set<string>();
    Object.keys(stats.running).forEach((fn) => functions.add(fn));
    Object.keys(stats.finished).forEach((fn) => functions.add(fn));
    Object.keys(stats.timing).forEach((fn) => functions.add(fn));
    return Array.from(functions).sort();
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'job-stats', label: 'Job Stats', icon: 'fa-chart-bar' },
  ];

  const renderJobStatsTab = () => {
    const functions = getAllFunctions();

    return (
      <div className="debug-job-stats">
        <div className="debug-toolbar">
          <button className="btn btn-sm btn-secondary" onClick={fetchStats} disabled={loading}>
            <i className={`fa-solid fa-refresh ${loading ? 'fa-spin' : ''}`}></i>
            Refresh
          </button>
          <button className="btn btn-sm btn-danger" onClick={handleReset}>
            <i className="fa-solid fa-trash"></i>
            Reset Stats
          </button>
          {lastUpdate && (
            <span className="debug-last-update">
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>

        {error && <div className="debug-error">{error}</div>}

        {functions.length === 0 ? (
          <div className="debug-empty">
            <i className="fa-solid fa-chart-simple"></i>
            <p>No job statistics collected yet.</p>
            <p className="debug-empty-hint">Run a scan to see metrics here.</p>
          </div>
        ) : (
          <div className="debug-table-container">
            <table className="debug-table">
              <thead>
                <tr>
                  <th>Function</th>
                  <th className="text-center">Running</th>
                  <th className="text-center">Finished</th>
                  <th className="text-right">Avg Time (s)</th>
                </tr>
              </thead>
              <tbody>
                {functions.map((fn) => (
                  <tr key={fn}>
                    <td className="debug-fn-name">{fn}</td>
                    <td className="text-center">
                      {stats?.running[fn] ? (
                        <span className="debug-badge debug-badge-running">
                          {stats.running[fn]}
                        </span>
                      ) : (
                        <span className="debug-badge debug-badge-zero">0</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="debug-badge debug-badge-finished">
                        {stats?.finished[fn] ?? 0}
                      </span>
                    </td>
                    <td className="text-right debug-timing">
                      {(stats?.timing[fn] ?? 0).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Debug Console" size="large">
      <div className="debug-modal">
        <div className="debug-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`debug-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="debug-content">
          {activeTab === 'job-stats' && renderJobStatsTab()}
        </div>
      </div>
    </Modal>
  );
}
