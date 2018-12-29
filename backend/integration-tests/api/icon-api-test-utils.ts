import * as path from "path";
import { of } from "rxjs";
import { flatMap, last } from "rxjs/operators";
import { createIcon, RequestBuilder, setAuth, updateIcon, ingestIconfile } from "./api-client";
import { List, Map } from "immutable";
import { readFile } from "../../src/utils/rx";
import { IconfileData, IconfileDescriptor, IconDescriptor, Iconfile } from "../../src/icon";
import clone from "../../src/utils/clone";
import { defaultAuth } from "./api-test-utils";
import { readFileSync } from "fs";
import { IconDTO, IconPath } from "../../src/iconsHandlers";

export interface Icon {
    readonly name: string;
    readonly modifiedBy: string;
    readonly files: List<IconfileData>;
}

export const getDemoIconfileContent = (iconName: string, iconfileDesc: IconfileDescriptor) =>
    readFile(path.join(
        __dirname, "..", "..", "..",
        "demo-data", iconfileDesc.format, iconfileDesc.size, `${iconName}.${iconfileDesc.format}`));

export const getDemoIconfileContentSync = (iconName: string, iconfileDesc: IconfileDescriptor) =>
    readFileSync(path.join(
        __dirname, "..", "..", "..",
        "demo-data", iconfileDesc.format, iconfileDesc.size, `${iconName}.${iconfileDesc.format}`));

interface TestIconDescriptor {
    name: string;
    modifiedBy: string;
    files: List<IconfileDescriptor>;
}

const testIconInputDataDescriptor = List([
    {
        name: "attach_money",
        modifiedBy: "ux",
        files: List([
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
        ])
    },
    {
        name: "cast_connected",
        modifiedBy: defaultAuth.user,
        files: List([
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
        ])
    }
]);

const moreTestIconInputDataDescriptor =  List([
    {
        name: "format_clear",
        modifiedBy: "ux",
        files: List([
            {
                format: "png",
                size: "24dp"
            },
            {
                format: "svg",
                size: "48px"
            }
        ])
    },
    {
        name: "insert_photo",
        modifiedBy: "ux",
        files: List([
            {
                format: "png",
                size: "24dp"
            },
            {
                format: "svg",
                size: "48px"
            }
        ])
    }
]);

const dp2px = Map.of(
    "24dp", "36px"
);

const createTestIconInputData: (testIconDescriptors: List<TestIconDescriptor>) => List<Icon>
= testIconDescriptors => testIconDescriptors.map(testIconDescriptor => ({
    name: testIconDescriptor.name,
    modifiedBy: testIconDescriptor.modifiedBy,
    files: testIconDescriptor.files
        .map(iconfileDesc => ({
            ...iconfileDesc,
            content: getDemoIconfileContentSync(testIconDescriptor.name, iconfileDesc)
        })).toList()
})).toList();

export const testIconInputData = createTestIconInputData(testIconInputDataDescriptor);
export const moreTestIconInputData = createTestIconInputData(moreTestIconInputDataDescriptor);

const createIngestedTestIconData: (iconInputData: List<Icon>) => List<Icon>
= iconInputData => iconInputData.map(inputTestIcon => ({
    name: inputTestIcon.name,
    modifiedBy: inputTestIcon.modifiedBy,
    files: inputTestIcon.files
        .map(iconfile => ({
            format: iconfile.format,
            size: dp2px.get(iconfile.size)
                ? dp2px.get(iconfile.size)
                : iconfile.size,
            content: iconfile.content
        })).toList()
})).toList();

export const ingestedTestIconData = createIngestedTestIconData(testIconInputData);
export const moreIngestedTestIconData = createIngestedTestIconData(moreTestIconInputData);

export const getIngestedTestIconDataDescription: () => IconDTO[] = () => clone([
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

export const addTestData = (
    requestBuilder: RequestBuilder,
    testData: List<Icon>
) => {
    return of(void 0)
    .pipe(
        flatMap(() => testData.toArray()),
        flatMap(icon =>
            createIcon(requestBuilder, icon.name, icon.files.get(0).content)
            .pipe(
                flatMap(() => icon.files.delete(0).toArray()),
                flatMap(file => ingestIconfile(requestBuilder, icon.name, file.content))
            )),
        last(void 0)
    ); // "reduce" could be also be used if the "return" value mattered
};
