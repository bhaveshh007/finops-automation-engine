import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { 
  ShieldCheck, DollarSign, Server, Clock, Power, Play, RefreshCw, 
  AlertTriangle, Database, History, CheckCircle2, Sliders, Tag, 
  Download, Search, Filter, Layers, Calculator, ArrowUpRight
} from 'lucide-react';

const API_BASE = 'https://geu3qm2rsh.execute-api.ap-south-1.amazonaws.com/prod/api';

const mockChartData = [
  { month: 'May', unoptimized: 1200, optimized: 850 },
  { month: 'Jun', unoptimized: 1350, optimized: 890 },
  { month: 'Jul', unoptimized: 1480, optimized: 920 },
  { month: 'Aug', unoptimized: 1600, optimized: 980 },
  { month: 'Sep', unoptimized: 1750, optimized: 1020 },
  { month: 'Oct', unoptimized: 1900, optimized: 1090 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('fleet'); // 'fleet' | 'calculator' | 'governance' | 'audit'
  const [instances, setInstances] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [envFilter, setEnvFilter] = useState('ALL');

  // ROI Calculator State
  const [calcNodes, setCalcNodes] = useState(5);
  const [calcHourlyRate, setCalcHourlyRate] = useState(0.096); // typical m5.large
  const [calcOffHours, setCalcOffHours] = useState(12);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/instances`);
      if (!res.ok) throw new Error('API fetch failed');
      const data = await res.json();
      setInstances(data);
    } catch (err) {
      console.error('Error fetching instances:', err);
      showToast('Error syncing with AWS ap-south-1');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await fetch(`${API_BASE}/audit-logs`);
      if (!res.ok) throw new Error('Audit logs fetch failed');
      const data = await res.json();
      setAuditLogs(data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const refreshAll = () => {
    fetchInstances();
    fetchAuditLogs();
  };

  useEffect(() => {
    fetchInstances();
    fetchAuditLogs();
  }, []);

  const handleAction = async (instanceId, currentStatus, env) => {
    if (env === 'prod') {
      showToast('Guardrail Alert: Production instances are locked');
      return;
    }

    const targetAction = currentStatus.toLowerCase() === 'running' ? 'STOP' : 'START';

    try {
      setActionLoading(instanceId);
      const res = await fetch(`${API_BASE}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId, action: targetAction })
      });
      const result = await res.json();

      if (res.ok) {
        showToast(`EC2 ${targetAction} dispatched & saved to DynamoDB!`);
        setTimeout(() => {
          fetchInstances();
          fetchAuditLogs();
        }, 2000);
      } else {
        showToast(result.error || 'Action failed on cloud');
      }
    } catch (err) {
      console.error('Action error:', err);
      showToast('Network error contacting API Gateway');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkStopDev = async () => {
    if (!window.confirm('Are you sure you want to STOP all non-production instances?')) return;
    try {
      setBulkLoading(true);
      const res = await fetch(`${API_BASE}/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEnv: 'dev', action: 'STOP' })
      });
      if (res.ok) {
        showToast('All Dev Instances stopped! Zero off-hours spend enforced.');
        setTimeout(() => {
          fetchInstances();
          fetchAuditLogs();
        }, 2500);
      }
    } catch (err) {
      showToast('Failed to trigger bulk action');
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleAutoScheduleTag = async (instanceId, currentVal) => {
    const newVal = currentVal === 'true' ? 'false' : 'true';
    try {
      showToast(`Updating tag AutoSchedule=${newVal}...`);
      const res = await fetch(`${API_BASE}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId, tagKey: 'AutoSchedule', tagValue: newVal })
      });
      if (res.ok) {
        showToast(`Tag successfully synchronized on AWS EC2!`);
        fetchInstances();
        fetchAuditLogs();
      }
    } catch (err) {
      showToast('Tag update failed');
    }
  };

  const exportAuditLogsCSV = () => {
    if (auditLogs.length === 0) {
      showToast('No logs available to export');
      return;
    }
    const headers = ['Timestamp', 'InstanceId', 'Action', 'TriggeredBy', 'EstimatedSavingsUSD', 'Status'];
    const rows = auditLogs.map(l => [
      `"${l.Timestamp || ''}"`,
      `"${l.InstanceId || ''}"`,
      `"${l.Action || ''}"`,
      `"${l.TriggeredBy || ''}"`,
      `"${l.EstimatedSavingsUSD || '0.00'}"`,
      `"${l.Status || 'RECORDED'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FinOps_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Audit Log CSV Downloaded!');
  };

  // Calculations for ROI tab
  const monthlySavingsPerNode = (calcHourlyRate * calcOffHours * 22).toFixed(2);
  const totalMonthlySavings = (monthlySavingsPerNode * calcNodes).toFixed(2);
  const totalAnnualSavings = (totalMonthlySavings * 12).toFixed(2);

  // Filtered Instances
  const filteredInstances = instances.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          i.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEnv = envFilter === 'ALL' || i.env.toLowerCase() === envFilter.toLowerCase();
    return matchesSearch && matchesEnv;
  });

  return (
    <div className="min-h-screen p-6 lg:p-10 bg-[#0b0f17] text-slate-100 font-sans selection:bg-emerald-500/30">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 border border-emerald-500/40 text-emerald-400 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 text-sm animate-bounce">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                FinOps Control Plane <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded font-mono">v2.4 Live</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Tag-Based Cost Governance & Automated Workload Engine (AWS ap-south-1)</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleBulkStopDev}
            disabled={bulkLoading}
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg transition text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Immediately stop all dev nodes to prevent weekend idle cost leaks"
          >
            <Power className="w-3.5 h-3.5" />
            {bulkLoading ? 'Shutting dev...' : 'Emergency Stop Dev Workloads'}
          </button>

          <button 
            onClick={refreshAll}
            disabled={loading || logsLoading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || logsLoading ? 'animate-spin text-emerald-400' : ''}`} />
            Sync Cloud
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 mb-8 space-x-1">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition cursor-pointer ${
            activeTab === 'fleet' 
              ? 'border-emerald-400 text-emerald-400 bg-emerald-400/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-4 h-4" /> Live Fleet & CRUD
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition cursor-pointer ${
            activeTab === 'calculator' 
              ? 'border-emerald-400 text-emerald-400 bg-emerald-400/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calculator className="w-4 h-4" /> ROI & Cost Modeling
        </button>
        <button
          onClick={() => setActiveTab('governance')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition cursor-pointer ${
            activeTab === 'governance' 
              ? 'border-emerald-400 text-emerald-400 bg-emerald-400/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Tag className="w-4 h-4" /> Tag Policy & Compliance
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition cursor-pointer ${
            activeTab === 'audit' 
              ? 'border-emerald-400 text-emerald-400 bg-emerald-400/5' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" /> DynamoDB Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* ================================= TAB 1: FLEET & LIVE CRUD ================================= */}
      {activeTab === 'fleet' && (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#131926] p-5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase font-medium">Monthly Cost Reduced</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">$810.00</div>
              <span className="text-xs text-emerald-400 mt-1 inline-block">42.6% compute reduction</span>
            </div>
            <div className="bg-[#131926] p-5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase font-medium">Governed Instances</span>
                <Server className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{instances.length} EC2 Nodes</div>
              <span className="text-xs text-slate-400 mt-1 inline-block">ap-south-1 Region</span>
            </div>
            <div className="bg-[#131926] p-5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase font-medium">Automated Off-Hours</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">12 hrs/day</div>
              <span className="text-xs text-slate-400 mt-1 inline-block">Mon-Fri Policy</span>
            </div>
            <div className="bg-[#131926] p-5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase font-medium">Prod Blast Radius</span>
                <ShieldCheck className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-400 mt-2">Zero Exposure</div>
              <span className="text-xs text-purple-400 mt-1 inline-block">Strict IAM condition checks</span>
            </div>
          </div>

          {/* Cost Trajectory Chart */}
          <div className="bg-[#131926] p-6 rounded-xl border border-slate-800 mb-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-semibold uppercase text-slate-300 tracking-wider">
                  Compute Spend Trajectory (Unmanaged Baseline vs FinOps Governed)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Automated schedules vs 24/7 continuous run baseline</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Unmanaged
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Optimized
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockChartData}>
                  <defs>
                    <linearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#475569" fontSize={12} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={12} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} 
                    formatter={(val) => [`$${val}`, '']}
                  />
                  <Area type="monotone" dataKey="unoptimized" stroke="#ef4444" fillOpacity={0} strokeWidth={2} name="Unmanaged" />
                  <Area type="monotone" dataKey="optimized" stroke="#10b981" fillOpacity={1} fill="url(#optGrad)" strokeWidth={2} name="Optimized Spend" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-[#131926] p-4 rounded-xl border border-slate-800 mb-6 flex flex-col md:flex-row justify-between gap-4">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-1.5 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by instance ID or tag name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-200 focus:outline-none w-full"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Environment:
              </span>
              <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                {['ALL', 'DEV', 'PROD'].map(env => (
                  <button
                    key={env}
                    onClick={() => setEnvFilter(env)}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition ${
                      envFilter === env ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {env}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* EC2 Instance CRUD Table */}
          <div className="bg-[#131926] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-semibold uppercase text-slate-300 tracking-wider">
                  Target Infrastructure Controls ({filteredInstances.length} Nodes)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Live CRUD actions with automatic DynamoDB audit logging</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-4">Instance Identity</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Environment Tag</th>
                    <th className="p-4">Runtime State</th>
                    <th className="p-4">Schedule Rule</th>
                    <th className="p-4 text-right">Direct Cloud Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredInstances.map((inst) => {
                    const isRunning = inst.status.toLowerCase() === 'running';
                    const isProd = inst.env === 'prod';
                    const isBusy = actionLoading === inst.id;

                    return (
                      <tr key={inst.id} className="hover:bg-slate-800/25 transition">
                        <td className="p-4">
                          <div className="font-medium text-white flex items-center gap-2">
                            {inst.name}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{inst.id}</div>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-400">{inst.type}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isProd 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {inst.env.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            isRunning ? 'text-emerald-400' : 'text-slate-400'
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${
                              isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                            }`}></span>
                            {inst.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-400">{inst.schedule}</td>
                        <td className="p-4 text-right">
                          {isProd ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-500">
                              <AlertTriangle className="w-3 h-3 text-rose-500/70" /> Protected (Zero-Trust)
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAction(inst.id, inst.status, inst.env)}
                              disabled={isBusy}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer border ${
                                isRunning 
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30' 
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              } disabled:opacity-50`}
                            >
                              {isBusy ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              ) : isRunning ? (
                                <><Power className="w-3.5 h-3.5" /> Stop Server</>
                              ) : (
                                <><Play className="w-3.5 h-3.5" /> Start Server</>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ================================= TAB 2: ROI CALCULATOR ================================= */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-[#131926] p-6 rounded-xl border border-slate-800 lg:col-span-1">
            <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" /> Cost Savings Simulator
            </h2>
            <p className="text-xs text-slate-400 mb-6">Adjust parameters to simulate annual organization savings with automated off-hours scheduling.</p>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex justify-between">
                  <span>Number of Non-Prod Nodes</span>
                  <span className="text-emerald-400 font-mono text-sm">{calcNodes} instances</span>
                </label>
                <input 
                  type="range" min="1" max="50" value={calcNodes}
                  onChange={(e) => setCalcNodes(Number(e.target.value))}
                  className="w-full mt-2 accent-emerald-400 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex justify-between">
                  <span>Instance Hourly Cost ($ USD)</span>
                  <span className="text-emerald-400 font-mono text-sm">${calcHourlyRate}/hr</span>
                </label>
                <select 
                  value={calcHourlyRate}
                  onChange={(e) => setCalcHourlyRate(Number(e.target.value))}
                  className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200"
                >
                  <option value={0.0104}>t3.micro ($0.0104/hr) - Micro Services</option>
                  <option value={0.0416}>t3.medium ($0.0416/hr) - General Dev</option>
                  <option value={0.096}>m5.large ($0.0960/hr) - Standard Backend</option>
                  <option value={0.192}>m5.xlarge ($0.1920/hr) - Heavy Staging</option>
                  <option value={0.384}>c5.2xlarge ($0.3840/hr) - Compute Intensive</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex justify-between">
                  <span>Daily Off-Hours Shutdown</span>
                  <span className="text-emerald-400 font-mono text-sm">{calcOffHours} hrs / day</span>
                </label>
                <input 
                  type="range" min="8" max="16" value={calcOffHours}
                  onChange={(e) => setCalcOffHours(Number(e.target.value))}
                  className="w-full mt-2 accent-emerald-400 cursor-pointer"
                />
                <span className="text-[11px] text-slate-500 mt-1 inline-block">7:00 PM to 7:00 AM off-shift coverage</span>
              </div>
            </div>
          </div>

          <div className="bg-[#131926] p-8 rounded-xl border border-slate-800 lg:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Projected Financial Impact</h3>
                  <p className="text-xs text-slate-400">Calculated on a standard 22 working day / month schedule</p>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full">
                  Up to ~55% Compute Savings
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Savings / Instance</span>
                  <div className="text-xl font-bold text-white mt-1">${monthlySavingsPerNode} <span className="text-xs font-normal text-slate-500">/mo</span></div>
                </div>
                <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Total Monthly Savings</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">${totalMonthlySavings} <span className="text-xs font-normal text-slate-500">/mo</span></div>
                </div>
                <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Annual FinOps Savings</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">${totalAnnualSavings} <span className="text-xs font-normal text-slate-500">/yr</span></div>
                </div>
              </div>
            </div>

            <div className="p-5 bg-emerald-500/5 rounded-xl border border-emerald-500/20 text-xs text-slate-300 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-semibold mb-1">FinOps Best Practice:</strong>
                Shutting down idle development and QA resources during nights and weekends is the fastest non-intrusive way for organizations to reduce AWS cloud waste without modifying any application code.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================= TAB 3: TAG GOVERNANCE ================================= */}
      {activeTab === 'governance' && (
        <div className="bg-[#131926] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" /> Tag Governance & Policy Compliance Auditor
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Toggle live AWS tags directly to enroll or exclude workloads from automated schedules</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="p-4">Target Instance</th>
                  <th className="p-4">Owner Tag</th>
                  <th className="p-4">Environment Tag</th>
                  <th className="p-4">AutoSchedule Tag</th>
                  <th className="p-4">Compliance Status</th>
                  <th className="p-4 text-right">Update Tag via API</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {instances.map(inst => {
                  const isScheduled = inst.autoSchedule === 'true';
                  const isProd = inst.env === 'prod';

                  return (
                    <tr key={inst.id} className="hover:bg-slate-800/25 transition">
                      <td className="p-4">
                        <div className="font-medium text-white">{inst.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{inst.id}</div>
                      </td>
                      <td className="p-4 text-xs text-slate-300">{inst.owner}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                          isProd ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {inst.env.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs">
                        <span className={isScheduled ? 'text-emerald-400' : 'text-slate-500'}>
                          AutoSchedule: {inst.autoSchedule}
                        </span>
                      </td>
                      <td className="p-4">
                        {isProd ? (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Compliant (Prod Guarded)
                          </span>
                        ) : isScheduled ? (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Compliant (Scheduled)
                          </span>
                        ) : (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Excluded (Manual Run)
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {isProd ? (
                          <span className="text-xs text-slate-600 italic">Locked</span>
                        ) : (
                          <button
                            onClick={() => toggleAutoScheduleTag(inst.id, inst.autoSchedule)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs rounded transition cursor-pointer"
                          >
                            Toggle AutoSchedule ({isScheduled ? 'Disable' : 'Enable'})
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================= TAB 4: AUDIT LOGS & EXPORT ================================= */}
      {activeTab === 'audit' && (
        <div className="bg-[#131926] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" /> DynamoDB Live Governance Audit Trail
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Immutable financial tracking and lifecycle state transitions</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={exportAuditLogsCSV}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Export to CSV
              </button>
              <button 
                onClick={fetchAuditLogs}
                disabled={logsLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition border border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} /> Refresh Logs
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="p-4">Timestamp (UTC)</th>
                  <th className="p-4">Target Instance</th>
                  <th className="p-4">Action Dispatched</th>
                  <th className="p-4">Initiator</th>
                  <th className="p-4">Estimated Savings</th>
                  <th className="p-4 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono text-xs">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-slate-500 font-sans">
                      No execution events recorded in DynamoDB yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/25 transition">
                      <td className="p-4 text-slate-300">
                        {log.Timestamp ? log.Timestamp.replace('T', ' ').substring(0, 19) : 'N/A'}
                      </td>
                      <td className="p-4 text-blue-400">{log.InstanceId}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-sans font-semibold ${
                          log.Action?.includes('STOP') 
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' 
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        }`}>
                          {log.Action || 'EXECUTION'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 font-sans">{log.TriggeredBy || 'FinOps Engine'}</td>
                      <td className="p-4 text-emerald-400 font-semibold">
                        {log.EstimatedSavingsUSD ? `+$${log.EstimatedSavingsUSD}` : '$0.00'}
                      </td>
                      <td className="p-4 text-right">
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-sans">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {log.Status || 'RECORDED'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
