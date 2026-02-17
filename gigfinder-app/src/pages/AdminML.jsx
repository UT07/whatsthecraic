import React, { useCallback, useEffect, useState } from 'react';
import mlAPI from '../services/mlAPI';

const AdminML = () => {
  const [modelInfo, setModelInfo] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [experimentResults, setExperimentResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [toast, setToast] = useState(null);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [model, expList] = await Promise.all([
        mlAPI.getModelInfo(),
        mlAPI.getExperiments()
      ]);

      setModelInfo(model);
      setExperiments(expList);

      // Load results for each experiment
      if (Array.isArray(expList) && expList.length > 0) {
        const results = {};
        await Promise.all(
          expList.map(async (exp) => {
            if (exp.id || exp.experiment_id) {
              const expId = exp.id || exp.experiment_id;
              const result = await mlAPI.getExperimentResults(expId);
              results[expId] = result;
            }
          })
        );
        setExperimentResults(results);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      await mlAPI.triggerRetrain();
      showToast('Model retrained successfully!', 'success');
      // Refresh model info after retrain
      const updatedModel = await mlAPI.getModelInfo();
      setModelInfo(updatedModel);
    } catch (error) {
      console.error('Retrain error:', error);
      showToast('Failed to retrain model', 'error');
    } finally {
      setRetraining(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getLatencyColor = (latency) => {
    if (!latency) return 'text-gray-400';
    if (latency < 100) return 'text-emerald-400';
    if (latency < 200) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getLatencyBg = (latency) => {
    if (!latency) return 'bg-gray-800';
    if (latency < 100) return 'bg-emerald-900/30 border-emerald-500/30';
    if (latency < 200) return 'bg-yellow-900/30 border-yellow-500/30';
    return 'bg-red-900/30 border-red-500/30';
  };

  const getSignificanceColor = (pValue) => {
    if (pValue == null) return 'text-gray-400';
    return pValue < 0.05 ? 'text-emerald-400' : 'text-gray-400';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatMetric = (value, decimals = 2) => {
    if (value == null) return 'N/A';
    if (typeof value === 'number') return value.toFixed(decimals);
    return value;
  };

  if (loading) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-muted">Loading ML dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="card">
        <div className="badge mb-2">Admin</div>
        <h1 className="section-title">ML Model Dashboard</h1>
        <p className="section-subtitle">Monitor model health, A/B experiments, and trigger retraining</p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`card ${toast.type === 'success' ? 'bg-emerald-900/30 border-emerald-500/30' : 'bg-red-900/30 border-red-500/30'}`}>
          <p className={toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'}>
            {toast.message}
          </p>
        </div>
      )}

      {/* Model Health Widget */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 text-white">Model Health</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Model Version</div>
            <div className="text-lg font-semibold text-emerald-400">
              {modelInfo?.model_version || 'Unknown'}
            </div>
          </div>

          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Last Trained</div>
            <div className="text-lg font-semibold text-white">
              {formatDate(modelInfo?.last_trained)}
            </div>
          </div>

          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Training Samples</div>
            <div className="text-lg font-semibold text-white">
              {modelInfo?.training_samples?.toLocaleString() || 0}
            </div>
          </div>

          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Prediction Count</div>
            <div className="text-lg font-semibold text-white">
              {modelInfo?.prediction_count?.toLocaleString() || 0}
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${getLatencyBg(modelInfo?.avg_latency)}`}>
            <div className="text-sm text-gray-400 mb-1">Avg Latency</div>
            <div className={`text-lg font-semibold ${getLatencyColor(modelInfo?.avg_latency)}`}>
              {modelInfo?.avg_latency ? `${modelInfo.avg_latency.toFixed(1)}ms` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {modelInfo?.avg_latency && modelInfo.avg_latency < 100 && 'Excellent'}
              {modelInfo?.avg_latency && modelInfo.avg_latency >= 100 && modelInfo.avg_latency < 200 && 'Good'}
              {modelInfo?.avg_latency && modelInfo.avg_latency >= 200 && 'Slow'}
            </div>
          </div>

          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Validation Metrics</div>
            {modelInfo?.validation_metrics ? (
              <div className="text-sm space-y-1">
                {Object.entries(modelInfo.validation_metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-400">{key}:</span>
                    <span className="text-white font-semibold">{formatMetric(value, 3)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white">No metrics available</div>
            )}
          </div>
        </div>

        {/* Manual Retrain Button */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <button
            className="btn btn-primary"
            onClick={handleRetrain}
            disabled={retraining}
          >
            {retraining ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Retraining Model...
              </span>
            ) : (
              'Retrain Model Now'
            )}
          </button>
          <p className="text-sm text-gray-400 mt-2">
            Manually trigger model retraining with latest user interaction data
          </p>
        </div>
      </div>

      {/* A/B Experiment Results Dashboard */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 text-white">A/B Experiment Results</h2>
        {!experiments || experiments.length === 0 ? (
          <p className="text-gray-400">No active experiments</p>
        ) : (
          <div className="space-y-6">
            {experiments.map((exp) => {
              const expId = exp.id || exp.experiment_id;
              const results = experimentResults[expId];

              return (
                <div key={expId} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-white">{exp.name || expId}</h3>
                    {exp.description && (
                      <p className="text-sm text-gray-400 mt-1">{exp.description}</p>
                    )}
                  </div>

                  {results && results.variants && results.variants.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="text-left py-2 px-3 text-gray-400 font-medium">Variant</th>
                            <th className="text-right py-2 px-3 text-gray-400 font-medium">Users</th>
                            <th className="text-right py-2 px-3 text-gray-400 font-medium">Conversions</th>
                            <th className="text-right py-2 px-3 text-gray-400 font-medium">Conv. Rate</th>
                            <th className="text-right py-2 px-3 text-gray-400 font-medium">p-value</th>
                            <th className="text-right py-2 px-3 text-gray-400 font-medium">Significant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.variants.map((variant, idx) => (
                            <tr key={idx} className="border-b border-gray-800">
                              <td className="py-2 px-3 text-white font-medium">
                                {variant.variant_name || variant.name || `Variant ${idx + 1}`}
                              </td>
                              <td className="text-right py-2 px-3 text-white">
                                {variant.user_count?.toLocaleString() || 0}
                              </td>
                              <td className="text-right py-2 px-3 text-white">
                                {variant.conversions?.toLocaleString() || 0}
                              </td>
                              <td className="text-right py-2 px-3 text-white">
                                {variant.conversion_rate != null
                                  ? `${(variant.conversion_rate * 100).toFixed(2)}%`
                                  : 'N/A'}
                              </td>
                              <td className="text-right py-2 px-3 text-white">
                                {variant.p_value != null ? variant.p_value.toFixed(4) : 'N/A'}
                              </td>
                              <td className="text-right py-2 px-3">
                                <span className={getSignificanceColor(variant.p_value)}>
                                  {variant.p_value != null && variant.p_value < 0.05 ? '✓ Yes' : '○ No'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No results available yet</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="card bg-gray-800/30">
        <div className="text-sm text-gray-400">
          <p className="mb-2">
            <strong className="text-white">Latency Indicators:</strong> Green (&lt;100ms) = Excellent, Yellow (100-200ms) = Good, Red (&gt;200ms) = Slow
          </p>
          <p>
            <strong className="text-white">Statistical Significance:</strong> p-value &lt; 0.05 indicates statistically significant results
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminML;
