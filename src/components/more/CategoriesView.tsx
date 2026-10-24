import React, { useState } from 'react';
import { Tag, Plus, Edit2, Trash2, Check, X, Shield, Search, TrendingUp, Package, Home, DollarSign, Zap, Briefcase, Users, ShoppingBag, Gift, Wrench } from 'lucide-react';
import { Category, TransactionType, ERPState } from '../../types';
import { triggerHaptic } from '../../lib/haptics';

interface CategoriesViewProps {
  categories: Category[];
  onUpdateState: (fn: (prev: ERPState) => ERPState) => void;
}

const PRESET_COLORS = [
  '#22C55E', // Green
  '#00D4AA', // Teal
  '#3B82F6', // Blue
  '#A78BFA', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F5A623', // Amber
  '#FB923C', // Orange
  '#6366F1', // Indigo
  '#64748B'  // Slate
];

const PRESET_ICONS = [
  'TrendingUp', 'Package', 'Home', 'DollarSign', 'Zap', 
  'Briefcase', 'Users', 'ShoppingBag', 'Gift', 'Wrench'
];

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  onUpdateState
}) => {
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [color, setColor] = useState('#00D4AA');
  const [icon, setIcon] = useState('Tag');

  const filteredCategories = categories.filter(c => {
    const matchesType = filterType === 'ALL' || c.type === filterType;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleOpenAdd = () => {
    triggerHaptic('light');
    setName('');
    setType('EXPENSE');
    setColor('#00D4AA');
    setIcon('Tag');
    setShowAddModal(true);
  };

  const handleOpenEdit = (cat: Category) => {
    triggerHaptic('light');
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setColor(cat.color || '#00D4AA');
    setIcon(cat.icon || 'Tag');
  };

  const handleSaveAdd = () => {
    if (!name.trim()) return;
    triggerHaptic('success');

    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      type,
      icon,
      color,
      active: true
    };

    onUpdateState(prev => ({
      ...prev,
      categories: [...prev.categories, newCat],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'CREATE_CATEGORY',
          entity: 'Category',
          entityId: newCat.id,
          diffAfter: { name: newCat.name, type: newCat.type },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));

    setShowAddModal(false);
  };

  const handleSaveEdit = () => {
    if (!editingCategory || !name.trim()) return;
    triggerHaptic('success');

    onUpdateState(prev => ({
      ...prev,
      categories: prev.categories.map(c =>
        c.id === editingCategory.id
          ? { ...c, name: name.trim(), type, icon, color }
          : c
      ),
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'UPDATE_CATEGORY',
          entity: 'Category',
          entityId: editingCategory.id,
          diffAfter: { name, type, color, icon },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));

    setEditingCategory(null);
  };

  const handleToggleActive = (cat: Category) => {
    triggerHaptic('medium');
    onUpdateState(prev => ({
      ...prev,
      categories: prev.categories.map(c =>
        c.id === cat.id ? { ...c, active: !c.active } : c
      )
    }));
  };

  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const confirmDeleteCategory = () => {
    if (!deletingCategory) return;
    triggerHaptic('warning');
    onUpdateState(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== deletingCategory.id),
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorId: prev.currentUser.id,
          actorName: prev.currentUser.name,
          action: 'DELETE_CATEGORY',
          entity: 'Category',
          entityId: deletingCategory.id,
          diffBefore: { name: deletingCategory.name },
          branch: prev.currentUser.branch
        },
        ...prev.auditLogs
      ]
    }));
    setDeletingCategory(null);
  };

  const handleDelete = (cat: Category) => {
    triggerHaptic('light');
    setDeletingCategory(cat);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#00D4AA]" />
            Transaction Categories Setting
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#8899BB]">Configure income & expense categories for transaction tagging</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-3 py-1.5 rounded-xl bg-emerald-600 dark:bg-[#00D4AA] text-white dark:text-[#0A0E1A] font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer hover:brightness-110 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-[#8899BB]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] focus:border-[#00D4AA] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-1 bg-white dark:bg-[#131926] p-1 rounded-xl border border-slate-200 dark:border-[#1E2D40]">
          {(['ALL', 'INCOME', 'EXPENSE'] as const).map(t => (
            <button
              key={t}
              onClick={() => {
                triggerHaptic('light');
                setFilterType(t);
              }}
              className={`py-1 px-3 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                filterType === t
                  ? 'bg-emerald-600 dark:bg-[#00D4AA] text-white dark:text-[#0A0E1A]'
                  : 'text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Grouped Lists */}
      <div className="space-y-6">
        {/* Income Categories Group */}
        {(filterType === 'ALL' || filterType === 'INCOME') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Income Categories
              </h4>
              <span className="text-[10px] font-mono text-slate-500 dark:text-[#8899BB] bg-white dark:bg-[#131926] px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#1E2D40]">
                {filteredCategories.filter(c => c.type === 'INCOME').length} items
              </span>
            </div>

            <div className="space-y-2">
              {filteredCategories.filter(c => c.type === 'INCOME').map(cat => (
                <div
                  key={cat.id}
                  className={`bg-white dark:bg-[#131926] border rounded-2xl p-3.5 flex items-center justify-between transition-all shadow-sm ${
                    cat.active ? 'border-slate-200 dark:border-[#1E2D40] hover:border-[#00D4AA]/40' : 'border-red-500/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner shrink-0"
                      style={{ backgroundColor: `${cat.color || '#00D4AA'}20`, color: cat.color || '#00D4AA' }}
                    >
                      <Tag className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{cat.name}</h4>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold font-mono bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          INCOME
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-[#8899BB] mt-0.5">
                        Status: {cat.active ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">Active</span> : <span className="text-red-500 font-bold">Disabled</span>}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleActive(cat)}
                      title={cat.active ? 'Deactivate' : 'Activate'}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer border ${
                        cat.active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-slate-200 dark:bg-gray-700/50 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-600 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {cat.active ? 'Active' : 'Disabled'}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(cat)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1C2333] hover:bg-emerald-500/20 text-slate-600 dark:text-[#8899BB] hover:text-[#00D4AA] cursor-pointer"
                      title="Edit Category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {filteredCategories.filter(c => c.type === 'INCOME').length === 0 && (
                <div className="text-center py-4 bg-slate-50 dark:bg-[#131926]/50 border border-slate-200 dark:border-[#1E2D40] rounded-xl p-3 text-xs text-slate-500 dark:text-[#8899BB]">
                  No income categories found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expense Categories Group */}
        {(filterType === 'ALL' || filterType === 'EXPENSE') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-rose-600 dark:text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-red-400"></span>
                Expense Categories
              </h4>
              <span className="text-[10px] font-mono text-slate-500 dark:text-[#8899BB] bg-white dark:bg-[#131926] px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#1E2D40]">
                {filteredCategories.filter(c => c.type === 'EXPENSE').length} items
              </span>
            </div>

            <div className="space-y-2">
              {filteredCategories.filter(c => c.type === 'EXPENSE').map(cat => (
                <div
                  key={cat.id}
                  className={`bg-white dark:bg-[#131926] border rounded-2xl p-3.5 flex items-center justify-between transition-all shadow-sm ${
                    cat.active ? 'border-slate-200 dark:border-[#1E2D40] hover:border-[#00D4AA]/40' : 'border-red-500/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner shrink-0"
                      style={{ backgroundColor: `${cat.color || '#00D4AA'}20`, color: cat.color || '#00D4AA' }}
                    >
                      <Tag className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{cat.name}</h4>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold font-mono bg-rose-500/20 text-rose-600 dark:text-red-400 border border-rose-500/30">
                          EXPENSE
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-[#8899BB] mt-0.5">
                        Status: {cat.active ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">Active</span> : <span className="text-red-500 font-bold">Disabled</span>}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleActive(cat)}
                      title={cat.active ? 'Deactivate' : 'Activate'}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer border ${
                        cat.active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-slate-200 dark:bg-gray-700/50 text-slate-600 dark:text-gray-400 border-slate-300 dark:border-gray-600 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {cat.active ? 'Active' : 'Disabled'}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(cat)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#1C2333] hover:bg-emerald-500/20 text-slate-600 dark:text-[#8899BB] hover:text-[#00D4AA] cursor-pointer"
                      title="Edit Category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {filteredCategories.filter(c => c.type === 'EXPENSE').length === 0 && (
                <div className="text-center py-4 bg-slate-50 dark:bg-[#131926]/50 border border-slate-200 dark:border-[#1E2D40] rounded-xl p-3 text-xs text-slate-500 dark:text-[#8899BB]">
                  No expense categories found.
                </div>
              )}
            </div>
          </div>
        )}

        {filteredCategories.length === 0 && (
          <div className="text-center py-8 bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-4 shadow-sm">
            <Tag className="w-8 h-8 text-slate-400 dark:text-[#8899BB] mx-auto mb-2 opacity-40" />
            <p className="text-xs text-slate-500 dark:text-[#8899BB]">No categories found matching your query.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {(showAddModal || editingCategory) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#00D4AA]/40 w-full max-w-sm p-5 rounded-2xl space-y-4 text-slate-900 dark:text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E2D40] pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Tag className="w-4 h-4 text-[#00D4AA]" />
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCategory(null);
                }}
                className="text-slate-400 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-[#8899BB] block mb-1">Category Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Category name"
                  className="w-full bg-slate-50 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] focus:border-[#00D4AA] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-[#8899BB] block mb-1">Category Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('INCOME')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      type === 'INCOME'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500'
                        : 'bg-slate-50 dark:bg-[#1C2333] border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB]'
                    }`}
                  >
                    + INCOME
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('EXPENSE')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      type === 'EXPENSE'
                        ? 'bg-rose-500/20 text-rose-600 dark:text-red-400 border-rose-500'
                        : 'bg-slate-50 dark:bg-[#1C2333] border-slate-200 dark:border-[#1E2D40] text-slate-600 dark:text-[#8899BB]'
                    }`}
                  >
                    - EXPENSE
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-[#8899BB] block mb-1">Color Badge</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                        color === c ? 'border-slate-900 dark:border-white scale-110 shadow-lg' : 'border-transparent opacity-80'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCategory(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!name.trim()}
                onClick={editingCategory ? handleSaveEdit : handleSaveAdd}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 dark:bg-[#00D4AA] hover:brightness-110 text-xs font-bold text-white dark:text-[#0A0E1A] shadow-lg cursor-pointer disabled:opacity-50"
              >
                {editingCategory ? 'Update Category' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#131926] border border-rose-200 dark:border-rose-900/50 max-w-sm w-full p-5 rounded-2xl space-y-4 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Category?</h3>
                <p className="text-xs text-slate-500 dark:text-[#8899BB] font-semibold">{deletingCategory.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#8899BB] leading-relaxed">
              Are you sure you want to delete category <strong className="text-slate-900 dark:text-white">"{deletingCategory.name}"</strong>? Existing ledger transactions under this category will remain, but the category won't be available for new entries.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeletingCategory(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1C2333] border border-slate-200 dark:border-[#1E2D40] text-xs font-bold text-slate-600 dark:text-[#8899BB] hover:bg-slate-200 dark:hover:bg-[#252E42]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCategory}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-md hover:bg-rose-700 active:scale-[0.98] transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
