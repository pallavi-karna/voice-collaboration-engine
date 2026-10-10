const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Serve static frontend
app.use(express.static('public'));

// Basic 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).redirect('/');
});

io.on('connection', (socket) => {
  socket.on('join-room', (rawRoomId) => {
    // Sanitize room ID: alphanumeric, dashes, and underscores only (max 32 chars)
    const roomId = String(rawRoomId || 'general')
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .substring(0, 32) || 'general';

    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.id);

    // Secure WebRTC signaling relay
    socket.on('signal', (data) => {
      if (!data || !data.target || !data.signal) return;
      io.to(data.target).emit('signal', {
        sender: socket.id,
        signal: data.signal
      });
    });

    // Chat relay with text sanitization
    socket.on('send-message', (data) => {
      if (!data || typeof data.text !== 'string') return;
      const cleanText = data.text.trim().substring(0, 500);
      if (!cleanText) return;

      io.to(roomId).emit('receive-message', {
        originalSenderId: socket.id,
        text: cleanText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-left', socket.id);
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
