import {
    videoPlayer,
    peerIdInput,
    subtitleInput,
    startStreamButton,
    connectReceiverButton,
    state,
    bitrateInput,
    VIDEO_DELAY_MS,
} from "./init";
import { shiftVVT } from "./shiftVVT";

const streamCamera = new URL(window.location.href).searchParams.get(
    "streamCamera",
);

if (streamCamera === "1") {
    captureSpecificCamera().then(() => {
        state.peer.on("connection", () => {
            startStreaming();
        });
    });
}

async function captureSpecificCamera() {
    try {
        const videoDevices = await getVideoDevices();

        // Log available video devices
        console.log("Available video devices:", videoDevices);

        // Find a non-virtual camera (replace "OBS Virtual Camera" with its exact label if needed)
        const targetDevice = videoDevices.find(
            (device) => !device.label.includes("Virtual"),
        );

        if (!targetDevice) {
            throw new Error("No physical camera found");
        }

        // Request media with the specific device
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: { exact: targetDevice.deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 60, max: 60 },
            },
        });

        // Attach to video element
        videoPlayer.srcObject = stream;
        videoPlayer.play();

        console.log("Camera stream started");
    } catch (error) {
        console.error("Error capturing camera:", error);
    }
}

async function getVideoDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
}

// Start streaming video to the receiver
async function startStreaming() {
    if (!state.peer) {
        console.error("Peer not initialized. Call initializePeer() first.");
        return;
    }

    if (!state.connectionsToReceivers.size) {
        console.error("No active connection to a receiver.");
        return;
    }

    // Capture video stream from videoPlayer
    const stream = (videoPlayer as any).captureStream();

    console.log("Captured video stream:", stream);

    for (const [peerId, connection] of state.connectionsToReceivers) {
        console.log("Calling:", peerId);

        // Call the receiver's peer ID
        const call = state.peer.call(peerId, stream);
        state.callsToReceivers.set(peerId, call.peerConnection);

        console.log("Successfully called:", peerId);

        call.on("error", (err) => {
            console.error("Call error:", err);
        });

        // Periodically send playback time
        function syncPlaybackTime() {
            setInterval(() => {
                if (connection && videoPlayer.readyState >= 2) {
                    connection.send({
                        type: "sync",
                        time: videoPlayer.currentTime,
                    });
                } else {
                    console.warn(
                        "syncPlaybackTime: No connection to receiver.",
                    );
                }
            }, 500); // Adjust interval as needed
        }

        videoPlayer.addEventListener("pause", () => {
            console.log("videoPlayer paused");
            connection.send({
                type: "pause",
            });
        });

        videoPlayer.addEventListener("play", () => {
            console.log("videoPlayer played");
            connection.send({
                type: "play",
                time: videoPlayer.currentTime,
            });
        });

        syncPlaybackTime();

        configureSenderParameters(call.peerConnection);
        // configureReceiverParameters(call.peerConnection);
        preferCodec(call.peerConnection, "VP9");
    }

    logStats();
}

function logStats() {
    let previousStatsByPeer: Map<
        string,
        { bytesSent: number; timestamp: number }
    > = new Map();

    async function calculateBitrate(
        peerConnection: RTCPeerConnection,
        peerId: string,
    ) {
        const stats = await peerConnection.getStats();
        let report: any;

        stats.forEach((_report) => {
            if (_report.type === "outbound-rtp" && _report.kind === "video") {
                report = _report;
            }
        });

        if (!report) {
            return;
        }

        const currentBytesSent = report.bytesSent;
        const currentTimestamp = report.timestamp;

        const previousStats = previousStatsByPeer.get(peerId);

        let value;
        if (previousStats) {
            const deltaBytes = currentBytesSent - previousStats.bytesSent;
            const deltaTime = currentTimestamp - previousStats.timestamp;

            // Calculate bitrate in bits per second (bps)
            const bitrate = (deltaBytes * 8) / (deltaTime / 1000) / 1_000_000;

            value = bitrate;
        }

        // Update previous stats
        previousStatsByPeer.set(peerId, {
            bytesSent: currentBytesSent,
            timestamp: currentTimestamp,
        });

        return value;
    }

    // Call periodically to monitor bitrate
    setInterval(async () => {
        let bitrates = [];
        for (const [peerId, peerConnection] of state.callsToReceivers) {
            const bitrate = await calculateBitrate(peerConnection, peerId);

            if (!bitrate) {
                continue;
            }

            bitrates.push(bitrate.toFixed(2));
        }
        const str = bitrates.join("/") + " Mbps";
        bitrateInput.value = str;
    }, 1000); // Every second
}

