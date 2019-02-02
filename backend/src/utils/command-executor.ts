import { SpawnOptions, spawn } from "child_process";
import { Observable, Observer } from "rxjs";
import loggerFactory from "./logger";

export type CommandExecutor = (
    command: string,
    spawnArgs: ReadonlyArray<string>,
    options?: SpawnOptions) => Observable<string>;

const ctxLogger = loggerFactory("command-executor");

let commandExecutionId = 0;

export const commandExecutor: CommandExecutor = (command, spawnArgs, options) => {
    return Observable.create((observer: Observer<string>) => {
        const cmdId = ++commandExecutionId;
        ctxLogger.debug("BEGIN command #%d: %s %O", cmdId, command, spawnArgs);
        let stdoutData: string = "";
        const proc = spawn(command, spawnArgs, options);
        proc.stderr.on("data", data => ctxLogger.info("[%d]: stderr: %O", cmdId, data.toString("utf8")));
        proc.stdout.on("data", data => {
            ctxLogger.debug("[%d]: stdout: %O", cmdId, data.toString("utf8"));
            stdoutData += data;
        });
        proc.on("error", err => {
            ctxLogger.debug("[#%d]: Failed to execute command: %O", cmdId, command, err);
            observer.error(err);
        });
        proc.on("close", code => {
            ctxLogger.debug("[#%d]: Program exited with %d", cmdId, code);
            if (code === 0) {
                observer.next(stdoutData);
                observer.complete();
            } else {
                observer.error(new Error(`${command} command ${spawnArgs} failed with exit code ${code}`));
            }
        });
    });
};
