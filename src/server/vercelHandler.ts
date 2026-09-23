import serverless from 'serverless-http';
import { app } from './app';

// Bundled into api/index.js at build time (see vercel.json's buildCommand).
// Vercel's zero-config Node builder transpiles api/*.ts in place but does not
// transpile relative imports that point outside api/, so app.ts must be
// inlined here rather than imported live from a Vercel function.
export default serverless(app);
