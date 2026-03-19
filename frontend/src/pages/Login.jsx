import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  ArrowRight, 
  Mail, 
  Lock, 
  User, 
  Calendar, 
  Phone,
  BarChart3,
  Globe,
  Zap
} from 'lucide-react';
import { cn } from '../utils/cn.js';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: 'test@example.com',
    password: 'password123',
    first_name: '',
    last_name: '',
    dob: '',
    mobile_number: ''
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = "w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none text-sm font-medium placeholder:text-slate-400 shadow-sm";

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      {/* Left Side: Branding & Marketing - EU Style */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-950 p-12 flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500 opacity-10 blur-[100px] -mr-48 -mt-48 rounded-full" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-400 opacity-5 blur-[120px] -ml-48 -mb-48 rounded-full" />
        
        <div className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 text-brand-50 mb-12"
          >
            <div className="p-2 bg-brand-500 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">NexGen Illustrations</span>
          </motion.div>

          <div className="space-y-8 max-w-lg">
            <motion.h1 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl font-extrabold text-white leading-tight"
            >
              Enterprise Grade <br />
              <span className="text-brand-400 border-b-4 border-brand-500/30">Benefit Modeling</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-slate-400 leading-relaxed font-light"
            >
              Seamlessly calculate, simulate, and illustrate millions of policy projections with our state-of-the-art computational engine. Built for performance, secured for life.
            </motion.p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-6 mt-12">
          {[
            { icon: ShieldCheck, title: "AES-256 Secure", desc: "Military-grade encryption" },
            { icon: Zap, title: "Nano-Performance", desc: "Sub-ms calculations" },
            { icon: Globe, title: "EU Compliant", desc: "Data residency ready" },
            { icon: BarChart3, title: "Dynamic Logic", desc: "Excel-parity engine" }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + (i * 0.1) }}
              className="flex gap-4 items-start group"
            >
              <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
                <item.icon className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">{item.title}</h3>
                <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between pt-8 border-t border-white/5">
          <span className="text-xs text-slate-500 font-code tracking-widest uppercase">v2.4.0-Stable</span>
          <div className="flex gap-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-xs text-slate-500">System Online</span>
          </div>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-20 bg-white shadow-[-20px_0_40px_rgba(0,0,0,0.02)]">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden flex justify-center">
             <div className="flex items-center gap-3 text-brand-950">
              <div className="p-2 bg-brand-600 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">NexGen</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {isLogin ? "Welcome back" : "Create Account"}
            </h2>
            <p className="text-slate-500 mt-2 font-medium">
              {isLogin 
                ? "Enter your credentials to access the secure portal." 
                : "Register to begin projecting millions of policy benefits."}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-semibold animate-in fade-in slide-in-from-top-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <input name="first_name" type="text" placeholder="First Name" required onChange={handleChange} className={inputClasses}/>
                      </div>
                      <div className="relative">
                        <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <input name="last_name" type="text" placeholder="Last Name" required onChange={handleChange} className={inputClasses}/>
                      </div>
                    </div>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input name="dob" type="date" required onChange={handleChange} className={inputClasses}/>
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input name="mobile_number" type="tel" placeholder="Mobile phone" required onChange={handleChange} className={inputClasses}/>
                    </div>
                  </>
                )}

                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    name="email" 
                    type="email" 
                    placeholder="Email Address" 
                    required 
                    value={formData.email} 
                    onChange={handleChange} 
                    className={inputClasses}
                  />
                </div>
                
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                    name="password" 
                    type="password" 
                    placeholder="Password" 
                    required 
                    value={formData.password} 
                    onChange={handleChange} 
                    className={inputClasses}
                  />
                </div>

                <motion.button 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 mt-4"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {isLogin ? 'Authenticate Session' : 'Create Secure Profile'}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </motion.button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-slate-500 text-sm font-medium">
                  {isLogin ? "Don't have an account?" : "Already have an identity?"}{' '}
                  <button 
                    type="button" 
                    onClick={() => setIsLogin(!isLogin)} 
                    className="text-brand-600 hover:text-brand-700 font-bold transition-colors underline underline-offset-4 decoration-2 decoration-brand-500/20 hover:decoration-brand-500"
                  >
                    {isLogin ? "Get Started" : "Sign In"}
                  </button>
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 text-center">
             <p className="text-[10px] text-slate-400 font-code mt-8 leading-relaxed">
              &copy; 2026 NexGen Financial Technologies Ltd. <br />
              All rights reserved. Strictly confidential.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

