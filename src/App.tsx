import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Uncategorized } from './pages/Uncategorized';
import { Import } from './pages/Import';
import { Settings } from './pages/Settings';
import { Documentation } from './pages/Documentation';
import { Categories } from './pages/Categories';
import { ensureSystemCategories } from './lib/db';

export default function App() {
  useEffect(() => {
    ensureSystemCategories();
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/uncategorized" element={<Uncategorized />} />
          <Route path="/import" element={<Import />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/docs" element={<Documentation />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
