import { useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { apiClient } from '../api/client.js';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, 
  LayoutDashboard, 
  Calculator, 
  Table as TableIcon, 
  TrendingUp, 
  Shield, 
  History,
  Info,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Settings,
  Bell
} from 'lucide-react';
import { cn } from '../utils/cn.js';

const Dashboard = () => {
  const { user, logout } = useAuth();
  
  const [formData, setFormData] = useState({
    product_id: '00000000-0000-0000-0000-000000000000',
    age: 30,
    policy_term: 20,
    premium_payment_term: 15,
    premium_amount: 50000
  });

  const [illustration, setIllustration] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'product_id' ? value : Number(value)
    }));
  };

  const calculateBenefits = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await apiClient.post('/calculations/calculate', formData);
      setIllustration(data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate benefits.');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!illustration) return null;
    const maturityValue = illustration[illustration.length - 1].projected_fund_value;
    const totalPremium = formData.premium_amount * Math.min(formData.premium_payment_term, formData.policy_term);
    const multiplier = (maturityValue / totalPremium).toFixed(2);
    return { maturityValue, totalPremium, multiplier };
  }, [illustration, formData]);

  const SidebarItem = ({ icon: Icon, label, active = false }) => (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group",
      active ? "bg-brand-50 text-brand-700 shadow-sm" : "hover:bg-slate-50 text-slate-500 hover:text-slate-900"
    )}>
      <Icon className={cn("w-5 h-5", active ? "text-brand-600" : "group-hover:text-brand-600")} />
      <span className="font-semibold text-sm">{label}</span>
      {active && <motion.div layoutId="activeInd" className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600" />}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      {/* Sidebar - Clean EU Style */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col pt-8">
        <div className="px-6 mb-10 flex items-center gap-2.5">
          <div className="p-2 bg-brand-950 rounded-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-brand-950">NexGen</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <SidebarItem icon={LayoutDashboard} label="Overview" active />
          <SidebarItem icon={Calculator} label="Illustrator" />
          <SidebarItem icon={History} label="Audit Logs" />
          <SidebarItem icon={Settings} label="Engine Settings" />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
             <div className="flex items-center gap-3 mb-3">
               <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-[10px] font-bold">
                 {user?.email?.[0]?.toUpperCase() || 'U'}
               </div>
               <div className="overflow-hidden">
                 <p className="text-xs font-bold text-slate-900 truncate">{user?.email}</p>
                 <p className="text-[10px] text-slate-500 font-medium">Standard License</p>
               </div>
             </div>
             <button 
                onClick={logout} 
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-red-600 hover:border-red-100 transition-all shadow-sm"
             >
               <LogOut className="w-3.5 h-3.5" />
               Sign Out
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <span>Illustrator</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-900 font-bold">New Policy Simulation</span>
          </div>

          <div className="flex items-center gap-5">
            <button className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-lg">
              <Bell className="w-5 h-5" />
            </button>
            <div className="h-4 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live Environment</span>
                <span className="text-[10px] text-emerald-600 font-code font-bold underline decoration-dotted">US-WEST-2::PROD</span>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          {/* Header Section */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Policy Illustration</h1>
              <p className="text-slate-500 mt-1 font-medium italic">Configure demographic and term parameters for precision modeling.</p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Import Batch
              </button>
              <button className="px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 hover:bg-brand-700 transition-all flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>

          {/* Core Dashboard Grid */}
          <div className="grid grid-cols-12 gap-8">
            
            {/* Input Configuration Panel */}
            <div className="col-span-12 lg:col-span-4 space-y-8">
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <History className="w-5 h-5 text-slate-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Constraints</h2>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-semibold">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                    {error}
                  </div>
                )}

                <form onSubmit={calculateBenefits} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      Target Product <Info className="w-3 h-3 text-slate-300" />
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <select 
                        name="product_id" 
                        value={formData.product_id} 
                        onChange={handleChange} 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 appearance-none outline-none"
                      >
                        <option value="00000000-0000-0000-0000-000000000000">Standard Term Plan</option>
                        <option value="bulk_id">Universal Life Flex</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Entry Age</label>
                      <input type="number" name="age" value={formData.age} onChange={handleChange} min="18" max="65" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Policy Term</label>
                      <input type="number" name="policy_term" value={formData.policy_term} onChange={handleChange} min="5" max="50" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Premium Term (Years)</label>
                    <input type="number" name="premium_payment_term" value={formData.premium_payment_term} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Annual Premium ($)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-2.5 text-slate-400 font-bold">$</div>
                      <input type="number" name="premium_amount" value={formData.premium_amount} onChange={handleChange} className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-brand-900 focus:ring-2 focus:ring-brand-500 outline-none" />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full py-4 bg-brand-950 text-white font-bold rounded-2xl shadow-xl shadow-brand-950/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4 group"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Calculator className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        Generate Illustration
                      </>
                    )}
                  </button>
                </form>
              </section>

              {/* Metric Highlights if Illustration Exists */}
              <AnimatePresence>
                {stats && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="grid grid-cols-1 gap-4"
                  >
                    <div className="bg-brand-600 p-6 rounded-2xl text-white shadow-lg shadow-brand-600/20">
                      <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Estimated Maturity Value</p>
                      <h3 className="text-3xl font-black font-code tracking-tighter">${stats.maturityValue.toLocaleString()}</h3>
                      <div className="mt-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold">{stats.multiplier}x return on investment</span>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                         <Shield className="w-6 h-6 text-brand-600" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Total Liability</p>
                        <h3 className="text-xl font-black text-slate-900 font-code tracking-tight">${stats.totalPremium.toLocaleString()}</h3>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Main Result Table Area */}
            <div className="col-span-12 lg:col-span-8 flex flex-col min-h-[600px]">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-full shadow-sm">
                
                {/* Custom Content Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                  <div className="flex items-center gap-3">
                    <TableIcon className="w-5 h-5 text-brand-700" />
                    <h3 className="text-base font-bold text-slate-900 tracking-tight underline decoration-slate-200 decoration-2 underline-offset-4">Benefit Projection Array</h3>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-Time Sync</span>
                  </div>
                </div>

                <div className="p-0 overflow-auto flex-1 h-[700px] relative">
                  {illustration ? (
                    <motion.table 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-full text-left border-collapse translate-gpu"
                    >
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-white border-b border-slate-100">
                          <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Year</th>
                          <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Attained Age</th>
                          <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Premium Output</th>
                          <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fund Value (8%)</th>
                          <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Death Benefit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {illustration.map((row, i) => (
                          <motion.tr 
                            key={row.year} 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i < 20 ? i * 0.02 : 0 }}
                            className="group hover:bg-brand-50/30 transition-all cursor-default"
                          >
                            <td className="px-8 py-4 text-xs font-bold text-slate-400 font-code">{row.year.toString().padStart(2, '0')}</td>
                            <td className="px-8 py-4 text-sm font-bold text-slate-900">{row.age}</td>
                            <td className="px-8 py-4">
                              <span className="text-xs font-code font-bold text-red-500/80 bg-red-50 px-2 py-0.5 rounded">
                                -${row.premium_paid.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-8 py-4">
                              <span className="text-sm font-code font-black text-brand-900">
                                ${row.projected_fund_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-8 py-4 text-right">
                              <span className="text-sm font-code font-black text-emerald-600 bg-emerald-50/50 px-3 py-1 rounded-lg border border-emerald-100/50">
                                ${row.death_benefit.toLocaleString()}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </motion.table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4 p-20 text-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                        <Calculator className="w-10 h-10" />
                      </div>
                      <div className="max-w-xs">
                        <h4 className="text-slate-900 font-bold mb-1">Awaiting Computation</h4>
                        <p className="text-xs font-medium leading-relaxed">
                          Define your policy parameters in the left panel and click 'Generate Illustration' to populate the benefit array.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 font-code uppercase tracking-tight">System Status: Integrity Validated</span>
                  <div className="flex items-center gap-1.5 opacity-40">
                    <Shield className="w-3 h-3" />
                    <span className="text-[10px] font-bold">AES-Protected</span>
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

