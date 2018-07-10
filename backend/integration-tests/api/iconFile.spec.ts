import { boilerplateSubscribe } from "../testUtils";
import {
    iconEndpointPath,
    iconFileEndpointPath,
    createAddIconFormData,
    setAuthentication,
    testUploadRequest,
    createAddIconFileFormData,
    CreateIconFormData,
    UploadFormData,
    manageTestResourcesBeforeAfter,
    describeAllIcons,
    getCheckIconFile1,
    getCheckIconFile
} from "./api-test-utils";
import { privilegeDictionary } from "../../src/security/authorization/privileges/priv-config";
import * as request from "request";
import { Observable } from "rxjs";

export const createInitialIcon: (
    createIconFormData: CreateIconFormData
) => Observable<number>
= createIconFormData => {
    const privileges = [
        privilegeDictionary.CREATE_ICON
    ];
    const jar = request.jar();

    return setAuthentication("zazie", privileges, jar)
    .flatMap(() =>
        testUploadRequest({
            path: iconEndpointPath,
            method: "POST",
            formData: createIconFormData,
            jar
        }))
    .map(result => (result.body.iconId as number));
};

export const addIconFile = (
    privileges: string[],
    iconName: string,
    format: string,
    size: string,
    formData: UploadFormData
) => {
    const jar = request.jar();

    return setAuthentication("zazie", privileges, jar)
    .flatMap(() =>
        testUploadRequest({
            path: createIconFileURL(iconName, format, size),
            method: "POST",
            formData,
            jar
        }));
};

const createIconFileURL: (iconName: string, format: string, size: string) => string
    = (iconName, format, size) => `/icons/${iconName}/formats/${format}/sizes/${size}`;

describe(iconFileEndpointPath, () => {

    manageTestResourcesBeforeAfter();

    it ("POST should fail with 403 without either of CREATE_ICON or ADD_ICON_FILE privilege", done => {
        const jar = request.jar();
        setAuthentication("zazie", [], jar)
        .flatMap(() =>
            testUploadRequest({
                path: iconFileEndpointPath,
                method: "POST",
                formData: createAddIconFormData("cartouche", "french", "great"),
                jar
            })
            .map(result => expect(result.response.statusCode).toEqual(403)))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should fail on insufficient data", done => {
        const privileges = [
            privilegeDictionary.ADD_ICON_FILE
        ];
        const jar = request.jar();
        setAuthentication("zazie", privileges, jar)
        .flatMap(() =>
            testUploadRequest({
                path: iconFileEndpointPath,
                method: "POST",
                formData: createAddIconFormData("cartouche", "french", "great"),
                jar
            })
            .map(result => expect(result.response.statusCode).toEqual(400)))
        .subscribe(boilerplateSubscribe(fail, done));
    });

    const createIconThenAddIconFileWithPrivileges = (privileges: string[]) => {
        const iconName = "cartouche";
        const format = "french";
        const size1 = "great";
        const upForm1 = createAddIconFormData(iconName, format, size1);
        const upForm2 = createAddIconFileFormData();
        const size2 = "large";
        return createInitialIcon(upForm1)
        .flatMap(iconId => addIconFile(privileges, iconName, format, size2, upForm2))
        .map(result => expect(result.response.statusCode).toEqual(201))
        .flatMap(() => describeAllIcons())
        .map(iconDTOList => {
            expect(iconDTOList.size).toEqual(1);
            expect(iconDTOList.get(0).name).toEqual(iconName);
            expect(Object.keys(iconDTOList.get(0).paths).reduce(
                (pathCount, formatInPath) => pathCount + Object.keys(iconDTOList.get(0).paths[formatInPath]).length, 0
            )).toEqual(2);
        })
        .flatMap(() => getCheckIconFile(upForm1))
        .flatMap(() => getCheckIconFile1(iconName, format, size2, upForm2));
    };

    it ("POST should complete with CREATE_ICON privilege", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];
        createIconThenAddIconFileWithPrivileges(privileges)
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("POST should complete with ADD_ICON_FILE privilege", done => {
        const privileges = [
            privilegeDictionary.ADD_ICON_FILE
        ];
        createIconThenAddIconFileWithPrivileges(privileges)
        .subscribe(boilerplateSubscribe(fail, done));
    });

    it ("GET should return the requested icon file as specified by format and size", done => {
        const privileges = [
            privilegeDictionary.CREATE_ICON
        ];

        const jar = request.jar();
        const formData = createAddIconFormData("cartouche", "french", "great");

        setAuthentication("zazie", privileges, jar)
        .flatMap(() =>
            testUploadRequest({
                path: iconEndpointPath,
                method: "POST",
                formData,
                jar
            })
            .flatMap(result => {
                expect(result.response.statusCode).toEqual(201);
                expect(result.body.iconId).toEqual(1);
                return getCheckIconFile(formData);
            })
        )
        .subscribe(boilerplateSubscribe(fail, done));
    });
});
