'use client';

import React, { useState } from 'react';
import { PeerProvider } from '@/hooks/use-peers';
import DeviceList from '@/components/DeviceList';
import SplashScreen from '@/components/SplashScreen';
import { motion, AnimatePresence } from 'motion/react';

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <PeerProvider>
      <main className="relative min-h-screen bg-black text-white selection:bg-white selection:text-black overflow-hidden">
        {/* The App Content (Always present, revealed by Splash) */}
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
          <DeviceList />
          
          <motion.footer 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            transition={{ delay: 1 }}
            className="fixed bottom-8 text-[10px] uppercase tracking-[0.2em] font-medium"
          >
            End-to-End Encrypted LAN Transfer
          </motion.footer>
        </div>

        {/* Subtle background noise/texture */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.05] z-[-1] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

        {/* The Splash Overlay */}
        {showSplash && (
          <SplashScreen onComplete={() => setShowSplash(false)} />
        )}
      </main>
    </PeerProvider>
  );
}
