import { subtitleInput, state } from "./init";

const sendSubtitleButton = document.getElementById(
    "sendSubtitle",
) as HTMLButtonElement;

function sendSubtitles() {
    if (!state.connectionsToReceivers.size) {
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
        for (const [peerId, connection] of state.connectionsToReceivers) {
            connection.send({ type: "subtitle", content: subtitleContent });
            console.log("Sent subtitle content to:", peerId);
        }

        console.log("Sent subtitle content to the receivers.");
    };
    reader.readAsText(file);
}

sendSubtitleButton.addEventListener("click", sendSubtitles);
