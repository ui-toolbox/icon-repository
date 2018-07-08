import * as util from "util";
import "jasmine";

import { SerializableJobImpl, JobDoneCallback, create as createSerializer } from "./serializer";

interface IStepResult {
    readonly batchId: number;
    readonly stepId: number;
}

const createStepResult = (batchId: number, stepId: number) => ({
    batchId,
    stepId
});

type AsynchStep = (
    batchId: number,
    stepId: number,
    resultList: IStepResult[],
    done: (error: Error) => void
) => void;

const createAsynchStep: (delay: number) => AsynchStep
= delay => {
    return (batchId: number, stepId: number, resultList: IStepResult[], done: (error: Error) => void) => {
        setTimeout(() => {
            resultList.push(createStepResult(batchId, stepId));
            done(void 0);
        }, delay);
    };
};

const createFailingStep: () => AsynchStep = () => {
    return (batchId: number, stepId: number, resultList: IStepResult[], done: (error: any) => void) => {
        setTimeout(() => {
            done(new Error("Step failed"));
        });
    };
};

const createJob: (
    id: number,
    batch: AsynchStep[],
    resultList: IStepResult[],
    assertFn: () => void
) => SerializableJobImpl
= (id, batch, resultList, assertFn) => done => {
    const executeStep = (stepIndex: number) => {
        if (stepIndex < batch.length) {
            batch[stepIndex](id, stepIndex, resultList, (error: Error) => {
                if (error) {
                    done(error, void 0);
                } else {
                    executeStep(stepIndex + 1);
                }
            });
        } else {
            done(void 0, void 0);
            assertFn();
        }
    };
    executeStep(0);
};

const firstBatch: AsynchStep[] = [
    createAsynchStep(1000),
    createAsynchStep(100)
];
const secondBatch: AsynchStep[] = [
    createAsynchStep(1),
    createAsynchStep(1500)
];
const failingBatch: AsynchStep[] = [
    createFailingStep(),
    createAsynchStep(1000)
];

const expected = [
    createStepResult(1, 0),
    createStepResult(1, 1),
    createStepResult(2, 0),
    createStepResult(2, 1)
];

const expectedWithFirstBatchFailing = [
    createStepResult(2, 0),
    createStepResult(2, 1)
];

describe("Test artifacts for serializer", () => {
    it("should give interleaved batch results without serialization", done => {
        const result: IStepResult[] = [];
        const assert = (id: string) => () => {
            if (result.length === 4) {
                expect(result).not.toEqual(expected);
                done();
            }
        };
        const job1 = createJob(1, firstBatch, result, assert("ONE"));
        const job2 = createJob(2, secondBatch, result, assert("TWO"));

        job1(() => void 0);
        job2(() => void 0);
    });
});

describe("Asynch step batches serializer", () => {
    it("should have batches coming in later wait until batches that came in earlier complete", done => {
        const batchCallbackSpy = jasmine.createSpy("Batch callback");
        const enqueueJob = createSerializer("TEST");

        const result: IStepResult[] = [];
        const assert = (id: string) => () => {
            if (result.length === 4) {
                expect(batchCallbackSpy).toHaveBeenCalledWith(undefined, undefined);
                expect(result).toEqual(expected);
                done();
            }
        };
        const job1 = createJob(1, firstBatch, result, assert("ONE"));
        const job2 = createJob(2, secondBatch, result, assert("TWO"));

        enqueueJob(job1, batchCallbackSpy);
        enqueueJob(job2, batchCallbackSpy);
    });
});

describe("Asynch step batches serializer", () => {
    it("should allow handling errors occurring in batches", done => {
        const batchCallbackSpy = jasmine.createSpy("Batch callback");

        const enqueueJob = createSerializer("TEST");

        const result: IStepResult[] = [];
        const assert = (id: string) => () => {
            if (result.length === 2) {
                expect(batchCallbackSpy).toHaveBeenCalledWith(new Error("Step failed"), undefined);
                expect(result).toEqual(expectedWithFirstBatchFailing);
                done();
            }
        };
        const job1 = createJob(1, failingBatch, result, assert("ONE"));
        const job2 = createJob(2, secondBatch, result, assert("TWO"));

        enqueueJob(job1, batchCallbackSpy);
        enqueueJob(job2, batchCallbackSpy);
    });
});
