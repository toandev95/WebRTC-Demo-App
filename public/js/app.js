(async () => {
  const localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: {
      autoGainControl: false,
      channelCount: 2,
      echoCancellation: false,
      latency: 0,
      noiseSuppression: false,
      sampleRate: 48000,
      sampleSize: 16,
      volume: 1.0,
    },
  });

  const localVideo = document.querySelector("#local");
  localVideo.srcObject = localStream;
  localVideo.width = 500;
  localVideo.muted = true;
  localVideo.autoplay = true;
  localVideo.playsInline = true;

  const peers = {};

  const socket = io.connect({
    transports: ["websocket"],
    auth: {
      fullname: window.location.search.split("name=")[1],
    },
  });

  const addPeer = async (sid) => {
    peers[sid] = new RTCPeerConnection({
      iceServers: [
        {
          urls: "turn:numb.viagenie.ca",
          username: "toandev.95@gmail.com",
          credential: "1234qwer",
        },
      ],
    });

    peers[sid].ontrack = (ev) => {
      // console.log(ev);

      console.log(ev);

      let remoteVideo = document.getElementById(sid);

      if (!remoteVideo) {
        remoteVideo = document.createElement("video");
        remoteVideo.id = sid;
        remoteVideo.width = 300;
        remoteVideo.muted = false;
        remoteVideo.autoplay = true;
        remoteVideo.playsInline = true;

        document.querySelector("#peers").appendChild(remoteVideo);
      }

      remoteVideo.srcObject = ev.streams[0];
    };

    peers[sid].onicecandidate = (ev) => {
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
      peers[sid].addTrack(track, localStream);
    });

    if (Object.keys(peers).length >= 2) {
      if (sid != socket.id) {
        const desc = await peers[sid].createOffer();
        await peers[sid].setLocalDescription(desc);

        socket.emit("request_P2P_connection_offer", {
          sid,
          data: desc,
        });
      }
    }
  };

  const removePeer = (sid) => {
    const videoElm = document.getElementById(sid);

    if (videoElm) {
      const tracks = videoElm.srcObject.getTracks();

      tracks.forEach(function (track) {
        track.stop();
      });

      document.querySelector("#peers").removeChild(videoElm);
    }

    peers[sid].close();
    delete peers[sid];
  };

  socket.onAny(async (eventName, payload) => {
    console.log(eventName, payload);

    switch (eventName) {
      case "entered_room":
        {
          const { joint, info } = JSON.parse(payload);

          if (joint && info) {
            const { sid } = info;

            if (!peers[sid]) {
              await addPeer(sid);
            }
          }
        }
        break;

      case "request_offer":
        {
          const j = JSON.parse(payload);

          const sid = j.from_user.sid;
          const data = j.data;

          if (!peers[sid]) {
            await addPeer(sid);

            if (sid != socket.id && data.type == "offer") {
              await peers[sid].setRemoteDescription(
                new RTCSessionDescription(data)
              );

              const desc = await peers[sid].createAnswer();
              desc.sdp = desc.sdp.replace(
                "useinbandfec=1",
                "useinbandfec=1; stereo=1; maxaveragebitrate=510000"
              );
              await peers[sid].setLocalDescription(
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

            await peers[sid].setRemoteDescription(
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
              try {
                await peers[sid].addIceCandidate(
                  new RTCIceCandidate(data.candidate)
                );
              } catch (error) {
                console.log(error);
              }
            }
          }
        }
        break;

      case "left_room":
        {
          const j = JSON.parse(payload);

          if (j.sid && peers[j.sid]) {
            removePeer(j.sid);
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
