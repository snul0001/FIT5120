import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Player } from '@lottiefiles/react-lottie-player';
// Import your downloaded JSON file here. Adjust the path if your assets folder is located elsewhere.
import wipAnimation from '../assets/animation-clean.json'; 

const WorkInProgress = ({ onBack }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0B1121] p-6 font-sans overflow-hidden view-enter-animation">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
        style={{ 
          backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', 
          backgroundPosition: '0 0, 20px 20px', 
          backgroundSize: '40px 40px' 
        }}
        aria-hidden="true"
      />
      
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center">
        
        {/* Lottie Animation Container */}
        <div className="relative w-64 h-64 mb-2 flex items-center justify-center">
          <Player
            autoplay
            loop
            src={wipAnimation}
            style={{ height: '100%', width: '100%' }}
          />
        </div>

        {/* Funny Tech Message */}
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
          The server hamsters are on a coffee break.
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg mb-10 max-w-md leading-relaxed">
          Our engineers are currently untangling cables and arguing over tabs vs. spaces. This feature will be up and running shortly.
        </p>

        {/* Go Back Button */}
        <button 
          onClick={onBack}
          className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-full px-8 py-3.5 font-semibold text-sm flex items-center gap-2 shadow-lg dark:shadow-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          Head back to safety
        </button>

      </div>
    </div>
  );
};

export default WorkInProgress;