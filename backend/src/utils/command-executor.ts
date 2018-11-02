import { ContextAbleLogger } from "./logger";
import { SpawnOptions, spawn } from "child_process";
import { Observable, Observer } from "rxjs";

export type CommandExecutor = (
    logger: ContextAbleLogger,
    command: string,
    spawnArgs: ReadonlyArray<string>,
    options?: SpawnOptions) => Observable<string>;

export const commandExecutor: CommandExecutor = (ctxLogger, command, spawnArgs, options) => {
    ctxLogger.debug("BEGIN");
    let stdoutData: string = "";
    const proc = spawn(command, spawnArgs, options);
    proc.stderr.on("data", data => ctxLogger.info(`stderr: ${data}`));
    proc.stdout.on("data", data => {
        ctxLogger.debug(`stdout: ${data}`);
        stdoutData += data;
    });
    return Observable.create((observer: Observer<string>) => {
        proc.on("error", err => observer.error(err));
        proc.on("close", code => {
            if (code === 0) {
                observer.next(stdoutData);
                observer.complete();
            } else {
                observer.error(new Error(`${command} command ${spawnArgs} failed with exit code ${code}`));
            }
        });
    });
};
