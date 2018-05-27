import { Request, Response } from "express";

const brandingHandlerProvider: (appDescription: string) => (req: Request, res: Response) => void
= appDescription => (req, res) => {
    res.send({
        appDescription
    });
};

export default brandingHandlerProvider;
