import * as path from "path";
import { createIcon, type RequestBuilder, ingestIconfile } from "./api-client";
import { type IconfileData, type IconfileDescriptor } from "../../src/icon";
import clone from "../../src/utils/clone";
import { defaultAuth } from "./api-test-utils";
import { readFileSync } from "fs";
import { type IconDTO } from "../../src/icons-handlers";
import { readFile } from "fs/promises";
import { isNil } from "lodash";

export interface Icon {
	readonly name: string
	readonly modifiedBy: string
	readonly files: IconfileData[]
}

export const getDemoIconfileContent = async (iconName: string, iconfileDesc: IconfileDescriptor): Promise<Buffer> => {
	return await readFile(
		path.join(__dirname, "..", "..", "..", "demo-data", iconfileDesc.format, iconfileDesc.size, `${iconName}.${iconfileDesc.format}`)
	);
};

export const getDemoIconfileContentSync = (iconName: string, iconfileDesc: IconfileDescriptor): Buffer =>
	readFileSync(
		path.join(__dirname, "..", "..", "..", "demo-data", iconfileDesc.format, iconfileDesc.size, `${iconName}.${iconfileDesc.format}`)
	);

interface TestIconDescriptor {
	name: string
	modifiedBy: string
	files: IconfileDescriptor[]
}

const testIconInputDataDescriptor = [
	{
		name: "attach_money",
		modifiedBy: "ux",
		files: [
			{
				format: "svg",
				size: "18px"
			},
			{
				format: "svg",
				size: "24px"
			},
			{
				format: "png",
				size: "24dp"
			}
		]
	},
	{
		name: "cast_connected",
		modifiedBy: defaultAuth.user,
		files: [
			{
				format: "svg",
				size: "24px"
			},
			{
				format: "svg",
				size: "48px"
			},
			{
				format: "png",
				size: "24dp"
			}
		]
	}
];

const moreTestIconInputDataDescriptor = [
	{
		name: "format_clear",
		modifiedBy: "ux",
		files: [
			{
				format: "png",
				size: "24dp"
			},
			{
				format: "svg",
				size: "48px"
			}
		]
	},
	{
		name: "insert_photo",
		modifiedBy: "ux",
		files: [
			{
				format: "png",
				size: "24dp"
			},
			{
				format: "svg",
				size: "48px"
			}
		]
	}
];

const dp2px: Record<string, string> = Object.freeze({
	"24dp": "36px"
});

const createTestIconInputData = (testIconDescriptors: TestIconDescriptor[]): Icon[] =>
	testIconDescriptors.map(testIconDescriptor => {
		const icon: Icon = {
			name: testIconDescriptor.name,
			modifiedBy: testIconDescriptor.modifiedBy,
			files: testIconDescriptor.files
				.map(iconfileDesc => {
					const iconfileData: IconfileData = {
						...iconfileDesc,
						content: getDemoIconfileContentSync(testIconDescriptor.name, iconfileDesc)
					};
					return iconfileData;
				})
		};
		return icon;
	});

export const testIconInputData = createTestIconInputData(testIconInputDataDescriptor);
export const moreTestIconInputData = createTestIconInputData(moreTestIconInputDataDescriptor);

const createIngestedTestIconData = (iconInputData: Icon[]): Icon[] =>
	iconInputData.map(inputTestIcon => ({
		name: inputTestIcon.name,
		modifiedBy: inputTestIcon.modifiedBy,
		files: inputTestIcon.files
			.map(iconfile => ({
				format: iconfile.format,
				size: !isNil(dp2px[iconfile.size])
					? dp2px[iconfile.size]
					: iconfile.size,
				content: iconfile.content
			}))
	}));

export const ingestedTestIconData = createIngestedTestIconData(testIconInputData);
export const moreIngestedTestIconData = createIngestedTestIconData(moreTestIconInputData);

export const getPreIngestedTestIconDataDescription = (): IconDTO[] => clone([
	{
		name: "attach_money",
		modifiedBy: "ux",
		paths: [
			{ format: "png", size: "36px", path: "/icon/attach_money/format/png/size/36px" },
			{ format: "svg", size: "18px", path: "/icon/attach_money/format/svg/size/18px" },
			{ format: "svg", size: "24px", path: "/icon/attach_money/format/svg/size/24px" }
		],
		tags: []
	},
	{
		name: "cast_connected",
		modifiedBy: "ux",
		paths: [
			{ format: "png", size: "36px", path: "/icon/cast_connected/format/png/size/36px" },
			{ format: "svg", size: "24px", path: "/icon/cast_connected/format/svg/size/24px" },
			{ format: "svg", size: "48px", path: "/icon/cast_connected/format/svg/size/48px" }
		],
		tags: []
	}
]);

export const addTestData = async (rb: RequestBuilder, testData: Icon[]): Promise<void> => {
	for (const icon of testData) {
		await createIcon(rb, icon.name, icon.files[0].content);
		for (const iconfile of icon.files.filter((_, index) => index > 0)) {
			await ingestIconfile(rb, icon.name, iconfile.content);
		}
	}
};