function configureSenderParameters(peerConnection: RTCPeerConnection) {
    const videoSender = peerConnection
        .getSenders()
        .find((sender) => sender.track?.kind === "video");

    console.log("Video senders:", peerConnection.getSenders());

    if (videoSender) {
        const parameters = videoSender.getParameters();
        if (!parameters.encodings) {
            parameters.encodings = [{}];
        }

        // Configure encoding for high quality
        parameters.encodings[0].maxBitrate = 10000 * 1000;
        parameters.encodings[0].maxFramerate = 60;
        // parameters.encodings[0].scaleResolutionDownBy = 1; // No resolution scaling
        parameters.encodings[0].networkPriority = "high";
        parameters.encodings[0].priority = "high";

        console.log(parameters.encodings[0]);

        // Maintain resolution over framerate
        parameters.degradationPreference = "balanced";
        videoSender.setParameters(parameters);

        console.log("Configured video sender parameters:", parameters);
    } else {
        console.error("No video sender found.");
    }
}

async function preferCodec(
    peerConnection: RTCPeerConnection,
    codecName: string,
) {
    const transceivers = peerConnection.getTransceivers();

    transceivers.forEach((transceiver) => {
        if (transceiver.sender.track?.kind === "video") {
            const codecs = RTCRtpSender.getCapabilities("video")?.codecs || [];
            const preferredCodecs = codecs.filter((c) =>
                c.mimeType.includes(codecName),
            );
            if (preferredCodecs.length) {
                transceiver.setCodecPreferences(preferredCodecs);
                console.log(`Preferred codec set to: ${codecName}`);
            } else {
                console.warn(`Codec ${codecName} not found.`);
            }
        }
    });
}

// function configureReceiverParameters(peerConnection: RTCPeerConnection) {
//     const videoReceiver = peerConnection
//         .getReceivers()
//         .find((receiver) => receiver.track?.kind === "video");

//     console.log("Video receivers:", peerConnection.getReceivers());

//     if (videoReceiver) {
//         (videoReceiver as any).playoutDelayHint = 1;
//         videoReceiver.jitterBufferTarget = 1000;

//         console.log("Configured video sender parameters");
//     } else {
//         console.error("No video sender found.");
//     }
// }

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

    const connection = (state.connectionToStreamer =
        state.peer.connect(peerId));

    connection.on("data", async (data: any) => {
        if (data.type === "subtitle") {
            console.log(
                "Received subtitle content from streamer.",
                data.content,
            );

            subtitlesRaw = data.content;
            syncVideo(data.time);
        }

        if (data.type === "sync") {
            syncVideo(data.time);
        }

        if (data.type === "pause") {
            videoPlayer.pause();
        }

        if (data.type === "play") {
            videoPlayer.play();
            syncVideo(data.time);
        }
    });

    connection.on("open", () => {
        console.log("Connected to sender:", peerId);
    });

    connection.on("error", (err) => {
        console.error("Connection error:", err);
    });
}

let currentShift = 0;

// Sync video playback time
function syncVideo(targetTime: number) {
    const currentTime = videoPlayer.currentTime + VIDEO_DELAY_MS / 1000;
    const drift = currentTime - targetTime;
    const driftCompensated = drift - currentShift;

    // Adjust if drift exceeds a threshold (e.g., 0.2 seconds)
    if (Math.abs(driftCompensated) > 0.2) {
        currentShift = drift;

        console.log({
            targetTime,
            currentTime,
            currentShift,
            drift,
            driftCompensated,
        });

        removeSubtitles();
        const shifted = shiftVVT(subtitlesRaw, drift);
        console.log({ shifted, subtitlesRaw });
        const url = subtitlesRawToBlobUrl(shifted);
        addSubtitleTrack(url);

        console.log(`Adjusted video time to ${targetTime}`);
    }
}

// Event Listeners
startStreamButton.addEventListener("click", startStreaming);
connectReceiverButton.addEventListener("click", connectAsReceiver);

state.peer.on("open", () => {
    const autoconnect = new URL(window.location.href).searchParams.get(
        "autoconnect",
    );

    if (autoconnect === "as-receiver") {
        connectAsReceiver();
    }
});

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

// Handle subtitle input file and create a track
subtitleInput.addEventListener("change", () => {
    const file = subtitleInput.files?.[0];
    if (file) {
        const subtitleURL = URL.createObjectURL(file);
        addSubtitleTrack(subtitleURL);
        console.log(`Loaded subtitles: ${file.name}`);
    }
});
