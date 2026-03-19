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

  const inputClasses = "w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-slate-900/10 focus:border-slate-900 transition-all duration-300 outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-medium shadow-sm";

  return (
    <div className="min-h-screen bg-[#fcfdfe] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative enterprise background blur elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100/40 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            transition={{ type: "spring", duration: 0.8 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-slate-900 to-slate-800 rounded-[1.5rem] shadow-xl shadow-slate-900/20 mb-6 relative group"
          >
            <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <BarChart3 className="w-10 h-10 text-white group-hover:scale-110 transition-transform duration-500" />
          </motion.div>
          <motion.h1 
            initial={{ y: 10, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            transition={{ delay: 0.1 }}
            className="text-4xl font-black text-slate-900 tracking-tight"
          >
            NEXGEN
          </motion.h1>
          <motion.p 
            initial={{ y: 10, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            transition={{ delay: 0.2 }}
            className="text-slate-500 font-semibold mt-2 text-base tracking-wide"
          >
            Secure Platform Access
          </motion.p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium"
                >
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" />
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {!isLogin && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                        <input name="first_name" type="text" placeholder="First Name" required onChange={handleChange} className={inputClasses}/>
                      </div>
                      <div className="relative">
                        <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                        <input name="last_name" type="text" placeholder="Last Name" required onChange={handleChange} className={inputClasses}/>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                        <input name="dob" type="date" required onChange={handleChange} className={inputClasses}/>
                      </div>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                        <input name="mobile_number" type="tel" placeholder="Mobile Number" required onChange={handleChange} className={inputClasses}/>
                      </div>
                    </div>
                  </>
                )}

                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
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
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
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

                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-slate-900"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="tracking-wide uppercase text-sm">{isLogin ? 'Authenticate' : 'Create Account'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <p className="text-slate-500 font-medium text-sm">
                  {isLogin ? "Require platform access?" : "Already provisioned?"}{' '}
                  <button 
                    type="button" 
                    onClick={() => setIsLogin(!isLogin)} 
                    className="text-slate-900 font-bold hover:text-brand-600 transition-colors"
                  >
                    {isLogin ? "Request Access" : "Sign In"}
                  </button>
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-slate-500 text-xs">
            © 2026 NexGen Financial Technologies
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

