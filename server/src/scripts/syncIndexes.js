// Brings the database indexes in line with the models: creates missing ones and
// replaces changed ones (e.g. the login-history TTL index). Safe to run more than once.
// Usage: npm run db:sync-indexes   (uses MONGO_URI from the environment / server/.env)
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import '../models/LoginHistory.js';
import '../models/Medicine.js';
import '../models/Patient.js';
import '../models/Requisition.js';
import '../models/Role.js';
import '../models/Setting.js';
import '../models/StockBatch.js';
import '../models/StockOut.js';
import '../models/User.js';

await connectDB();
for (const model of Object.values(mongoose.models)) {
  const dropped = await model.syncIndexes();
  console.log(`✓ ${model.modelName}${dropped.length ? ` (replaced: ${dropped.join(', ')})` : ''}`);
}
await mongoose.disconnect();
