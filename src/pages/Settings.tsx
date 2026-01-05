import React, { useState, useEffect } from 'react';
import { clearAll, clearTransactionsOnly, getIgnoredAccounts, setIgnoredAccounts, getIncludeInternal, setIncludeInternal, getTopCategoriesCount, setTopCategoriesCount } from '../lib/db';
import { Trash2, Plus, AlertTriangle, Settings2, Shield } from 'lucide-react';

export function Settings() {
    // Accounts
    const [ignoredAccounts, setIgnoredAccountsState] = useState<string[]>([]);
    const [newAccount, setNewAccount] = useState('');

    // Preferences
    const [includeInternal, setIncludeInternalState] = useState(false);
    const [topCount, setTopCount] = useState(10);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        const ignored = await getIgnoredAccounts();
        const include = await getIncludeInternal();
        const count = await getTopCategoriesCount();

        setIgnoredAccountsState(ignored || []);
        setIncludeInternalState(include);
        setTopCount(count);
    };

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAccount) return;
        const updated = [...ignoredAccounts, newAccount.trim()];
        await setIgnoredAccounts(updated);
        setIgnoredAccountsState(updated);
        setNewAccount('');
    };

    const handleDeleteAccount = async (acc: string) => {
        if (!confirm('Remove this account from ignore list?')) return;
        const updated = ignoredAccounts.filter(a => a !== acc);
        await setIgnoredAccounts(updated);
        setIgnoredAccountsState(updated);
    };

    const handleClearData = async () => {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
            await clearAll();
            load();
            alert('Data cleared.');
        }
    }

    const handleClearTransactions = async () => {
        if (confirm('Are you sure you want to delete ALL imported transactions and logs? Categories and rules will be kept.')) {
            await clearTransactionsOnly();
            load();
            alert('Transactions cleared.');
        }
    }

    return (
        <div className="space-y-8 max-w-3xl mx-auto animate-in fade-in duration-500 pb-20">
            <header className="flex items-center gap-3 border-b border-gray-100 pb-6">
                <div className="p-2 bg-gray-100 rounded-lg">
                    <Settings2 className="w-8 h-8 text-gray-700" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
                    <p className="text-gray-500">Application configs and preferences.</p>
                </div>
            </header>

            {/* General Preferences */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
                <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">General Preferences</h3>

                <div className="grid gap-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-900">Include "Internal" in Charts</p>
                            <p className="text-sm text-gray-500">Show internal/ignored transfers in dashboard statistics.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeInternal}
                                onChange={async (e) => {
                                    const val = e.target.checked;
                                    await setIncludeInternal(val);
                                    setIncludeInternalState(val);
                                }}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-900">Dashboard Top Categories</p>
                            <p className="text-sm text-gray-500">Number of categories to display in the trend chart.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="3"
                                max="20"
                                value={topCount}
                                onChange={async (e) => {
                                    const val = parseInt(e.target.value);
                                    if (val >= 3 && val <= 20) {
                                        await setTopCategoriesCount(val);
                                        setTopCount(val);
                                    }
                                }}
                                className="w-20 rounded-lg border-gray-300 focus:ring-indigo-500 text-center font-mono"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* My Accounts */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-bold text-gray-900">My Accounts</h3>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                    Transactions involving these accounts (Sender or Beneficiary) are treated as <strong>Internal Transfers</strong> and ignored by default.
                </p>

                <form onSubmit={handleAddAccount} className="flex gap-2 mb-4">
                    <input
                        value={newAccount}
                        onChange={e => setNewAccount(e.target.value)}
                        className="flex-1 rounded-lg border-gray-300 shadow-sm text-sm font-mono"
                        placeholder="IBAN / Account No."
                    />
                    <button type="submit" disabled={!newAccount} className="bg-gray-900 text-white px-3 rounded-lg hover:bg-black disabled:opacity-50">
                        <Plus className="w-5 h-5" />
                    </button>
                </form>

                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {ignoredAccounts.map(acc => (
                        <div key={acc} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 font-mono text-sm text-gray-700 group">
                            <span>{acc}</span>
                            <button onClick={() => handleDeleteAccount(acc)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {ignoredAccounts.length === 0 && (
                        <p className="text-sm text-gray-400 italic text-center py-4">No accounts listed.</p>
                    )}
                </div>
            </section>

            {/* Danger Zone */}
            <section className="bg-red-50 p-6 rounded-xl border border-red-100 mt-12">
                <h3 className="text-sm font-bold text-red-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h3>
                <div className="flex gap-4">
                    <button onClick={handleClearTransactions} className="bg-white border text-sm border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm">
                        Clear Transactions Only
                    </button>
                    <button onClick={handleClearData} className="bg-red-100 border text-sm border-red-200 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors">
                        Clear All Data (Factory Reset)
                    </button>
                </div>
            </section>
        </div>
    );
}
