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
const turnUrl = new URL(window.location.href).searchParams.get("turnurl");
const turnUser = new URL(window.location.href).searchParams.get("turnuser");
const turnPass = new URL(window.location.href).searchParams.get("turnpass");

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
        config: {
            iceServers: [
                {
                    urls: turnUrl,
                    username: turnUser,
                    credential: turnPass,
                },
            ],
        },
        // debug: 3,
    }),
    connectionToStreamer: null as DataConnection | null,
    connectionsToReceivers: new Map<string, DataConnection>(),
    callsToReceivers: new Map<string, RTCPeerConnection>(),
    callToStreamer: null as RTCPeerConnection | null,
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

export const VIDEO_DELAY_MS = 500;

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

    state.peer.on("call", (call) => {
        call.answer(); // Answer the call

        const peerConnection = call.peerConnection;

        peerConnection.addEventListener("icecandidate", (event) => {
            if (event.candidate) {
                console.log(
                    "ICE Candidate Type:",
                    getCandidateType(event.candidate.candidate),
                );
            }
        });

        peerConnection.addEventListener("iceconnectionstatechange", () => {
            console.log(
                "ICE Connection State:",
                peerConnection.iceConnectionState,
            );
        });

        state.callToStreamer = call.peerConnection;

        peerConnection.addEventListener("track", (event) => {
            console.log("------------- track added", event);
            const receiver = event.receiver;

            (receiver as any).playoutDelayHint = VIDEO_DELAY_MS / 1000;
            // receiver.jitterBufferTarget = VIDEO_DELAY_MS;
        });
    });

    function getCandidateType(candidate: string) {
        if (candidate.includes("typ relay")) return "TURN (Relay)";
        if (candidate.includes("typ srflx")) return "STUN (Server Reflexive)";
        if (candidate.includes("typ host")) return "P2P (Host)";
        return "Unknown";
    }
}

initializePeer();
