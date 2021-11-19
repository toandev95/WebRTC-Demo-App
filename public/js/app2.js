const peers = {};

const main = async () => {
  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
    },
    video: {
      width: {
        max: 720,
      },
      height: {
        max: 480,
      },
    },
  });

  const localVideo = document.getElementById("local");
  localVideo.srcObject = localStream;
  localVideo.width = 500;
  localVideo.muted = true;
  localVideo.autoplay = true;
  localVideo.playsInline = true;

  const socket = io.connect({
    transports: ["websocket"],
    auth: {
      fullname: (window.location.search || "name=Toan").split("name=")[1],
    },
  });

  const addPeer = (sid, initiator) => {
    peers[sid] = new SimplePeer({
      initiator,
      stream: localStream,
      reconnectTimer: 100,
      iceTransportPolicy: "relay",
      trickle: false,
      config: {
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
          {
            urls: "turn:34.87.147.10:3478?transport=tcp",
            username: "toandev",
            credential: "123456",
          },
          {
            urls: "turn:numb.viagenie.ca?transport=udp",
            username: "toandev.95@gmail.com",
            credential: "1234qwer",
          },
        ],
      },
    });

    peers[sid].on("signal", (data) => {
      console.log(data);

      switch (data.type) {
        case "offer":
          socket.emit("request_P2P_connection_offer", {
            sid,
            data,
          });
          break;

        case "answer":
          socket.emit("request_P2P_connection_answer", {
            sid,
            data,
          });
          break;

        case "candidate":
          socket.emit("request_P2P_connection_candidate", {
            sid,
            data,
          });
          break;

        default:
          break;
      }
    });

    peers[sid].on("stream", (stream) => {
      let newVid = document.createElement("video");
      newVid.id = sid;
      newVid.srcObject = stream;
      newVid.width = 300;
      newVid.muted = true;
      newVid.autoplay = true;
      newVid.playsInline = true;

      document.getElementById("peers").appendChild(newVid);
    });
  };

  const removePeer = (sid) => {
    let videoEl = document.getElementById(sid);

    if (videoEl) {
      const tracks = videoEl.srcObject.getTracks();

      tracks.forEach((track) => {
        track.stop();
      });

      videoEl.srcObject = null;
      document.getElementById("peers").removeChild(videoEl);
    }

    peers[sid].destroy();

    delete peers[sid];
  };

  socket.onAny((eventName, args) => {
    console.log(eventName);

    const payload = JSON.parse(args);

    switch (eventName) {
      case "connected":
        {
          socket.emit("request_enter_room", {
            // room_name: "Toan",
            room: "6687c994-d183-48cb-a866-b0d9b73948d1",
          });
        }

        break;

      case "disconnect":
        {
          for (let sid in peers) {
            removePeer(sid);
          }
        }

        break;

      case "entered_room":
        {
          const { sid } = payload.info;

          if (!peers[sid]) {
            addPeer(sid, sid != socket.id);
          }
        }
        break;

      case "request_offer":
      case "request_answer":
      case "request_candidate":
        {
          const { from_user, data } = payload;
          const { sid } = from_user;

          if (!peers[sid]) {
            addPeer(sid, sid == socket.id);
          }

          if (sid == socket.id) {
            return;
          }

          peers[sid].signal(data);
        }
        break;

      case "left_room":
        {
          const { sid } = payload;

          if (peers[sid]) {
            removePeer(sid);
          }
        }
        break;

      default:
        break;
    }
  });
};

main();
