'use client';

import React, { useState } from 'react';
import { usePeers } from '@/hooks/use-peers';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Laptop, FileIcon, Download, X, Check, Share2, QrCode, ScanLine, RefreshCw, AlertCircle, History, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function DeviceList() {
  const { peers, sendFile, transferProgress, receivedFiles, clearReceivedFiles, myId, connectToPeer, connectionStatus } = usePeers();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [manualId, setManualId] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}#${myId}` : '';

  const handleShare = () => {
    if (!myId) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId) {
      connectToPeer(manualId);
      setManualId('');
    }
  };

  const handleRetry = () => {
    window.location.reload();
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
        
        {/* Connection Status Indicator */}
        <div className="flex justify-center mt-4">
          {connectionStatus === 'connecting' && (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-50">
              <RefreshCw size={12} className="animate-spin" />
              Connecting to Network...
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-400">
              <AlertCircle size={12} />
              Connection Failed
              <button onClick={handleRetry} className="underline hover:text-white ml-2">Retry</button>
            </div>
          )}
          {connectionStatus === 'connected' && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              className="text-xs uppercase tracking-widest"
            >
              Nearby Devices
            </motion.p>
          )}
        </div>
        
        <div className="flex items-center justify-center gap-4 mt-6">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleShare}
            disabled={!myId || connectionStatus !== 'connected'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {copied ? <Check size={12} /> : <Share2 size={12} />}
            {copied ? 'Copied' : 'Copy Link'}
          </motion.button>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowQR(true)}
            disabled={!myId || connectionStatus !== 'connected'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <QrCode size={12} />
            Show QR
          </motion.button>
        </div>
      </header>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-[32px] flex flex-col items-center gap-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-black text-center">
                <h3 className="text-lg font-medium mb-1">Scan to Connect</h3>
                <p className="text-xs opacity-50">Open camera on mobile device</p>
              </div>
              
              <div className="p-4 bg-white rounded-xl border border-black/5 shadow-inner">
                <QRCodeSVG value={shareUrl} size={200} />
              </div>

              <button 
                onClick={() => setShowQR(false)}
                className="w-full py-3 rounded-full bg-black text-white text-sm font-medium hover:scale-[1.02] transition-transform"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {peers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="col-span-full py-12 text-center flex flex-col items-center gap-6"
            >
              <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center animate-pulse">
                <Smartphone size={32} strokeWidth={1} />
              </div>
              
              <div className="space-y-2">
                <p className="text-xs tracking-widest uppercase opacity-50">No devices found</p>
                <p className="text-[10px] opacity-30 max-w-[200px] mx-auto">
                  Share the link or QR code to connect instantly.
                </p>
              </div>

              {/* Manual Connect Form */}
              <form onSubmit={handleManualConnect} className="flex items-center gap-2 mt-4 bg-white/5 p-1 pl-4 rounded-full border border-white/10 focus-within:border-white/30 transition-colors">
                <ScanLine size={14} className="opacity-50" />
                <input 
                  type="text" 
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="Enter Peer ID..."
                  className="bg-transparent border-none outline-none text-xs w-32 placeholder:text-white/20"
                />
                <button 
                  type="submit"
                  disabled={!manualId}
                  className="px-4 py-2 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-wider hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Connect
                </button>
              </form>
              
              {myId && (
                <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-[10px] opacity-30 uppercase tracking-widest mb-1">Your ID</p>
                  <code className="text-xs font-mono select-all">{myId}</code>
                </div>
              )}
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
        {receivedFiles.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 p-4 z-40 pointer-events-none"
          >
            <div className="max-w-md mx-auto bg-black/90 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-2xl pointer-events-auto max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <History size={14} />
                  Received Files ({receivedFiles.length})
                </h3>
                <button 
                  onClick={clearReceivedFiles}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="space-y-3">
                {receivedFiles.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shrink-0">
                      <FileIcon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.file.name}</p>
                      <p className="text-[10px] opacity-40">
                        {(item.file.size / 1024 / 1024).toFixed(2)} MB • from {item.from.slice(0, 4)}
                      </p>
                    </div>
                    <a 
                      href={URL.createObjectURL(item.file)}
                      download={item.file.name}
                      className="p-2 rounded-full bg-white text-black hover:scale-110 transition-transform"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
