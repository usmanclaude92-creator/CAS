import { app } from '../src/server/app.js';

// Vercel's Node runtime invokes this with a plain (req, res) signature —
// an Express app is itself a callable (req, res) handler, so it can be
// exported directly. (serverless-http wraps for AWS Lambda's event/context
// shape instead, which is a mismatch here and hangs every request.)
export default app;
