// Weight tracking component
// This allows users to log and view their weight entries

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Scale, TrendingUp, TrendingDown, X, Edit2, Trash2, Calendar, AlertTriangle, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/date';
import type { WeightEntry } from '../types';

interface DeleteConfirmation {
  isOpen: boolean;
  entryId: string | null;
  entryWeight: number;
  entryDate: string;
}

export default function WeightTracker() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({
    isOpen: false,
    entryId: null,
    entryWeight: 0,
    entryDate: '',
  });
  const [formData, setFormData] = useState({
    weight: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Ref for the form section to enable auto-scrolling
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadWeightEntries();
  }, []);

  // Auto-scroll to form when it becomes visible
  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  }, [showForm]);

  const loadWeightEntries = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const { data, error } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error loading weight entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const entryData = {
        user_id: user.data.user.id,
        weight: parseFloat(formData.weight),
        date: formData.date,
        notes: formData.notes || null,
      };

      let error;
      if (editingEntry) {
        ({ error } = await supabase
          .from('weight_entries')
          .update(entryData)
          .eq('id', editingEntry.id));
      } else {
        ({ error } = await supabase
          .from('weight_entries')
          .insert([entryData]));
      }

      if (error) throw error;

      resetForm();
      loadWeightEntries();
    } catch (error) {
      console.error('Error saving weight entry:', error);
    }
  };

  const handleEdit = (entry: WeightEntry) => {
    setEditingEntry(entry);
    setFormData({
      weight: entry.weight.toString(),
      date: entry.date,
      notes: entry.notes || '',
    });
    // Don't show the main form, we'll edit inline
    setShowForm(false);
  };

  const handleDeleteClick = (entry: WeightEntry) => {
    setDeleteConfirmation({
      isOpen: true,
      entryId: entry.id,
      entryWeight: entry.weight,
      entryDate: new Date(entry.date).toLocaleDateString(),
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.entryId) return;

    try {
      const { error } = await supabase
        .from('weight_entries')
        .delete()
        .eq('id', deleteConfirmation.entryId);

      if (error) throw error;
      loadWeightEntries();
    } catch (error) {
      console.error('Error deleting weight entry:', error);
    } finally {
      setDeleteConfirmation({ isOpen: false, entryId: null, entryWeight: 0, entryDate: '' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation({ isOpen: false, entryId: null, entryWeight: 0, entryDate: '' });
  };

  const resetForm = () => {
    setFormData({
      weight: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowForm(false);
    setEditingEntry(null);
  };

  const handleAddNew = () => {
    setShowForm(true);
    setEditingEntry(null);
    setFormData({
      weight: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const getWeightTrend = () => {
    if (entries.length < 2) return null;
    const latest = entries[0].weight;
    const previous = entries[1].weight;
    return latest - previous;
  };

  const trend = getWeightTrend();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">Delete Weight Entry</h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete the weight entry of{' '}
                  <span className="font-medium">{deleteConfirmation.entryWeight} lbs</span> from{' '}
                  <span className="font-medium">{deleteConfirmation.entryDate}</span>?
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm lg:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm lg:text-base"
                >
                  Delete Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Weight Tracking</h1>
          <p className="mt-2 text-sm lg:text-base text-gray-600">Monitor your weight progress over time.</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm lg:text-base"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </button>
      </div>

      {/* Stats */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center">
              <Scale className="h-6 w-6 lg:h-8 lg:w-8 text-blue-600 flex-shrink-0" />
              <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-gray-600">Current Weight</p>
                <p className="text-lg lg:text-2xl font-bold text-gray-900">{entries[0].weight} lbs</p>
              </div>
            </div>
          </div>

          {trend !== null && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
              <div className="flex items-center">
                {trend > 0 ? (
                  <TrendingUp className="h-6 w-6 lg:h-8 lg:w-8 text-red-600 flex-shrink-0" />
                ) : (
                  <TrendingDown className="h-6 w-6 lg:h-8 lg:w-8 text-green-600 flex-shrink-0" />
                )}
                <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-gray-600">Recent Change</p>
                  <p className={`text-lg lg:text-2xl font-bold ${trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {trend > 0 ? '+' : ''}{trend.toFixed(1)} lbs
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center">
              <Scale className="h-6 w-6 lg:h-8 lg:w-8 text-gray-600 flex-shrink-0" />
              <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                <p className="text-xs lg:text-sm font-medium text-gray-600">Total Entries</p>
                <p className="text-lg lg:text-2xl font-bold text-gray-900">{entries.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Form */}
      {showForm && (
        <div ref={formRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900">Add Weight Entry</h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-gray-700">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  id="weight"
                  step="0.1"
                  required
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                  placeholder="Enter weight"
                />
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                />
              </div>
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                placeholder="Any notes about this entry..."
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm lg:text-base"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm lg:text-base"
              >
                Save Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Weight History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900">Weight History</h2>
        </div>
        <div className="p-4 lg:p-6">
          {entries.length > 0 ? (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div key={entry.id}>
                  {editingEntry?.id === entry.id ? (
                    /* Inline Edit Form */
                    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium text-gray-900">Edit Weight Entry</h3>
                          <button
                            type="button"
                            onClick={() => setEditingEntry(null)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Weight (lbs)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              required
                              value={formData.weight}
                              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Date
                            </label>
                            <input
                              type="date"
                              required
                              value={formData.date}
                              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Notes (optional)
                          </label>
                          <textarea
                            rows={2}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            placeholder="Any notes about this entry..."
                          />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingEntry(null)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save Changes
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    /* Regular Entry Display */
                    <div className="flex items-center justify-between p-3 lg:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900 text-sm lg:text-base">{entry.weight} lbs</p>
                          <div className="flex items-center text-xs lg:text-sm text-gray-500">
                            <Calendar className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />
                            {formatDate(entry.date).toLocaleDateString()}
                          </div>
                        </div>
                        {entry.notes && (
                          <p className="text-xs lg:text-sm text-gray-600 truncate">{entry.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(entry)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 lg:py-12">
              <Scale className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2 text-sm lg:text-base">No weight entries yet</p>
              <button
                onClick={handleAddNew}
                className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Add your first entry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}