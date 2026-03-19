import { useState, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { apiClient } from '../api/client.js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut,
  LayoutDashboard,
  Calculator,
  TrendingUp,
  Shield,
  History,
  Info,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Upload,
  Settings,
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';
import { cn } from '../utils/cn.js';
import { useNavigate } from 'react-router-dom';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Parse a CSV string and return an array-of-objects keyed by header row */
const parseCsv = (text) => {
  const [headerLine, ...lines] = text.trim().split('\n');
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
  return lines
    .filter(l => l.trim())
    .map(line => {
      const values = line.split(',').map(v => v.trim());
      return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] }), {});
    });
};

/** Download any string blob as a file */
const downloadFile = (content, filename, mime = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Generate a sample CSV the user can download as a template */
// Products: 00000000...=Standard Term Life, 11111111...=Endowment Classic, 22222222...=Money Back, 33333333...=ULIP Growth
const SAMPLE_CSV = `product_id,age,policy_term,premium_payment_term,premium_amount
00000000-0000-0000-0000-000000000000,30,20,15,50000
11111111-1111-1111-1111-111111111111,35,25,20,75000
22222222-2222-2222-2222-222222222222,40,20,15,100000
33333333-3333-3333-3333-333333333333,28,30,25,40000
00000000-0000-0000-0000-000000000000,45,20,15,60000`;

// ─── component ───────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // ── individual form state ──
  const [formData, setFormData] = useState({
    product_id: '00000000-0000-0000-0000-000000000000',
    age: 30,
    policy_term: 20,
    premium_payment_term: 15,
    premium_amount: 50000,
  });

  // ── result state ──
  const [illustration, setIllustration] = useState(null);   // individual: array of year rows
  const [batchData, setBatchData]       = useState(null);   // bulk: { id, results[] }
  const [viewMode, setViewMode]         = useState('individual'); // 'individual' | 'bulk'

  // ── expanded bulk row (drill-down) ──
  const [expandedRow, setExpandedRow] = useState(null);     // request_id string or null

  // ── ui state ──
  const [loading, setLoading]           = useState(false);
  const [bulkStatus, setBulkStatus]     = useState('');     // status message during poll
  const [error, setError]               = useState('');

  // ─── form change ─────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'product_id' ? value : Number(value),
    }));
  };

  // ─── individual calculate ─────────────────────────────────────────────────
  const calculateBenefits = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.post('/calculations/calculate', formData);
      setIllustration(data.data);
      setBatchData(null);
      setViewMode('individual');
      setExpandedRow(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Calculation failed.');
    } finally {
      setLoading(false);
    }
  };

  // ─── bulk CSV flow ────────────────────────────────────────────────────────

  /** Called when user picks a file from the native picker */
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';          // reset so same file can be re-picked
    if (!file) return;

    setLoading(true);
    setError('');
    setBulkStatus('Parsing CSV file…');

    try {
      const text   = await file.text();
      const rows   = parseCsv(text);

      if (rows.length === 0) {
        throw new Error('CSV file is empty or has no data rows.');
      }

      // Map CSV rows → API payload. Validate required columns.
      const PRODUCT_ID = '00000000-0000-0000-0000-000000000000';
      const calculations = rows.map((r, idx) => {
        const age                = Number(r.age);
        const policy_term        = Number(r.policy_term);
        const premium_payment_term = Number(r.premium_payment_term);
        const premium_amount     = Number(r.premium_amount);

        if (!age || !policy_term || !premium_payment_term || !premium_amount) {
          throw new Error(
            `Row ${idx + 2}: Missing or invalid field. Required: age, policy_term, premium_payment_term, premium_amount`
          );
        }
        return {
          product_id: r.product_id || PRODUCT_ID,
          age,
          policy_term,
          premium_payment_term,
          premium_amount,
        };
      });

      setBulkStatus(`Uploading ${calculations.length} policies to engine…`);

      // Upload batch
      const uploadRes = await apiClient.post('/bulk/upload', { calculations });
      const batchId   = uploadRes.data.batch_id;

      // ── smart polling ──
      setBulkStatus('Workers are calculating projections…');
      let results = [];
      const MAX_POLLS = 20;
      const POLL_INTERVAL_MS = 2000;

      for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
        await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
        setBulkStatus(`Polling for results… (attempt ${attempt}/${MAX_POLLS})`);

        const res = await apiClient.get(`/bulk/${batchId}/results`);
        results   = res.data.results || [];

        const completed = results.filter(r => r.status === 'COMPLETED').length;
        const total     = results.length;

        setBulkStatus(`Processing: ${completed}/${total} policies done…`);

        if (completed === total && total > 0) break;   // all done!
      }

      if (results.length === 0) {
        throw new Error('Workers did not return any results. Please try again.');
      }

      setBatchData({ id: batchId, results });
      setIllustration(null);
      setViewMode('bulk');
      setExpandedRow(null);
      setBulkStatus('');

    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Bulk upload failed.');
      setBulkStatus('');
    } finally {
      setLoading(false);
    }
  };

  // ─── export ───────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (viewMode === 'individual') {
      if (!illustration) { alert('Run a calculation first.'); return; }
      const header = 'Year,Age,Premium Paid,Projected Fund (8%),Protection Value';
      const rows   = illustration.map(r =>
        `${r.year},${r.age},${r.premium_paid},${r.projected_fund_value},${r.death_benefit}`
      );
      downloadFile([header, ...rows].join('\n'), 'nexgen_policy_illustration.csv');
    } else {
      if (!batchData) { alert('Run a bulk import first.'); return; }
      const header = 'Request ID,Age,Premium,Policy Term,Ppt,Status,Maturity Value';
      const rows   = batchData.results.map(r => {
        const maturity = r.projected_benefits
          ? r.projected_benefits[r.projected_benefits.length - 1].projected_fund_value
          : 'N/A';
        return `${r.request_id},${r.age},${r.premium_amount},${r.policy_term},${r.premium_payment_term},${r.status},${maturity}`;
      });
      downloadFile([header, ...rows].join('\n'), `bulk_batch_${batchData.id.substring(0,8)}.csv`);
    }
  };

  // ─── stats sidebar cards ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (viewMode === 'individual') {
      if (!illustration) return null;
      const last         = illustration[illustration.length - 1];
      const maturityValue  = last.projected_fund_value;
      const totalPremium   = formData.premium_amount *
        Math.min(formData.premium_payment_term, formData.policy_term);
      const multiplier     = (maturityValue / totalPremium).toFixed(2);
      return { type: 'individual', maturityValue, totalPremium, multiplier };
    } else {
      if (!batchData) return null;
      const totalRows     = batchData.results.length;
      const completedRows = batchData.results.filter(r => r.status === 'COMPLETED').length;
      const totalMaturity = batchData.results.reduce((acc, r) => {
        if (!r.projected_benefits) return acc;
        return acc + r.projected_benefits[r.projected_benefits.length - 1].projected_fund_value;
      }, 0);
      return { type: 'bulk', totalRows, completedRows, totalMaturity };
    }
  }, [illustration, batchData, formData, viewMode]);

  // ─── sub-components ───────────────────────────────────────────────────────
  const SidebarItem = ({ icon: Icon, label, active = false }) => (
    <div
      onClick={() => { if (!active) alert(`${label} module coming soon.`); }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group',
        active
          ? 'bg-indigo-50 text-indigo-700 shadow-sm'
          : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'
      )}
    >
      <Icon className={cn('w-5 h-5', active ? 'text-indigo-600' : 'group-hover:text-indigo-600')} />
      <span className="font-semibold text-sm">{label}</span>
      {active && <motion.div layoutId="activeInd" className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />}
    </div>
  );

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#fcfdfe] overflow-hidden font-sans">

      {/* Hidden file input for CSV upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-72 border-r border-slate-200 bg-white flex flex-col pt-8 flex-shrink-0">
        <div className="px-6 mb-10 flex items-center gap-3.5">
          <div className="flex items-center justify-center w-9 h-9 bg-slate-900 rounded-xl shadow-lg shadow-slate-200">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900">NEXGEN</span>
        </div>

        <nav className="flex-1 px-6 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Policy Illustrator" active />
          <SidebarItem icon={History}         label="Batch History" />
          <SidebarItem icon={Settings}        label="Engine Config" />
        </nav>

        <div className="p-6 border-t border-slate-100 bg-slate-50/30">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-black">
                {(user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-black text-slate-900 truncate tracking-tight">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-slate-400 font-medium truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top header */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 lg:px-10 flex items-center justify-between z-20 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-widest">
            <span className="hover:text-slate-900 transition-colors cursor-pointer">Platform</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-900">Policy Illustrator</span>
          </div>

          <div className="flex items-center gap-4">
            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => { setViewMode('individual'); setExpandedRow(null); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  viewMode === 'individual'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Individual
              </button>
              <button
                onClick={() => { if (batchData) { setViewMode('bulk'); setExpandedRow(null); } }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  viewMode === 'bulk'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : batchData ? 'text-slate-500 hover:text-slate-700' : 'text-slate-300 cursor-not-allowed'
                )}
              >
                Bulk {batchData ? `(${batchData.results.length})` : ''}
              </button>
            </div>

            <button
              onClick={() => alert('No critical alerts in the last 24 h.')}
              className="text-slate-400 hover:text-slate-900 transition-all p-2 hover:bg-slate-50 rounded-xl relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-slate-900 rounded-full border-2 border-white" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                LIVE
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-50/30">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">

            {/* Page title + action buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                  Policy Illustration Engine
                </h1>
                <p className="text-slate-500 font-medium text-sm mt-1">
                  Run individual projections or import a CSV for bulk processing.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => downloadFile(SAMPLE_CSV, 'nexgen_bulk_template.csv')}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                  Download Template
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </button>
                <button
                  onClick={handleExport}
                  className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>

            {/* Bulk loading status banner */}
            <AnimatePresence>
              {(loading && bulkStatus) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 px-5 py-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700 text-sm font-semibold"
                >
                  <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin flex-shrink-0" />
                  {bulkStatus}
                </motion.div>
              )}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 px-5 py-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-semibold"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                  <button onClick={() => setError('')} className="ml-auto">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Main grid ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Left: parameter form */}
              <div className="lg:col-span-4 space-y-5">
                <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <Calculator className="w-5 h-5 text-slate-700" />
                    </div>
                    <h2 className="text-base font-black text-slate-900">Parameters</h2>
                  </div>

                  {/* error inside form */}
                  <form onSubmit={calculateBenefits} className="space-y-5">

                    {/* Product */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                        Product <Info className="w-3 h-3" />
                      </label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                        <select
                          name="product_id"
                          value={formData.product_id}
                          onChange={handleChange}
                          className="w-full pl-10 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none outline-none transition-all"
                        >
                          <option value="00000000-0000-0000-0000-000000000000">Standard Term Life</option>
                          <option value="11111111-1111-1111-1111-111111111111">Endowment Plan Classic</option>
                          <option value="22222222-2222-2222-2222-222222222222">Money Back Plan (20yr)</option>
                          <option value="33333333-3333-3333-3333-333333333333">ULIP Growth Fund</option>
                        </select>
                        <ChevronRight className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                      </div>
                    </div>

                    {/* Age + Policy Term */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Entry Age</label>
                        <input type="number" name="age" value={formData.age} onChange={handleChange}
                          min="18" max="65"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Policy Term</label>
                        <input type="number" name="policy_term" value={formData.policy_term} onChange={handleChange}
                          min="5" max="50"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Premium Payment Term */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Premium Payment Term (yrs)</label>
                      <input type="number" name="premium_payment_term" value={formData.premium_payment_term} onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>

                    {/* Annual Premium */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Annual Premium (₹)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-slate-400 font-bold text-sm">₹</span>
                        <input type="number" name="premium_amount" value={formData.premium_amount} onChange={handleChange}
                          className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 group"
                    >
                      {loading && !bulkStatus ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Calculator className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                          Run Calculation
                        </>
                      )}
                    </button>
                  </form>
                </section>

                {/* Stat cards */}
                <AnimatePresence mode="wait">
                  {stats?.type === 'individual' && (
                    <motion.div key="ind-stats" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl shadow-slate-900/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 blur-3xl -mr-14 -mt-14 rounded-full group-hover:scale-150 transition-transform duration-700" />
                        <p className="text-white/60 text-xs font-bold uppercase tracking-wide mb-1">Maturity Value Est.</p>
                        <h3 className="text-3xl font-black tracking-tight">₹{stats.maturityValue.toLocaleString('en-IN')}</h3>
                        <div className="mt-4 flex items-center gap-2 bg-white/10 w-fit px-3 py-1.5 rounded-full border border-white/10">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
                          <span className="text-xs font-bold uppercase">{stats.multiplier}x Yield</span>
                        </div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="w-11 h-11 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-5 h-5 text-slate-700" />
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">Total Premium Paid</p>
                          <h3 className="text-xl font-black text-slate-900">₹{stats.totalPremium.toLocaleString('en-IN')}</h3>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {stats?.type === 'bulk' && (
                    <motion.div key="bulk-stats" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 blur-3xl -mr-14 -mt-14 rounded-full group-hover:scale-150 transition-transform duration-700" />
                        <p className="text-white/60 text-xs font-bold uppercase tracking-wide mb-1">Total Batch Maturity</p>
                        <h3 className="text-3xl font-black tracking-tight">₹{stats.totalMaturity.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
                        <div className="mt-4 flex items-center gap-2 bg-white/10 w-fit px-3 py-1.5 rounded-full border border-white/10">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                          <span className="text-xs font-bold uppercase">{stats.completedRows}/{stats.totalRows} Completed</span>
                        </div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="w-11 h-11 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center flex-shrink-0">
                          <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">Batch ID</p>
                          <p className="text-sm font-mono font-bold text-slate-700">{batchData.id.substring(0,16)}…</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right: result table */}
              <div className="lg:col-span-8">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col" style={{ minHeight: '600px' }}>

                  {/* Table header */}
                  <div className="px-6 lg:px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-5 bg-slate-900 rounded-full" />
                      <h3 className="font-black text-slate-900">
                        {viewMode === 'individual' ? 'Year-by-Year Projection' : 'Batch Summary'}
                      </h3>
                      {viewMode === 'bulk' && batchData && expandedRow && (
                        <button
                          onClick={() => setExpandedRow(null)}
                          className="ml-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-100 transition-all"
                        >
                          ← Back to Summary
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Sync
                    </div>
                  </div>

                  {/* Table body */}
                  <div className="flex-1 overflow-auto custom-scrollbar" style={{ maxHeight: '600px' }}>

                    {/* ── Individual mode ── */}
                    {viewMode === 'individual' && (
                      illustration ? (
                        <table className="w-full text-left border-separate border-spacing-0">
                          <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
                            <tr>
                              {['Year', 'Age', 'Premium Paid', 'Projected Fund (8%)', 'Protection Value'].map(h => (
                                <th key={h} className="px-6 lg:px-8 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {illustration.map((row, i) => (
                              <motion.tr
                                key={row.year}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i < 20 ? i * 0.02 : 0 }}
                                className="hover:bg-slate-50/60 transition-all"
                              >
                                <td className="px-6 lg:px-8 py-3.5 text-xs font-bold text-slate-400">{String(row.year).padStart(2, '0')}</td>
                                <td className="px-6 lg:px-8 py-3.5 text-sm font-bold text-slate-900">{row.age}</td>
                                <td className="px-6 lg:px-8 py-3.5">
                                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg">
                                    -₹{row.premium_paid.toLocaleString('en-IN')}
                                  </span>
                                </td>
                                <td className="px-6 lg:px-8 py-3.5 text-sm font-bold text-slate-900">
                                  ₹{row.projected_fund_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 lg:px-8 py-3.5">
                                  <span className="text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
                                    ₹{row.death_benefit.toLocaleString('en-IN')}
                                  </span>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-16 text-center gap-5">
                          <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                            <Calculator className="w-10 h-10 text-slate-200" />
                          </div>
                          <div>
                            <h4 className="text-slate-900 font-bold text-lg">Awaiting Engine Signal</h4>
                            <p className="text-sm text-slate-400 mt-2 max-w-xs leading-relaxed">
                              Fill the parameters and click <strong>Run Calculation</strong>, or import a CSV for bulk processing.
                            </p>
                          </div>
                        </div>
                      )
                    )}

                    {/* ── Bulk mode: summary table ── */}
                    {viewMode === 'bulk' && batchData && !expandedRow && (
                      <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
                          <tr>
                            {['#', 'Age', 'Premium', 'Policy Term', 'Ppt', 'Status', 'Maturity Value', ''].map(h => (
                              <th key={h} className="px-5 lg:px-8 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {batchData.results.map((row, i) => {
                            const maturity = row.projected_benefits
                              ? row.projected_benefits[row.projected_benefits.length - 1].projected_fund_value
                              : null;
                            return (
                              <tr key={row.request_id} className="hover:bg-slate-50/60 transition-all">
                                <td className="px-5 lg:px-8 py-3.5 text-xs font-bold text-slate-300">{i + 1}</td>
                                <td className="px-5 lg:px-8 py-3.5 text-sm font-bold text-slate-900">{row.age}</td>
                                <td className="px-5 lg:px-8 py-3.5 text-sm font-semibold text-slate-700">₹{Number(row.premium_amount).toLocaleString('en-IN')}</td>
                                <td className="px-5 lg:px-8 py-3.5 text-sm text-slate-500">{row.policy_term}y</td>
                                <td className="px-5 lg:px-8 py-3.5 text-sm text-slate-500">{row.premium_payment_term}y</td>
                                <td className="px-5 lg:px-8 py-3.5">
                                  <span className={cn(
                                    'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg border',
                                    row.status === 'COMPLETED'
                                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                      : 'text-amber-700 bg-amber-50 border-amber-200'
                                  )}>
                                    {row.status === 'COMPLETED'
                                      ? <CheckCircle2 className="w-3 h-3" />
                                      : <Clock className="w-3 h-3" />}
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-5 lg:px-8 py-3.5">
                                  {maturity !== null ? (
                                    <span className="text-sm font-bold text-emerald-600">
                                      ₹{maturity.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="px-5 lg:px-8 py-3.5">
                                  {row.projected_benefits && (
                                    <button
                                      onClick={() => setExpandedRow(row.request_id)}
                                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-100 transition-all whitespace-nowrap"
                                    >
                                      View Detail →
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {/* ── Bulk mode: drill-down year-by-year for one policy ── */}
                    {viewMode === 'bulk' && batchData && expandedRow && (() => {
                      const row = batchData.results.find(r => r.request_id === expandedRow);
                      if (!row?.projected_benefits) return null;
                      return (
                        <div>
                          <div className="px-6 lg:px-8 py-3 bg-indigo-50/60 border-b border-indigo-100 flex items-center gap-3">
                            <div className="text-xs font-bold text-indigo-600">
                              Policy Details — Age {row.age} · Term {row.policy_term}y · PPT {row.premium_payment_term}y · ₹{Number(row.premium_amount).toLocaleString('en-IN')}/yr
                            </div>
                          </div>
                          <table className="w-full text-left border-separate border-spacing-0">
                            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
                              <tr>
                                {['Year', 'Age', 'Premium Paid', 'Projected Fund (8%)', 'Protection Value'].map(h => (
                                  <th key={h} className="px-6 lg:px-8 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {row.projected_benefits.map((yr, i) => (
                                <motion.tr
                                  key={yr.year}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i < 20 ? i * 0.02 : 0 }}
                                  className="hover:bg-slate-50/60 transition-all"
                                >
                                  <td className="px-6 lg:px-8 py-3.5 text-xs font-bold text-slate-400">{String(yr.year).padStart(2, '0')}</td>
                                  <td className="px-6 lg:px-8 py-3.5 text-sm font-bold text-slate-900">{yr.age}</td>
                                  <td className="px-6 lg:px-8 py-3.5">
                                    <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg">
                                      -₹{yr.premium_paid.toLocaleString('en-IN')}
                                    </span>
                                  </td>
                                  <td className="px-6 lg:px-8 py-3.5 text-sm font-bold text-slate-900">
                                    ₹{yr.projected_fund_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-6 lg:px-8 py-3.5">
                                    <span className="text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
                                      ₹{yr.death_benefit.toLocaleString('en-IN')}
                                    </span>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}

                    {/* ── Bulk mode: no data yet ── */}
                    {viewMode === 'bulk' && !batchData && (
                      <div className="flex flex-col items-center justify-center h-full p-16 text-center gap-5">
                        <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                          <FileSpreadsheet className="w-10 h-10 text-slate-200" />
                        </div>
                        <div>
                          <h4 className="text-slate-900 font-bold text-lg">No Bulk Data</h4>
                          <p className="text-sm text-slate-400 mt-2 max-w-xs leading-relaxed">
                            Click <strong>Import CSV</strong> to upload a batch file. Download the template first to see the required format.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 lg:px-8 py-3 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      SHA-256 Integrity Verified
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      Secure Compute
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
