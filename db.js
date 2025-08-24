// backend/db.js
import mongoose from 'mongoose';

const {
  MONGO_URI,
  MONGODB_MAX_POOL = '50',
  MONGOOSE_DEBUG = 'false',
} = process.env;

mongoose.set('strictQuery', true);
mongoose.set('debug', MONGOOSE_DEBUG === 'true');

/**
 * Connect to MongoDB with sensible defaults for Atlas/production.
 * @param {string} [uri] - optional override, otherwise uses process.env.MONGO_URI
 */
export async function connectDB(uri) {
  const mongoUri = uri || MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI is not set');

  // Important: use SRV connection string from Atlas and whitelist your server IP in Atlas.
  // Also ensure your database user has the correct database/collection permissions.

  await mongoose.connect(mongoUri, {
    maxPoolSize: Number(MONGODB_MAX_POOL), // concurrent sockets to Mongo
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,        // fast failover if cluster unreachable
    socketTimeoutMS: 20000,
    retryWrites: true,
    w: 'majority',
  });

  // Helpful connection logs
  const { host, port, name } = mongoose.connection;
  console.log(`[db] Connected to MongoDB @ ${host}:${port} / ${name}`);

  // Graceful shutdown
  const cleanup = async (sig) => {
    try {
      await mongoose.connection.close();
      console.log(`[db] Connection closed (${sig})`);
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', () => cleanup('SIGINT'));
  process.once('SIGTERM', () => cleanup('SIGTERM'));
}
