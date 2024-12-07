import { test, expect, describe } from "bun:test";
import { shiftVVT } from "./shiftVVT";

describe("shiftVVT", () => {
    const subtitles = `WEBVTT

01:30.140 --> 01:31.140
Чё?

01:31.140 --> 01:32.370
Чё слышала.

01:32.370 --> 01:34.540
Либо давай делись наличностью,

01:34.540 --> 01:36.780
либо хрен тебе, а не свидание.`;

    test("shift 1 second", () => {
        const shifted = shiftVVT(subtitles, 1);

        const expected = `WEBVTT

01:31.140 --> 01:32.140
Чё?

01:32.140 --> 01:33.370
Чё слышала.

01:33.370 --> 01:35.540
Либо давай делись наличностью,

01:35.540 --> 01:37.780
либо хрен тебе, а не свидание.`;

        expect(shifted.split("\n")).toEqual(expected.split("\n"));
    });

    test("shift fractional seconds", () => {
        const shifted = shiftVVT(subtitles, 1.5);

        const expected = `WEBVTT

01:31.640 --> 01:32.640
Чё?

01:32.640 --> 01:33.870
Чё слышала.

01:33.870 --> 01:36.040
Либо давай делись наличностью,

01:36.040 --> 01:38.280
либо хрен тебе, а не свидание.`;

        expect(shifted.split("\n")).toEqual(expected.split("\n"));
    });

    test("shift more than 3 number after decimal", () => {
        const shifted = shiftVVT(subtitles, 0.0001);

        expect(shifted.split("\n")).toEqual(subtitles.split("\n"));
    });

    test("shift more than a minute", () => {
        const shifted = shiftVVT(subtitles, 60.1);

        const expected = `WEBVTT

02:30.240 --> 02:31.240
Чё?

02:31.240 --> 02:32.470
Чё слышала.

02:32.470 --> 02:34.640
Либо давай делись наличностью,

02:34.640 --> 02:36.880
либо хрен тебе, а не свидание.`;

        expect(shifted.split("\n")).toEqual(expected.split("\n"));
    });

    test("shift negative", () => {
        const shifted = shiftVVT(subtitles, -1.1);

        const expected = `WEBVTT

01:29.040 --> 01:30.040
Чё?

01:30.040 --> 01:31.270
Чё слышала.

01:31.270 --> 01:33.440
Либо давай делись наличностью,

01:33.440 --> 01:35.680
либо хрен тебе, а не свидание.`;

        expect(shifted.split("\n")).toEqual(expected.split("\n"));
    });

    test("shift negative over 0", () => {
        const shifted = shiftVVT(subtitles, -1000);

        const expected = `WEBVTT

00:00.000 --> 00:00.000
Чё?

00:00.000 --> 00:00.000
Чё слышала.

00:00.000 --> 00:00.000
Либо давай делись наличностью,

00:00.000 --> 00:00.000
либо хрен тебе, а не свидание.`;

        expect(shifted.split("\n")).toEqual(expected.split("\n"));
    });
});
