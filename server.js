const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.id);

    socket.on('signal', (data) => {
      io.to(data.target).emit('signal', {
        sender: socket.id,
        signal: data.signal
      });
    });

    socket.on('send-message', (data) => {
      io.to(roomId).emit('receive-message', {
        originalSenderId: socket.id,
        text: data.text,
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
  console.log(`Server running on port ${PORT}`);
});