/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthContext } from './AuthContext';
import { authAPI } from '../services/api.service';

const SocketContext = createContext(null);
let socketClient = null;

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuthContext();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      socketClient?.disconnect();
      socketClient = null;
      return undefined;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL
      || new URL(import.meta.env.VITE_API_URL || 'http://localhost:5001/api').origin;

    const client = io(socketUrl, {
      autoConnect: true,
      auth: { token },
      transports: ['websocket'],
    });

    socketClient = client;

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    
    const handleConnectError = async (error) => {
      if (error.message.includes('Authentication error') || error.message.includes('token')) {
        try {
          await authAPI.refreshToken();
          // The token change will naturally re-run this effect since it's in the dependency array
        } catch (refreshErr) {
          console.error('[Socket] Failed to refresh token:', refreshErr);
          client.disconnect();
        }
      }
    };

    client.on('connect', handleConnect);
    client.on('disconnect', handleDisconnect);
    client.on('connect_error', handleConnectError);

    return () => {
      client.off('connect', handleConnect);
      client.off('disconnect', handleDisconnect);
      client.off('connect_error', handleConnectError);
      client.disconnect();
      if (socketClient === client) {
        socketClient = null;
      }
    };
  }, [isAuthenticated, token]);

  const value = useMemo(() => ({ socket: socketClient, isConnected: Boolean(isAuthenticated && connected) }), [connected, isAuthenticated]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }

  return context;
};
