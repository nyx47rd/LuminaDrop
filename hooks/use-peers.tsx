'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Peer, DataConnection } from 'peerjs';

interface PeerDevice {
  id: string;
  name: string;
}

interface PeerContextType {
  peers: PeerDevice[];
  myId: string;
  sendFile: (to: string, file: File) => void;
  incomingFile: { file: File; from: string } | null;
  transferProgress: number;
  setIncomingFile: (val: any) => void;
}

const PeerContext = createContext<PeerContextType | null>(null);

export const PeerProvider = ({ children }: { children: React.ReactNode }) => {
  const [peers, setPeers] = useState<PeerDevice[]>([]);
  const [myId, setMyId] = useState<string>('');
  const [incomingFile, setIncomingFile] = useState<any>(null);
  const [transferProgress, setTransferProgress] = useState(0);
  
  const peerInstance = useRef<Peer | null>(null);
  const connections = useRef<{ [key: string]: DataConnection }>({});

  const setupConnection = useCallback((conn: DataConnection) => {
    let receivedChunks: ArrayBuffer[] = [];
    let fileMeta: { name: string; size: number; type: string } | null = null;

    conn.on('data', (data: any) => {
      if (typeof data === 'string') {
        try {
          fileMeta = JSON.parse(data);
          receivedChunks = [];
        } catch (e) {
          // Not JSON, ignore
        }
      } else if (data instanceof ArrayBuffer) {
        receivedChunks.push(data);
        const receivedSize = receivedChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
        if (fileMeta) {
          setTransferProgress((receivedSize / fileMeta.size) * 100);
          if (receivedSize >= fileMeta.size) {
            const blob = new Blob(receivedChunks, { type: fileMeta.type });
            const file = new File([blob], fileMeta.name, { type: fileMeta.type });
            setIncomingFile({ file, from: conn.peer });
            setTransferProgress(0);
          }
        }
      }
    });

    conn.on('open', () => {
      connections.current[conn.peer] = conn;
      setPeers(prev => [...prev.filter(p => p.id !== conn.peer), { id: conn.peer, name: `Device ${conn.peer.slice(0, 4)}` }]);
    });

    conn.on('close', () => {
      delete connections.current[conn.peer];
      setPeers(prev => prev.filter(p => p.id !== conn.peer));
    });
  }, []);

  useEffect(() => {
    const peer = new Peer();
    peerInstance.current = peer;

    peer.on('open', (id) => {
      setMyId(id);
      console.log('My Peer ID:', id);
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    // Handle room/lobby logic via URL hash if present
    const hash = window.location.hash.replace('#', '');
    if (hash && hash !== myId) {
      const conn = peer.connect(hash);
      setupConnection(conn);
    }

    return () => {
      peer.destroy();
    };
  }, [setupConnection, myId]);

  const sendFile = async (to: string, file: File) => {
    let conn = connections.current[to];
    if (!conn) {
      conn = peerInstance.current!.connect(to);
      setupConnection(conn);
      
      await new Promise<void>((resolve) => {
        conn.on('open', () => resolve());
      });
    }

    // Send metadata
    conn.send(JSON.stringify({ name: file.name, size: file.size, type: file.type }));

    // Send file in chunks
    const chunkSize = 16384;
    let offset = 0;

    const sendChunk = () => {
      const slice = file.slice(offset, offset + chunkSize);
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        conn.send(buffer);
        offset += buffer.byteLength;
        setTransferProgress((offset / file.size) * 100);

        if (offset < file.size) {
          // Small delay to avoid saturating the data channel
          setTimeout(sendChunk, 1);
        } else {
          setTransferProgress(0);
        }
      };
      
      reader.readAsArrayBuffer(slice);
    };

    sendChunk();
  };

  return (
    <PeerContext.Provider value={{ peers, myId, sendFile, incomingFile, transferProgress, setIncomingFile }}>
      {children}
    </PeerContext.Provider>
  );
};

export const usePeers = () => {
  const context = useContext(PeerContext);
  if (!context) throw new Error('usePeers must be used within PeerProvider');
  return context;
};
