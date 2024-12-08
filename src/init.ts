import Peer, { DataConnection } from "peerjs";

export const videoPlayer = document.getElementById(
    "videoPlayer",
) as HTMLVideoElement;
export const startStreamButton = document.getElementById(
    "startStream",
) as HTMLButtonElement;
export const connectReceiverButton = document.getElementById(
    "connectReceiver",
) as HTMLButtonElement;
export const peerIdInput = document.getElementById(
    "peerIdInput",
) as HTMLInputElement;
export const myPeerIdTextarea = document.getElementById(
    "myPeerId",
) as HTMLTextAreaElement;
export const videoInput = document.getElementById(
    "videoInput",
) as HTMLInputElement;
export const subtitleInput = document.getElementById(
    "subtitleInput",
) as HTMLInputElement;
export const bitrateInput = document.getElementById(
    "bitrate",
) as HTMLInputElement;

videoInput.addEventListener("change", () => {
    const file = videoInput.files?.[0];
    if (file) {
        const videoURL = URL.createObjectURL(file);
        videoPlayer.src = videoURL;
        console.log(`Loaded video: ${file.name}`);
    }
});

const idMy =
    new URL(window.location.href).searchParams.get("myid") || "anonymous";
const idTarget = new URL(window.location.href).searchParams.get("targetid");
const host = new URL(window.location.href).searchParams.get("host");
const key = new URL(window.location.href).searchParams.get("key");

if (!key) {
    throw new Error("Missing key query param");
}

if (!host) {
    throw new Error("Missing host query param");
}

if (idTarget) {
    peerIdInput.value = idTarget;
}

export const state = {
    peer: new Peer(idMy, {
        host,
        key,
        port: 9000,
        secure: false,
    }),
    connectionToStreamer: null as DataConnection | null,
    connectionsToReceivers: new Map<string, DataConnection>(),
    calls: new Map<string, RTCPeerConnection>(),
};

window.addEventListener("beforeunload", () => {
    console.log("beforeunload");
    if (state.peer && !state.peer.destroyed) {
        console.log("destroying peer");
        state.peer.destroy();
    } else {
        console.log("no peer to destroy");
    }
});

(window as any).state = state;

// Initialize PeerJS
function initializePeer() {
    console.log("Initializing peerjs.");
    // Display Peer ID
    state.peer.on("open", (id) => {
        console.log("My Peer ID:", id);
        myPeerIdTextarea.value = id;
    });

    // Handle incoming connections for streamer
    state.peer.on("connection", (conn) => {
        console.log("connection acquired from", conn.peer);
        state.connectionsToReceivers.set(conn.peer, conn);
    });

    // Handle incoming media streams
    state.peer.on("call", (call) => {
        console.log("Incoming call from:", call.peer);

        call.answer(); // Auto-answer
        call.on("stream", (remoteStream) => {
            console.log("Remote stream received");
            videoPlayer.srcObject = remoteStream;
        });
    });
}

initializePeer();
