import { Observer } from "rxjs";

export const boilerplateSubscribe: (
    fail: (error: any) => void,
    done: () => void
) => Observer<any>
= (fail, done) => ({
    next: () => void 0,
    error: error => {
        fail(error);
        done();
    },
    complete: done
});
