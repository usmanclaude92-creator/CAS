import serverless from 'serverless-http';
import { app } from '../src/server/app';

// Vercel serverless entrypoint. All /api/* requests are rewritten to this
// function (see vercel.json), which dispatches into the same Express app
// used for local dev and traditional hosting (server.ts).
export default serverless(app);
