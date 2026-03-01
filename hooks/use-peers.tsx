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

// ★★★ Render.com URL'ini buraya yaz ★★★
const PEER_SERVER_HOST = 'lumina-peer.onrender.com';

function waitForPeerJS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Peer) { resolve(); return; }
    let waited = 0;
    const check = setInterval(() => {
      waited += 100;
      if ((window as any).Peer) { clearInterval(check); resolve(); }
      if (waited > 10000) { clearInterval(check); reject('PeerJS yüklenemedi'); }
    }, 100);
  });
}

export const PeerProvider = ({ children }: { children: React.ReactNode }) => {
  const [peers, setPeers] = useState<PeerDevice[]>([]);
  const [myId, setMyId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'error'
  >('connecting');
  const [incomingFile, setIncomingFile] = useState<any>(null);
  const [transferProgress, setTransferProgress] = useState(0);

  const peer = useRef<any>(null);
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
          }
        } catch {}
      } else if (data instanceof ArrayBuffer) {
        chunks.push(data);
        const received = chunks.reduce((a: number, c: ArrayBuffer) => a + c.byteLength, 0);
        if (meta) {
          setTransferProgress((received / meta.size) * 100);
          if (received >= meta.size) {
            const blob = new Blob(chunks, { type: meta.type });
            const file = new File([blob], meta.name, { type: meta.type });
            setIncomingFile({ file, from: conn.peer });
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
        ...p.filter((x: PeerDevice) => x.id !== conn.peer),
        { id: conn.peer, name: `Device ${conn.peer.slice(0, 4)}` },
      ]);
    });

    conn.on('close', () => {
      delete conns.current[conn.peer];
      setPeers((p) => p.filter((x: PeerDevice) => x.id !== conn.peer));
    });

    conn.on('error', () => {
      delete conns.current[conn.peer];
      setPeers((p) => p.filter((x: PeerDevice) => x.id !== conn.peer));
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    destroyed.current = false;

    let reconnectTimer: any = null;

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

      // ★★★ KENDİ SUNUCUNA BAĞLAN ★★★
      const p = new PeerClass(undefined, {
        host: PEER_SERVER_HOST,
        port: 443,
        path: '/',
        secure: true,
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      peer.current = p;

      p.on('open', (id: string) => {
        console.log('✅ Peer ID:', id);
        setMyId(id);
        setConnectionStatus('connected');
      });

      p.on('connection', (conn: any) => setupConn(conn));

      p.on('disconnected', () => {
        setConnectionStatus('connecting');
        if (destroyed.current || p.destroyed) return;

        reconnectTimer = setTimeout(() => {
          if (!destroyed.current && !p.destroyed && p.disconnected) {
            p.reconnect();
          }
        }, 3000);
      });

      p.on('error', (err: any) => {
        console.warn('PeerJS:', err.type, err.message || '');
        if (err.type === 'peer-unavailable') return;
      });

      p.on('close', () => setConnectionStatus('error'));

      // Hash ile bağlan
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        p.on('open', () => {
          if (hash !== p.id) {
            const c = p.connect(hash, { reliable: true });
            setupConn(c);
          }
        });
      }
    };

    init();

    return () => {
      destroyed.current = true;
      clearTimeout(reconnectTimer);
      peer.current?.destroy();
      peer.current = null;
    };
  }, [setupConn]);

  const connectToPeer = useCallback(
    (peerId: string) => {
      if (!peer.current || peerId === myId || conns.current[peerId]) return;
      const conn = peer.current.connect(peerId, { reliable: true });
      setupConn(conn);
    },
    [myId, setupConn]
  );

  const sendFile = useCallback(
    async (to: string, file: File) => {
      let conn = conns.current[to];

      if (!conn || !conn.open) {
        if (!peer.current) return;
        conn = peer.current.connect(to, { reliable: true });
        setupConn(conn);

        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject('timeout'), 10000);
          conn.on('open', () => { clearTimeout(t); resolve(); });
          conn.on('error', (e: any) => { clearTimeout(t); reject(e); });
        });
      }

      conn.send(JSON.stringify({
        name: file.name, size: file.size, type: file.type,
      }));

      const CHUNK = 16384;
      let offset = 0;

      const next = () => {
        if (offset >= file.size) { setTransferProgress(0); return; }
        const slice = file.slice(offset, offset + CHUNK);
        const r = new FileReader();
        r.onload = (e) => {
          const buf = e.target?.result as ArrayBuffer;
          try { conn.send(buf); } catch { setTransferProgress(0); return; }
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