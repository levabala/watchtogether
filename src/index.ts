const videoInput = document.getElementById("videoInput") as HTMLInputElement;
const subtitleInput = document.getElementById("subtitleInput") as HTMLInputElement;
const videoElement = document.getElementById("videoPlayer") as HTMLVideoElement;

// Handle video file selection
videoInput.addEventListener("change", () => {
    const file = videoInput.files?.[0];
    if (file) {
        const videoURL = URL.createObjectURL(file);
        videoElement.src = videoURL;
        console.log(`Loaded video: ${file.name}`);
    }
});

// Handle subtitle file selection
subtitleInput.addEventListener("change", () => {
    const file = subtitleInput.files?.[0];
    if (file) {
        const subtitleURL = URL.createObjectURL(file);

        // Remove existing subtitle tracks
        const existingTracks = videoElement.querySelectorAll("track");
        existingTracks.forEach((track) => track.remove());

        // Add the new subtitle track
        const trackElement = document.createElement("track");
        trackElement.src = subtitleURL;
        trackElement.kind = "subtitles";
        trackElement.label = "Uploaded Subtitles";
        trackElement.srclang = "en"; // Adjust language if needed
        trackElement.default = true;

        videoElement.appendChild(trackElement);
        console.log(`Loaded subtitles: ${file.name}`);
    }
});
