/**
 * Serializes asynchronous jobs.
 */
import { List } from "immutable";

import logger from "../utils/logger";

export type JobResult = any;
export type JobDoneCallback = () => void;
export type SerializableJobImpl = (done: JobDoneCallback) => void;
export type EnqueueJob = (job: SerializableJobImpl) => void;

export const create: (jobType: string) => EnqueueJob = jobType => {
    const ctxLogger = logger.createChild("asynch-jobs-serializer: " + jobType);

    let queue: List<SerializableJobImpl> = List([]);

    const hasPending: () => boolean = () => queue.size > 0;

    const executeItem: (job: SerializableJobImpl) => void
    = job => job(() => setImmediate(next));

    const executeNextItem = () => {
        executeItem(queue.first());
    };

    const next = () => {
        queue = queue.shift(); // remove the caller batch job from the queue
        if (hasPending()) {
            executeNextItem();
        }
    };

    const enqueue: (job: SerializableJobImpl) => void
    = job => {
        const hadPending = hasPending();
        queue = queue.push(job);
        if (hadPending) {
            ctxLogger.verbose("Jobs in the queue already, one of them must be running");
        } else {
            ctxLogger.verbose("No jobs in the queue, execute this one");
            setImmediate(executeNextItem);
        }

    };

    return enqueue;
};
