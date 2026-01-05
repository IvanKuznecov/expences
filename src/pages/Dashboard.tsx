import { useState, useEffect, useMemo } from 'react';
import { getAllTransactions, getCategories, type Category, type Transaction, getIncludeInternal, getTopCategoriesCount } from '../lib/db';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { formatCurrency } from '../lib/utils';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Calendar, Filter } from 'lucide-react';
import { format, subMonths, parseISO, isBefore, isAfter } from 'date-fns';

export function Dashboard() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // Legacy Stats (Top of Page)
    const [stats, setStats] = useState<{
        lastMonth: string;
        income: number;
        expense: number;
        balance: number;
    } | null>(null);

    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [categoryTrend, setCategoryTrend] = useState<any[]>([]);
    const [topCategories, setTopCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Monthly Section State
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        const [txs, cats, includeInternal, topCount] = await Promise.all([
            getAllTransactions(),
            getCategories(),
            getIncludeInternal(),
            getTopCategoriesCount()
        ]);

        const validTxs = includeInternal
            ? txs
            : txs.filter(t => t.categoryId !== 'INTERNAL');

        setTransactions(validTxs);
        setCategories(cats);

        if (validTxs.length === 0) {
            setLoading(false);
            return;
        }

        // 1. Find Last Active Month (for Top Overview)
        const sortedTxs = [...validTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const lastTxDate = new Date(sortedTxs[0].date);
        const lastMonthStr = format(lastTxDate, 'yyyy-MM');

        // Set default selected month to the latest active month
        setSelectedMonth(lastMonthStr);

        // Stats for Last Month
        const lastMonthTxs = sortedTxs.filter(t => t.date.startsWith(lastMonthStr));
        let income = 0;
        let expense = 0;
        lastMonthTxs.forEach(t => {
            if (t.type === 'C') income += t.amount;
            else expense += t.amount;
        });

        setStats({
            lastMonth: format(lastTxDate, 'MMMM yyyy'),
            income,
            expense,
            balance: income - expense
        });

        // 2. Monthly Trend (Income vs Expense) - Last 6 Months
        const months = [];
        for (let i = 5; i >= 0; i--) {
            months.push(format(subMonths(lastTxDate, i), 'yyyy-MM'));
        }

        const monthlyFlow = months.map(m => {
            const mTxs = validTxs.filter(t => t.date.startsWith(m));
            const inc = mTxs.filter(t => t.type === 'C').reduce((sum, t) => sum + t.amount, 0);
            const exp = mTxs.filter(t => t.type === 'D').reduce((sum, t) => sum + t.amount, 0);
            return {
                name: format(parseISO(m + '-01'), 'MMM'),
                Income: inc,
                Expense: exp
            };
        });
        setMonthlyData(monthlyFlow);

        // 3. Category Trend
        const periodStart = months[0];
        const periodTxs = validTxs.filter(t => t.date >= periodStart && t.type === 'D');

        const catTotals: Record<string, number> = {};
        periodTxs.forEach(t => {
            const cid = t.categoryId || 'uncategorized';
            catTotals[cid] = (catTotals[cid] || 0) + t.amount;
        });

        const topCatIds = Object.entries(catTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topCount)
            .map(e => e[0]);

        const resolvedTopCats = topCatIds.map(id => {
            if (id === 'uncategorized') return { id: 'uncategorized', name: 'Uncategorized', color: '#9ca3af', budget: 0 };
            return cats.find(c => c.id === id) || { id, name: 'Unknown', color: '#000', budget: 0 };
        });
        setTopCategories(resolvedTopCats);

        const catData = months.map(m => {
            const mTxs = validTxs.filter(t => t.date.startsWith(m) && t.type === 'D');
            const row: any = { name: format(parseISO(m + '-01'), 'MMM') };

            resolvedTopCats.forEach(cat => {
                const total = mTxs.filter(t => (t.categoryId || 'uncategorized') === cat.id)
                    .reduce((sum, t) => sum + t.amount, 0);
                row[cat.name] = total;
            });

            const otherTotal = mTxs.filter(t => !topCatIds.includes(t.categoryId || 'uncategorized'))
                .reduce((sum, t) => sum + t.amount, 0);
            row['Others'] = otherTotal;

            return row;
        });
        setCategoryTrend(catData);
        setLoading(false);
    };

    // --- New Monthly Section Logic ---

    // 1. Available Months
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        transactions.forEach(t => months.add(t.date.substring(0, 7))); // yyyy-MM
        return Array.from(months).sort().reverse();
    }, [transactions]);

    // 2. Calculated Monthly Stats
    const monthlyAnalysis = useMemo(() => {
        if (!selectedMonth) return null;

        // Starting Balance: Sum of ALL transactions BEFORE this month
        // Income - Expense
        const prevTxs = transactions.filter(t => t.date < selectedMonth);
        const startingBalance = prevTxs.reduce((sum, t) => {
            return sum + (t.type === 'C' ? t.amount : -t.amount);
        }, 0);

        // Current Month Stats
        const currentTxs = transactions.filter(t => t.date.startsWith(selectedMonth));
        const monthIncome = currentTxs.filter(t => t.type === 'C').reduce((s, t) => s + t.amount, 0);
        const monthExpense = currentTxs.filter(t => t.type === 'D').reduce((s, t) => s + t.amount, 0);
        const monthBalance = monthIncome - monthExpense;

        // Category Breakdown (Expenses Only)
        const expenseTxs = currentTxs.filter(t => t.type === 'D');
        const catMap = new Map<string, number>();

        expenseTxs.forEach(t => {
            const cid = t.categoryId || 'uncategorized';
            catMap.set(cid, (catMap.get(cid) || 0) + t.amount);
        });

        const breakdown = Array.from(catMap.entries())
            .map(([id, amount]) => {
                const cat = id === 'uncategorized'
                    ? { name: 'Uncategorized', color: '#9ca3af' }
                    : categories.find(c => c.id === id) || { name: 'Unknown', color: '#000' };
                return {
                    name: cat.name,
                    amount,
                    color: cat.color
                };
            })
            .sort((a, b) => b.amount - a.amount);

        return {
            startingBalance,
            monthIncome,
            monthExpense,
            monthBalance,
            breakdown
        };
    }, [transactions, selectedMonth, categories]);


    if (loading) return <div className="p-20 text-center text-gray-400">Loading dashboard...</div>;
    if (!stats || !monthlyAnalysis) return (
        <div className="flex flex-col items-center justify-center p-20 text-gray-400">
            <Wallet className="w-12 h-12 mb-4 opacity-50" />
            <p>No transactions found. Import data to get started.</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <header>
                <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
                <div className="flex items-center gap-2 text-gray-500">
                    <p>Overview for <span className="font-semibold text-gray-800">{stats.lastMonth}</span></p>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">Last Uploaded</span>
                </div>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Total Income</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.income)}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-full group-hover:bg-green-100 transition-colors">
                        <ArrowUpCircle className="w-8 h-8 text-green-500" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Total Expenses</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.expense)}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-full group-hover:bg-red-100 transition-colors">
                        <ArrowDownCircle className="w-8 h-8 text-red-500" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Net Balance</p>
                        <p className={`text-2xl font-bold mt-1 ${stats.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                            {formatCurrency(stats.balance)}
                        </p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
                        <Wallet className="w-8 h-8 text-blue-500" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Monthly Flow Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Cash Flow Trend (Last 6 Months)</h3>
                    <div className="h-[450px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `€${val / 1000}k`} />
                                <Tooltip
                                    formatter={(value: any) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Category Trend Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Top Categories Trend</h3>
                    <div className="h-[450px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} stackOffset="sign">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `€${val / 1000}k`} />
                                <Tooltip
                                    formatter={(value: any) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                {/* Dynamic Bars for Top Categories */}
                                {topCategories.map((cat, idx) => (
                                    <Bar key={cat.id} dataKey={cat.name} stackId="a" fill={cat.color} radius={idx === topCategories.length ? [4, 4, 0, 0] : [0, 0, 0, 0]} barSize={30} />
                                ))}
                                <Bar dataKey="Others" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* --- New Monthly Analysis Section --- */}
            <div id="monthly-analysis" className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-indigo-600" />
                            Monthly Deep Dive
                        </h3>
                        <p className="text-gray-500 mt-1">Detailed breakdown of finances for a specific month.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">Select Month:</span>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 font-mono shadow-sm"
                        >
                            {availableMonths.map(m => (
                                <option key={m} value={m}>{format(parseISO(m + '-01'), 'MMMM yyyy')}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Month Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                            <p className="text-sm font-medium text-indigo-800 opacity-70 mb-1">Starting Balance</p>
                            <p className="text-xl font-bold text-indigo-900">{formatCurrency(monthlyAnalysis.startingBalance)}</p>
                            <p className="text-xs text-indigo-600 mt-2">Carried over from previous</p>
                        </div>
                        <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                            <p className="text-sm font-medium text-red-800 opacity-70 mb-1">Total Expense</p>
                            <p className="text-xl font-bold text-red-900">{formatCurrency(monthlyAnalysis.monthExpense)}</p>
                            <p className="text-xs text-red-600 mt-2">Spent this month</p>
                        </div>
                        <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                            <p className="text-sm font-medium text-green-800 opacity-70 mb-1">Total Income</p>
                            <p className="text-xl font-bold text-green-900">{formatCurrency(monthlyAnalysis.monthIncome)}</p>
                            <p className="text-xs text-green-600 mt-2">Earned this month</p>
                        </div>
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                            <p className="text-sm font-medium text-gray-800 opacity-70 mb-1">Net Balance</p>
                            <p className={`text-xl font-bold ${monthlyAnalysis.monthBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                {formatCurrency(monthlyAnalysis.monthBalance)}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">Income - Expense</p>
                        </div>
                    </div>

                    {/* Breakdown Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Chart */}
                        <div className="lg:col-span-2 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                            <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Filter className="w-4 h-4" /> Category Breakdown
                            </h4>
                            <div className="h-[600px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={monthlyAnalysis.breakdown}
                                        layout="vertical"
                                        margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            width={140}
                                            tick={{ fontSize: 12, fill: '#4b5563' }}
                                        />
                                        <Tooltip
                                            formatter={(val: any) => formatCurrency(val)}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                        />
                                        <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={20}>
                                            {monthlyAnalysis.breakdown.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* List Breakdown */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 h-[600px] overflow-y-auto">
                            <h4 className="font-bold text-gray-900 mb-4 sticky top-0 bg-white pb-2 border-b border-gray-100">
                                Detailed List
                            </h4>
                            <div className="space-y-3">
                                {monthlyAnalysis.breakdown.map(item => (
                                    <div key={item.name} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                            <span className="text-sm font-medium text-gray-700">{item.name}</span>
                                        </div>
                                        <span className="text-sm font-mono text-gray-900 group-hover:font-bold transition-all">
                                            {formatCurrency(item.amount)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
