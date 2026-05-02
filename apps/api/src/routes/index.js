import { Router } from 'express';
import healthCheck from './health-check.js';
import angelOneRouter from './angelOne.js';

const router = Router();

export default () => {
    router.get('/health', healthCheck);
    router.use('/angel-one', angelOneRouter);

    return router;
};