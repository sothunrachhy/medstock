// Vercel serverless entry point: every /api/* request is routed here (see vercel.json).
// The React app (client/dist) is served by Vercel as static files.
import { createApp } from '../server/src/app.js';

export default createApp();
