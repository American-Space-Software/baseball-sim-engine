import type { Database } from "better-sqlite3";
declare class SchemaService {
    private readonly database;
    constructor(database: Database);
    load(): void;
    transaction<T>(callback: () => T): T;
}
export { SchemaService };
