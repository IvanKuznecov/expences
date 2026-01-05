import { useState, useEffect } from 'react';
import { FileUploader } from '../components/FileUploader';
import { parseBankCSV, type ParseResult } from '../lib/parser';
import { saveTransactions, addImportLog, getImportLogs, type ImportLog } from '../lib/db';
import { formatCurrency, cn } from '../lib/utils';
import { CheckCircle, Save, History, FileText } from 'lucide-react';

import { getMappings, getIgnoredAccounts } from '../lib/db';
import { applyMappings } from '../lib/matcher';

export function Import() {
    const [result, setResult] = useState<ParseResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [filename, setFilename] = useState('');
    const [logs, setLogs] = useState<ImportLog[]>([]);

    useEffect(() => {
        loadLogs();
    }, [saved]);

    const loadLogs = async () => {
        const history = await getImportLogs();
        setLogs(history.reverse()); // Show newest first
    };

    const handleFileSelect = async (file: File) => {
        setLoading(true);
        setSaved(false);
        setFilename(file.name);
        const text = await file.text();

        const ignored = await getIgnoredAccounts();
        const parseResult = await parseBankCSV(text);

        // Apply mappings
        const mappings = await getMappings();
        parseResult.data.forEach(tx => {
            if (!tx.categoryId) {
                const { match, conflicts } = applyMappings(tx, mappings, ignored);
                if (match) {
                    tx.categoryId = match;
                } else if (conflicts) {
                    tx.conflicts = conflicts;
                } else if (tx.type === 'C') {
                    // Fallback: Credit -> Income
                    tx.categoryId = 'IN';
                }
            }
        });

        setResult(parseResult);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!result?.data) return;
        setLoading(true);
        await saveTransactions(result.data);

        // Log import
        await addImportLog({
            id: `log-${Date.now()}`,
            date: new Date().toISOString(),
            filename: filename,
            count: result.data.length
        });

        setLoading(false);
        setSaved(true);
        setResult(null); // Reset result to show uploader again
        // Keep filename for success message
    };

    const clear = () => {
        setResult(null);
        setSaved(false);
        setFilename('');
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto pb-20 animate-in fade-in duration-500">
            <header>
                <h2 className="text-3xl font-bold text-gray-900">Import Data</h2>
                <p className="text-gray-500">Upload your bank CSV export file.</p>
            </header>

            {/* Success Message Banner */}
            {saved && (
                <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="font-bold">Import Successful!</h3>
                        <p className="text-sm">Successfully imported transactions from <span className="font-medium">{filename}</span>.</p>
                    </div>
                    <button onClick={() => setSaved(false)} className="text-sm text-green-700 font-semibold hover:underline">Dismiss</button>
                </div>
            )}

            {!result && !loading && (
                <FileUploader onFileSelect={handleFileSelect} />
            )}

            {loading && (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-500">Processing...</span>
                </div>
            )}

            {result && !loading && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Preview: {filename}</h3>
                            <p className="text-gray-500">{result.data.length} transactions found. {result.errors.length} errors.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={clear} className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium">Cancel</button>
                            <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm shadow-blue-200 transition-all hover:scale-105 active:scale-95">
                                <Save className="w-4 h-4" /> Save Import
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Beneficiary</th>
                                        <th className="px-4 py-3">Purpose</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {result.data.slice(0, 10).map((tx) => (
                                        <tr key={tx.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">{tx.date}</td>
                                            <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[200px]" title={tx.beneficiary}>{tx.beneficiary}</td>
                                            <td className="px-4 py-3 text-gray-500 truncate max-w-[300px]" title={tx.purpose}>{tx.purpose}</td>
                                            <td className={cn("px-4 py-3 text-right font-bold tabular-nums", tx.type === 'D' ? "text-gray-900" : "text-green-600")}>
                                                {tx.type === 'D' ? '-' : '+'}{formatCurrency(tx.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {result.data.length > 10 && (
                            <div className="p-3 bg-gray-50 text-center text-xs text-gray-500 border-t border-gray-100">
                                Showing first 10 of {result.data.length} transactions
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Import History */}
            {!result && !loading && logs.length > 0 && (
                <section className="pt-8 border-t border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-500" />
                        Import History
                    </h3>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">File Name</th>
                                        <th className="px-4 py-3 text-right">Transactions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-gray-600">
                                                {new Date(log.date).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-blue-500" />
                                                {log.filename}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {log.count}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
