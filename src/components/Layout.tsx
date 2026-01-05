import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, Upload, Settings, AlertCircle, BookOpen, FolderTree } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
    const location = useLocation();

    const navItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Transactions', icon: Receipt, path: '/transactions' },
        { label: 'Uncategorized', icon: AlertCircle, path: '/uncategorized' },
        { label: 'Categories', icon: FolderTree, path: '/categories' },
        { label: 'Import', icon: Upload, path: '/import' },
        { label: 'Settings', icon: Settings, path: '/settings' },
        { label: 'Documentation', icon: BookOpen, path: '/docs' },
    ];

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed h-full z-10 hidden md:flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        ExpenseTracker
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-blue-50 text-blue-700 font-medium shadow-sm'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 text-white">
                        <p className="text-xs text-gray-400 font-medium mb-1">Current User</p>
                        <p className="font-bold">Ivan Kuznecovs</p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-8">
                {children}
            </main>
        </div>
    );
}
