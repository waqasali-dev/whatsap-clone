import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database connection string from environment
const connectionString = process.env.DATABASE_URL;
const isNeon = connectionString && (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require'));

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: isNeon ? { rejectUnauthorized: false } : false
    }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'whatsapp',
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
      ssl: false
    };

const pool = new Pool(poolConfig);

// Connect and log status
pool.connect()
  .then((client) => {
    const dbType = isNeon ? 'Neon Cloud PostgreSQL' : 'Local PostgreSQL';
    console.log(`Connected to ${dbType} database successfully`);
    client.release();
  })
  .catch((err) => {
    console.error('PostgreSQL database connection error:', err.message);
  });

export default pool;
