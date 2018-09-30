import { Observable } from "rxjs";
import { randomBytes } from "crypto";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import { createIcon, setAuth, RequestBuilder, addIconFile } from "./api-client";
import { List } from "immutable";
import { IconFileData, IconFile } from "../../src/icon";
import { clone } from "../../src/utils/clone";

export interface Icon {
    readonly name: string;
    readonly modifiedBy: string;
    readonly files: List<IconFileData>;
}

export const getTestIconData: () => List<Icon> = () => List([
    {
        name: "cartouche",
        modifiedBy: "ux",
        files: List([
            {
                format: "french",
                size: "great",
                content: randomBytes(4096)
            },
            {
                format: "french",
                size: "large",
                content: randomBytes(4096)
            },
            {
                format: "belge",
                size: "large",
                content: randomBytes(4096)
            }
        ])
    },
    {
        name: "flonflon",
        modifiedBy: "ux",
        files: List([
            {
                format: "french",
                size: "great",
                content: randomBytes(4096)
            },
            {
                format: "french",
                size: "large",
                content: randomBytes(4096)
            },
            {
                format: "belge",
                size: "large",
                content: randomBytes(4096)
            }
        ])
    }
]);

const testDataDescriptor = [
    {
        name: "cartouche",
        modifiedBy: "ux",
        paths: [
            { format: "belge", size: "large", path: "/icons/cartouche/formats/belge/sizes/large" },
            { format: "french", size: "great", path: "/icons/cartouche/formats/french/sizes/great" },
            { format: "french", size: "large", path: "/icons/cartouche/formats/french/sizes/large" }
        ]
    },
    {
        name: "flonflon",
        modifiedBy: "ux",
        paths: [
            { format: "belge", size: "large", path: "/icons/flonflon/formats/belge/sizes/large" },
            { format: "french", size: "great", path: "/icons/flonflon/formats/french/sizes/great" },
            { format: "french", size: "large", path: "/icons/flonflon/formats/french/sizes/large" }
        ]
    }
];

type TestDataDescriptor = typeof testDataDescriptor;

export const getTestDataDescriptor: () => TestDataDescriptor = () => clone(testDataDescriptor);

export const createInitialIconFile: (requestBuilder: RequestBuilder, iconFile: IconFile) => Observable<number>
= (requestBuilder, iconFile) => {
    const privileges = [
        privilegeDictionary.CREATE_ICON
    ];

    return setAuth(requestBuilder, privileges)
    .flatMap(() => createIcon(requestBuilder, iconFile));
};

export const addTestData = (
    requestBuilder: RequestBuilder,
    testData: List<Icon>
) => {
    return Observable.of(void 0)
    .flatMap(() => testData.toArray())
    .flatMap(icon =>
        createIcon(requestBuilder, {name: icon.name, ...icon.files.get(0)})
        .flatMap(() => icon.files.delete(0).toArray())
        .flatMap(file => addIconFile(requestBuilder, {name: icon.name, ...file})))
    .last(void 0); // "reduce" could be also be used if the "return" value mattered
};
