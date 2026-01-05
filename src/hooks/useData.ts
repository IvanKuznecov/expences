import { useState, useEffect } from 'react';
import { getAllTransactions, type Transaction } from '../lib/db';

export function useTransactions() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        const data = await getAllTransactions();
        // Sort by date desc
        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(data);
        setLoading(false);
    };

    return { transactions, loading, refresh: load };
}
