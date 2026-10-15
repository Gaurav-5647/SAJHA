import './config.js';
import mongoose from 'mongoose';
import { app } from './app.js';
import { createPortal } from './portal.js';

const portal = process.env.PORTAL;
const port = Number(process.env.PORT || 10000);

async function start() {
  if (!['admin', 'agent'].includes(portal)) {
    throw new Error('PORTAL must be admin or agent');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }

  app.set('trust proxy', 1);

  await mongoose.connect(process.env.MONGODB_URI);

  createPortal(app, portal, port).listen(port, '0.0.0.0', () => {
    console.log(`SAJHA ${portal} portal running on port ${port}`);
  });
}

start().catch((error) => {
  console.error('Portal startup failed:', error.message);
  process.exit(1);
});
