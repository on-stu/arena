import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(path.join(__dirname, "../client")));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const players = {};
const MAX_HP = 100;

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  players[socket.id] = {
    x: 400 + Math.random() * 100,
    y: 300 + Math.random() * 100,
    hp: MAX_HP,
  };

  // 현재 유저에게 모든 플레이어 정보 전송
  socket.emit("currentPlayers", players);
  // 자신의 위치를 별도로 전송
  socket.emit("yourPlayer", {
    x: players[socket.id].x,
    y: players[socket.id].y,
  });

  // 다른 사람들에게 새로운 유저 정보 알림
  socket.broadcast.emit("newPlayer", { id: socket.id, ...players[socket.id] });

  // 위치 갱신 수신
  socket.on("move", (pos) => {
    if (players[socket.id]) {
      players[socket.id] = {
        ...players[socket.id],
        x: pos.x,
        y: pos.y,
      };
      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        ...players[socket.id],
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });

  socket.on("shoot", (data) => {
    const payload = {
      id: socket.id,
      x: data.x,
      y: data.y,
      vx: data.vx,
      vy: data.vy,
    };
    socket.broadcast.emit("playerShot", payload);
  });

  socket.on("hit", (targetId) => {
    if (players[targetId]) {
      players[targetId].hp -= 20;
      if (players[targetId].hp <= 0) {
        io.to(targetId).emit("youLose");
        io.to(socket.id).emit("youWin");
        // 리셋하거나 연결 유지
      } else {
        io.emit("updateHp", {
          id: targetId,
          hp: players[targetId].hp,
        });
      }
    }
  });
});

httpServer.listen(1234, () => {
  console.log("Server listening on http://localhost:1234");
});
