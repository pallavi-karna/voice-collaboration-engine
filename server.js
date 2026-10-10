const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

app.use((req, res) => {
  res.status(404).redirect('/');
});

const activeRooms = new Map();

io.on('connection', (socket) => {
  socket.on('join-room', ({ rawRoomId, username, avatar }) => {
    const roomId = String(rawRoomId || 'main-room')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-_]/g, '')
      .substring(0, 32) || 'MAIN-ROOM';

    const cleanName = String(username || 'Anonymous')
      .trim()
      .substring(0, 24) || 'Anonymous';

    const userProfile = {
      id: socket.id,
      name: cleanName,
      avatar: avatar || null
    };

    socket.join(roomId);

    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Map());
    }
    const roomUsers = activeRooms.get(roomId);
    roomUsers.set(socket.id, userProfile);

    // Notify others in room of new peer identity
    socket.to(roomId).emit('user-joined', userProfile);

    // Send existing peers in room to the newly connected client
    const existingPeers = [];
    roomUsers.forEach((peer, peerId) => {
      if (peerId !== socket.id) existingPeers.push(peer);
    });
    socket.emit('current-peers', existingPeers);

    // WebRTC signaling relay
    socket.on('signal', (data) => {
      if (!data || !data.target || !data.signal) return;
      io.to(data.target).emit('signal', {
        sender: socket.id,
        signal: data.signal
      });
    });

    // Chat relay
    socket.on('send-message', (data) => {
      if (!data || typeof data.text !== 'string') return;
      const cleanText = data.text.trim().substring(0, 500);
      if (!cleanText) return;

      io.to(roomId).emit('receive-message', {
        senderId: socket.id,
        senderName: cleanName,
        text: cleanText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    socket.on('disconnect', () => {
      if (activeRooms.has(roomId)) {
        activeRooms.get(roomId).delete(socket.id);
        if (activeRooms.get(roomId).size === 0) {
          activeRooms.delete(roomId);
        }
      }
      socket.to(roomId).emit('user-left', socket.id);
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});