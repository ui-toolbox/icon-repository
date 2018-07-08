/**
 * Serializes asynchronous jobs.
 */
import { List } from "immutable";

import logger from "../utils/logger";
import { Observable, Observer } from "rxjs";

export type JobResult = any;

interface JobCallback {
    readonly next: (result: JobResult) => void;
    readonly error: (error: Error) => void;
    readonly complete: () => void;
}

export type SerializableJobImpl = () => Observable<JobResult>;
export type EnqueueJob = (job: SerializableJobImpl) => Observable<JobResult>;

interface JobItem {
    readonly job: SerializableJobImpl;
    readonly callbacks: JobCallback;
}

export const create: (jobType: string) => EnqueueJob = jobType => {
    const ctxLogger = logger.createChild("asynch-jobs-serializer: " + jobType);

    let queue: List<JobItem> = List([]);

    const hasPending: () => boolean = () => queue.size > 0;

    const executeItem: (item: JobItem) => void = item => {
        item.job()
        .subscribe(
            nextValue => item.callbacks.next(nextValue),
            error => item.callbacks.error(error),
            () => item.callbacks.complete()
        );
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

    const scheduleNextJob = () => {
        ctxLogger.debug("Scheduling next job");
        setImmediate(next);
    };

    const enqueue: (job: SerializableJobImpl) => Observable<JobResult>
    = job => Observable.create((observer: Observer<JobResult>) => {
        const newItem: JobItem = {
            job,
            callbacks: {
                next: nextValue => {
                    observer.next(nextValue);
                },
                error: error => {
                    observer.error(error);
                    scheduleNextJob();
                },
                complete: () => {
                    observer.complete();
                    scheduleNextJob();
                }
            }
        };

        const hadPending = hasPending();
        queue = queue.push(newItem);
        if (hadPending) {
            ctxLogger.debug("Jobs in the queue already, one of them must be running");
        } else {
            ctxLogger.debug("No jobs in the queue, execute this one");
            setImmediate(executeNextItem);
        }
    });

    return enqueue;
};
