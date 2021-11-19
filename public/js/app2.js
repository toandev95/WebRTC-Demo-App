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

  const peers = {};

  const addPeer = (sid, initiator) => {
    peers[sid] = new SimplePeer({
      initiator,
      stream: localStream,
      config: {
        iceServers: [
          {
            urls: "turn:34.87.147.10:3478",
            username: "toandev",
            credential: "123456",
          },
        ],
        iceTransportPolicy: "relay",
      },
    });

    peers[sid].on("signal", (data) => {
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

      tracks.forEach(function (track) {
        track.stop();
      });

      videoEl.srcObject = null;
      document.getElementById("peers").removeChild(videoEl);
    }

    if (peers[sid]) {
      peers[sid].destroy();
    }

    delete peers[sid];
  };

  socket.onAny((eventName, args) => {
    console.log(eventName, args);

    const payload = JSON.parse(args);

    switch (eventName) {
      case "connected":
        socket.emit("request_enter_room", {
          // room_name: "Toan",
          room: "6687c994-d183-48cb-a866-b0d9b73948d1",
        });

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

          if (sid == socket.id) {
            return;
          }

          if (!peers[sid]) {
            addPeer(sid, false);
          }

          peers[sid].signal(data);
        }
        break;

      case "left_room":
        {
          const { sid } = payload;

          if (sid && peers[sid]) {
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
