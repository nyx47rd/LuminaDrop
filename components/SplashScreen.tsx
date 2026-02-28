'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'expanding'>('loading');

  useEffect(() => {
    // Start expansion after 2.5 seconds
    const timer = setTimeout(() => {
      setPhase('expanding');
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Star Path (Gemini-like 4-pointed star)
  // Centered at 50,50 in a 100x100 box
  const starPath = "M50 0 L61 39 L100 50 L61 61 L50 100 L39 61 L0 50 L39 39 Z";

  return (
    <motion.div
      className="fixed inset-0 z-[100] pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'expanding' ? 0 : 1 }}
      transition={{ duration: 0.5, delay: 1.5 }} // Fade out the whole overlay at the very end
      onAnimationComplete={() => {
        if (phase === 'expanding') onComplete();
      }}
    >
      {/* 
        LAYER 1: The Black Overlay with a "Star Hole" 
        This sits on top of the App. The App is visible through the hole.
      */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <mask id="star-reveal-mask">
            {/* White = Visible (The Black Overlay) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            
            {/* Black = Invisible (The Hole/Window) */}
            {/* We animate this star to scale up and rotate */}
            <motion.path
              d={starPath}
              fill="black"
              initial={{ scale: 1, rotate: 0, x: 0, y: 0 }} 
              animate={phase === 'expanding' ? { scale: 60, rotate: 90 } : { scale: 1, rotate: 0 }}
              transition={phase === 'expanding' ? { duration: 1.2, ease: [0.65, 0, 0.35, 1] } : {}}
              style={{ 
                transformBox: 'fill-box', 
                transformOrigin: 'center' 
              }}
            />
          </mask>
        </defs>

        {/* The Black Screen Overlay applied with the mask */}
        <rect 
          x="0" 
          y="0" 
          width="100%" 
          height="100%" 
          fill="black" 
          mask="url(#star-reveal-mask)" 
        />
      </svg>

      {/* 
        LAYER 2: The Colorful Star (Visual Only)
        This sits exactly on top of the "Hole" to hide the app initially.
        It spins and then fades out as the hole expands.
      */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence>
          {phase === 'loading' && (
            <motion.div
              key="colorful-star"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} // Apple-style spring curve
              className="w-32 h-32 md:w-48 md:h-48"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="w-full h-full"
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <defs>
                    <linearGradient id="gemini-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4285F4" />
                      <stop offset="25%" stopColor="#9b72cb" />
                      <stop offset="50%" stopColor="#d96570" />
                      <stop offset="75%" stopColor="#f4af42" />
                      <stop offset="100%" stopColor="#4285F4" />
                    </linearGradient>
                  </defs>
                  <path
                    d={starPath}
                    fill="url(#gemini-gradient)"
                  />
                </svg>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loading Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'loading' ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className="absolute bottom-12 left-0 right-0 text-center text-[10px] uppercase tracking-[0.4em] font-light opacity-40 text-white"
      >
        Lumina Drop
      </motion.div>
    </motion.div>
  );
}
