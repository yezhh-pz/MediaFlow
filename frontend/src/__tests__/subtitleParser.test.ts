import { expect, test } from "vitest";
import { parseSRT } from "../utils/subtitleParser";

test("parses simple SRT content correctly", () => {
  const srtContent = `1
00:00:01,000 --> 00:00:02,000
Hello World

2
00:00:03,500 --> 00:00:05,000
Second Line`;

  const parsed = parseSRT(srtContent);
  expect(parsed).toHaveLength(2);
  expect(parsed[0].text).toBe("Hello World");
  expect(parsed[0].start).toBe(1);
  expect(parsed[0].end).toBe(2);
  expect(parsed[1].start).toBe(3.5);
});
