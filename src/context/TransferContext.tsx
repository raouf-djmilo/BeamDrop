import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { P2PTransferManager, TransferFile, TextPayload } from '../utils/p2p';
import { playChime } from '../utils/audio';

interface TransferContextValue {
  transferManager: P2PTransferManager;
  isConnected: boolean;
  peerId: string;
  connectedPeers: string[];
  currentTransfer: {
    fileName: string;
    progress: number;
    speed: number;
    fileSize: number;
  } | null;
  transferCompleted: boolean;
  activeQueue: File[];
  currentQueueIndex: number;
  isQueueSending: boolean;
  queueCompletedCount: number;
  startSendQueue: (files: File[]) => Promise<void>;
  cancelQueue: () => void;
  sentHistory: { name: string; size: number; time: string; type: string }[];
  clearSentHistory: () => void;
  e2eeKeyHex: string;
  setE2eeKeyHex: (hex: string) => void;
}

const TransferContext = createContext<TransferContextValue | null>(null);

export const TransferProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const transferManager = useMemo(() => new P2PTransferManager(), []);
  const [peerId, setPeerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [e2eeKeyHex, setE2eeKeyHex] = useState<string>('');

  const [activeQueue, setActiveQueue] = useState<File[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [isQueueSending, setIsQueueSending] = useState<boolean>(false);
  const [queueCompletedCount, setQueueCompletedCount] = useState<number>(0);

  const [currentTransfer, setCurrentTransfer] = useState<{
    fileName: string;
    progress: number;
    speed: number;
    fileSize: number;
  } | null>(null);
  const [transferCompleted, setTransferCompleted] = useState<boolean>(false);
  const [sentHistory, setSentHistory] = useState<{ name: string; size: number; time: string; type: string }[]>([]);

  useEffect(() => {
    transferManager.onConnected = () => {
      setIsConnected(true);
      setConnectedPeers(transferManager.connectedPeersList);
    };

    transferManager.onDisconnected = () => {
      setIsConnected(false);
      setConnectedPeers([]);
    };

    transferManager.onPeersChange = (peers: string[]) => {
      setConnectedPeers(peers);
      setIsConnected(peers.length > 0 || transferManager.isConnected);
    };

    transferManager.init().then((id: string) => {
      setPeerId(id);
    }).catch((err: any) => {
      console.error('[Global Transfer State] Peer init failed:', err);
    });

    return () => {
      transferManager.destroy();
    };
  }, [transferManager]);

  const startSendQueue = async (files: File[]) => {
    if (files.length === 0) return;
    if (!transferManager.isConnected && transferManager.getConnectedDevicesCount() === 0) {
      throw new Error('No device connected. Please scan QR or select Radar peer first.');
    }

    setIsQueueSending(true);
    setActiveQueue(files);
    setCurrentQueueIndex(0);
    setQueueCompletedCount(0);
    setTransferCompleted(false);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentQueueIndex(i);
      setCurrentTransfer({
        fileName: file.name,
        progress: 0,
        speed: 0,
        fileSize: file.size
      });

      try {
        await transferManager.sendFile(file, (progress: number, speed: number) => {
          setCurrentTransfer((prev) => prev ? { ...prev, progress, speed } : null);
        });

        setQueueCompletedCount((prev) => prev + 1);
        setSentHistory((prev) => [
          {
            name: file.name,
            size: file.size,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: file.type || 'file'
          },
          ...prev
        ]);
      } catch (err) {
        console.error('[Transfer Queue] File send failed:', err);
        break;
      }
    }

    playChime('complete');
    setIsQueueSending(false);
    setCurrentTransfer(null);
    setTransferCompleted(true);
  };

  const cancelQueue = () => {
    setIsQueueSending(false);
    setActiveQueue([]);
    setCurrentTransfer(null);
  };

  const clearSentHistory = () => {
    setSentHistory([]);
  };

  return (
    <TransferContext.Provider
      value={{
        transferManager,
        isConnected,
        peerId,
        connectedPeers,
        currentTransfer,
        transferCompleted,
        activeQueue,
        currentQueueIndex,
        isQueueSending,
        queueCompletedCount,
        startSendQueue,
        cancelQueue,
        sentHistory,
        clearSentHistory,
        e2eeKeyHex,
        setE2eeKeyHex
      }}
    >
      {children}
    </TransferContext.Provider>
  );
};

export const useTransfer = () => {
  const ctx = useContext(TransferContext);
  if (!ctx) {
    throw new Error('useTransfer must be used within TransferProvider');
  }
  return ctx;
};
