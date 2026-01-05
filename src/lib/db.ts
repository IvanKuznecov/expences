import { openDB, type DBSchema } from 'idb';

export interface Transaction {
    id: string;
    date: string; // ISO date string YYYY-MM-DD
    amount: number;
    type: 'D' | 'C';
    beneficiary: string;
    purpose: string;
    categoryId?: string;
    conflicts?: string[]; // Array of category IDs if multiple rules match
    originalRow: Record<string, string>;
}

export interface Category {
    id: string;
    name: string;
    color: string;
    budget: number;
}

export interface Mapping {
    id: string;
    pattern: string;
    categoryId: string;
}

interface ExpenseDB extends DBSchema {
    transactions: {
        key: string;
        value: Transaction;
        indexes: { 'by-date': string; 'by-category': string };
    };
    categories: {
        key: string;
        value: Category;
    };
    mappings: {
        key: string;
        value: Mapping;
    };
    settings: {
        key: string;
        value: any;
    };
    import_logs: {
        key: string;
        value: ImportLog;
        indexes: { 'by-date': string };
    };
}

export interface ImportLog {
    id: string;
    date: string;
    filename: string;
    count: number;
}

const dbPromise = openDB<ExpenseDB>('expense-tracker', 3, { // Bump version
    upgrade(db, oldVersion) {
        if (oldVersion < 1) {
            const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
            txStore.createIndex('by-date', 'date');
            txStore.createIndex('by-category', 'categoryId');

            db.createObjectStore('categories', { keyPath: 'id' });
            db.createObjectStore('mappings', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
            db.createObjectStore('settings');
        }
        if (oldVersion < 3) {
            const logStore = db.createObjectStore('import_logs', { keyPath: 'id' });
            logStore.createIndex('by-date', 'date');
        }
    },
});


export const getDB = () => dbPromise;

// ... existing exports ...

export async function addImportLog(log: ImportLog) {
    const db = await getDB();
    return db.put('import_logs', log);
}

export async function getImportLogs() {
    const db = await getDB();
    return db.getAllFromIndex('import_logs', 'by-date');
}

export async function getIgnoredAccounts(): Promise<string[]> {
    const db = await getDB();
    return (await db.get('settings', 'ignoredAccounts')) || [];
}

export async function setIgnoredAccounts(accounts: string[]) {
    const db = await getDB();
    return db.put('settings', accounts, 'ignoredAccounts');
}

export async function getIncludeInternal(): Promise<boolean> {
    const db = await getDB();
    return (await db.get('settings', 'includeInternal')) ?? false; // Default to false (excluded)
}

export async function setIncludeInternal(include: boolean) {
    const db = await getDB();
    return db.put('settings', include, 'includeInternal');
}

export async function getTopCategoriesCount(): Promise<number> {
    const db = await getDB();
    return (await db.get('settings', 'topCategoriesCount')) ?? 10;
}

export async function setTopCategoriesCount(count: number) {
    const db = await getDB();
    return db.put('settings', count, 'topCategoriesCount');
}


export async function saveTransactions(transactions: Transaction[]) {
    const db = await getDB();
    const tx = db.transaction('transactions', 'readwrite');
    await Promise.all(transactions.map(t => tx.store.put(t)));
    await tx.done;
}

export async function getAllTransactions() {
    const db = await getDB();
    return db.getAll('transactions');
}

export async function getTransactionsByDateRange(start: string, end: string) {
    const db = await getDB();
    return db.getAllFromIndex('transactions', 'by-date', IDBKeyRange.bound(start, end));
}

export async function getCategories() {
    const db = await getDB();
    return db.getAll('categories');
}

export async function addCategory(category: Category) {
    const db = await getDB();
    return db.put('categories', category);
}

export async function deleteCategory(id: string) {
    const db = await getDB();
    const tx = db.transaction(['categories', 'transactions', 'mappings'], 'readwrite');

    // 1. Delete the category
    await tx.objectStore('categories').delete(id);

    // 2. Unset categoryId for all affected transactions
    const txIndex = tx.objectStore('transactions').index('by-category');
    let txCursor = await txIndex.openCursor(IDBKeyRange.only(id));

    while (txCursor) {
        const update = { ...txCursor.value };
        delete update.categoryId;
        await txCursor.update(update);
        txCursor = await txCursor.continue();
    }

    // 3. Delete associated mappings
    // We don't have an index on mappings by categoryId, so we scan. 
    // Mappings table is usually small.
    let mapCursor = await tx.objectStore('mappings').openCursor();
    while (mapCursor) {
        if (mapCursor.value.categoryId === id) {
            await mapCursor.delete();
        }
        mapCursor = await mapCursor.continue();
    }

    await tx.done;
}

export async function getMappings() {
    const db = await getDB();
    return db.getAll('mappings');
}

export async function addMapping(mapping: Mapping) {
    const db = await getDB();
    return db.put('mappings', mapping);
}

export async function deleteMapping(id: string) {
    const db = await getDB();
    return db.delete('mappings', id);
}

export async function clearAll() {
    const db = await getDB();
    const tx = db.transaction(['transactions', 'categories', 'mappings', 'import_logs'], 'readwrite');
    await tx.objectStore('transactions').clear();
    await tx.objectStore('categories').clear();
    await tx.objectStore('mappings').clear();
    await tx.objectStore('import_logs').clear();
    await tx.done;
}

export async function clearTransactionsOnly() {
    const db = await getDB();
    const tx = db.transaction(['transactions', 'import_logs'], 'readwrite');
    await tx.objectStore('transactions').clear();
    await tx.objectStore('import_logs').clear();
    await tx.done;
}

export async function ensureSystemCategories() {
    const db = await getDB();

    // Income Category
    const income = await db.get('categories', 'IN');
    if (!income) {
        await db.put('categories', {
            id: 'IN',
            name: 'Income',
            color: '#22c55e', // green-500
            budget: 0
        });
    }

    // Internal / Ignored Category
    const internal = await db.get('categories', 'INTERNAL');
    if (!internal) {
        await db.put('categories', {
            id: 'INTERNAL',
            name: 'Internal / Ignored',
            color: '#9ca3af', // gray-400
            budget: 0
        });
    }
}


