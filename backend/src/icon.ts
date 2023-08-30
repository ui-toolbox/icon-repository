import { isEqual } from "lodash";

export interface IconfileDescriptor {
	readonly format: string
	readonly size: string
}

export interface IconfileData extends IconfileDescriptor {
	readonly content: Buffer
}

export interface IconAttributes {
	readonly name: string
}

export interface IconfileDescriptorEx extends IconfileDescriptor, IconAttributes {}

export interface Iconfile extends IconAttributes, IconfileData {}

export class IconDescriptor implements IconAttributes {
	public readonly name: string;
	public readonly modifiedBy: string;
	public readonly iconfiles: IconfileDescriptor[];
	public readonly tags: string[];

	constructor (name: string, modifiedBy: string, iconfiles: IconfileDescriptor[], tags: string[]) {
		this.name = name;
		this.modifiedBy = modifiedBy;
		this.iconfiles = iconfiles ?? [];
		this.tags = tags ?? [];
	}

	public addIconfile (iconfile: IconfileDescriptor): IconDescriptor {
		return new IconDescriptor(this.name, this.modifiedBy, this.iconfiles.concat(iconfile), this.tags);
	}

	public removeIconfile (iconfile: IconfileDescriptor): IconDescriptor {
		return new IconDescriptor(this.name, this.modifiedBy, this.iconfiles.filter(ifi => isEqual(ifi, iconfile)), this.tags);
	}

	public addTag (tag: string): IconDescriptor {
		return new IconDescriptor(this.name, this.modifiedBy, this.iconfiles, this.tags.concat(tag));
	}
}

export class IconNotFound extends Error {}

export class IconfileAlreadyExists {
	public readonly message: string;

	constructor (iconfile: Iconfile) {
		this.message = `A file ${iconfile.format}@${iconfile.size} for icon ${iconfile.name} already exists`;
	}
}
