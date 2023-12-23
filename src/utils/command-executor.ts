import { type SpawnOptions, spawn } from "child_process";
import { createLogger } from "./logger";
import { isNil } from "lodash";

export type CommandExecutor = (
	command: string,
	spawnArgs: readonly string[],
	options?: SpawnOptions
) => Promise<string>;

const logger = createLogger("command-executor");

let commandExecutionId = 0;

export const commandExecutor: CommandExecutor = async (command, spawnArgs, options) => await new Promise((resolve, reject) => {
	const cmdId = ++commandExecutionId;
	logger.debug("BEGIN command #%d: %s %O", cmdId, command, spawnArgs);
	let stdoutData: string = "";
	const proc = typeof options === "undefined" ? spawn(command, spawnArgs) : spawn(command, spawnArgs, options);
	if (!isNil(proc.stderr)) {
		proc.stderr.on("data", data => logger.info("[%d]: stderr: %O", cmdId, data.toString("utf8")));
	}
	if (!isNil(proc.stdout)) {
		proc.stdout.on("data", data => {
			logger.debug("[%d]: stdout: %O", cmdId, data.toString("utf8"));
			stdoutData += data;
		});
	};
	proc.on("error", err => {
		logger.debug("[#%d]: Failed to execute command: %O", cmdId, command, err);
		reject(err);
	});
	proc.on("close", code => {
		logger.debug("[#%d]: Program exited with %d", cmdId, code);
		if (code === 0) {
			resolve(stdoutData);
		} else {
			reject(new Error(`${command} command ${spawnArgs.join(", ")} failed with exit code ${code}`));
		}
	});
});
