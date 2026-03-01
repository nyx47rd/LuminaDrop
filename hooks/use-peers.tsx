'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { Peer as PeerType, DataConnection } from 'peerjs';

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
  const isReconnecting = useRef(false);
  const isDestroyed = useRef(false);
  // ─── Peer henüz "open" olmadıysa beklemek için ───
  const peerReadyPromise = useRef<Promise<void> | null>(null);
  const peerReadyResolve = useRef<(() => void) | null>(null);

  // ────────────────────────────────────────────
  // Gelen bağlantıyı / kurduğumuz bağlantıyı dinle
  // ────────────────────────────────────────────
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
          // JSON değilse yoksay
        }
      } else if (data instanceof ArrayBuffer) {
        receivedChunks.push(data);
        const receivedSize = receivedChunks.reduce(
          (acc, chunk) => acc + chunk.byteLength,
          0,
        );
        if (fileMeta) {
          setTransferProgress((receivedSize / fileMeta.size) * 100);
          if (receivedSize >= fileMeta.size) {
            const blob = new Blob(receivedChunks, { type: fileMeta.type });
            const file = new File([blob], fileMeta.name, {
              type: fileMeta.type,
            });
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

    conn.on('error', (err) => {
      console.warn('DataConnection error:', err);
      delete connections.current[conn.peer];
      setPeers((prev) => prev.filter((p) => p.id !== conn.peer));
    });
  }, []);

  // ────────────────────────────────────────────
  // Peer oluşturma – yalnızca tarayıcıda
  // ────────────────────────────────────────────
  useEffect(() => {
    // ★ SSR koruması – window yoksa hiçbir şey yapma
    if (typeof window === 'undefined') return;

    isDestroyed.current = false;

    // "peer hazır" sözü
    peerReadyPromise.current = new Promise<void>((resolve) => {
      peerReadyResolve.current = resolve;
    });

    let peer: PeerType;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // ★ PeerJS'i dinamik olarak import et (SSR'de require patlamaz)
    import('peerjs').then(({ Peer }) => {
      if (isDestroyed.current) return; // unmount olduysa vazgeç

      // Benzersiz, PeerJS-uyumlu ID (yalnızca harf-rakıt-tire)
      const newId =
        'u-' +
        crypto.getRandomValues(new Uint32Array(2)).join('-');

      peer = new Peer(newId, {
        // PeerServer Cloud varsayılan ayarlar zaten secure
        // Kendi sunucunuz varsa host/port/path ekleyin
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
        debug: 1, // 0 = sessiz, 3 = çok detaylı
      });

      peerInstance.current = peer;

      // ── open ──
      peer.on('open', (id) => {
        console.log('Peer açıldı – ID:', id);
        setMyId(id);
        setConnectionStatus('connected');
        isReconnecting.current = false;
        peerReadyResolve.current?.();
      });

      // ── error ──
      peer.on('error', (err: any) => {
        console.error('PeerJS hatası:', err.type, err.message ?? err);

        switch (err.type) {
          case 'unavailable-id':
            // ID çakışması – yeni ID ile tekrar oluşturmak lazım
            // ama genelde random ID ile olmaz
            setConnectionStatus('error');
            break;

          case 'peer-unavailable':
            // Bağlanmak istediğimiz peer yok – ölümcül değil
            console.warn('Hedef peer bulunamadı.');
            break;

          case 'network':
          case 'server-error':
          case 'socket-error':
          case 'socket-closed':
            // Ağ hatası – disconnect event'i zaten tetiklenir,
            // orada reconnect yapacağız
            break;

          default:
            break;
        }
      });

      // ── disconnected ──
      peer.on('disconnected', () => {
        console.log('Peer sunucudan koptu.');
        setConnectionStatus('connecting');

        if (
          !isReconnecting.current &&
          !peer.destroyed &&
          !isDestroyed.current
        ) {
          isReconnecting.current = true;
          console.log('3 sn sonra yeniden bağlanılacak…');
          reconnectTimer = setTimeout(() => {
            if (peer && !peer.destroyed && peer.disconnected) {
              console.log('Reconnect…');
              try {
                peer.reconnect();
              } catch (e) {
                console.error('Reconnect başarısız:', e);
              }
            }
            isReconnecting.current = false;
          }, 3000);
        }
      });

      // ── close ──
      peer.on('close', () => {
        console.log('Peer tamamen kapandı.');
        setConnectionStatus('error');
      });

      // ── gelen bağlantı ──
      peer.on('connection', (conn) => {
        setupConnection(conn);
      });

      // ── URL hash ile otomatik bağlantı ──
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        // Peer açılana kadar bekle, sonra bağlan
        peerReadyPromise.current?.then(() => {
          if (hash !== peer.id && !peer.destroyed) {
            const conn = peer.connect(hash, { reliable: true });
            setupConnection(conn);
          }
        });
      }
    });

    // ── Cleanup ──
    return () => {
      isDestroyed.current = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (peerInstance.current) {
        peerInstance.current.destroy();
        peerInstance.current = null;
      }
    };
  }, [setupConnection]);

  // ────────────────────────────────────────────
  // Başka bir peer'a bağlan
  // ────────────────────────────────────────────
  const connectToPeer = useCallback(
    (peerId: string) => {
      if (!peerInstance.current || peerId === myId) return;

      // Zaten bağlıysak tekrar bağlanma
      if (connections.current[peerId]) return;

      const conn = peerInstance.current.connect(peerId, { reliable: true });
      setupConnection(conn);
    },
    [myId, setupConnection],
  );

  // ────────────────────────────────────────────
  // Dosya gönder
  // ────────────────────────────────────────────
  const sendFile = useCallback(
    async (to: string, file: File) => {
      let conn = connections.current[to];

      if (!conn || !conn.open) {
        if (!peerInstance.current) return;
        conn = peerInstance.current.connect(to, { reliable: true });
        setupConnection(conn);

        // Bağlantı açılana kadar bekle (timeout ile)
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Bağlantı zaman aşımı')), 10000);
          conn.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });
          conn.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      }

      // Meta veri gönder
      conn.send(
        JSON.stringify({ name: file.name, size: file.size, type: file.type }),
      );

      // Chunk'larla dosya gönder
      const chunkSize = 16384; // 16 KB
      let offset = 0;

      const sendNextChunk = () => {
        if (offset >= file.size) {
          setTransferProgress(0);
          return;
        }

        const slice = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();

        reader.onload = (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          try {
            conn.send(buffer);
          } catch (err) {
            console.error('Chunk gönderilemedi:', err);
            setTransferProgress(0);
            return;
          }
          offset += buffer.byteLength;
          setTransferProgress((offset / file.size) * 100);

          if (offset < file.size) {
            // Data channel'ı boğmamak için küçük gecikme
            setTimeout(sendNextChunk, 0);
          } else {
            setTransferProgress(0);
          }
        };

        reader.onerror = () => {
          console.error('Dosya okunamadı');
          setTransferProgress(0);
        };

        reader.readAsArrayBuffer(slice);
      };

      sendNextChunk();
    },
    [setupConnection],
  );

  return (
    <PeerContext.Provider
      value={{
        peers,
        myId,
        connectionStatus,
        connectToPeer,
        sendFile,
        incomingFile,
        transferProgress,
        setIncomingFile,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};

export const usePeers = () => {
  const context = useContext(PeerContext);
  if (!context) throw new Error('usePeers must be used within PeerProvider');
  return context;
};