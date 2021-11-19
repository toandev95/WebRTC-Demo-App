const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const peers = {};

io.use((socket, next) => {
  const { fullname } = socket.handshake.auth;

  if (fullname) {
    next();
  } else {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const sid = socket.id;
  const { fullname } = socket.handshake.auth;

  peers[sid] = socket;

  socket.on("request_enter_room", () => {
    io.sockets.emit(
      "entered_room",
      JSON.stringify({
        joint: new Date(),
        info: { sid, fullname },
      })
    );
  });

  socket.on("request_P2P_connection_offer", (ev) => {
    peers[ev.sid].emit(
      "request_offer",
      JSON.stringify({
        from_user: { sid },
        data: ev.data,
      })
    );
  });

  socket.on("request_P2P_connection_answer", (ev) => {
    peers[ev.sid].emit(
      "request_answer",
      JSON.stringify({
        from_user: { sid },
        data: ev.data,
      })
    );
  });

  socket.on("request_P2P_connection_candidate", (ev) => {
    peers[ev.sid].emit(
      "request_candidate",
      JSON.stringify({
        from_user: { sid },
        data: ev.data,
      })
    );
  });

  socket.on("disconnect", () => {
    io.sockets.emit("left_room", JSON.stringify({ sid }));

    delete peers[sid];
  });

  socket.emit(
    "connected",
    JSON.stringify({
      info: {
        connected: new Date(),
        sid,
        fullname,
      },
    })
  );

  console.log("Có client kết nối!", socket.id);
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Đang chạy trên *:3000");
});
