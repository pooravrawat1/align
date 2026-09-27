import { MongoClient } from 'mongodb';

let client = null;
let connecting = null;

export async function connectToMongoDB() {
  if (client) return client;
  if (!connecting) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    const candidate = new MongoClient(uri, { appName: 'align' });
    connecting = candidate.connect()
      .then(() => {
        client = candidate;
        console.log('Connected to MongoDB');
        return client;
      })
      .catch((err) => {
        connecting = null;
        throw err;
      });
  }
  return connecting;
}

export async function getDb(name = process.env.MONGODB_DB) {
  return (await connectToMongoDB()).db(name);
}

// Call this only when the application terminates.
export async function disconnectFromMongoDB() {
  const current = client;
  client = null;
  connecting = null;
  if (current) await current.close();
}
