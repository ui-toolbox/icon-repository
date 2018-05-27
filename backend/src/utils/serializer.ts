/**
 * Serializes asynchronous jobs.
 */
import { List } from "immutable";

import logger from "../utils/logger";

export type JobResult = any;
export type JobDoneCallback = (error: Error, result: JobResult) => void;
export type SerializableJobImpl = (done: JobDoneCallback) => void;
export type EnqueueJob = (job: SerializableJobImpl, callback: JobDoneCallback) => void;

interface IJobItem {
    readonly job: SerializableJobImpl;
    readonly callback: JobDoneCallback;
}

export const create: (jobType: string) => EnqueueJob = jobType => {
    const ctxLogger = logger.createChild("asynch-jobs-serializer: " + jobType);

    let queue: List<IJobItem> = List([]);

    const hasPending: () => boolean = () => queue.size > 0;

    const executeItem: (item: IJobItem) => void = item => {
        item.job((error: Error, result: any) => {
            if (item.callback) {
                item.callback(error, result);
            }
            setImmediate(next);
        });
    };

    const executeNextItem = () => {
        executeItem(queue.first());
    };

    const next = () => {
        queue = queue.shift(); // remove the caller batch job from the queue
        if (hasPending()) {
            executeNextItem();
        }
    };

    const enqueue: (job: SerializableJobImpl, callback: JobDoneCallback) => void
    = (job, callback) => {
        const newItem: IJobItem = {
            job,
            callback
        };

        const hadPending = hasPending();
        queue = queue.push(newItem);
        if (hadPending) {
            ctxLogger.verbose("Jobs in the queue already, one of them must be running");
        } else {
            ctxLogger.verbose("No jobs in the queue, execute this one");
            setImmediate(executeNextItem);
        }

    };

    return enqueue;
};
