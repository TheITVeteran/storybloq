/**
 * Companion protocol contract tests.
 *
 * These tests validate the JSON message shapes exchanged between the Mac app
 * (CompanionServer) and iOS app (ConnectionManager) over WebSocket.
 *
 * The actual encoding/decoding is implemented in Swift. These tests serve as
 * cross-platform contract documentation and validation.
 */
import { describe, it, expect } from "vitest";

/**
 * Expected JSON shape of the capabilities message sent from Mac to iOS.
 * Source: macos/claudestory/Core/Companion/CompanionMessage.swift
 */
interface CapabilitiesEnvelope {
  type: "capabilities";
  channelAvailable: boolean;
  permissionRelayAvailable: boolean;
}

function isValidCapabilitiesMessage(msg: unknown): msg is CapabilitiesEnvelope {
  if (typeof msg !== "object" || msg === null) return false;
  const obj = msg as Record<string, unknown>;
  return (
    obj.type === "capabilities" &&
    typeof obj.channelAvailable === "boolean" &&
    typeof obj.permissionRelayAvailable === "boolean"
  );
}

describe("Companion Protocol - Capabilities Message (T-221)", () => {
  it("validates a well-formed capabilities message", () => {
    const msg = {
      type: "capabilities",
      channelAvailable: true,
      permissionRelayAvailable: false,
    };
    expect(isValidCapabilitiesMessage(msg)).toBe(true);
  });

  it("rejects message with missing channelAvailable", () => {
    const msg = { type: "capabilities", permissionRelayAvailable: false };
    expect(isValidCapabilitiesMessage(msg)).toBe(false);
  });

  it("rejects message with missing permissionRelayAvailable", () => {
    const msg = { type: "capabilities", channelAvailable: true };
    expect(isValidCapabilitiesMessage(msg)).toBe(false);
  });

  it("rejects message with wrong type", () => {
    const msg = { type: "status", channelAvailable: true, permissionRelayAvailable: false };
    expect(isValidCapabilitiesMessage(msg)).toBe(false);
  });

  it("rejects non-boolean field values", () => {
    const msg = { type: "capabilities", channelAvailable: "yes", permissionRelayAvailable: 1 };
    expect(isValidCapabilitiesMessage(msg)).toBe(false);
  });

  it("accepts both-false capabilities (default state)", () => {
    const msg = {
      type: "capabilities",
      channelAvailable: false,
      permissionRelayAvailable: false,
    };
    expect(isValidCapabilitiesMessage(msg)).toBe(true);
  });

  it("accepts both-true capabilities (fully available)", () => {
    const msg = {
      type: "capabilities",
      channelAvailable: true,
      permissionRelayAvailable: true,
    };
    expect(isValidCapabilitiesMessage(msg)).toBe(true);
  });

  it("ignores extra fields (forward compatibility)", () => {
    const msg = {
      type: "capabilities",
      channelAvailable: true,
      permissionRelayAvailable: false,
      futureField: "should be ignored",
    };
    expect(isValidCapabilitiesMessage(msg)).toBe(true);
  });

  it("parseCapabilitiesMessage returns typed result from valid JSON", async () => {
    const { parseCapabilitiesMessage } = await import("../../src/channel/companion-protocol.js");
    const result = parseCapabilitiesMessage(
      '{"type":"capabilities","channelAvailable":true,"permissionRelayAvailable":false}',
    );
    expect(result).toEqual({
      type: "capabilities",
      channelAvailable: true,
      permissionRelayAvailable: false,
    });
  });

  it("parseCapabilitiesMessage returns null for invalid JSON", async () => {
    const { parseCapabilitiesMessage } = await import("../../src/channel/companion-protocol.js");
    expect(parseCapabilitiesMessage("not json")).toBeNull();
  });

  it("parseCapabilitiesMessage returns null for wrong type", async () => {
    const { parseCapabilitiesMessage } = await import("../../src/channel/companion-protocol.js");
    expect(
      parseCapabilitiesMessage('{"type":"status","channelAvailable":true,"permissionRelayAvailable":false}'),
    ).toBeNull();
  });

  it("parseCapabilitiesMessage returns null for missing fields", async () => {
    const { parseCapabilitiesMessage } = await import("../../src/channel/companion-protocol.js");
    expect(parseCapabilitiesMessage('{"type":"capabilities","channelAvailable":true}')).toBeNull();
  });
});
