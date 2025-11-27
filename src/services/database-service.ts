import {Pool} from 'pg'
import {env} from '../config/environment'

export class DatabaseService {
    private pool : Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        });
    }

    async query(text: string, params?: any[]) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params)
            return result;
        } catch (error) {
            console.error(error);
            throw error
        } finally {
            client.release();
        }
    }

    async transaction<T>(cb: (client: any) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await cb(client);  // ✅ Capture the return value
            await client.query('COMMIT');
            return result;  // ✅ Return the result from the callback
        } catch (error) {
            await client.query('ROLLBACK')
            throw error;
        } finally {
            client.release();
        }
    }

}

export const db = new DatabaseService();