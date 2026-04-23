// src/realtime/socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

export function initSocket(httpServer, options = {}) {
  io = new Server(httpServer, {
    ...options,
  });

  // Middleware for JWT auth during handshake
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '') || null;
      if (!token) return next(new Error('NO_TOKEN'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id || decoded._id || decoded.userId };
      // Join user room for targeted emits
      socket.join(`user:${socket.user.id}`);
      return next();
    } catch (err) {
      return next(new Error('AUTH_FAILED'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id;
    console.log(`🔌 Socket connected: ${socket.id} (user:${userId})`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log('📡 Socket.IO initialized');
}

export function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function getIO() { return io; }
