import React, { useState, useEffect, useMemo } from 'react';
import { getCategories, getAllTransactions, saveTransactions, type Category, type Transaction } from '../lib/db';
import { formatCurrency, cn } from '../lib/utils';
import { HelpCircle, Check, AlertTriangle, AlertCircle, Plus, Search, Tag } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function Uncategorized() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        const [cats, txs] = await Promise.all([
            getCategories(),
            getAllTransactions()
        ]);

        // Filter uncategorized
        const uncategorized = txs.filter(t => !t.categoryId).sort((a, b) => b.date.localeCompare(a.date));

        setCategories(cats);
        setTransactions(uncategorized);
        setLoading(false);
    };

    const handleCategorize = async (txId: string, catId: string) => {
        const txs = await getAllTransactions();
        const tx = txs.find(t => t.id === txId);
        if (tx) {
            tx.categoryId = catId;
            delete tx.conflicts; // Clear conflicts on manual resolve
            await saveTransactions([tx]);
            load();
        }
    };

    // Derived Data: Available Months from Uncategorized Transactions
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        transactions.forEach(t => {
            months.add(t.date.substring(0, 7)); // YYYY-MM
        });
        return Array.from(months).sort().reverse();
    }, [transactions]);

    // Derived Data: Filtered
    const filteredTransactions = useMemo(() => {
        return transactions
            .filter(t => selectedMonth === 'all' || t.date.startsWith(selectedMonth))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, selectedMonth]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-amber-500" />
                        Uncategorized Transactions
                    </h2>
                    <p className="text-gray-500 mt-2">
                        {filteredTransactions.length} items need your attention.
                    </p>
                </div>

                {transactions.length > 0 && (
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 px-3 py-2"
                    >
                        <option value="all">All Months</option>
                        {availableMonths.map(m => (
                            <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMMM yyyy')}</option>
                        ))}
                    </select>
                )}
            </header>

            {transactions.length === 0 ? (
                <div className="p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900">All caught up!</h3>
                    <p className="text-gray-500">No uncategorized transactions found.</p>
                </div>
            ) : filteredTransactions.length === 0 ? (
                <div className="p-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900">No items for this month</h3>
                    <p className="text-gray-500">Select another month or "All Months" to see items.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredTransactions.map(tx => (
                        <div key={tx.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3 text-sm text-gray-500">
                                        <span className="font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{tx.date}</span>
                                        {tx.originalRow['Beneficiary/payer\'s account number'] && (
                                            <span className="font-mono text-xs text-gray-400">{tx.originalRow['Beneficiary/payer\'s account number']}</span>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{tx.beneficiary || 'Unknown Beneficiary'}</h3>
                                        <p className="text-gray-600 mt-1">{tx.purpose}</p>
                                    </div>

                                    <div className="text-xs text-gray-400 space-y-1 pt-2 font-mono">
                                        {Object.entries(tx.originalRow).map(([k, v]) => {
                                            if (!v || ['Value date', 'Amount', 'Currency', 'Beneficiary/ Payer', 'Purpose of payment', 'Beneficiary/payer\'s account number'].includes(k)) return null;
                                            return <div key={k}><span className="font-semibold">{k}:</span> {v as any}</div>
                                        })}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-4 min-w-[250px]">
                                    <span className={cn("text-xl font-bold tabular-nums", tx.type === 'D' ? "text-gray-900" : "text-green-600")}>
                                        {tx.type === 'D' ? '-' : '+'}{formatCurrency(tx.amount)}
                                    </span>

                                    <div className="w-full flex flex-col gap-2 items-end">
                                        {tx.conflicts && tx.conflicts.length > 0 && (
                                            <div className="w-full bg-orange-50 border border-orange-100 p-3 rounded-lg mb-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-orange-700 mb-2">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Multiple Rules Matched
                                                </div>
                                                <div className="flex flex-wrap gap-2 justify-end">
                                                    {tx.conflicts.map(cId => {
                                                        const cat = categories.find(c => c.id === cId);
                                                        if (!cat) return null;
                                                        return (
                                                            <button
                                                                key={cId}
                                                                onClick={() => handleCategorize(tx.id, cId)}
                                                                className="text-xs px-2 py-1 rounded border border-orange-200 bg-white hover:bg-orange-100 text-orange-900 transition-colors flex items-center gap-1"
                                                            >
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                                                {cat.name}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <select
                                            className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                            value=""
                                            onChange={(e) => handleCategorize(tx.id, e.target.value)}
                                        >
                                            <option value="" disabled>Select Category...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
