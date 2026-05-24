import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, ChevronLeft, Flag } from 'lucide-react';

export interface TourStep {
  element: string;
  title: string;
  description: string;
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
  theme: 'dark' | 'light';
  isOpen: boolean;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ steps, onComplete, theme, isOpen }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [isMounted, setIsMounted] = useState(false);

  const updateCoords = useCallback(() => {
    const el = document.querySelector(steps[currentStep].element);
    if (el) {
      const rect = el.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      setCoords({
        top: rect.top + scrollY,
        left: rect.left + scrollX,
        width: rect.width,
        height: rect.height
      });

      // Smooth scroll to element if not in view
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, steps]);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      // Wait for next tick to ensure DOM elements are rendered
      const timer = setTimeout(updateCoords, 100);
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords);
      };
    } else {
      setIsMounted(false);
    }
  }, [isOpen, updateCoords]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onComplete();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onComplete]);

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skip = () => onComplete();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Spotlight Mask */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto overflow-hidden">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <motion.rect
              animate={{
                x: coords.left - 8,
                y: coords.top - 8,
                width: coords.width + 16,
                height: coords.height + 16,
                rx: 16
              }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(15,23,42,0.6)'}
          mask="url(#spotlight-mask)"
          className="backdrop-blur-[2px]"
          onClick={skip}
        />
      </svg>

      {/* Spotlight Glow */}
      <motion.div
        animate={{
          top: coords.top - 12,
          left: coords.left - 12,
          width: coords.width + 24,
          height: coords.height + 24,
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.02, 1]
        }}
        transition={{ 
          top: { type: 'spring', damping: 30, stiffness: 200 },
          left: { type: 'spring', damping: 30, stiffness: 200 },
          width: { type: 'spring', damping: 30, stiffness: 200 },
          height: { type: 'spring', damping: 30, stiffness: 200 },
          opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
        }}
        className="absolute border-2 border-indigo-500/50 rounded-[24px] shadow-[0_0_40px_rgba(99,102,241,0.2)] pointer-events-none"
      />

      {/* Tooltip Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: 1,
            top: coords.top + coords.height + 24 > window.innerHeight - 300 
              ? coords.top - 200 // Position above if too close to bottom
              : coords.top + coords.height + 24,
            left: Math.min(Math.max(coords.left + coords.width / 2 - 160, 20), window.innerWidth - 340)
          }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className={`absolute w-[320px] p-6 rounded-3xl shadow-2xl pointer-events-auto border transition-colors ${
            theme === 'dark' 
              ? 'bg-zinc-900 border-white/10 text-white shadow-black/80' 
              : 'bg-white border-slate-200 text-slate-800 shadow-xl'
          }`}
        >
          {/* Progress dots */}
          <div className="flex gap-1 mb-4">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 rounded-full transition-all ${
                  i === currentStep 
                    ? 'w-6 bg-indigo-500' 
                    : 'w-2 bg-indigo-500/20'
                }`} 
              />
            ))}
          </div>

          <h3 className="text-lg font-bold tracking-tight mb-2 flex items-center gap-2">
            <span className="text-indigo-500">#</span> {steps[currentStep].title}
          </h3>
          <p className="text-sm opacity-60 leading-relaxed mb-6">
            {steps[currentStep].description}
          </p>

          <footer className="flex items-center justify-between gap-4">
            <button 
              onClick={skip}
              className="text-[10px] font-bold uppercase tracking-wider opacity-40 hover:opacity-100 transition-opacity"
            >
              Skip
            </button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button 
                  onClick={prev}
                  className={`p-2 rounded-xl border transition-all ${
                    theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                  aria-label="Previous step"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={next}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <span>Finish</span>
                    <Flag className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </footer>

          {/* Floating Arrow */}
          <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 border-t border-l rotate-45 pointer-events-none transition-colors ${
            coords.top + coords.height + 24 > window.innerHeight - 300
              ? 'bottom-[-9px] border-b border-r border-t-0 border-l-0' // Arrow down
              : 'top-[-9px]' // Arrow up
          } ${
            theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200'
          }`} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
