"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Settings, Activity, ShieldCheck, AlertTriangle, FileText, ChevronRight, CheckCircle2, BarChart2, PieChart } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ReferenceLine, Cell, LineChart, Line 
} from "recharts";
import axios from "axios";

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [config, setConfig] = useState({
    target_col: "",
    sensitive_col: "",
    model_name: "Logistic Regression",
    mitigation: "ExponentiatedGradient (DemographicParity)",
    test_size: 20
  });
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const loadSample = (type: "loan" | "hiring" | "hospital") => {
    // In a real app, you would fetch these files, but here we just prefill config
    if (type === "loan") setConfig({ ...config, target_col: "loan_approved", sensitive_col: "gender" });
    if (type === "hiring") setConfig({ ...config, target_col: "hired", sensitive_col: "gender" });
    if (type === "hospital") setConfig({ ...config, target_col: "high_risk_diagnosis", sensitive_col: "race" });
  };

  const handleRunAudit = async () => {
    if (!file) {
      setError("Please upload a dataset first.");
      return;
    }
    if (!config.target_col || !config.sensitive_col) {
      setError("Please provide Target and Sensitive columns.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_col", config.target_col);
    formData.append("sensitive_col", config.sensitive_col);
    formData.append("model_name", config.model_name);
    formData.append("mitigation", config.mitigation);
    formData.append("test_size_pct", config.test_size.toString());

    try {
      const response = await axios.post("/api/audit", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setResults(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "An error occurred during the audit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {/* Sidebar Configuration */}
      <div className="w-full lg:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 shrink-0 z-10 shadow-xl">
        <div className="flex items-center gap-3 text-indigo-400">
          <ShieldCheck className="w-8 h-8" />
          <h1 className="text-xl font-bold tracking-tight text-white">FairAI Audit</h1>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4" /> 1. Dataset
            </h3>
            <div className="relative group">
              <input 
                type="file" 
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              />
              <div className="p-4 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/50 group-hover:border-indigo-500 group-hover:bg-slate-800 transition-all text-center">
                {file ? (
                  <span className="text-indigo-400 font-medium flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" /> {file.name}
                  </span>
                ) : (
                  <span className="text-slate-400 text-sm">Drop CSV here or click to browse</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2 mt-6">
              <Settings className="w-4 h-4" /> 2. Configuration
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Target Column</label>
                <input 
                  type="text" 
                  value={config.target_col}
                  onChange={(e) => setConfig({...config, target_col: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g. loan_approved"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Sensitive Attribute</label>
                <input 
                  type="text" 
                  value={config.sensitive_col}
                  onChange={(e) => setConfig({...config, sensitive_col: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g. gender"
                />
              </div>
              
              <div className="pt-2">
                <label className="text-xs text-slate-400 mb-1 block">ML Model</label>
                <select 
                  value={config.model_name}
                  onChange={(e) => setConfig({...config, model_name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option>Logistic Regression</option>
                  <option>Random Forest</option>
                  <option>Decision Tree</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Mitigation Strategy</label>
                <select 
                  value={config.mitigation}
                  onChange={(e) => setConfig({...config, mitigation: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option>ExponentiatedGradient (DemographicParity)</option>
                  <option>ExponentiatedGradient (EqualizedOdds)</option>
                  <option>ThresholdOptimizer</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <button 
            onClick={handleRunAudit}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Run Fairness Audit <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
          
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 lg:p-10 relative overflow-x-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        {!results && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto z-10 relative">
            <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-6 border border-slate-700/50 shadow-2xl">
              <Activity className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Detect & Mitigate Bias in AI</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Upload your dataset and configure the target variables to run a comprehensive fairness audit. The system will train a model, measure demographic disparity, and apply mathematical mitigation techniques to ensure fair outcomes.
            </p>
            <div className="grid grid-cols-3 gap-3 w-full">
              <button onClick={() => loadSample("loan")} className="py-2 px-4 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors border border-slate-700">Loan Data</button>
              <button onClick={() => loadSample("hiring")} className="py-2 px-4 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors border border-slate-700">Hiring Data</button>
              <button onClick={() => loadSample("hospital")} className="py-2 px-4 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors border border-slate-700">Hospital Data</button>
            </div>
          </div>
        )}

        {loading && (
          <div className="h-full flex flex-col items-center justify-center z-10 relative">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
              <ShieldCheck className="absolute inset-0 m-auto w-8 h-8 text-indigo-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Analyzing Dataset & Training Models...</h3>
            <p className="text-slate-400">Applying fairness constraints and evaluating metrics</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {results && !loading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="z-10 relative space-y-6"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-teal-400" />
                    Fairness Audit Complete
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">Review the bias metrics and model diagnostics below.</p>
                </div>
                
                {/* Metric Badges */}
                <div className="flex gap-4">
                  <div className="bg-slate-800/80 backdrop-blur border border-slate-700 px-4 py-2 rounded-xl text-center">
                    <div className="text-xs text-slate-400 uppercase font-semibold">Fairness Score</div>
                    <div className="text-xl font-bold text-white">{(results.metrics.fairness_score * 100).toFixed(1)}%</div>
                  </div>
                  <div className="bg-slate-800/80 backdrop-blur border border-slate-700 px-4 py-2 rounded-xl text-center">
                    <div className="text-xs text-slate-400 uppercase font-semibold">Accuracy Drop</div>
                    <div className="text-xl font-bold text-white">
                      {((results.metrics.accuracy_mitigated - results.metrics.accuracy_base) * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                 
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-xl w-fit mb-6">
                {["overview", "diagnostics", "groups"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab 
                        ? "bg-indigo-500 text-white shadow-md" 
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === "overview" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bias Mitigation Plot */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-indigo-400" />
                      Bias Mitigation Results
                    </h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: "Before Mitigation", value: results.metrics.dpd_before },
                          { name: "After Mitigation", value: results.metrics.dpd_after }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                          <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8'}} label={{ value: 'Demographic Parity Diff', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                          <Tooltip 
                            cursor={{fill: '#334155', opacity: 0.4}}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                          />
                          <ReferenceLine y={0.1} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Fairness Threshold', fill: '#ef4444', fontSize: 12 }} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {
                              [0, 1].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#10b981'} />
                              ))
                            }
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Group Rates Plot */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-indigo-400" />
                      Decision Rate per Group
                    </h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={results.charts.rates_before.map((b: any, i: number) => ({
                          group: b.group,
                          "Rate Before": b.rate,
                          "Rate After": results.charts.rates_after[i].rate
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="group" stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                          <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                          <Tooltip 
                            cursor={{fill: '#334155', opacity: 0.4}}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                          />
                          <Legend />
                          <Bar dataKey="Rate Before" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Rate After" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "diagnostics" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Feature Importances Plot */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-400" />
                      Feature Impact
                    </h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={results.charts.feature_importances} margin={{ left: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                          <XAxis type="number" stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                          <YAxis dataKey="feature" type="category" stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 12}} />
                          <Tooltip 
                            cursor={{fill: '#334155', opacity: 0.4}}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {
                              results.charts.feature_importances.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.is_sensitive ? '#ef4444' : '#6366f1'} />
                              ))
                            }
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* CV Scores Plot */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                      Model Robustness (Cross-Validation)
                    </h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={results.charts.cv_scores}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="fold" stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                          <YAxis domain={['auto', 'auto']} stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                          />
                          <ReferenceLine y={results.metrics.cv_mean} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'top', value: 'Mean Accuracy', fill: '#10b981', fontSize: 12 }} />
                          <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', strokeWidth: 2, r: 6 }} activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "groups" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-400 text-sm uppercase tracking-wider">
                          <th className="pb-4 font-semibold px-4">Group</th>
                          <th className="pb-4 font-semibold px-4">Count (Test)</th>
                          <th className="pb-4 font-semibold px-4">True Pos Rate</th>
                          <th className="pb-4 font-semibold px-4">Rate BEFORE</th>
                          <th className="pb-4 font-semibold px-4">Rate AFTER</th>
                          <th className="pb-4 font-semibold px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-300">
                        {results.group_table.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                            <td className="py-4 px-4 font-medium text-white">{row.group}</td>
                            <td className="py-4 px-4">{row.n_test}</td>
                            <td className="py-4 px-4">{(row.tpr * 100).toFixed(1)}%</td>
                            <td className="py-4 px-4 text-red-400">{(row.rate_before * 100).toFixed(1)}%</td>
                            <td className="py-4 px-4 text-teal-400 font-medium">{(row.rate_after * 100).toFixed(1)}%</td>
                            <td className="py-4 px-4">
                              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                row.bias_flag === 'Fair' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                row.bias_flag === 'Moderate' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {row.bias_flag}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
