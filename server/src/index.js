// Local / VPS entry point: `npm start` or `npm run dev`.
// (On Vercel the app is loaded from api/index.js instead.)
import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { checkEnv } from './config/env.js';

const envCheck = checkEnv();
if (!envCheck.ok) {
  console.error('Invalid configuration in server/.env (see server/.env.example):');
  for (const e of envCheck.errors) console.error(`  - ${e}`);
  process.exit(1);
}

const app = createApp({ serveClient: true });
const PORT = envCheck.env.PORT;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
