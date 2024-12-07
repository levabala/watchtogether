import Peer, { DataConnection } from "peerjs";

const videoPlayer = document.getElementById("videoPlayer") as HTMLVideoElement;
const startStreamButton = document.getElementById("startStream") as HTMLButtonElement;
const connectReceiverButton = document.getElementById("connectReceiver") as HTMLButtonElement;
const peerIdInput = document.getElementById("peerIdInput") as HTMLInputElement;
const myPeerIdTextarea = document.getElementById("myPeerId") as HTMLTextAreaElement;
const videoInput = document.getElementById("videoInput") as HTMLInputElement;

videoInput.addEventListener("change", () => {
    const file = videoInput.files?.[0];
    if (file) {
        const videoURL = URL.createObjectURL(file);
        videoPlayer.src = videoURL;
        console.log(`Loaded video: ${file.name}`);
    }
});

let peer: Peer;
let connection: DataConnection | null = null;

// Initialize PeerJS
function initializePeer() {
    peer = new Peer();

    // Display Peer ID
    peer.on("open", (id) => {
        console.log("My Peer ID:", id);
        myPeerIdTextarea.value = id;
    });

    // Handle incoming connections (receiver mode)
    peer.on("connection", (conn) => {
        connection = conn;

        console.log("Connected to:", conn.peer);
        conn.on("data", (data) => {
            console.log("Data received:", data);
        });
    });

    // Handle incoming media streams
    peer.on("call", (call) => {
        console.log("Incoming call from:", call.peer);

        call.answer(); // Auto-answer
        call.on("stream", (remoteStream) => {
            console.log("Remote stream received");
            videoPlayer.srcObject = remoteStream;
        });
    });
}

// Start streaming video to the receiver
async function startStreaming() {
    if (!peer) {
        console.error("Peer not initialized. Call initializePeer() first.");
        return;
    }

    const peerId = peerIdInput.value.trim();
    if (!peerId) {
        console.error("Please enter a Peer ID to connect to.");
        return;
    }

    // Capture video stream from videoPlayer
    const stream = (videoPlayer as any).captureStream();
    console.log("Captured video stream:", stream);

    // Call the receiver's peer ID
    const call = peer.call(peerId, stream);

    call.on("error", (err) => {
        console.error("Call error:", err);
    });
}

// Connect as a receiver
function connectAsReceiver() {
    const peerId = peerIdInput.value.trim();
    if (!peerId) {
        console.error("Please enter a Peer ID to connect to.");
        return;
    }

    connection = peer.connect(peerId);

    connection.on("open", () => {
        console.log("Connected to sender:", peerId);
    });

    connection.on("data", (data) => {
        console.log("Data received from sender:", data);
    });

    connection.on("error", (err) => {
        console.error("Connection error:", err);
    });
}

// Event Listeners
startStreamButton.addEventListener("click", startStreaming);
connectReceiverButton.addEventListener("click", connectAsReceiver);

// Initialize PeerJS
initializePeer();
