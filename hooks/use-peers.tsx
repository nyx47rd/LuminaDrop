'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
// Remove npm import
// import type { Peer as PeerType, DataConnection } from 'peerjs';

// Define minimal types for PeerJS since we are using CDN
interface PeerType {
  id: string;
  disconnected: boolean;
  destroyed: boolean;
  on: (event: string, callback: any) => void;
  connect: (id: string, options?: any) => DataConnection;
  reconnect: () => void;
  destroy: () => void;
  disconnect: () => void;
}

interface DataConnection {
  peer: string;
  open: boolean;
  on: (event: string, callback: any) => void;
  send: (data: any) => void;
  close: () => void;
}

interface PeerDevice {
  id: string;
  name: string;
}

interface PeerContextType {
  peers: PeerDevice[];
  myId: string;
  connectionStatus: 'connecting' | 'connected' | 'error';
  connectToPeer: (id: string) => void;
  sendFile: (to: string, file: File) => void;
  incomingFile: { file: File; from: string } | null;
  transferProgress: number;
  setIncomingFile: (val: any) => void;
}

const PeerContext = createContext<PeerContextType | null>(null);

export const PeerProvider = ({ children }: { children: React.ReactNode }) => {
  const [peers, setPeers] = useState<PeerDevice[]>([]);
  const [myId, setMyId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'error'
  >('connecting');
  const [incomingFile, setIncomingFile] = useState<any>(null);
  const [transferProgress, setTransferProgress] = useState(0);

  const peerInstance = useRef<PeerType | null>(null);
  const connections = useRef<{ [key: string]: DataConnection }>({});
  const isDestroyed = useRef(false);

  const peerReadyPromise = useRef<Promise<void> | null>(null);
  const peerReadyResolve = useRef<(() => void) | null>(null);

  const setupConnection = useCallback((conn: DataConnection) => {
    let receivedChunks: ArrayBuffer[] = [];
    let fileMeta: { name: string; size: number; type: string } | null = null;

    conn.on('data', (data: unknown) => {
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (parsed.name && parsed.size !== undefined) {
            fileMeta = parsed;
            receivedChunks = [];
          }
        } catch {
          // not json
        }
      } else if (data instanceof ArrayBuffer) {
        receivedChunks.push(data);
        const receivedSize = receivedChunks.reduce(
          (acc, chunk) => acc + chunk.byteLength,
          0
        );
        if (fileMeta) {
          setTransferProgress((receivedSize / fileMeta.size) * 100);
          if (receivedSize >= fileMeta.size) {
            const blob = new Blob(receivedChunks, { type: fileMeta.type });
            const file = new File([blob], fileMeta.name, { type: fileMeta.type });
            setIncomingFile({ file, from: conn.peer });
            setTransferProgress(0);
            fileMeta = null;
            receivedChunks = [];
          }
        }
      }
    });

    conn.on('open', () => {
      connections.current[conn.peer] = conn;
      setPeers((prev) => [
        ...prev.filter((p) => p.id !== conn.peer),
        { id: conn.peer, name: `Device ${conn.peer.slice(0, 4)}` },
      ]);
    });

    conn.on('close', () => {
      delete connections.current[conn.peer];
      setPeers((prev) => prev.filter((p) => p.id !== conn.peer));
    });

    conn.on('error', (err: any) => {
      console.warn('Connection error:', err);
      delete connections.current[conn.peer];
      setPeers((prev) => prev.filter((p) => p.id !== conn.peer));
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    isDestroyed.current = false;

    peerReadyPromise.current = new Promise<void>((resolve) => {
      peerReadyResolve.current = resolve;
    });

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    const init = async () => {
      // Use window.Peer from CDN
      // const { Peer } = await import('peerjs');
      const Peer = (window as any).Peer;

      if (isDestroyed.current || !Peer) {
        console.error('PeerJS library not loaded');
        return;
      }

      // ★ ID verme — PeerJS kendi üretsin, çakışma olmaz
      const peer = new Peer(undefined, {
        debug: 0, // sessiz
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      peerInstance.current = peer;

      peer.on('open', (id: string) => {
        console.log('✅ Connected — ID:', id);
        setMyId(id);
        setConnectionStatus('connected');
        attempts = 0;
        peerReadyResolve.current?.();
      });

      peer.on('error', (err: any) => {
        console.error('PeerJS error:', err.type);

        if (err.type === 'peer-unavailable') {
          // hedef peer yok, ölümcül değil
          return;
        }

        // network/server hataları — disconnected event zaten gelir
      });

      peer.on('disconnected', () => {
        setConnectionStatus('connecting');

        if (isDestroyed.current || peer.destroyed) return;
        if (attempts >= MAX_ATTEMPTS) {
          console.error('❌ Bağlantı kurulamadı, yeniden oluşturuluyor...');
          // Eski peer'ı yık, sıfırdan oluştur
          peer.destroy();
          attempts = 0;
          reconnectTimer = setTimeout(() => {
            if (!isDestroyed.current) init();
          }, 3000);
          return;
        }

        attempts++;
        const delay = 2000 * attempts;
        console.log(`🔄 Reconnect ${attempts}/${MAX_ATTEMPTS} in ${delay}ms`);

        reconnectTimer = setTimeout(() => {
          if (!isDestroyed.current && !peer.destroyed && peer.disconnected) {
            peer.reconnect();
          }
        }, delay);
      });

      peer.on('close', () => {
        setConnectionStatus('error');
      });

      peer.on('connection', (conn: DataConnection) => {
        setupConnection(conn);
      });

      // Hash ile otomatik bağlantı
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        peerReadyPromise.current?.then(() => {
          if (hash !== peer.id && !peer.destroyed) {
            const conn = peer.connect(hash, { reliable: true });
            setupConnection(conn);
          }
        });
      }
    };

    init();

    return () => {
      isDestroyed.current = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      peerInstance.current?.destroy();
      peerInstance.current = null;
    };
  }, [setupConnection]);

  const connectToPeer = useCallback(
    (peerId: string) => {
      if (!peerInstance.current || peerId === myId) return;
      if (connections.current[peerId]) return;
      const conn = peerInstance.current.connect(peerId, { reliable: true });
      setupConnection(conn);
    },
    [myId, setupConnection]
  );

  const sendFile = useCallback(
    async (to: string, file: File) => {
      let conn = connections.current[to];

      if (!conn || !conn.open) {
        if (!peerInstance.current) return;
        conn = peerInstance.current.connect(to, { reliable: true });
        setupConnection(conn);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('Timeout')),
            10000
          );
          conn.on('open', () => { clearTimeout(timeout); resolve(); });
          conn.on('error', (e: any) => { clearTimeout(timeout); reject(e); });
        });
      }

      conn.send(
        JSON.stringify({ name: file.name, size: file.size, type: file.type })
      );

      const chunkSize = 16384;
      let offset = 0;

      const sendChunk = () => {
        if (offset >= file.size) { setTransferProgress(0); return; }
        const slice = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();
        reader.onload = (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          try { conn.send(buffer); } catch { setTransferProgress(0); return; }
          offset += buffer.byteLength;
          setTransferProgress((offset / file.size) * 100);
          if (offset < file.size) setTimeout(sendChunk, 0);
          else setTransferProgress(0);
        };
        reader.readAsArrayBuffer(slice);
      };
      sendChunk();
    },
    [setupConnection]
  );

  return (
    <PeerContext.Provider
      value={{
        peers, myId, connectionStatus, connectToPeer,
        sendFile, incomingFile, transferProgress, setIncomingFile,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};

export const usePeers = () => {
  const ctx = useContext(PeerContext);
  if (!ctx) throw new Error('usePeers must be used within PeerProvider');
  return ctx;
};