function parseTimeSeconds(time: string): number {
    const parts = time.split(":");

    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    }

    if (parts.length === 3) {
        return (
            parseInt(parts[0]) * 3600 +
            parseInt(parts[1]) * 60 +
            parseFloat(parts[2])
        );
    }

    throw new Error(`Invalid time: ${time}`);
}

function stringifyTime(timeSeconds: number): string {
    const hours = Math.floor(timeSeconds / 3600);
    const minutes = Math.floor((timeSeconds % 3600) / 60);
    const seconds = timeSeconds - hours * 3600 - minutes * 60;

    const hoursStr = hours.toString().padStart(2, "0");
    const minutesStr = minutes.toString().padStart(2, "0");
    const secondsStr =
        Math.floor(seconds).toString().padStart(2, "0") +
        "." +
        seconds.toFixed(3).split(".")[1];

    let parts;
    if (hours > 0) {
        parts = [hoursStr, minutesStr, secondsStr];
    } else {
        parts = [minutesStr, secondsStr];
    }

    return parts.join(":");
}

export function shiftVVT(subtitles: string, shift: number): string {
    const lines = subtitles.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!line.includes("-->")) {
            continue;
        }

        const [startRaw, endRawRaw] = line.split(" --> ");
        const [endRaw, ...rest] = endRawRaw.split(" ");

        const start = parseTimeSeconds(startRaw);
        const end = parseTimeSeconds(endRaw);

        const startShifted = Math.max(start + shift, 0);
        const endShifted = Math.max(end + shift, 0);

        lines[i] =
            stringifyTime(startShifted) +
            " --> " +
            [stringifyTime(endShifted), ...rest].join(" ");
    }

    return lines.join("\n");
}
