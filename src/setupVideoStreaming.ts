import {
    videoPlayer,
    videoInput,
    peerIdInput,
    subtitleInput,
    myPeerIdTextarea,
    startStreamButton,
    connectReceiverButton,
    state,
    bitrateInput,
} from "./init";
import { shiftVVT } from "./shiftVVT";

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

    for (const [peerId] of state.connectionsToReceivers) {
        console.log("Calling:", peerId);

        // Call the receiver's peer ID
        const call = state.peer.call(peerId, stream);
        state.calls.set(peerId, call.peerConnection);

        console.log("Successfully called:", peerId);

        call.on("error", (err) => {
            console.error("Call error:", err);
        });

        // Periodically send playback time
        function syncPlaybackTime() {
            setInterval(() => {
                if (state.connectionToStreamer && videoPlayer.readyState >= 2) {
                    state.connectionToStreamer.send({
                        type: "sync",
                        time: videoPlayer.currentTime,
                    });
                }
            }, 500); // Adjust interval as needed
        }

        syncPlaybackTime();

        configureSenderParameters(call.peerConnection);
        configureReceiverParameters(call.peerConnection);
        preferCodec(call.peerConnection, "VP9");
    }

    logStats();
}

function logStats() {
    let previousStatsByPeer: Map<
        string,
        { bytesSent: number; timestamp: number }
    > = new Map();

    async function calculateBitrate(peerConnection: RTCPeerConnection, peerId: string) {
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
        for (const [peerId, peerConnection] of state.calls) {
            const bitrate = await calculateBitrate(peerConnection, peerId);

            if (!bitrate) {
                continue;
            }

            bitrates.push(bitrate.toFixed(2));
        }
        const str = bitrates.join('/') + " Mbps";
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
        parameters.encodings[0].scaleResolutionDownBy = 1; // No resolution scaling
        parameters.encodings[0].networkPriority = "high";
        parameters.encodings[0].priority = "high";

        console.log(parameters.encodings[0]);

        // Maintain resolution over framerate
        parameters.degradationPreference = "maintain-resolution";
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

function configureReceiverParameters(peerConnection: RTCPeerConnection) {
    const videoReceiver = peerConnection
        .getReceivers()
        .find((receiver) => receiver.track?.kind === "video");

    console.log("Video senders:", peerConnection.getSenders());

    if (videoReceiver) {
        (videoReceiver as any).playoutDelayHint = 3000;
        videoReceiver.jitterBufferTarget = 3000;

        console.log("Configured video sender parameters");
    } else {
        console.error("No video sender found.");
    }
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

    const connection = (state.connectionToStreamer =
        state.peer.connect(peerId));

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
