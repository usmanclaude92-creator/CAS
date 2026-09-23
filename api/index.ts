import serverless from 'serverless-http';
import { app } from '../src/server/app.js';

// Vercel's Node builder transpiles files under api/ but does not transpile
// relative imports that point outside it — and Node's native ESM resolver
// requires an explicit extension on relative imports (it doesn't infer
// .js the way CommonJS/bundlers do), so this import must say `.js` even
// though the source file on disk is `app.ts`.
export default serverless(app);
