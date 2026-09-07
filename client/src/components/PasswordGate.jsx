import React, { useState } from 'react';
import { Lock } from 'lucide-react';

const PasswordGate = ({ children }) => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Hardcoded password check
    if (password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      setError(true);
      setPassword('');
    }
  };

  // If authenticated, render the actual app
  if (isAuthenticated) {
    return children;
  }

  // If not, show the lock screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1121] p-6 font-sans">
      <div 
        className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
        style={{ 
          backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', 
          backgroundPosition: '0 0, 20px 20px', 
          backgroundSize: '40px 40px' 
        }}
      />
      
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 p-8 rounded-2xl shadow-xl backdrop-blur-sm">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Lock className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
          Development Build
        </h2>
        <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-8">
          This environment is currently restricted. Please enter the password to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Enter password..."
              autoFocus
              className={`w-full px-4 py-3 rounded-lg border bg-transparent text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                error 
                  ? 'border-red-500 focus:ring-red-500/50' 
                  : 'border-slate-300 dark:border-slate-700 focus:border-slate-400 dark:focus:border-slate-500 focus:ring-slate-400/20'
              }`}
            />
            {error && (
              <p className="text-red-500 text-xs mt-2 text-center font-medium">
                Incorrect password. Please try again.
              </p>
            )}
          </div>
          
          <button
            type="submit"
            className="w-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-3 rounded-lg font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
          >
            Unlock Application
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordGate;