import {
    videoPlayer,
    videoInput,
    peerIdInput,
    subtitleInput,
    myPeerIdTextarea,
    startStreamButton,
    connectReceiverButton,
    state,
} from "./init";
import { shiftVVT } from "./shiftVVT";

// Start streaming video to the receiver
async function startStreaming() {
    if (!state.peer) {
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
    const call = state.peer.call(peerId, stream);

    call.on("error", (err) => {
        console.error("Call error:", err);
    });

    // Periodically send playback time
    function syncPlaybackTime() {
        setInterval(() => {
            if (state.connection && videoPlayer.readyState >= 2) {
                state.connection.send({
                    type: "sync",
                    time: videoPlayer.currentTime,
                });
            }
        }, 500); // Adjust interval as needed
    }
    syncPlaybackTime();
}

let subtitlesRaw = "";

function subtitlesRawToBlobUrl(subtitles: string): string {
    const blob = new Blob([subtitles], { type: "text/vtt" });
    return URL.createObjectURL(blob);
}

// Connect as a receiver
function connectAsReceiver() {
    const peerId = peerIdInput.value.trim();
    if (!peerId) {
        console.error("Please enter a Peer ID to connect to.");
        return;
    }

    const connection = (state.connection = state.peer.connect(peerId));

    connection.on("data", async (data: any) => {
        if (data.type === "subtitle") {
            console.log(
                "Receiveasync d subtitle content from streamer.",
                data.content,
            );

            const url = subtitlesRawToBlobUrl(data.content);

            subtitlesRaw = data.content;
            addSubtitleTrack(url);
        }

        if (data.type === "sync") {
            syncVideo(data.time);
        }
    });

    connection.on("open", () => {
        console.log("Connected to sender:", peerId);
    });

    // connection.on("data", (data) => {
    //     console.log("Data received from sender:", data);
    // });

    connection.on("error", (err) => {
        console.error("Connection error:", err);
    });
}

let currentShift = 0;

// Sync video playback time
function syncVideo(targetTime: number) {
    const currentTime = videoPlayer.currentTime;
    const drift = currentTime - targetTime;
    const driftCompensated = drift - currentShift;

    // Adjust if drift exceeds a threshold (e.g., 0.2 seconds)
    if (Math.abs(driftCompensated) > 0.2) {
        currentShift = drift;

        console.log({ targetTime, currentTime, currentShift, drift, driftCompensated });

        removeSubtitles();
        const shifted = shiftVVT(subtitlesRaw, drift);
        console.log({shifted, subtitlesRaw});
        const url = subtitlesRawToBlobUrl(shifted);
        addSubtitleTrack(url);

        console.log(`Adjusted video time to ${targetTime}`);
    }
}

// Event Listeners
startStreamButton.addEventListener("click", startStreaming);
connectReceiverButton.addEventListener("click", connectAsReceiver);

function removeSubtitles() {
    const existingTracks = videoPlayer.querySelectorAll("track");
    existingTracks.forEach((track) => track.remove());
}

// Function to add a VTT subtitle track
function addSubtitleTrack(subtitleURL: string): void {
    // Remove existing tracks
    const existingTracks = videoPlayer.querySelectorAll("track");
    existingTracks.forEach((track) => track.remove());

    console.log({ subtitleURL });

    const url = subtitleURL;

    // Create and add a new <track> element
    const trackElement = document.createElement("track");
    trackElement.src = url;
    trackElement.kind = "subtitles";
    trackElement.label = "Subtitles"; // Adjust label as needed
    // trackElement.srclang = "en"; // Adjust language code
    trackElement.default = true;

    videoPlayer.appendChild(trackElement);
    console.log(`Added subtitle track: ${subtitleURL}`);
}

function shiftSubtitlesInPlace(drift: number): void {
    console.log("shiftSubtitles", drift);
    const textTracks = videoPlayer.textTracks;

    if (textTracks.length === 0) {
        console.error("No subtitles loaded.");
        return;
    }

    // Use the first text track (adjust as needed for multi-track scenarios)
    const subtitleTrack = textTracks[0];

    if (!subtitleTrack || !subtitleTrack.cues) {
        console.error("No subtitle track found.");
        return;
    }

    // Ensure the track is showing (optional, can be "hidden" too)
    subtitleTrack.mode = "showing";

    // Adjust the timing of each cue
    for (let i = 0; i < subtitleTrack.cues.length; i++) {
        const cue = subtitleTrack.cues[i] as VTTCue;
        if (i < 3 || i > subtitleTrack.cues.length - 3)
            console.log("before", cue.startTime);
        cue.startTime += drift;
        if (i < 3 || i > subtitleTrack.cues.length - 3)
            console.log("after", cue.startTime);
        cue.endTime += drift;
    }

    console.log(`Shifted subtitles by ${drift} seconds.`);
}

// Handle subtitle input file and create a track
subtitleInput.addEventListener("change", () => {
    const file = subtitleInput.files?.[0];
    if (file) {
        const subtitleURL = URL.createObjectURL(file);
        addSubtitleTrack(subtitleURL);
        console.log(`Loaded subtitles: ${file.name}`);
    }
});
