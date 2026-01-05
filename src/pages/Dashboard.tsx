import { useState, useEffect, useMemo } from 'react';
import { useTransactions } from '../hooks/useData';
import { formatCurrency, cn } from '../lib/utils';
import { getCategories, type Category, getTopCategoriesCount, getIncludeInternal } from '../lib/db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Calendar, Filter } from 'lucide-react';
import { format, subMonths, parseISO } from 'date-fns';

// Custom Tooltip without explicit complex types to avoid import issues
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-lg text-sm">
                <p className="font-bold text-gray-900 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }}></div>
                        <span className="text-gray-600">{entry.name}:</span>
                        <span className="font-mono font-medium">{formatCurrency(entry.value as number)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export function Dashboard() {
    const { transactions, loading: txLoading } = useTransactions();
    const [categories, setCategories] = useState<Map<string, Category>>(new Map());
    const [topCount, setTopCount] = useState(5);
    const [includeInternal, setIncludeInternal] = useState(false);
    const [initLoading, setInitLoading] = useState(true);

    // Monthly Deep Dive State
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM

    // Average View State
    const [averagePeriod, setAveragePeriod] = useState<'3' | '6' | '12'>('3');

    useEffect(() => {
        loadData().catch(err => console.error("Dashboard Load Error:", err));
    }, []);

    const loadData = async () => {
        try {
            const [cats, count, incInternal] = await Promise.all([
                getCategories(),
                getTopCategoriesCount(),
                getIncludeInternal()
            ]);
            setCategories(new Map(cats.map(c => [c.id, c])));
            setTopCount(count);
            setIncludeInternal(incInternal);
        } catch (e) {
            console.error("Failed to load settings/categories", e);
        } finally {
            setInitLoading(false);
        }
    };

    // Set default selected month to current/latest
    useEffect(() => {
        if (!selectedMonth && transactions.length > 0) {
            const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
            if (sorted.length > 0) {
                setSelectedMonth(sorted[0].date.substring(0, 7));
            }
        }
    }, [transactions]);

    // Helper: Get Categories (memoized)
    const categoryList = useMemo(() => Array.from(categories.values()), [categories]);
    const internalCatIds = useMemo(() => {
        return categoryList
            .filter(c => c.name.toLowerCase().includes('internal') || c.id === 'INTERNAL')
            .map(c => c.id);
    }, [categoryList]);

    // Data Processing
    // 1. Monthly Totals for Overview & Trend
    const monthlyData = useMemo(() => {
        const data = new Map<string, { date: string, income: number, expense: number, categories: Map<string, number> }>();

        transactions.forEach(t => {
            if (!includeInternal && t.categoryId && internalCatIds.includes(t.categoryId)) return;

            const month = t.date.substring(0, 7);
            const entry = data.get(month) || { date: month, income: 0, expense: 0, categories: new Map() };

            if (t.type === 'C') {
                entry.income += t.amount;
            } else {
                entry.expense += t.amount;
                const catId = t.categoryId || 'uncategorized';
                entry.categories.set(catId, (entry.categories.get(catId) || 0) + t.amount);
            }
            data.set(month, entry);
        });

        // Convert to array and sort by date
        return Array.from(data.values())
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [transactions, includeInternal, internalCatIds]);

    // 2. Average Expenses Data
    const averageData = useMemo(() => {
        if (transactions.length === 0) return [];
        const monthsCtx = parseInt(averagePeriod);
        const cutoffDate = subMonths(new Date(), monthsCtx).toISOString().substring(0, 7);

        // Filter transactions for the period
        const relevantTxs = transactions.filter(t => {
            if (!includeInternal && t.categoryId && internalCatIds.includes(t.categoryId)) return false;
            return t.date >= cutoffDate + '-01' && t.type === 'D';
        });

        // Avoid division by zero
        const uniqueMonths = new Set(relevantTxs.map(t => t.date.substring(0, 7))).size;
        const divisor = uniqueMonths || 1;

        const sums = new Map<string, number>();
        relevantTxs.forEach(t => {
            const catId = t.categoryId || 'uncategorized';
            sums.set(catId, (sums.get(catId) || 0) + t.amount);
        });

        return Array.from(sums.entries())
            .map(([catId, total]) => {
                const cat = categories.get(catId);
                return {
                    name: cat ? cat.name : (catId === 'uncategorized' ? 'Uncategorized' : 'Unknown'),
                    amount: total / divisor, // Average
                    color: cat ? cat.color : '#9ca3af'
                };
            })
            .sort((a, b) => b.amount - a.amount)
            .slice(0, topCount);

    }, [transactions, averagePeriod, includeInternal, internalCatIds, categories, topCount]);

    // 3. Top Categories for Trend Chart
    const topCategoriesForTrend = useMemo(() => {
        const totals = new Map<string, number>();
        monthlyData.forEach(m => {
            m.categories.forEach((amount, catId) => {
                totals.set(catId, (totals.get(catId) || 0) + amount);
            });
        });

        return Array.from(totals.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, topCount)
            .map(([id]) => id);
    }, [monthlyData, topCount]);

    // Format Data for Recharts (Trend)
    const trendChartData = useMemo(() => {
        return monthlyData.slice(-12).map(m => {
            const entry: any = { name: format(parseISO(m.date + '-01'), 'MMM yy') };
            topCategoriesForTrend.forEach(catId => {
                const cat = categories.get(catId);
                const name = cat ? cat.name : (catId === 'uncategorized' ? 'Uncategorized' : 'Unknown');
                entry[name] = m.categories.get(catId) || 0;
            });
            return entry;
        });
    }, [monthlyData, topCategoriesForTrend, categories]);

    // Statistics for Cards
    const stats = useMemo(() => {
        if (monthlyData.length === 0) return null;
        const current = monthlyData[monthlyData.length - 1];

        return {
            month: format(parseISO(current.date + '-01'), 'MMMM yyyy'),
            income: current.income,
            expense: current.expense,
            balance: current.income - current.expense
        };
    }, [monthlyData]);

    // Monthly Deep Dive Logic
    const availableMonthsForSelector = useMemo(() => monthlyData.map(m => m.date).reverse(), [monthlyData]);

    const monthlyDeepDiveStats = useMemo(() => {
        if (!selectedMonth) return null;

        let startingBalance = 0;
        monthlyData.forEach(m => {
            if (m.date < selectedMonth) {
                startingBalance += (m.income - m.expense);
            }
        });

        const monthData = monthlyData.find(m => m.date === selectedMonth);
        const income = monthData?.income || 0;
        const expense = monthData?.expense || 0;
        const net = income - expense;

        const breakdown = monthData ? Array.from(monthData.categories.entries())
            .map(([catId, amount]) => {
                const cat = categories.get(catId);
                return {
                    name: cat ? cat.name : (catId === 'uncategorized' ? 'Uncategorized' : 'Unknown'),
                    amount: amount,
                    color: cat ? cat.color : '#9ca3af'
                };
            })
            .sort((a, b) => b.amount - a.amount) : [];

        return {
            startingBalance,
            income,
            expense,
            net,
            breakdown
        };
    }, [monthlyData, selectedMonth, categories]);

    if (txLoading || initLoading) return <div className="p-12 text-center text-gray-500">Loading dashboard...</div>;

    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-gray-400">
                <Wallet className="w-12 h-12 mb-4 opacity-50" />
                <p>No transactions found. Import data to get started.</p>
            </div>
        );
    }

    if (!stats) return <div className="p-12 text-center text-gray-500">Processing data...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <header>
                <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
                <p className="text-gray-500">Financial overview for {stats.month}</p>
            </header>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <ArrowDownCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Income</p>
                            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(stats.income)}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-50 rounded-lg">
                            <ArrowUpCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Expenses</p>
                            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(stats.expense)}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <Wallet className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Net Balance</p>
                            <h3 className={cn("text-2xl font-bold", stats.balance >= 0 ? "text-green-600" : "text-red-600")}>
                                {stats.balance > 0 ? '+' : ''}{formatCurrency(stats.balance)}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Trend Chart (Stacked) */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Expense Trend (Last 12 Months)</h3>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => `€${value}`} />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend />
                            {topCategoriesForTrend.map(catId => {
                                const cat = categories.get(catId);
                                const name = cat ? cat.name : (catId === 'uncategorized' ? 'Uncategorized' : 'Unknown');
                                return (
                                    <Bar
                                        key={catId}
                                        dataKey={name}
                                        fill={cat ? cat.color : '#9ca3af'}
                                        radius={[0, 0, 0, 0]}
                                        stackId="a"
                                    />
                                );
                            })}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            {/* Average Expenses Section */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Average Monthly Expenses</h3>
                    <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                        {['3', '6', '12'].map((period) => (
                            <button
                                key={period}
                                onClick={() => setAveragePeriod(period as any)}
                                className={cn(
                                    "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                                    averagePeriod === period ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                {period} Months
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={averageData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={120}
                                    tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: '#f9fafb' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-2 border border-blue-100 shadow-lg rounded-lg text-xs">
                                                    <p className="font-bold">{data.name}</p>
                                                    <p className="font-mono text-blue-600">{formatCurrency(data.amount)} / month</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={24}>
                                    {averageData.map((entry: any, index: number) => (
                                        <Cell key={index} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="space-y-4 pt-4">
                        <p className="text-sm text-gray-500 mb-4">
                            Top {topCount} categories by average monthly spend over the last {averagePeriod} months.
                        </p>
                        {averageData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                                    <span className="font-medium text-gray-700">{item.name}</span>
                                </div>
                                <span className="font-bold text-gray-900 font-mono">{formatCurrency(item.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Monthly Deep Dive */}
            <section className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-32 bg-blue-500 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
                <div className="relative z-10">
                    <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <Calendar className="w-6 h-6 text-blue-400" />
                                Monthly Deep Dive
                            </h2>
                            <p className="text-slate-400 mt-1">Detailed breakdown for the selected period.</p>
                        </div>

                        <div className="bg-slate-800 p-1 rounded-lg border border-slate-700">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent text-white text-sm font-medium border-none focus:ring-0 cursor-pointer min-w-[200px]"
                            >
                                {availableMonthsForSelector.map(m => (
                                    <option key={m} value={m} className="bg-slate-800 text-white">
                                        {format(parseISO(m + '-01'), 'MMMM yyyy')}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </header>

                    {monthlyDeepDiveStats && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Starting Balance</p>
                                    <p className={cn("text-xl font-bold font-mono", monthlyDeepDiveStats.startingBalance >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {formatCurrency(monthlyDeepDiveStats.startingBalance)}
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Income</p>
                                    <p className="text-xl font-bold text-white font-mono">{formatCurrency(monthlyDeepDiveStats.income)}</p>
                                </div>
                                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Expense</p>
                                    <p className="text-xl font-bold text-white font-mono">{formatCurrency(monthlyDeepDiveStats.expense)}</p>
                                </div>
                                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Net Flow</p>
                                    <p className={cn("text-xl font-bold font-mono", monthlyDeepDiveStats.net >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                        {monthlyDeepDiveStats.net > 0 ? '+' : ''}{formatCurrency(monthlyDeepDiveStats.net)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 h-[450px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={monthlyDeepDiveStats.breakdown.slice(0, 15)} layout="vertical" margin={{ left: 10, right: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                                            <XAxis type="number" tickFormatter={(val) => `€${val}`} stroke="#64748b" tick={{ fontSize: 11 }} />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                width={130}
                                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <RechartsTooltip
                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const d = payload[0].payload;
                                                        return (
                                                            <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl">
                                                                <p className="text-white font-bold text-sm mb-1">{d.name}</p>
                                                                <p className="text-emerald-400 font-mono font-bold">{formatCurrency(d.amount)}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={20}>
                                                {monthlyDeepDiveStats.breakdown.slice(0, 15).map((entry, index) => (
                                                    <Cell key={index} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="bg-slate-800/30 rounded-xl p-4 overflow-y-auto max-h-[450px] border border-slate-700 space-y-2 custom-scrollbar">
                                    {monthlyDeepDiveStats.breakdown.map((cat, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-700/50 rounded-lg transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}></div>
                                                <span className="text-sm text-slate-300 group-hover:text-white transition-colors truncate max-w-[120px]" title={cat.name}>{cat.name}</span>
                                            </div>
                                            <span className="text-sm font-mono text-slate-400 group-hover:text-emerald-400 transition-colors">
                                                {formatCurrency(cat.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
