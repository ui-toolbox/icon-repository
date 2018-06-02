import * as express from "express";

const router: express.Router = express.Router();

const getPrivileges: express.RequestHandler = (req, res, next) => {
    const privileges: string[] = req.session.authentication && req.session.authentication.privileges
        ? req.session.authentication.privileges
        : [];
    res.send(privileges).status(200).end();
};

const setAuthentication: express.RequestHandler = (req, res) => {
    if (req.body.privileges) {
        req.session.authentication = {
            username: req.body.username,
            privileges: req.body.privileges
        };
    }
    res.status(200).end();
};

router.get("/authentication", getPrivileges);
router.put("/authentication", setAuthentication);

export default router;
