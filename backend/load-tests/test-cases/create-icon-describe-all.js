import http from "k6/http";
import { group, check } from "k6";

const sampleIconFilePath = "backend/demo-data/svg/48px/attach_money.svg";
const format = "svg";
const svgFile = open(sampleIconFilePath);

export default function() {

    group("Create icon", () => {
        const iconName = `attach_money-${new Date().getTime()}-${Math.floor(Math.random() * 1024 * 1024)}`;
        const size = `${Math.floor(Math.random() * 10) + 1}x`;
        var data = {
            name: iconName,
            format,
            size,
            file: http.file(svgFile, `${iconName}-${size}.${format}`)
        };

        const resCreate = http.post(`${__ENV.ICONREPO_BASE_URL}/icons`, data);
        check(resCreate, {
            "is status 201": (r) => r.status === 201
        });
    })

    group("Reload icons", () => {
        const resDescribe = http.get(`${__ENV.ICONREPO_BASE_URL}/icons`);
        check(resDescribe, {
            "is status 200": (r) => r.status === 200
        });
    })

};
