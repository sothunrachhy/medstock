// Local / VPS entry point: `npm start` or `npm run dev`.
// (On Vercel the app is loaded from api/index.js instead.)
import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy server/.env.example to server/.env and fill it in.');
  process.exit(1);
}

const app = createApp({ serveClient: true });
const PORT = Number(process.env.PORT) || 5000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
