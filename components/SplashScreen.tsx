'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'expanding' ? 0 : 1 }}
      transition={{ duration: 0.1, delay: 1.4 }} // Fade out the container ONLY after the star has filled the screen
      onAnimationComplete={() => {
        if (phase === 'expanding') onComplete();
      }}
    >
      <svg 
        className="w-full h-full" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* The Gradient Definition */}
          <linearGradient id="gemini-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="25%" stopColor="#9b72cb" />
            <stop offset="50%" stopColor="#d96570" />
            <stop offset="75%" stopColor="#f4af42" />
            <stop offset="100%" stopColor="#4285F4" />
          </linearGradient>

          {/* The Mask Definition */}
          <mask id="star-hole-mask">
            {/* White = Visible (The Black Overlay) */}
            <rect x="-50%" y="-50%" width="200%" height="200%" fill="white" />
            
            {/* Black = Invisible (The Hole) */}
            <motion.path
              d={starPath}
              fill="black"
              initial={{ scale: 0.2, rotate: 0 }}
              animate={phase === 'expanding' ? { scale: 30, rotate: 90 } : { scale: 0.2, rotate: 360 }}
              transition={phase === 'expanding' 
                ? { duration: 1.5, ease: [0.7, 0, 0.3, 1] } 
                : { duration: 3, repeat: Infinity, ease: "linear" }
              }
              style={{ transformOrigin: '50px 50px' }}
            />
          </mask>
        </defs>

        {/* LAYER 1: The Black Overlay with the Hole */}
        <rect 
          x="-50%" y="-50%" width="200%" height="200%" 
          fill="black" 
          mask="url(#star-hole-mask)" 
        />

        {/* LAYER 2: The Gradient Star (Fills the hole initially) */}
        <motion.path
          d={starPath}
          fill="url(#gemini-gradient)"
          initial={{ scale: 0.2, rotate: 0, opacity: 1 }}
          animate={phase === 'expanding' 
            ? { scale: 30, rotate: 90, opacity: 0 } 
            : { scale: 0.2, rotate: 360, opacity: 1 }
          }
          transition={phase === 'expanding' 
            ? { 
                scale: { duration: 1.5, ease: [0.7, 0, 0.3, 1] },
                rotate: { duration: 1.5, ease: [0.7, 0, 0.3, 1] },
                opacity: { duration: 0.5, delay: 0.1 } // Fade out quickly as it expands to reveal app
              } 
            : { 
                scale: { duration: 0 }, // No scale anim during loading
                rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                opacity: { duration: 0 }
              }
          }
          style={{ transformOrigin: '50px 50px' }}
        />
      </svg>

      {/* Loading Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'loading' ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="absolute bottom-12 left-0 right-0 text-center text-[10px] uppercase tracking-[0.4em] font-light opacity-40 text-white pointer-events-none"
      >
        Lumina Drop
      </motion.div>
    </motion.div>
  );
}
