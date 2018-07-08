import * as express from "express";
import { getAuthentication, Authentication, storeAuthentication } from "./common";
import { Set } from "immutable";

const router: express.Router = express.Router();

const getPrivileges: express.RequestHandler = (req, res, next) => {
    const privileges: Set<string> = getAuthentication(req.session) && getAuthentication(req.session).privileges
        ? getAuthentication(req.session).privileges
        : Set();
    res.send(privileges).status(200).end();
};

const setAuthentication: express.RequestHandler = (req, res) => {
    if (req.body.privileges) {
        storeAuthentication(req.session, new Authentication(req.body.username, req.body.privileges));
    }
    res.status(200).end();
};

router.get("/authentication", getPrivileges);
router.put("/authentication", setAuthentication);

export default router;
