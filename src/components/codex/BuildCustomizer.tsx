// src/components/codex/BuildCustomizer.tsx
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, Wrench } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { supabase } from '../../lib/supabase';

export const BuildCustomizer: React.FC = () => {
  const { powers, magicItems, skillsets, fetchInitialData } = useCharacterStore();

  const [activeSubTab, setActiveSubTab] = useState<'powers' | 'items' | 'skillsets'>('powers');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [action, setAction] = useState('A');
  const [usage, setUsage] = useState('');
  const [effect, setEffect] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setAction('A');
    setUsage('');
    setEffect('');
    setSkillsText('');
  };

  const handleEditClick = (item: any) => {
    setEditingId(item.id);
    setName(item.name || '');
    setAction((item.action || 'A').toUpperCase());
    setUsage(item.usage || '');
    setEffect(item.effect || '');
    if (Array.isArray(item.skills)) {
      setSkillsText(item.skills.join(', '));
    }
  };

  const handleDeleteClick = async (id: number, typeName: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete this ${typeName}?`);
    if (!confirmed) return;

    try {
      const tableName = activeSubTab === 'powers' ? 'powers' : activeSubTab === 'items' ? 'magic_items' : 'skillsets';
      await supabase.from(tableName).delete().eq('id', id);
      await fetchInitialData();
    } catch (err) {
      console.error(`Error deleting ${typeName}:`, err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (activeSubTab === 'powers') {
        const payload = { name: name.trim(), action, usage: usage.trim(), effect: effect.trim(), source: 'Custom' };
        if (editingId) {
          await supabase.from('powers').update(payload).eq('id', editingId);
        } else {
          await supabase.from('powers').insert(payload);
        }
      } else if (activeSubTab === 'items') {
        const payload = { name: name.trim(), action, usage: usage.trim(), effect: effect.trim(), source: 'Custom' };
        if (editingId) {
          await supabase.from('magic_items').update(payload).eq('id', editingId);
        } else {
          await supabase.from('magic_items').insert(payload);
        }
      } else if (activeSubTab === 'skillsets') {
        const skillsArray = skillsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const payload = { name: name.trim(), skills: skillsArray, source: 'Custom' };
        if (editingId) {
          await supabase.from('skillsets').update(payload).eq('id', editingId);
        } else {
          await supabase.from('skillsets').insert(payload);
        }
      }

      await fetchInitialData();
      resetForm();
    } catch (err) {
      console.error('Error saving custom item:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="font-outfit font-bold text-base text-slate-100 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-purple-400" />
          Build Customizer & Content Creator
        </h3>
      </div>

      {/* Sub-tab selection */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setActiveSubTab('powers');
            resetForm();
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            activeSubTab === 'powers'
              ? 'bg-purple-600/25 border-purple-500 text-purple-300'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Custom Powers
        </button>
        <button
          onClick={() => {
            setActiveSubTab('items');
            resetForm();
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            activeSubTab === 'items'
              ? 'bg-purple-600/25 border-purple-500 text-purple-300'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Custom Magic Items
        </button>
        <button
          onClick={() => {
            setActiveSubTab('skillsets');
            resetForm();
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            activeSubTab === 'skillsets'
              ? 'bg-purple-600/25 border-purple-500 text-purple-300'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Custom Skillsets
        </button>
      </div>

      {/* Creator Form */}
      <form onSubmit={handleSubmit} className="p-4 bg-slate-950/60 rounded-xl border border-slate-850 flex flex-col gap-3">
        <h4 className="font-outfit font-bold text-xs text-slate-300 uppercase tracking-wider">
          {editingId ? 'Edit Entry' : `Add New ${activeSubTab === 'powers' ? 'Power' : activeSubTab === 'items' ? 'Magic Item' : 'Skillset'}`}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-purple-500"
            required
          />

          {activeSubTab !== 'skillsets' ? (
            <>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-purple-500"
              >
                <option value="AM">AM (Action+Move)</option>
                <option value="A">A (Action)</option>
                <option value="M">M (Move)</option>
                <option value="P">P (Passive)</option>
                <option value="F">F (Free)</option>
              </select>
              <input
                type="text"
                placeholder="Usage (e.g. 2/rest)..."
                value={usage}
                onChange={(e) => setUsage(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-purple-500"
              />
            </>
          ) : (
            <input
              type="text"
              placeholder="Comma-separated skills (e.g. 💪 Athletics, 🏃 Stealth)..."
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              className="sm:col-span-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-purple-500"
            />
          )}
        </div>

        {activeSubTab !== 'skillsets' && (
          <input
            type="text"
            placeholder="Effect description..."
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-purple-500"
          />
        )}

        <div className="flex justify-end gap-2 pt-1">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg"
            >
              Cancel Edit
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {editingId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {editingId ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </form>

      {/* CRUD List Table */}
      <div className="flex flex-col gap-2">
        <h4 className="font-outfit font-bold text-xs text-slate-400 uppercase tracking-wider">
          Existing Entries
        </h4>
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
          {(activeSubTab === 'powers' ? powers : activeSubTab === 'items' ? magicItems : skillsets).map((item) => (
            <div
              key={item.id}
              className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100">{item.name}</span>
                {'action' in item && item.action && (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                    {item.action}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEditClick(item)}
                  className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-900 rounded transition-all"
                  title="Edit Entry"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteClick(item.id, item.name)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                  title="Delete Entry"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
