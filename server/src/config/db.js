import mongoose from 'mongoose';

// Cached across calls (and across warm serverless invocations on Vercel),
// so each request does not open a new connection.
const cache = globalThis.__medstockMongo || (globalThis.__medstockMongo = { promise: null });

export async function connectDB(uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medstock') {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!cache.promise) {
    mongoose.set('strictQuery', true);
    cache.promise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 })
      .then(() => {
        const { host, name } = mongoose.connection;
        console.log(`MongoDB connected: ${host}/${name}`);
        return mongoose.connection;
      })
      .catch((err) => {
        cache.promise = null; // allow a retry on the next request
        throw err;
      });
  }
  return cache.promise;
}
