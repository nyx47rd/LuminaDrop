'use client';

import React, { useState } from 'react';
import { usePeers } from '@/hooks/use-peers';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Laptop, Monitor, FileIcon, Download, X, Check, Share2 } from 'lucide-react';

export default function DeviceList() {
  const { peers, sendFile, transferProgress, incomingFile, setIncomingFile, myId } = usePeers();
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#${myId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, peerId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      sendFile(peerId, file);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-12">
      <header className="mb-12 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-light tracking-tight"
        >
          Lumina
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.2 }}
          className="text-xs uppercase tracking-widest mt-2"
        >
          Nearby Devices
        </motion.p>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleShare}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-[10px] uppercase tracking-widest"
        >
          {copied ? <Check size={12} /> : <Share2 size={12} />}
          {copied ? 'Copied' : 'Share Link'}
        </motion.button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {peers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              exit={{ opacity: 0 }}
              className="col-span-full py-20 text-center border-2 border-dashed border-black/10 rounded-[32px]"
            >
              Searching...
            </motion.div>
          ) : (
            peers.map((peer) => (
              <motion.div
                key={peer.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative glass p-6 rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all hover:border-black/20"
              >
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors duration-500">
                  <Laptop size={24} strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{peer.name}</p>
                  <p className="text-[10px] opacity-30 uppercase tracking-tighter">Ready to receive</p>
                </div>

                <label className="absolute inset-0 cursor-pointer">
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={(e) => handleFileChange(e, peer.id)}
                  />
                </label>

                {transferProgress > 0 && transferProgress < 100 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 overflow-hidden rounded-b-[32px]">
                    <motion.div 
                      className="h-full bg-white"
                      initial={{ width: 0 }}
                      animate={{ width: `${transferProgress}%` }}
                    />
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {incomingFile && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md glass p-6 rounded-[32px] shadow-2xl z-50"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center">
                <FileIcon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{incomingFile.file.name}</p>
                <p className="text-xs opacity-40">Incoming from {incomingFile.from.slice(0, 4)}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIncomingFile(null)}
                  className="p-2 rounded-full hover:bg-white/5 transition-colors"
                >
                  <X size={20} />
                </button>
                <a 
                  href={URL.createObjectURL(incomingFile.file)}
                  download={incomingFile.file.name}
                  onClick={() => setIncomingFile(null)}
                  className="p-2 rounded-full bg-white text-black hover:scale-110 transition-transform"
                >
                  <Download size={20} />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
