import { describe, it, expect } from "vitest";
import {
  parseTicketId,
  parseIssueId,
  parseDate,
  parseOutputFormat,
  CliValidationError,
} from "../../src/cli/helpers.js";

describe("parseTicketId", () => {
  it("accepts valid ticket IDs", () => {
    expect(parseTicketId("T-001")).toBe("T-001");
    expect(parseTicketId("T-077a")).toBe("T-077a");
    expect(parseTicketId("T-079b")).toBe("T-079b");
  });

  it("rejects invalid ticket IDs", () => {
    expect(() => parseTicketId("INVALID")).toThrow(CliValidationError);
    expect(() => parseTicketId("T001")).toThrow(CliValidationError);
    expect(() => parseTicketId("ISS-001")).toThrow(CliValidationError);
    expect(() => parseTicketId("")).toThrow(CliValidationError);
  });

  it("throws with error code invalid_input", () => {
    try {
      parseTicketId("bad");
    } catch (err) {
      expect(err).toBeInstanceOf(CliValidationError);
      expect((err as CliValidationError).code).toBe("invalid_input");
    }
  });
});

describe("parseIssueId", () => {
  it("accepts valid issue IDs", () => {
    expect(parseIssueId("ISS-001")).toBe("ISS-001");
    expect(parseIssueId("ISS-999")).toBe("ISS-999");
  });

  it("rejects invalid issue IDs", () => {
    expect(() => parseIssueId("INVALID")).toThrow(CliValidationError);
    expect(() => parseIssueId("T-001")).toThrow(CliValidationError);
    expect(() => parseIssueId("")).toThrow(CliValidationError);
  });
});

describe("parseDate", () => {
  it("accepts valid dates", () => {
    expect(parseDate("2026-01-15")).toBe("2026-01-15");
    expect(parseDate("2024-02-29")).toBe("2024-02-29"); // leap year
  });

  it("rejects invalid dates", () => {
    expect(() => parseDate("2026-13-01")).toThrow(CliValidationError);
    expect(() => parseDate("2026-02-29")).toThrow(CliValidationError); // not a leap year
    expect(() => parseDate("not-a-date")).toThrow(CliValidationError);
    expect(() => parseDate("")).toThrow(CliValidationError);
  });
});

describe("parseOutputFormat", () => {
  it("accepts valid formats", () => {
    expect(parseOutputFormat("json")).toBe("json");
    expect(parseOutputFormat("md")).toBe("md");
  });

  it("rejects invalid formats", () => {
    expect(() => parseOutputFormat("csv")).toThrow(CliValidationError);
    expect(() => parseOutputFormat("")).toThrow(CliValidationError);
  });
});
