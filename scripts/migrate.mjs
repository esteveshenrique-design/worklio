import {openDatabase} from '../database.mjs';
if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL to the target PostgreSQL database.');
const db=await openDatabase();
await db.close();
console.log('PostgreSQL schema is ready. Existing data was preserved.');
