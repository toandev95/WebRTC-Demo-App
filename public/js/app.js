// const updateBandwidth = (sdp, bandwidth) => {
//   if (sdp.indexOf("b=AS:") == -1) {
//     sdp = sdp.replace(/c=IN (.*)\r\n/, "c=IN $1\r\nb=AS:" + bandwidth + "\r\n");
//   } else {
//     sdp = sdp.replace(new RegExp("b=AS:.*\r\n"), "b=AS:" + bandwidth + "\r\n");
//   }

//   return sdp;
// };

// const removeBandwidth = (sdp) =>
//   sdp.replace(/b=AS:.*\r\n/, "").replace(/b=TIAS:.*\r\n/, "");

(async () => {
  const localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: {
      echoCancellation: false,
    },
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
          urls: "turn:numb.viagenie.ca",
          username: "toandev.95@gmail.com",
          credential: "1234qwer",
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
            candidate: ev.candidate,
          },
        });
      }
    };

    localStream.getTracks().forEach((track) => {
      conns[sid].addTrack(track, localStream);
    });

    if (Object.keys(conns).length >= 2) {
      const desc = await conns[sid].createOffer();
      await conns[sid].setLocalDescription(desc);

      socket.emit("request_P2P_connection_offer", {
        sid,
        data: desc,
      });
    }
  };

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

            if (sid != socket.id && data.type == "offer") {
              await conns[sid].setRemoteDescription(
                new RTCSessionDescription(data)
              );

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

            await conns[sid].setRemoteDescription(
              new RTCSessionDescription(data)
            );
          }
        }
        break;

      case "request_candidate":
        {
          const j = JSON.parse(payload);

          if (j.from_user.sid != socket.id) {
            const sid = j.from_user.sid;
            const data = j.data;

            if (data.candidate) {
              await conns[sid].addIceCandidate(
                new RTCIceCandidate(data.candidate)
              );
            }
          }
        }
        break;

      case "left_room":
        {
          const j = JSON.parse(payload);

          if (j.sid && conns[j.sid]) {
            const sid = j.sid;

            delete conns[sid];

            try {
              const video = document.querySelector(`[data-socket=${sid}]`);
              document.querySelector("#conns").removeChild(video);
            } catch (error) {}
          }
        }
        break;

      default:
        break;
    }
  });

  socket.on("connected", async (ev) => {
    // const { sid } = JSON.parse(ev);
    // console.log();

    socket.emit("request_enter_room", {
      // room_name: "Toan",
      room: "6687c994-d183-48cb-a866-b0d9b73948d1",
    });
  });
})();
