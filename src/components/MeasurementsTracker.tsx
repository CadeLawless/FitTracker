import React, { useState, useEffect, useRef } from 'react';
import { Plus, Ruler, TrendingUp, TrendingDown, X, Edit2, Trash2, Calendar, AlertTriangle, Save, Settings, Check, Eye, EyeOff, Calculator } from 'lucide-react';
import { supabase, bodyFatCalculations } from '../lib/supabase';
import { formatDate } from '../lib/date';
import type { BodyMeasurement, BodyMeasurementEntry, BodyMeasurementValue, MeasurementField, UserProfile } from '../types';

interface DeleteConfirmation {
  isOpen: boolean;
  entryId: string | null;
  entryDate: string;
}

interface CustomFieldForm {
  field_name: string;
  unit: string;
}

export default function MeasurementsTracker() {
  const [entries, setEntries] = useState<BodyMeasurement[]>([]);
  const [measurementFields, setMeasurementFields] = useState<MeasurementField[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userGender, setUserGender] = useState<'male' | 'female' | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCustomizeFields, setShowCustomizeFields] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BodyMeasurement | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({
    isOpen: false,
    entryId: null,
    entryDate: '',
  });
  const [customFieldForm, setCustomFieldForm] = useState<CustomFieldForm>({
    field_name: '',
    unit: '',
  });
  const [formData, setFormData] = useState<Record<string, string>>({
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  }, [showForm]);

  const loadData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Load user profile and gender for body fat calculation
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.data.user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      const gender = user.data.user.user_metadata?.gender as 'male' | 'female';

      // Load measurement fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('measurement_fields')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('field_name');

      if (fieldsError) throw fieldsError;

      // Load measurement entries with values
      const { data: entriesData, error: entriesError } = await supabase
        .from('body_measurement_entries')
        .select(`
          *,
          values:body_measurement_values(
            *,
            field:measurement_fields(*)
          )
        `)
        .eq('user_id', user.data.user.id)
        .order('date', { ascending: false });

      if (entriesError) throw entriesError;

      // Transform entries to include dynamic field access
      const transformedEntries = (entriesData || []).map(entry => {
        const transformed: BodyMeasurement = {
          ...entry,
          values: entry.values || [],
        };

        // Add dynamic field access for backward compatibility
        entry.values?.forEach((value: BodyMeasurementValue) => {
          if (value.field) {
            const fieldKey = getFieldKey(value.field.field_name);
            transformed[fieldKey] = value.value;
          }
        });

        return transformed;
      });

      setUserProfile(profileData);
      setUserGender(gender);
      setMeasurementFields(fieldsData || []);
      setEntries(transformedEntries);
    } catch (error) {
      console.error('Error loading measurement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBodyFat = () => {
    const waist = parseFloat(formData.waist || '0');
    const neck = parseFloat(formData.neck || '0');
    const hips = parseFloat(formData.hips || '0');

    if (!userProfile || !waist || !neck || !userProfile.height_inches || !userGender) return;

    try {
      const bodyFat = bodyFatCalculations.calculateBodyFat(
        userGender,
        waist,
        neck,
        userProfile.height_inches,
        userGender === 'female' ? hips : undefined
      );

      setFormData({ ...formData, body_fat_percentage: bodyFat.toFixed(1) });
    } catch (error) {
      console.error('Error calculating body fat:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      let entryId: string;

      if (editingEntry) {
        // Update existing entry
        const { error: entryError } = await supabase
          .from('body_measurement_entries')
          .update({
            date: formData.date,
            notes: formData.notes || null,
          })
          .eq('id', editingEntry.id);

        if (entryError) throw entryError;
        entryId = editingEntry.id;

        // Delete existing values
        const { error: deleteError } = await supabase
          .from('body_measurement_values')
          .delete()
          .eq('entry_id', entryId);

        if (deleteError) throw deleteError;
      } else {
        // Create new entry
        const { data: entryData, error: entryError } = await supabase
          .from('body_measurement_entries')
          .insert([{
            user_id: user.data.user.id,
            date: formData.date,
            notes: formData.notes || null,
          }])
          .select()
          .single();

        if (entryError) throw entryError;
        entryId = entryData.id;
      }

      // Insert measurement values
      const valuesToInsert: any[] = [];
      measurementFields.forEach(field => {
        const fieldKey = getFieldKey(field.field_name);
        const value = formData[fieldKey];
        if (value && value.trim()) {
          valuesToInsert.push({
            entry_id: entryId,
            field_id: field.id,
            value: parseFloat(value),
          });
        }
      });

      if (valuesToInsert.length > 0) {
        const { error: valuesError } = await supabase
          .from('body_measurement_values')
          .insert(valuesToInsert);

        if (valuesError) throw valuesError;
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving measurement entry:', error);
    }
  };

  const handleEdit = (entry: BodyMeasurement) => {
    setEditingEntry(entry);
    
    // Populate form with existing data
    const newFormData: Record<string, string> = {
      date: entry.date,
      notes: entry.notes || '',
    };

    // Add measurement values
    entry.values.forEach(value => {
      if (value.field) {
        const fieldKey = getFieldKey(value.field.field_name);
        newFormData[fieldKey] = value.value.toString();
      }
    });

    setFormData(newFormData);
    setShowForm(false); // Don't show main form, we'll edit inline
  };

  const handleDeleteClick = (entry: BodyMeasurement) => {
    setDeleteConfirmation({
      isOpen: true,
      entryId: entry.id,
      entryDate: formatDate(entry.date).toLocaleDateString(),
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.entryId) return;

    try {
      const { error } = await supabase
        .from('body_measurement_entries')
        .delete()
        .eq('id', deleteConfirmation.entryId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting measurement entry:', error);
    } finally {
      setDeleteConfirmation({ isOpen: false, entryId: null, entryDate: '' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation({ isOpen: false, entryId: null, entryDate: '' });
  };

  const resetForm = () => {
    setFormData({
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
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const getFieldKey = (fieldName: string): string => {
    return fieldName.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/%/g, '_percentage')
      .replace(/[^a-z0-9_]/g, '');
  };

  const toggleFieldActive = async (field: MeasurementField) => {
    try {
      const { error } = await supabase
        .from('measurement_fields')
        .update({ 
          is_active: !field.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', field.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error toggling field:', error);
    }
  };

  const addCustomField = async () => {
    if (!customFieldForm.field_name.trim() || !customFieldForm.unit.trim()) return;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Try to reactivate existing field first
      const { data: existingField, error: checkError } = await supabase
        .from('measurement_fields')
        .select('*')
        .eq('user_id', user.data.user.id)
        .eq('field_name', customFieldForm.field_name.trim())
        .eq('unit', customFieldForm.unit.trim())
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      if (existingField) {
        // Reactivate existing field
        const { error } = await supabase
          .from('measurement_fields')
          .update({ 
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingField.id);

        if (error) throw error;
      } else {
        // Create new field
        const { error } = await supabase
          .from('measurement_fields')
          .insert([{
            user_id: user.data.user.id,
            field_name: customFieldForm.field_name.trim(),
            unit: customFieldForm.unit.trim(),
            is_active: true,
          }]);

        if (error) throw error;
      }

      setCustomFieldForm({ field_name: '', unit: '' });
      loadData();
    } catch (error) {
      console.error('Error adding custom field:', error);
    }
  };

  const getLatestMeasurement = (fieldName: string) => {
    if (entries.length === 0) return null;
    const fieldKey = getFieldKey(fieldName);
    const latestEntry = entries.find(entry => entry[fieldKey] != null);
    return latestEntry ? latestEntry[fieldKey] : null;
  };

  const getMeasurementChange = (fieldName: string) => {
    if (entries.length < 2) return null;
    const fieldKey = getFieldKey(fieldName);
    
    const entriesWithField = entries.filter(entry => entry[fieldKey] != null);
    if (entriesWithField.length < 2) return null;
    
    const latest = entriesWithField[0][fieldKey];
    const previous = entriesWithField[1][fieldKey];
    return latest - previous;
  };

  const activeFields = measurementFields.filter(field => field.is_active);
  const inactiveFields = measurementFields.filter(field => !field.is_active);

  // Check if we have the required fields for body fat calculation
  const hasBodyFatFields = activeFields.some(f => getFieldKey(f.field_name) === 'waist') && 
                          activeFields.some(f => getFieldKey(f.field_name) === 'neck');

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
                  <h3 className="text-lg font-medium text-gray-900">Delete Measurement Entry</h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete the measurement entry from{' '}
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

      {/* Customize Fields Modal */}
      {showCustomizeFields && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Customize Measurement Fields</h3>
                <button
                  onClick={() => setShowCustomizeFields(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Add Custom Field */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Add Custom Field</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Field name (e.g., Forearm)"
                    value={customFieldForm.field_name}
                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, field_name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Unit (e.g., inches, cm)"
                    value={customFieldForm.unit}
                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, unit: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <button
                    onClick={addCustomField}
                    disabled={!customFieldForm.field_name.trim() || !customFieldForm.unit.trim()}
                    className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </button>
                </div>
              </div>

              {/* Active Fields */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Active Fields (shown in add form)</h4>
                <div className="space-y-2">
                  {activeFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900">{field.field_name}</span>
                        <span className="text-sm text-gray-600 ml-2">({field.unit})</span>
                      </div>
                      <button
                        onClick={() => toggleFieldActive(field)}
                        className="flex items-center px-2 py-1 text-green-700 hover:bg-green-100 rounded transition-colors text-sm"
                      >
                        <EyeOff className="h-4 w-4 mr-1" />
                        Hide
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inactive Fields */}
              {inactiveFields.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Hidden Fields</h4>
                  <div className="space-y-2">
                    {inactiveFields.map((field) => (
                      <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div>
                          <span className="font-medium text-gray-900">{field.field_name}</span>
                          <span className="text-sm text-gray-600 ml-2">({field.unit})</span>
                        </div>
                        <button
                          onClick={() => toggleFieldActive(field)}
                          className="flex items-center px-2 py-1 text-gray-700 hover:bg-gray-100 rounded transition-colors text-sm"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Show
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
                <button
                  onClick={() => setShowCustomizeFields(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm lg:text-base"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Body Measurements</h1>
          <p className="mt-2 text-sm lg:text-base text-gray-600">Track your body measurements and progress over time.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCustomizeFields(true)}
            className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm lg:text-base"
          >
            <Settings className="h-4 w-4 mr-2" />
            Customize Fields
          </button>
          <button
            onClick={handleAddNew}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm lg:text-base"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Stats */}
      {entries.length > 0 && activeFields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {activeFields.slice(0, 4).map((field) => {
            const latest = getLatestMeasurement(field.field_name);
            const change = getMeasurementChange(field.field_name);
            
            return (
              <div key={field.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
                <div className="flex items-center justify-between mb-3">
                  <Ruler className="h-6 w-6 lg:h-8 lg:w-8 text-blue-600" />
                  {change !== null && (
                    change > 0 ? (
                      <TrendingUp className="h-5 w-5 text-red-500" />
                    ) : change < 0 ? (
                      <TrendingDown className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="h-5 w-5" />
                    )
                  )}
                </div>
                <div>
                  <p className="text-xs lg:text-sm font-medium text-gray-600">{field.field_name}</p>
                  <p className="text-lg lg:text-2xl font-bold text-gray-900">
                    {latest !== null ? `${latest} ${field.unit}` : 'No data'}
                  </p>
                  {change !== null && (
                    <p className="text-xs text-gray-500">
                      {change > 0 ? '+' : ''}{change.toFixed(1)} {field.unit}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Entry Form */}
      {showForm && (
        <div ref={formRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900">Add Measurement Entry</h2>
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

            {/* Measurement Fields */}
            {activeFields.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Measurements</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700">
                        {field.field_name} ({field.unit})
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData[getFieldKey(field.field_name)] || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          [getFieldKey(field.field_name)]: e.target.value 
                        })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                        placeholder={`Enter ${field.field_name.toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body Fat Calculator */}
            {hasBodyFatFields && userProfile && userGender && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-blue-900">Body Fat Calculator</h3>
                  <Calculator className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-xs text-blue-700 mb-3">
                  Fill in waist, neck{userGender === 'female' && ', and hips'} measurements to calculate body fat percentage.
                </p>
                <button
                  type="button"
                  onClick={calculateBodyFat}
                  disabled={!formData.waist || !formData.neck || (userGender === 'female' && !formData.hips)}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Body Fat %
                </button>
              </div>
            )}

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
                placeholder="Any notes about this measurement..."
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

      {/* Measurement History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900">Measurement History</h2>
        </div>
        <div className="p-4 lg:p-6">
          {entries.length > 0 ? (
            <div className="space-y-4">
              {entries.map((entry) => {
                return (
                  <div key={entry.id}>
                    {editingEntry?.id === entry.id ? (
                      /* Inline Edit Form */
                      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-900">Edit Measurement Entry</h3>
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
                              <label className="block text-sm font-medium text-gray-700">Date</label>
                              <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>
                          </div>

                          {/* Show all fields that have data or are currently active */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Measurements</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {measurementFields
                                .filter(field => {
                                  return field.is_active || entry.values.some(v => v.field_id === field.id);
                                })
                                .map((field) => (
                                  <div key={field.id}>
                                    <label className="block text-sm font-medium text-gray-700">
                                      {field.field_name} ({field.unit})
                                      {!field.is_active && (
                                        <span className="text-xs text-gray-500 ml-1">(hidden field)</span>
                                      )}
                                    </label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={formData[getFieldKey(field.field_name)] || ''}
                                      onChange={(e) => setFormData({ 
                                        ...formData, 
                                        [getFieldKey(field.field_name)]: e.target.value 
                                      })}
                                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    />
                                  </div>
                                ))}
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
                            <textarea
                              rows={2}
                              value={formData.notes}
                              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                      /* Regular Entry Display - Restored Original Styling */
                      <div className="flex items-center justify-between p-3 lg:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex items-center text-sm lg:text-base font-medium text-gray-900">
                              <Calendar className="h-4 w-4 mr-1" />
                              {formatDate(entry.date).toLocaleDateString()}
                            </div>
                          </div>
                          
                          {entry.values.length > 0 && (
                            <div className="text-xs lg:text-sm text-gray-600 space-y-1">
                              {entry.values.map((value) => (
                                <div key={value.id}>
                                  <span className="font-medium">{value.field?.field_name}:</span> {value.value} {value.field?.unit}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {entry.notes && (
                            <p className="text-xs lg:text-sm text-gray-600 truncate mt-1">{entry.notes}</p>
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
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 lg:py-12">
              <Ruler className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2 text-sm lg:text-base">No measurements recorded yet</p>
              <button
                onClick={handleAddNew}
                className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Add your first measurement
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}