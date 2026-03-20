import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProject } from "../../src/core/init.js";
import { runReadCommand, writeOutput } from "../../src/cli/run.js";
import { ExitCode } from "../../src/core/output-formatter.js";
import { ProjectLoaderError } from "../../src/core/errors.js";
import { CliValidationError } from "../../src/cli/helpers.js";

describe("writeOutput", () => {
  it("writes to stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    writeOutput("hello");
    expect(spy).toHaveBeenCalledWith("hello\n");
    spy.mockRestore();
  });
});

describe("runReadCommand", () => {
  const tmpDirs: string[] = [];
  let origCwd: string;

  beforeEach(() => {
    origCwd = process.cwd();
    process.exitCode = undefined;
  });

  afterEach(async () => {
    process.chdir(origCwd);
    process.exitCode = undefined;
    for (const d of tmpDirs) {
      await rm(d, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  it("discovers root and calls handler", async () => {
    const dir = await mkdtemp(join(tmpdir(), "run-test-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "test" });
    process.chdir(dir);

    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await runReadCommand("md", (ctx) => ({
      output: `project: ${ctx.state.config.project}`,
    }));
    expect(spy).toHaveBeenCalled();
    const output = (spy.mock.calls[0]![0] as string);
    expect(output).toContain("project: test");
    expect(process.exitCode).toBe(ExitCode.OK);
    spy.mockRestore();
  });

  it("returns USER_ERROR when no project found", async () => {
    const dir = await mkdtemp(join(tmpdir(), "run-test-"));
    tmpDirs.push(dir);
    process.chdir(dir);

    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await runReadCommand("md", () => ({ output: "should not reach" }));
    const output = (spy.mock.calls[0]![0] as string);
    expect(output).toContain("not_found");
    expect(process.exitCode).toBe(ExitCode.USER_ERROR);
    spy.mockRestore();
  });

  it("catches ProjectLoaderError", async () => {
    const dir = await mkdtemp(join(tmpdir(), "run-test-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "test" });
    process.chdir(dir);

    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await runReadCommand("md", () => {
      throw new ProjectLoaderError("project_corrupt", "bad data");
    });
    const output = (spy.mock.calls[0]![0] as string);
    expect(output).toContain("project_corrupt");
    expect(process.exitCode).toBe(ExitCode.USER_ERROR);
    spy.mockRestore();
  });

  it("catches CliValidationError", async () => {
    const dir = await mkdtemp(join(tmpdir(), "run-test-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "test" });
    process.chdir(dir);

    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await runReadCommand("md", () => {
      throw new CliValidationError("invalid_input", "bad arg");
    });
    const output = (spy.mock.calls[0]![0] as string);
    expect(output).toContain("invalid_input");
    expect(process.exitCode).toBe(ExitCode.USER_ERROR);
    spy.mockRestore();
  });

  it("catches unknown errors", async () => {
    const dir = await mkdtemp(join(tmpdir(), "run-test-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "test" });
    process.chdir(dir);

    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await runReadCommand("md", () => {
      throw new Error("unexpected");
    });
    const output = (spy.mock.calls[0]![0] as string);
    expect(output).toContain("io_error");
    expect(process.exitCode).toBe(ExitCode.USER_ERROR);
    spy.mockRestore();
  });

  it("returns OK when no warnings present", async () => {
    const dir = await mkdtemp(join(tmpdir(), "run-test-"));
    tmpDirs.push(dir);
    await initProject(dir, { name: "test" });
    process.chdir(dir);

    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await runReadCommand("md", (_ctx) => ({
      output: "ok",
    }));
    expect(process.exitCode).toBe(ExitCode.OK);
    spy.mockRestore();
  });
});
