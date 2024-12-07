import { subtitleInput, state } from "./init";

const sendSubtitleButton = document.getElementById(
    "sendSubtitle",
) as HTMLButtonElement;

// Send subtitles to the receiver
function sendSubtitles() {
    if (!state.connection) {
        console.error("No active connection to a receiver.");
        return;
    }

    const file = subtitleInput.files?.[0];
    if (!file) {
        console.error("No subtitle file selected.");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const subtitleContent = reader.result as string;
        state.connection?.send({ type: "subtitle", content: subtitleContent });
        console.log("Sent subtitle content to receiver.");
    };
    reader.readAsText(file);
}

sendSubtitleButton.addEventListener("click", sendSubtitles);
