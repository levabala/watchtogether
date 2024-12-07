import Peer, { DataConnection } from "peerjs";

export const videoPlayer = document.getElementById("videoPlayer") as HTMLVideoElement;
export const startStreamButton = document.getElementById(
    "startStream",
) as HTMLButtonElement;
export const connectReceiverButton = document.getElementById(
    "connectReceiver",
) as HTMLButtonElement;
export const peerIdInput = document.getElementById("peerIdInput") as HTMLInputElement;
export const myPeerIdTextarea = document.getElementById(
    "myPeerId",
) as HTMLTextAreaElement;
export const videoInput = document.getElementById("videoInput") as HTMLInputElement;
export const subtitleInput = document.getElementById(
    "subtitleInput",
) as HTMLInputElement;

videoInput.addEventListener("change", () => {
    const file = videoInput.files?.[0];
    if (file) {
        const videoURL = URL.createObjectURL(file);
        videoPlayer.src = videoURL;
        console.log(`Loaded video: ${file.name}`);
    }
});

export const state = {
    peer: new Peer(),
    connection: null as DataConnection | null,
};

// Initialize PeerJS
function initializePeer() {
    console.log("Initializing peerjs.");
    // Display Peer ID
    state.peer.on("open", (id) => {
        console.log("My Peer ID:", id);
        myPeerIdTextarea.value = id;
    });

    // Handle incoming connections (receiver mode)
    state.peer.on("connection", (conn) => {
        console.log('connection acquired');
        state.connection = conn;
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

