import React, { useState, useEffect, useRef } from 'react';
import { getCategories, addCategory, deleteCategory, type Category, getMappings, addMapping, deleteMapping, type Mapping, getAllTransactions, saveTransactions, getIgnoredAccounts } from '../lib/db';
import { applyMappings } from '../lib/matcher';
import { Trash2, Plus, RefreshCw, Wand2, ChevronRight, ChevronDown, FolderTree, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

export function Categories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [importing, setImporting] = useState(false);

    // Suggestions
    const [suggestions, setSuggestions] = useState<{ name: string, count: number, example: string }[]>([]);

    // UI State
    const [expandedCat, setExpandedCat] = useState<string | null>(null);

    // Forms
    const [catName, setCatName] = useState('');
    const [catColor, setCatColor] = useState('#3b82f6');
    const [mapPattern, setMapPattern] = useState('');
    const [mapCatId, setMapCatId] = useState('');

    const importInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        const cats = await getCategories();
        const maps = await getMappings();

        setCategories(cats);
        setMappings(maps);

        findSuggestions(cats, maps);
    };

    const findSuggestions = async (cats: Category[], maps: Mapping[]) => {
        const txs = await getAllTransactions();
        const uncategorized = txs.filter(t => !t.categoryId);
        const counts = new Map<string, { count: number, example: string }>();

        uncategorized.forEach(t => {
            const key = t.beneficiary || t.purpose;
            if (!key || key.length < 3) return;
            const entry = counts.get(key) || { count: 0, example: key };
            entry.count++;
            counts.set(key, entry);
        });

        // Top 10 frequent uncategorized patterns
        const sorted = Array.from(counts.entries())
            .map(([name, val]) => ({ name, ...val }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        setSuggestions(sorted);
    };

    const handleUpdateName = (id: string, newName: string) => {
        setCategories(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
    };

    const handleSaveCategory = async (category: Category) => {
        await addCategory(category);
    };

    const handleUpdateColor = async (category: Category, newColor: string) => {
        const updated = { ...category, color: newColor };
        await addCategory(updated);
        setCategories(prev => prev.map(c => c.id === category.id ? updated : c));
    };

    const handleReapplyRules = async () => {
        if (!confirm('Warning: This will strictly re-apply checks.\n\n1. Transactions matching a rule will be updated.\n2. Transactions NOT matching any rule will become UNCLASSIFIED.\n\nManual categorizations without a matching rule will be lost. Continue?')) return;

        const txs = await getAllTransactions();
        const maps = await getMappings();
        const ignored = await getIgnoredAccounts();
        let updatedCount = 0;

        txs.forEach(tx => {
            const { match, conflicts } = applyMappings(tx, maps, ignored);

            // Strict update:
            // 1. If match found (single), set categoryId, clear conflicts.
            // 2. If conflicts found (multiple), clear categoryId, set conflicts.
            // 3. If nothing found, clear both.

            let changed = false;

            if (match) {
                if (tx.categoryId !== match || (tx.conflicts && tx.conflicts.length > 0)) {
                    tx.categoryId = match;
                    delete tx.conflicts;
                    changed = true;
                }
            } else if (conflicts) {
                if (tx.categoryId || JSON.stringify(tx.conflicts) !== JSON.stringify(conflicts)) {
                    delete tx.categoryId;
                    tx.conflicts = conflicts;
                    changed = true;
                }
            } else {
                // No match, no conflict
                if (tx.type === 'C') {
                    // Credit fallback -> Income
                    if (tx.categoryId !== 'IN') {
                        tx.categoryId = 'IN';
                        delete tx.conflicts;
                        changed = true;
                    }
                } else {
                    // Debit fallback -> Uncategorized
                    if (tx.categoryId || tx.conflicts) {
                        delete tx.categoryId;
                        delete tx.conflicts;
                        changed = true;
                    }
                }
            }

            if (changed) updatedCount++;
        });

        if (updatedCount > 0) {
            await saveTransactions(txs);
            alert(`Updated ${updatedCount} transactions.`);
        } else {
            alert('No changes made.');
        }
        load();
    };

    const handleExportRules = () => {
        const exported = mappings.map(m => ({
            pattern: m.pattern,
            categoryId: m.categoryId
        }));
        const jsonString = JSON.stringify(exported, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rules_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportRules = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result as string;
                const imported = JSON.parse(content);

                if (!Array.isArray(imported)) {
                    throw new Error('Invalid format: Expected an array.');
                }

                if (!confirm(`Found ${imported.length} rules in file. Merge with existing?`)) return;

                let added = 0;
                const currentPatterns = new Set(mappings.map(m => m.pattern));

                for (const rule of imported) {
                    if (!rule.pattern || !rule.categoryId) continue;

                    if (!currentPatterns.has(rule.pattern)) {
                        await addMapping({
                            id: `map-imp-${Date.now()}-${added}`,
                            pattern: rule.pattern,
                            categoryId: rule.categoryId
                        });
                        added++;
                    }
                }

                alert(`Import complete. Added ${added} new rules.`);
                load();

                // Clear input
                if (importInputRef.current) importInputRef.current.value = '';

            } catch (err) {
                console.error(err);
                alert('Failed to import. Invalid JSON.');
            }
        };
        reader.readAsText(file);
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!catName) return;
        await addCategory({
            id: `cat-${Date.now()}`,
            name: catName,
            color: catColor,
            budget: 0
        });
        setCatName('');
        load();
    };

    const handleDeleteCategory = async (id: string) => {
        if (confirm('Delete this category?')) {
            await deleteCategory(id);
            load();
        }
    };

    const handleAddMapping = async (e: React.FormEvent) => {
        e.preventDefault();
        saveMapping(mapPattern, mapCatId);
    };

    const saveMapping = async (pattern: string, categoryId: string) => {
        if (!pattern || !categoryId) return;
        await addMapping({
            id: `map-${Date.now()}`,
            pattern: pattern,
            categoryId: categoryId
        });
        setMapPattern('');
        setMapCatId('');
        load();
    };

    const handleDeleteMapping = async (id: string) => {
        if (confirm('Delete this mapping?')) {
            await deleteMapping(id);
            load();
        }
    };

    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm('This will import categories and create mappings from your Excel file. Continue?')) return;

        setImporting(true);
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer);

            const newCategories = new Map<string, Category>();
            const patternCounts = new Map<string, Map<string, number>>();

            const ignoreCats = new Set(['IN', 'savings', 'cash', 'in', 'Balance', 'Openning', 'Outgoing', 'Credit', 'Opening', 'Total']);

            workbook.SheetNames.forEach(sheetName => {
                if (sheetName === 'Expences' || sheetName.length < 4) return;

                const sheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
                if (data.length < 2) return;

                const header = data[0];
                const catColIndices = new Map<number, string>();
                header.forEach((h: any, i: number) => {
                    if (typeof h === 'string' && i > 10 && !ignoreCats.has(h) && !h.match(/^\d/)) {
                        catColIndices.set(i, h);
                        if (!newCategories.has(h)) {
                            newCategories.set(h, {
                                id: `cat-${h.toLowerCase().replace(/\s+/g, '-')}`,
                                name: h,
                                color: '#' + Math.floor(Math.random() * 16777215).toString(16),
                                budget: 0
                            });
                        }
                    }
                });

                for (let i = 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row || !row[6]) continue;

                    let matchedCatName: string | null = null;
                    for (const [colIdx, catName] of catColIndices) {
                        if (row[colIdx]) {
                            matchedCatName = catName;
                            break;
                        }
                    }

                    if (matchedCatName) {
                        const bene = row[4];
                        const purpose = row[8];
                        let pattern = '';

                        if (bene) {
                            pattern = bene;
                        } else if (purpose) {
                            const match = purpose.match(/Pirkums - (.+?) - par/);
                            if (match) {
                                pattern = match[1];
                            } else {
                                pattern = purpose;
                            }
                        }

                        if (pattern && pattern.length > 2) {
                            if (!patternCounts.has(pattern)) {
                                patternCounts.set(pattern, new Map());
                            }
                            const catCounts = patternCounts.get(pattern)!;
                            catCounts.set(matchedCatName, (catCounts.get(matchedCatName) || 0) + 1);
                        }
                    }
                }
            });

            const existingCats = await getCategories();
            for (const cat of newCategories.values()) {
                if (!existingCats.find(c => c.name === cat.name)) {
                    await addCategory(cat);
                }
            }

            const existingMappings = await getMappings();
            let addedCount = 0;

            for (const [pattern, catCounts] of patternCounts) {
                let bestCat = '';
                let max = 0;
                for (const [catName, count] of catCounts) {
                    if (count > max) {
                        max = count;
                        bestCat = catName;
                    }
                }

                const catObj = Array.from(newCategories.values()).find(c => c.name === bestCat)
                    || existingCats.find(c => c.name === bestCat);

                if (catObj && !existingMappings.find(m => m.pattern === pattern)) {
                    await addMapping({
                        id: `map-auto-${Date.now()}-${addedCount}`,
                        pattern: pattern,
                        categoryId: catObj.id
                    });
                    addedCount++;
                }
            }

            alert(`Import complete! Added ${newCategories.size} categories and ${addedCount} mappings.`);
            load();

        } catch (e) {
            console.error(e);
            alert('Error parsing Excel file');
        } finally {
            setImporting(false);
        }
    };

    // Group Mappings
    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

    const groupedMappings = sortedCategories.map(cat => ({
        cat,
        maps: mappings
            .filter(m => m.categoryId === cat.id)
            .sort((a, b) => a.pattern.localeCompare(b.pattern))
    })).filter(g => g.maps.length > 0);

    return (
        <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Categories & Rules</h2>
                    <p className="text-gray-500">Manage expense categories and automation rules.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => importInputRef.current?.click()}
                        className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm transition-all active:scale-95"
                    >
                        <Upload className="w-4 h-4" /> Import Rules
                    </button>
                    <input
                        type="file"
                        ref={importInputRef}
                        onChange={handleImportRules}
                        accept=".json"
                        className="hidden"
                    />

                    <button
                        onClick={handleExportRules}
                        className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm transition-all active:scale-95"
                    >
                        <Download className="w-4 h-4" /> Export Rules
                    </button>

                    <button
                        onClick={handleReapplyRules}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
                    >
                        <RefreshCw className="w-4 h-4" /> Re-apply Rules
                    </button>
                </div>
            </header>

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <section className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                        <Wand2 className="w-5 h-5" /> Suggested Rules
                        <span className="text-sm font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Found {suggestions.length} frequent uncategorized items
                        </span>
                    </h3>
                    <div className="overflow-x-auto">
                        <div className="flex gap-4 pb-2">
                            {suggestions.map((s, idx) => (
                                <div key={idx} className="min-w-[280px] bg-white p-4 rounded-lg shadow-sm border border-amber-100 flex flex-col gap-3">
                                    <div>
                                        <p className="font-bold text-gray-900 truncate" title={s.name}>{s.name}</p>
                                        <p className="text-xs text-gray-500">{s.count} transactions</p>
                                    </div>
                                    <select
                                        className="text-sm border-gray-200 rounded-md focus:ring-amber-500 focus:border-amber-500"
                                        onChange={(e) => {
                                            if (e.target.value) saveMapping(s.name, e.target.value);
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Compute rule...</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>→ {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Categories Column */}
                <div className="space-y-6">
                    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Categories</h3>
                        <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                            <input
                                type="text"
                                placeholder="Name"
                                value={catName}
                                onChange={e => setCatName(e.target.value)}
                                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                            <input
                                type="color"
                                value={catColor}
                                onChange={e => setCatColor(e.target.value)}
                                className="h-10 w-14 rounded-lg cursor-pointer border border-gray-200 p-1"
                            />
                            <button type="submit" className="bg-gray-900 text-white px-3 rounded-lg hover:bg-black">
                                <Plus className="w-5 h-5" />
                            </button>
                        </form>

                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                            {sortedCategories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all">
                                    <div className="flex items-center gap-3 flex-1">
                                        <input
                                            type="color"
                                            value={cat.color}
                                            onChange={(e) => handleUpdateColor(cat, e.target.value)}
                                            className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent bubble-color-picker flex-shrink-0"
                                            title="Click to change color"
                                        />
                                        <input
                                            type="text"
                                            value={cat.name}
                                            onChange={(e) => handleUpdateName(cat.id, e.target.value)}
                                            onBlur={() => handleSaveCategory(cat)}
                                            className="font-medium text-gray-700 bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-2 py-1 transition-all w-full focus:bg-white focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-gray-300 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                        <h3 className="font-bold text-blue-900 mb-2">Migrate from Excel</h3>
                        <input
                            type="file"
                            accept=".xlsx"
                            onChange={handleExcelImport}
                            disabled={importing}
                            className="block w-full text-sm text-blue-700
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-white file:text-blue-700
                                hover:file:bg-blue-50 cursor-pointer"
                        />
                        {importing && <p className="text-xs text-blue-600 mt-2 animate-pulse">Processing file...</p>}
                    </section>
                </div>

                {/* Rules Column */}
                <div className="space-y-6">
                    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Categorization Rules</h3>

                        <form onSubmit={handleAddMapping} className="flex gap-2 mb-6">
                            <input
                                value={mapPattern}
                                onChange={e => setMapPattern(e.target.value)}
                                className="flex-1 rounded-lg border-gray-300 shadow-sm text-sm"
                                placeholder="Keyword (e.g. Netflix)"
                            />
                            <select
                                value={mapCatId}
                                onChange={e => setMapCatId(e.target.value)}
                                className="w-1/3 rounded-lg border-gray-300 shadow-sm text-sm"
                            >
                                <option value="">Category</option>
                                {sortedCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <button type="submit" disabled={!mapPattern || !mapCatId} className="bg-gray-900 text-white px-3 rounded-lg hover:bg-black disabled:opacity-50">
                                <Plus className="w-5 h-5" />
                            </button>
                        </form>

                        <div className="space-y-3">
                            {groupedMappings.map(group => (
                                <div key={group.cat.id} className="border border-gray-100 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => setExpandedCat(expandedCat === group.cat.id ? null : group.cat.id)}
                                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.cat.color }}></div>
                                            <span className="font-semibold text-gray-700 text-sm">{group.cat.name}</span>
                                            <span className="text-xs text-gray-400">({group.maps.length})</span>
                                        </div>
                                        {expandedCat === group.cat.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                    </button>

                                    {(expandedCat === group.cat.id) && (
                                        <div className="bg-white divide-y divide-gray-50">
                                            {group.maps.map(m => (
                                                <div key={m.id} className="p-3 pl-8 flex items-center justify-between group hover:bg-gray-50">
                                                    <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{m.pattern}</span>
                                                    <button onClick={() => handleDeleteMapping(m.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
