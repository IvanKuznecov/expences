import React from 'react';
import { Database, Server, Cpu, FileText, Settings, ShieldCheck, RefreshCw } from 'lucide-react';

export function Documentation() {
    return (
        <div className="space-y-12 max-w-4xl mx-auto pb-20 animate-in fade-in duration-500">
            <header>
                <h2 className="text-3xl font-bold text-gray-900">Documentation</h2>
                <p className="text-gray-500">Technical overview of the Expense Tracker architecture and processes.</p>
            </header>

            {/* Architecture Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                    <Server className="w-6 h-6 text-blue-600" />
                    <h3 className="text-2xl font-bold text-gray-800">Architecture</h3>
                </div>
                <div className="prose prose-blue max-w-none text-gray-600">
                    <p>
                        This application is a <strong>Client-Side Single Page Application (SPA)</strong> built with React and Vite.
                        It is designed to precise specifications for performance and privacy, as it operates entirely within the user's browser without a backend server.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div className="border border-gray-200 p-4 rounded-xl bg-gray-50">
                            <h4 className="font-bold text-gray-900 mb-2">Frontend Stack</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li><strong>Core:</strong> React 18 + TypeScript</li>
                                <li><strong>Build Tool:</strong> Vite</li>
                                <li><strong>Styling:</strong> TailwindCSS (Utility-first)</li>
                                <li><strong>Icons:</strong> Lucide React</li>
                                <li><strong>Routing:</strong> React Router DOM</li>
                            </ul>
                        </div>
                        <div className="border border-gray-200 p-4 rounded-xl bg-gray-50">
                            <h3 className="font-bold text-gray-900 mt-4 mb-2">2. Categorization Logic</h3>
                            <ul className="list-disc pl-5 space-y-1 text-gray-600">
                                <li>
                                    <strong>Internal Transfers (Priority 1):</strong> Checks if the beneficiary or purpose contains an account number from your "My Accounts" list (case-insensitive).
                                    <br /><span className="text-xs text-gray-400">Action: Categories as "Internal / Ignored". Excluded from stats.</span>
                                </li>
                                <li>
                                    <strong>Income (Priority 2):</strong> Any transaction with positive amount (Credit).
                                    <br /><span className="text-xs text-gray-400">Action: Categories as "Income".</span>
                                </li>
                                <li>
                                    <strong>User Mappings (Priority 3):</strong> Checks description against your custom keywords.
                                    <br /><span className="text-xs text-gray-400">Action: Assigns specific category.</span>
                                </li>
                            </ul>

                            <h3 className="font-bold text-gray-900 mt-4 mb-2">3. Features</h3>
                            <ul className="list-disc pl-5 space-y-1 text-gray-600">
                                <li><strong>Dashboard:</strong> Monthly Overview, Trends, Last Month comparison. Excludes internal transfers.</li>
                                <li><strong>Transactions:</strong>
                                    <ul className="list-circle pl-5 mt-1">
                                        <li>Full text search & filtering (Month, Category).</li>
                                        <li><strong>Inline Editing:</strong> Click any category to change it instantly.</li>
                                        <li>Smart sorting: By Category (A-Z) → Date (Newest).</li>
                                    </ul>
                                </li>
                                <li><strong>Settings:</strong>
                                    <ul className="list-circle pl-5 mt-1">
                                        <li><strong>Editable Categories:</strong> Click name to rename, click color to change theme.</li>
                                        <li><strong>My Accounts:</strong> Manage your IBANs to auto-detect internal transfers.</li>
                                        <li><strong>Excel Import:</strong> One-time migration tool.</li>
                                        <li><strong>Danger Zone:</strong> Clear just transactions (keep rules) or factory reset.</li>
                                    </ul>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Database Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                    <Database className="w-6 h-6 text-indigo-600" />
                    <h3 className="text-2xl font-bold text-gray-800">Database Schema</h3>
                </div>
                <p className="text-gray-600">
                    The application uses <strong>IndexedDB</strong> with a versioned schema. The main database is named <code>expense-tracker</code>.
                </p>
                <div className="grid gap-6">
                    <div className="bg-white border boundary-gray-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 font-mono font-bold text-indigo-800">
                            transactions
                        </div>
                        <div className="p-4 text-sm font-mono space-y-2 text-gray-600">
                            <p><span className="text-purple-600">id</span>: string (PK) - Unique Transaction ID</p>
                            <p><span className="text-purple-600">date</span>: string (ISO) - YYYY-MM-DD</p>
                            <p><span className="text-purple-600">amount</span>: number - Transaction value (cents)</p>
                            <p><span className="text-purple-600">type</span>: 'D' | 'C' - Debit or Credit</p>
                            <p><span className="text-purple-600">categoryId</span>: string | undefined - Linked Category ID</p>
                            <p><span className="text-purple-600">conflicts</span>: array - Conflicting Category IDs</p>
                        </div>
                    </div>

                    <div className="bg-white border boundary-gray-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100 font-mono font-bold text-emerald-800">
                            categories & mappings
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm font-mono text-gray-600">
                            <div>
                                <p className="font-bold mb-2 text-gray-900">categories</p>
                                <p><span className="text-purple-600">id</span>: string (PK)</p>
                                <p><span className="text-purple-600">name</span>: string</p>
                                <p><span className="text-purple-600">color</span>: string (Hex)</p>
                            </div>
                            <div>
                                <p className="font-bold mb-2 text-gray-900">mappings (rules)</p>
                                <p><span className="text-purple-600">id</span>: string (PK)</p>
                                <p><span className="text-purple-600">pattern</span>: string - Regex/String match</p>
                                <p><span className="text-purple-600">categoryId</span>: string - Target Category</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Processes Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                    <Cpu className="w-6 h-6 text-amber-600" />
                    <h3 className="text-2xl font-bold text-gray-800">Core Processes</h3>
                </div>

                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 mt-1">
                            <FileText className="w-8 h-8 text-amber-500 bg-amber-50 p-1.5 rounded-lg" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 mb-1">CSV Import & Parsing</h4>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                The system parses bank export CSVs using <code>PapaParse</code>. It automatically detects hashes to prevent duplicate imports.
                                During this process, it checks for <strong>Internal Transfers</strong> against the user's "Ignored Accounts" list (stored in <code>settings</code>).
                                If a transaction involves an ignored account, it is skipped entirely.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-shrink-0 mt-1">
                            <RefreshCw className="w-8 h-8 text-blue-500 bg-blue-50 p-1.5 rounded-lg" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 mb-1">Auto-Categorization & Conflict Resolution</h4>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                When a transaction is saved or rules are re-applied, the <code>matcher</code> engine runs.
                                It checks every transaction against all <strong>Mappings</strong>.
                                <br />
                                <ul className="list-disc list-inside mt-2 space-y-1 ml-1">
                                    <li>If <strong>0 rules</strong> match: Transaction remains <em>Uncategorized</em>.</li>
                                    <li>If <strong>1 rule</strong> matches: Category is automatically assigned.</li>
                                    <li>If <strong>&gt;1 rules</strong> match: A <strong>Conflict</strong> is flagged. The transaction is marked as Uncategorized, and the user must resolve it in the "Uncategorized" view.</li>
                                </ul>
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-shrink-0 mt-1">
                            <ShieldCheck className="w-8 h-8 text-red-500 bg-red-50 p-1.5 rounded-lg" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 mb-1">Data Integrity & Cascading Deletes</h4>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Deleting a <strong>Category</strong> triggers a cascading cleanup process.
                                <br />
                                1. The Category is removed.
                                <br />
                                2. All <strong>Mappings</strong> tied to that category are deleted.
                                <br />
                                3. All <strong>Transactions</strong> tied to that category have their `categoryId` set to undefined (Uncategorized).
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
