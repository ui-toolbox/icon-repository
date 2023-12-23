// @ts-expect-error TODO
import probe = require("probe-image-size");

import { Readable } from "stream";

const bufferToStream = (buffer: Buffer): Readable => {
	const readable = new Readable();
	readable._read = () => undefined;
	readable.push(buffer);
	readable.push(null);
	return readable;
};

export interface ImageMetadata {
	width: number
	height: number
	type: string
	mime: string
	wUnits: string
	hUnits: string
}

const probeImageSize: (fileStream: Readable) => Promise<ImageMetadata> = probe;

export const probeMetadata = async (content: Buffer): Promise<ImageMetadata> => {
	return await probeImageSize(bufferToStream(content));
};
