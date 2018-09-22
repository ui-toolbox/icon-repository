// @ts-ignore
import probe = require("probe-image-size");

import { Readable } from "stream";
import { Observable, Observer } from "rxjs";

const bufferToStream: (buffer: Buffer) => Readable = buffer => {
    const readable = new Readable();
    readable._read = () => void 0;
    readable.push(buffer);
    readable.push(null);
    return readable;
};

export interface ImageMetadata {
    width: number;
    height: number;
    type: string;
    mime: string;
    wUnits: string;
    hUnits: string;
}

type ProbeCallback = (result: ImageMetadata) => void;
const probeImageSize: (fileStream: Readable) => Promise<ImageMetadata> = probe;

export const probeMetadata: (content: Buffer) => Observable<ImageMetadata> =
content => Observable.create((observer: Observer<ImageMetadata>) =>
    probeImageSize(bufferToStream(content)).then(
        result => {
            observer.next(result);
            observer.complete();
        },
        error => observer.error(error)
    ));
