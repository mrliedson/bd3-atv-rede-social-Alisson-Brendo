require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const Post = require('./models/post'); // importando o model

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos
app.use(express.static('public'));

// Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
.catch(err => console.error('❌ Erro ao conectar ao MongoDB Atlas:', err.message));

// Rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO
io.on('connection', async (socket) => {
  console.log('🟢 Novo cliente conectado:', socket.id);

  // Enviar todos os posts existentes para o cliente
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(100);
    socket.emit('previousMessage', posts);
  } catch (err) {
    console.error('Erro ao buscar posts:', err);
  }

  // Receber post do cliente
  socket.on('sendMessage', async (data) => {
    try {
      if (!data || !data.author || !data.message) return;

      const newPost = new Post({
        author: data.author,
        title: data.title,
        message: data.message
      });

      const savedPost = await newPost.save(); // <<< É aqui que salva no banco

      io.emit('receivedMessage', savedPost);
    } catch (err) {
      console.error('Erro ao salvar post:', err);
    }
  });

  socket.on('deleteMessage', async (postId) => {
    try {
        // Deleta do MongoDB
        await Post.findByIdAndDelete(postId);

        // Notifica todos os clientes para remover do DOM
        io.emit('removedMessage', postId);
    } catch (err) {
        console.error('Erro ao deletar post:', err);
    }
});


  socket.on('disconnect', () => {
    console.log('🔴 Cliente desconectado:', socket.id);
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
