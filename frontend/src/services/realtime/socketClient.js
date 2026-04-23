// src/services/realtime/socketClient.js
import { io } from 'socket.io-client';

let socket;

export function connectSocket(getToken, options = {}) {
  if (socket?.connected) return socket;
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5050', {
    autoConnect: true,
    transports: ['websocket'],
    withCredentials: true,
    auth: {
      token: typeof getToken === 'function' ? getToken() : getToken,
    },
    ...options,
  });

  socket.on('connect', () => {
    console.log('🔌 Connected to realtime server', socket.id);
  });
  socket.on('disconnect', (reason) => {
    console.log('🔌 Disconnected from realtime server', reason);
  });
  socket.on('connect_error', (err) => {
    console.error('❌ Socket connect error:', err.message);
  });

  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  if (socket) socket.disconnect();
}
