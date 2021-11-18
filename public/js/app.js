(async () => {
  const localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  const localVideo = document.querySelector("#local");
  localVideo.srcObject = localStream;
  localVideo.width = 500;
  localVideo.muted = true;
  localVideo.autoplay = true;
  localVideo.playsInline = true;

  const conns = {};

  const socket = io.connect({
    transports: ["websocket"],
    auth: {
      fullname: window.location.search.split("name=")[1],
    },
  });

  const createConn = async (sid) => {
    conns[sid] = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
          ],
        },
      ],
    });

    conns[sid].onaddstream = (ev) => {
      // console.log(ev);

      const remoteVideo = document.createElement("video");
      remoteVideo.setAttribute("data-socket", sid);
      remoteVideo.srcObject = ev.stream;
      remoteVideo.width = 300;
      remoteVideo.muted = false;
      remoteVideo.autoplay = true;
      remoteVideo.playsInline = true;

      document.querySelector("#conns").appendChild(remoteVideo);
    };

    conns[sid].onicecandidate = (ev) => {
      // console.log(ev);

      if (ev.candidate && sid != socket.id) {
        socket.emit("request_P2P_connection_candidate", {
          sid,
          data: {
            candidate: ev.candidate.candidate,
            sdpMid: ev.candidate.sdpMid,
            sdpMLineIndex: ev.candidate.sdpMLineIndex,
          },
        });
      }
    };

    localStream.getTracks().forEach((track) => {
      conns[sid].addTrack(track, localStream);
    });

    if (sid != socket.id) {
      const desc = await conns[sid].createOffer();
      await conns[sid].setLocalDescription(desc);

      socket.emit("request_P2P_connection_offer", {
        sid,
        data: desc,
      });
    }
  };

  socket.on("connected", (ev) => {
    // console.log(ev);

    socket.emit("request_enter_room", {
      // room_name: "Toan",
      room: "6687c994-d183-48cb-a866-b0d9b73948d1",
    });
  });

  socket.onAny(async (eventName, payload) => {
    console.log(eventName, payload);

    switch (eventName) {
      case "entered_room":
        {
          const { joint, info } = JSON.parse(payload);

          if (joint && info) {
            const { sid } = info;

            if (!conns[sid]) {
              await createConn(sid);
            }
          }
        }
        break;

      case "request_offer":
        {
          const j = JSON.parse(payload);

          const sid = j.from_user.sid;
          const data = j.data;

          if (!conns[sid]) {
            await createConn(sid);

            if (sid != socket.id) {
              await conns[sid].setRemoteDescription(data);

              const desc = await conns[sid].createAnswer();
              await conns[sid].setLocalDescription(
                new RTCSessionDescription(desc)
              );

              socket.emit("request_P2P_connection_answer", {
                sid,
                data: desc,
              });
            }
          }
        }
        break;

      case "request_answer":
        {
          const j = JSON.parse(payload);

          if (j.from_user.sid != socket.id) {
            const sid = j.from_user.sid;
            const data = j.data;

            await conns[sid].setRemoteDescription(data);
          }
        }
        break;

      case "request_candidate":
        {
          const j = JSON.parse(payload);

          if (j.from_user.sid != socket.id) {
            const sid = j.from_user.sid;
            const data = j.data;

            await conns[sid].addIceCandidate(new RTCIceCandidate(data));
          }
        }
        break;

      case "left_room":
        {
          const j = JSON.parse(payload);

          if (j.sid && conns[j.sid]) {
            const sid = j.sid;

            delete conns[sid];

            const video = document.querySelector(`[data-socket=${sid}]`);
            document.querySelector("#conns").removeChild(video);
          }
        }
        break;

      default:
        break;
    }
  });
})();
