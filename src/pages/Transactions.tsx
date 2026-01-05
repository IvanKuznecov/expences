import { useState, useEffect, useMemo } from 'react';
import { useTransactions } from '../hooks/useData';
import { formatCurrency, cn } from '../lib/utils';
import { Filter, X, Check, ChevronDown } from 'lucide-react';
import { getCategories, type Category, saveTransactions } from '../lib/db';
import { format, parseISO } from 'date-fns';

export function Transactions() {
    const { transactions, loading, refresh } = useTransactions();
    const [categories, setCategories] = useState<Map<string, Category>>(new Map());

    // Filter States
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // UI States
    const [isCatFilterOpen, setIsCatFilterOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        getCategories().then(cats => {
            setCategories(new Map(cats.map(c => [c.id, c])));
        });
    }, []);

    const updateCategory = async (txId: string, newCategoryId: string) => {
        const tx = transactions.find(t => t.id === txId);
        if (tx && tx.categoryId !== newCategoryId) {
            tx.categoryId = newCategoryId;
            // Clear conflicts if any, as user manually resolved it
            delete tx.conflicts;
            await saveTransactions([tx]);
            refresh();
        }
        setEditingId(null);
    };

    // Derived Data: Available Months
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        transactions.forEach(t => {
            months.add(t.date.substring(0, 7)); // YYYY-MM
        });
        return Array.from(months).sort().reverse();
    }, [transactions]);

    // Derived Data: Filtered & Sorted Transactions
    const processedTransactions = useMemo(() => {
        let result = [...transactions];

        // 1. Filter by Month
        if (selectedMonth !== 'all') {
            result = result.filter(t => t.date.startsWith(selectedMonth));
        }

        // 2. Filter by Categories
        if (selectedCategories.length > 0) {
            result = result.filter(t => {
                const catId = t.categoryId || 'uncategorized';
                return selectedCategories.includes(catId);
            });
        }

        // 3. Sort by Category Name (A-Z) then Date (Desc)
        result.sort((a, b) => {
            // Priority: Internal -> Others -> Uncategorized
            const catNameA = a.categoryId ? (categories.get(a.categoryId)?.name || 'Unknown') : 'Uncategorized';
            const catNameB = b.categoryId ? (categories.get(b.categoryId)?.name || 'Unknown') : 'Uncategorized';

            const catCompare = catNameA.localeCompare(catNameB);
            if (catCompare !== 0) return catCompare;

            // Secondary sort by Date (Newest first)
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        return result;
    }, [transactions, selectedMonth, selectedCategories, categories]);

    const toggleCategory = (catId: string) => {
        setSelectedCategories(prev =>
            prev.includes(catId)
                ? prev.filter(id => id !== catId)
                : [...prev, catId]
        );
    };

    if (loading) {
        return <div className="p-12 text-center text-gray-500">Loading transactions...</div>;
    }

    if (transactions.length === 0) {
        return (
            <div className="text-center p-12 bg-white rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">No transactions found</h3>
                <p className="text-gray-500 mt-2">Import some data to get started.</p>
            </div>
        );
    }

    // Prepare category list for filter
    const categoryList = Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name));
    // Add "Uncategorized" as a pseudo-category for filtering
    const allFilterOptions = [
        { id: 'uncategorized', name: 'Uncategorized', color: '#9ca3af' },
        ...categoryList
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
                    <p className="text-gray-500">{processedTransactions.length} transactions shown</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Month Filter */}
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
                    >
                        <option value="all">All Months</option>
                        {availableMonths.map(m => (
                            <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMMM yyyy')}</option>
                        ))}
                    </select>

                    {/* Category Multi-Select */}
                    <div className="relative">
                        <button
                            onClick={() => setIsCatFilterOpen(!isCatFilterOpen)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm font-medium transition-colors",
                                selectedCategories.length > 0 ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                            )}
                        >
                            <Filter className="w-4 h-4" />
                            Categories {selectedCategories.length > 0 && `(${selectedCategories.length})`}
                            <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
                        </button>

                        {isCatFilterOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsCatFilterOpen(false)} />
                                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-20 max-h-[400px] overflow-y-auto p-2">
                                    <div className="mb-2 px-2 py-1 flex justify-between items-center border-b border-gray-50">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Filter Categories</span>
                                        {selectedCategories.length > 0 && (
                                            <button
                                                onClick={() => setSelectedCategories([])}
                                                className="text-xs text-red-500 hover:text-red-600"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        {allFilterOptions.map(cat => {
                                            const isSelected = selectedCategories.includes(cat.id);
                                            return (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => toggleCategory(cat.id)}
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                                                        isSelected ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                                        <span className="truncate max-w-[160px]">{cat.name}</span>
                                                    </div>
                                                    {isSelected && <Check className="w-3 h-3" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 uppercase tracking-wider text-xs">
                            <tr>
                                <th className="px-6 py-3">Category</th>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Details</th>
                                <th className="px-6 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {processedTransactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        {editingId === tx.id ? (
                                            <select
                                                autoFocus
                                                className="text-xs border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1 pl-1 pr-6"
                                                value={tx.categoryId || ''}
                                                onChange={(e) => updateCategory(tx.id, e.target.value)}
                                                onBlur={() => setEditingId(null)}
                                            >
                                                <option value="" disabled>Select...</option>
                                                {categoryList.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <button
                                                onClick={() => setEditingId(tx.id)}
                                                className="group relative focus:outline-none"
                                            >
                                                {(() => {
                                                    const cat = tx.categoryId ? categories.get(tx.categoryId) : null;
                                                    return (
                                                        <span
                                                            className={cn(
                                                                "px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5 border border-transparent group-hover:border-gray-200 group-hover:shadow-sm transition-all",
                                                                !tx.categoryId && "bg-gray-100 text-gray-600",
                                                                (tx.categoryId && !cat) && "bg-red-50 text-red-600 border border-red-100"
                                                            )}
                                                            style={cat ? { backgroundColor: `${cat.color}20`, color: cat.color } : {}}
                                                        >
                                                            {cat && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />}
                                                            {cat ? cat.name : (tx.categoryId ? 'Unknown' : 'Uncategorized')}
                                                            <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50 -mr-1 transition-opacity" />
                                                        </span>
                                                    );
                                                })()}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">{tx.date}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 break-words">{tx.beneficiary}</div>
                                        <div className="text-xs text-gray-500 break-words mt-0.5">{tx.purpose}</div>
                                    </td>
                                    <td className={cn("px-6 py-4 text-right font-bold text-base tabular-nums", tx.type === 'D' ? "text-gray-900" : "text-green-600")}>
                                        {tx.type === 'D' ? '-' : '+'}{formatCurrency(tx.amount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {processedTransactions.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                        No transactions match your current filters.
                    </div>
                )}
            </div>
        </div>
    );
}
