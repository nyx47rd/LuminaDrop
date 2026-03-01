'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';

interface PeerDevice {
  id: string;
  name: string;
}

interface ReceivedFile {
  file: File;
  from: string;
  id: string;
  timestamp: number;
}

interface PeerContextType {
  peers: PeerDevice[];
  myId: string;
  connectionStatus: 'connecting' | 'connected' | 'error';
  connectToPeer: (id: string) => void;
  sendFile: (to: string, file: File) => void;
  receivedFiles: ReceivedFile[];
  transferProgress: number;
  clearReceivedFiles: () => void;
}

const PeerContext = createContext<PeerContextType | null>(null);

// ★ CF Worker URL — protokol olmadan sadece domain
const PEER_SERVER_HOST = 'lumina-peer.yasar-123-sevda.workers.dev';

function waitForPeerJS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Peer) { resolve(); return; }
    let waited = 0;
    const interval = setInterval(() => {
      waited += 100;
      if ((window as any).Peer) {
        clearInterval(interval);
        resolve();
      }
      if (waited > 10000) {
        clearInterval(interval);
        reject(new Error('PeerJS CDN yüklenemedi'));
      }
    }, 100);
  });
}

export const PeerProvider = ({ children }: { children: React.ReactNode }) => {
  const [peers, setPeers] = useState<PeerDevice[]>([]);
  const [myId, setMyId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'error'
  >('connecting');
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [transferProgress, setTransferProgress] = useState(0);

  const peerRef = useRef<any>(null);
  const conns = useRef<Record<string, any>>({});
  const destroyed = useRef(false);

  const setupConn = useCallback((conn: any) => {
    let chunks: ArrayBuffer[] = [];
    let meta: any = null;

    conn.on('data', (data: any) => {
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (parsed.name && parsed.size !== undefined) {
            meta = parsed;
            chunks = [];
            setTransferProgress(0);
          }
        } catch {}
      } else if (data instanceof ArrayBuffer) {
        chunks.push(data);
        const received = chunks.reduce(
          (a: number, c: ArrayBuffer) => a + c.byteLength, 0
        );
        if (meta) {
          setTransferProgress((received / meta.size) * 100);
          if (received >= meta.size) {
            const blob = new Blob(chunks, { type: meta.type });
            const file = new File([blob], meta.name, { type: meta.type });
            setReceivedFiles((prev) => [
              ...prev,
              {
                file,
                from: conn.peer,
                id: Math.random().toString(36).substring(7),
                timestamp: Date.now(),
              },
            ]);
            setTransferProgress(0);
            meta = null;
            chunks = [];
          }
        }
      }
    });

    conn.on('open', () => {
      conns.current[conn.peer] = conn;
      setPeers((p) => [
        ...p.filter((x) => x.id !== conn.peer),
        { id: conn.peer, name: `Device ${conn.peer.slice(0, 4)}` },
      ]);
    });

    conn.on('close', () => {
      delete conns.current[conn.peer];
      setPeers((p) => p.filter((x) => x.id !== conn.peer));
    });

    conn.on('error', (err: any) => {
      console.warn('conn error:', err);
      delete conns.current[conn.peer];
      setPeers((p) => p.filter((x) => x.id !== conn.peer));
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    destroyed.current = false;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      try {
        await waitForPeerJS();
      } catch (e) {
        console.error(e);
        setConnectionStatus('error');
        return;
      }

      if (destroyed.current) return;

      const PeerClass = (window as any).Peer;

      const p = new PeerClass({
        // ★ ID verme — server üretsin (GET /peerjs/id'den alır)
        host: PEER_SERVER_HOST,
        port: 443,
        path: '/peerjs',   // ★ PeerJS varsayılan path
        secure: true,
        key: 'peerjs',     // ★ varsayılan key
        debug: 2,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      peerRef.current = p;

      p.on('open', (id: string) => {
        console.log('✅ Peer ID:', id);
        setMyId(id);
        setConnectionStatus('connected');
      });

      p.on('connection', (conn: any) => {
        setupConn(conn);
      });

      p.on('disconnected', () => {
        console.log('⚠️ Disconnected, reconnecting...');
        setConnectionStatus('connecting');
        if (destroyed.current || p.destroyed) return;
        reconnectTimer = setTimeout(() => {
          if (!destroyed.current && !p.destroyed && p.disconnected) {
            p.reconnect();
          }
        }, 3000);
      });

      p.on('error', (err: any) => {
        console.error('❌ PeerJS error:', err.type, err.message || '');
        if (err.type === 'peer-unavailable') {
          console.warn('Hedef peer bulunamadı');
          return;
        }
        if (err.type === 'server-error' || err.type === 'network') {
          setConnectionStatus('error');
        }
      });

      p.on('close', () => {
        console.log('Peer kapatıldı');
        setConnectionStatus('error');
      });

      // Hash ile otomatik bağlantı
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        p.on('open', (id: string) => {
          if (hash !== id && !p.destroyed) {
            const c = p.connect(hash, { reliable: true });
            setupConn(c);
          }
        });
      }
    };

    init();

    return () => {
      destroyed.current = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [setupConn]);

  const connectToPeer = useCallback(
    (peerId: string) => {
      if (!peerRef.current || peerId === myId || conns.current[peerId]) return;
      const conn = peerRef.current.connect(peerId, { reliable: true });
      setupConn(conn);
    },
    [myId, setupConn]
  );

  const sendFile = useCallback(
    async (to: string, file: File) => {
      let conn = conns.current[to];

      if (!conn || !conn.open) {
        if (!peerRef.current) return;
        conn = peerRef.current.connect(to, { reliable: true });
        setupConn(conn);

        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('Bağlantı timeout')), 10000);
          conn.on('open', () => { clearTimeout(t); resolve(); });
          conn.on('error', (e: any) => { clearTimeout(t); reject(e); });
        });
      }

      conn.send(
        JSON.stringify({ name: file.name, size: file.size, type: file.type })
      );

      const CHUNK = 16384;
      let offset = 0;

      const next = () => {
        if (offset >= file.size) { setTransferProgress(0); return; }
        const slice = file.slice(offset, offset + CHUNK);
        const r = new FileReader();
        r.onload = (e) => {
          const buf = e.target?.result as ArrayBuffer;
          try {
            conn.send(buf);
          } catch {
            setTransferProgress(0);
            return;
          }
          offset += buf.byteLength;
          setTransferProgress((offset / file.size) * 100);
          if (offset < file.size) setTimeout(next, 0);
          else setTransferProgress(0);
        };
        r.readAsArrayBuffer(slice);
      };
      next();
    },
    [setupConn]
  );

  const clearReceivedFiles = useCallback(
    () => setReceivedFiles([]),
    []
  );

  return (
    <PeerContext.Provider
      value={{
        peers,
        myId,
        connectionStatus,
        connectToPeer,
        sendFile,
        receivedFiles,
        transferProgress,
        clearReceivedFiles,
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