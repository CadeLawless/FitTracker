import React, { useState, useEffect, useRef } from 'react';
import { Plus, Ruler, TrendingUp, TrendingDown, X, Edit2, Trash2, Calendar, AlertTriangle, Save, Settings, Eye, EyeOff, Calculator, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/date';
import { scrollToRef } from '../lib/htmlElement';
import type { BodyMeasurement, BodyMeasurementValue, MeasurementField, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import FormInput from './ui/FormInput';

interface DeleteConfirmation {
  isOpen: boolean;
  entryId: string | null;
  entryDate: string;
}

interface CustomFieldForm {
  field_name: string;
  unit: string;
}

interface BodyFatCalculatorData {
  gender: string;
  age: string;
  chest: string;
  abdominal: string;
  thigh: string;
  tricep: string;
  suprailiac: string;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export default function MeasurementsTracker() {
  const { user, authLoading } = useAuth();
  const [entries, setEntries] = useState<BodyMeasurement[]>([]);
  const [measurementFields, setMeasurementFields] = useState<MeasurementField[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCustomizeFields, setShowCustomizeFields] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BodyMeasurement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({
    isOpen: false,
    entryId: null,
    entryDate: '',
  });
  const [customFieldForm, setCustomFieldForm] = useState<CustomFieldForm>({
    field_name: '',
    unit: '',
  });
   const [bodyFatData, setBodyFatData] = useState<BodyFatCalculatorData>({
    gender: '',
    age: '',
    chest: '',
    abdominal: '',
    thigh: '',
    tricep: '',
    suprailiac: '',
  });
  const [formData, setFormData] = useState<Record<string, string>>({
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if(authLoading) return;
    if(!user) return;

    loadData();
  }, [authLoading, user]);

  useEffect(() => {
      const isRefPresent = !!formRef.current;
    scrollToRef(formRef, showForm && isRefPresent);
  }, [showForm]);

  // Notification system
  const showNotification = (type: Notification['type'], title: string, message: string) => {
    const id = Date.now().toString();
    const notification: Notification = { id, type, title, message };
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const loadData = async () => {
    try {
      if (!user) return;

      // Load user profile and gender for body fat calculation
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      // Load measurement fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('measurement_fields')
        .select('*')
        .eq('user_id', user.id)
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
        .eq('user_id', user.id)
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
      // Set default values for body fat calculator from profile and auth data
      const age = calculateAge(user?.birth_date || '');
      setBodyFatData(prev => ({
        ...prev,
        gender: user?.gender || '',
        age: age > 0 ? age.toString() : '',
      }));
      setMeasurementFields(fieldsData || []);
      setEntries(transformedEntries);
    } catch (error) {
      console.error('Error loading measurement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const calculateBodyFat = () => {
    const { gender, age, chest, abdominal, thigh, tricep, suprailiac } = bodyFatData;
    
    if (!gender || !age) {
      showNotification('error', 'Missing Information', 'Please enter gender and age to calculate body fat percentage.');
      return;
    }

    const ageNum = parseInt(age);
    if (ageNum <= 0) {
      showNotification('error', 'Invalid Age', 'Please enter a valid age.');
      return;
    }

    let bodyFat = 0;

    if (gender === 'male') {
      // Jackson-Pollock 3-site formula for men (chest, abdominal, thigh)
      const chestNum = parseFloat(chest);
      const abdominalNum = parseFloat(abdominal);
      const thighNum = parseFloat(thigh);
      
      if (!chestNum || !abdominalNum || !thighNum) {
        showNotification('error', 'Missing Measurements', 'For males, please enter chest, abdominal, and thigh skinfold measurements.');
        return;
      }
      
      const sum = chestNum + abdominalNum + thighNum;
      const density = 1.10938 - (0.0008267 * sum) + (0.0000016 * sum * sum) - (0.0002574 * ageNum);
      bodyFat = (495 / density) - 450;
    } else if (gender === 'female') {
      // Jackson-Pollock 3-site formula for women (tricep, suprailiac, thigh)
      const tricepNum = parseFloat(tricep);
      const supraNum = parseFloat(suprailiac);
      const thighNum = parseFloat(thigh);
      
      if (!tricepNum || !supraNum || !thighNum) {
        showNotification('error', 'Missing Measurements', 'For females, please enter tricep, suprailiac, and thigh skinfold measurements.');
        return;
      }
      
      const sum = tricepNum + supraNum + thighNum;
      const density = 1.0994921 - (0.0009929 * sum) + (0.0000023 * sum * sum) - (0.0001392 * ageNum);
      bodyFat = (495 / density) - 450;
    } else {
      showNotification('error', 'Invalid Gender', 'Please select a valid gender (male or female) for body fat calculation.');
      return;
    }

    if (bodyFat > 0 && bodyFat < 50) {
      const roundedBodyFat = Math.round(bodyFat * 10) / 10;
      setFormData(prev => ({ ...prev, [getFieldKey("Body Fat %")]: roundedBodyFat.toString() }));
      showNotification('success', 'Calculation Complete', `Body fat percentage calculated: ${roundedBodyFat}%`);
    } else {
      showNotification('error', 'Invalid Result', 'Invalid calculation result. Please check your measurements.');
    }
  };

  const resetBodyFatCalculator = () => {
    // Reset to profile defaults
    const age = user?.birth_date || userProfile?.birth_date 
      ? calculateAge(user?.birth_date || userProfile?.birth_date || '') 
      : 0;
    
    setBodyFatData({
      gender: user?.gender || userProfile?.gender || '',
      age: age > 0 ? age.toString() : '',
      chest: '',
      abdominal: '',
      thigh: '',
      tricep: '',
      suprailiac: '',
    });
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
    resetBodyFatCalculator();
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
    const first = entriesWithField[entriesWithField.length-1][fieldKey];
    return latest - first;
  };

  const activeFields = measurementFields.filter(field => field.is_active);
  const inactiveFields = measurementFields.filter(field => !field.is_active);
  const activeFieldsWithoutBodyFat = activeFields.filter(field => field.field_name !== 'Body Fat %');
  const bodyFatField = activeFields.find(field => field.field_name === 'Body Fat %');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-blue-theme" />;
    }
  };

  const getNotificationColors = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-200/10 border-green-200 dark:border-green-400/40 text-green-800 dark:text-green-200';
      case 'error':
        return 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-400/40 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 text-blue-800';
    }
  };

  return (
    <>
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 w-[90vw] sm:right-4 z-50 space-y-2 sm:w-[400px]">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`w-full border rounded-lg shadow-lg p-4 ${getNotificationColors(notification.type)}`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="ml-3 w-0 flex-1">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="text-sm mt-1">{notification.message}</p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    onClick={() => removeNotification(notification.id)}
                    className="inline-flex text-gray-400 hover:text-gray-600 dark:text-gray-400 focus:outline-none"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Delete Measurement Entry</h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Are you sure you want to delete the measurement entry from{' '}
                  <span className="font-medium">{deleteConfirmation.entryDate}</span>?
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 border border-input-theme rounded-lg text-gray-700 dark:text-gray-200 hover:bg-secondary-theme transition-colors text-sm lg:text-base"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Customize Measurement Fields</h3>
                <button
                  onClick={() => setShowCustomizeFields(false)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-400 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Add Custom Field */}
              <div className="mb-6 p-4 bg-secondary-theme rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Add Custom Field</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormInput
                    type="text"
                    placeholder="Field name (e.g., Forearm)"
                    value={customFieldForm.field_name}
                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, field_name: e.target.value })}
                  />
                  <FormInput
                    type="text"
                    placeholder="Unit (e.g., inches, cm)"
                    value={customFieldForm.unit}
                    onChange={(e) => setCustomFieldForm({ ...customFieldForm, unit: e.target.value })}
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
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Active Fields (shown in add form)</h4>
                <div className="space-y-2">
                  {activeFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-200/10 border border-green-200 dark:border-green-400/40 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{field.field_name}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">({field.unit})</span>
                      </div>
                      <button
                        onClick={() => toggleFieldActive(field)}
                        className="flex items-center px-2 py-1 text-green-theme bg-hover-green-theme rounded transition-colors text-sm"
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
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Hidden Fields</h4>
                  <div className="space-y-2">
                    {inactiveFields.map((field) => (
                      <div key={field.id} className="flex items-center justify-between p-3 bg-secondary-theme border border-gray-200 dark:border-gray-600 rounded-lg">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{field.field_name}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">({field.unit})</span>
                        </div>
                        <button
                          onClick={() => toggleFieldActive(field)}
                          className="flex items-center px-2 py-1 text-gray-700 dark:text-gray-200 bg-hover-light-theme rounded transition-colors text-sm"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Show
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-600 mt-6">
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
      
      <div className="space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">Body Measurements</h1>
            <p className="mt-2 text-sm lg:text-base text-gray-600 dark:text-gray-400">Track your body measurements and progress over time.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCustomizeFields(true)}
              className="flex items-center justify-center px-4 py-2 border border-input-theme text-gray-700 dark:text-gray-200 rounded-lg hover:bg-secondary-theme transition-colors text-sm lg:text-base"
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
                <div key={field.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Ruler className="h-6 w-6 lg:h-8 lg:w-8 text-blue-theme" />
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
                    <p className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">{field.field_name}</p>
                    <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {latest !== null ? `${latest} ${field.unit}` : 'No data'}
                    </p>
                    {change !== null && (
                      <p className="text-xs text-gray-500">
                        All Time: {change > 0 ? '+' : ''}{change.toFixed(1)} {field.unit}
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
          <div ref={formRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">Add Measurement Entry</h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Date
                  </label>
                  <FormInput
                    type="date"
                    id="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>
  
              {/* Measurement Fields */}
              {activeFields.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Measurements</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeFieldsWithoutBodyFat.map((field) => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                          {field.field_name} ({field.unit})
                        </label>
                        <FormInput
                          type="number"
                          step="0.1"
                          value={formData[getFieldKey(field.field_name)] || ''}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            [getFieldKey(field.field_name)]: e.target.value 
                          })}
                          placeholder={`Enter ${field.field_name.toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Body Fat Calculator Section - Mobile Responsive */}
              {bodyFatField && (
                <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <h3 className="text-sm lg:text-base font-medium text-gray-900 dark:text-gray-100 flex items-center">
                      <Calculator className="h-4 w-4 lg:h-5 lg:w-5 mr-2 text-green-600 flex-shrink-0" />
                      Body Fat Calculator
                    </h3>
                    <button
                      type="button"
                      onClick={resetBodyFatCalculator}
                      className="text-sm text-gray-700 dark:text-gray-200 hover:text-label-theme self-start sm:self-auto"
                    >
                      Reset
                    </button>
                  </div>
                  
                  <div className="bg-secondary-theme rounded-lg p-4 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Use skinfold calipers to measure at the specified sites. Measurements should be in millimeters.
                    </p>
                    
                    {/* User Info - Mobile Responsive */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Gender</label>
                        <FormInput
                          inputType='select'
                          value={bodyFatData.gender}
                          onChange={(e) => setBodyFatData(prev => ({ ...prev, gender: e.target.value }))}
                        >
                          <>
                            <option value="">Select gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </>
                        </FormInput>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Age</label>
                        <FormInput
                          type="number"
                          value={bodyFatData.age}
                          onChange={(e) => setBodyFatData(prev => ({ ...prev, age: e.target.value }))}
                          placeholder="Enter your age"
                        />
                      </div>
                    </div>
    
                    {/* Skinfold Measurements - Mobile Responsive */}
                    {bodyFatData.gender === 'male' ? (
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Male Protocol (3-Site)</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Chest (mm)</label>
                            <FormInput
                              type="number"
                              step="0.1"
                              value={bodyFatData.chest}
                              onChange={(e) => setBodyFatData(prev => ({ ...prev, chest: e.target.value }))}
                              placeholder="Chest skinfold"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Abdominal (mm)</label>
                            <FormInput
                              type="number"
                              step="0.1"
                              value={bodyFatData.abdominal}
                              onChange={(e) => setBodyFatData(prev => ({ ...prev, abdominal: e.target.value }))}
                              placeholder="Abdominal skinfold"
                            />
                          </div>
                          <div className="sm:col-span-2 lg:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Thigh (mm)</label>
                            <FormInput
                              type="number"
                              step="0.1"
                              value={bodyFatData.thigh}
                              onChange={(e) => setBodyFatData(prev => ({ ...prev, thigh: e.target.value }))}
                              placeholder="Thigh skinfold"
                            />
                          </div>
                        </div>
                      </div>
                    ) : bodyFatData.gender === 'female' ? (
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Female Protocol (3-Site)</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Tricep (mm)</label>
                            <FormInput
                              type="number"
                              step="0.1"
                              value={bodyFatData.tricep}
                              onChange={(e) => setBodyFatData(prev => ({ ...prev, tricep: e.target.value }))}
                              placeholder="Tricep skinfold"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Suprailiac (mm)</label>
                            <FormInput
                              type="number"
                              step="0.1"
                              value={bodyFatData.suprailiac}
                              onChange={(e) => setBodyFatData(prev => ({ ...prev, suprailiac: e.target.value }))}
                              placeholder="Suprailiac skinfold"
                            />
                          </div>
                          <div className="sm:col-span-2 lg:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Thigh (mm)</label>
                            <FormInput
                              type="number"
                              step="0.1"
                              value={bodyFatData.thigh}
                              onChange={(e) => setBodyFatData(prev => ({ ...prev, thigh: e.target.value }))}
                              placeholder="Thigh skinfold"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500 text-sm lg:text-base">Please select your gender to see the appropriate measurement fields.</p>
                      </div>
                    )}
    
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={calculateBodyFat}
                        className="px-4 lg:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm lg:text-base"
                      >
                        Calculate Body Fat %
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Body Fat Result - Mobile Responsive */}
              <div>
                <label htmlFor="body_fat_percentage" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Body Fat Percentage (%)
                </label>
                <FormInput
                  type="number"
                  id="body_fat_percentage"
                  step="0.1"
                  value={formData[getFieldKey('Body Fat %')] || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    [getFieldKey('Body Fat %')]: e.target.value 
                  }))}
                  placeholder="Enter or calculate body fat %"
                />
                <p className="mt-1 text-xs text-gray-500">
                  You can enter this manually or use the calculator above
                </p>
              </div>
  
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Notes (optional)
                </label>
                <FormInput
                  inputType='textarea'
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any notes about this measurement..."
                />
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-input-theme rounded-lg text-gray-700 dark:text-gray-200 hover:bg-secondary-theme transition-colors text-sm lg:text-base"
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
          <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-600">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">Measurement History</h2>
          </div>
          <div className="p-4 lg:p-6">
            {entries.length > 0 ? (
              <div className="space-y-4">
                {entries.map((entry) => {
                  return (
                    <div key={entry.id}>
                      {editingEntry?.id === entry.id ? (
                        /* Inline Edit Form */
                        <div className="border border-blue-200 rounded-lg p-4 bg-light-blue-theme">
                          <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Edit Measurement Entry</h3>
                              <button
                                type="button"
                                onClick={() => setEditingEntry(null)}
                                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 p-1"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Date</label>
                                <FormInput
                                  type="date"
                                  required
                                  value={formData.date}
                                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                              </div>
                            </div>
  
                            {/* Show all fields that have data or are currently active */}
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Measurements</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {measurementFields
                                  .filter(field => {
                                    return field.is_active || entry.values.some(v => v.field_id === field.id);
                                  })
                                  .map((field) => (
                                    <div key={field.id}>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                        {field.field_name} ({field.unit})
                                        {!field.is_active && (
                                          <span className="text-xs text-gray-500 ml-1">(hidden field)</span>
                                        )}
                                      </label>
                                      <FormInput
                                        type="number"
                                        step="0.1"
                                        value={formData[getFieldKey(field.field_name)] || ''}
                                        onChange={(e) => setFormData({ 
                                          ...formData, 
                                          [getFieldKey(field.field_name)]: e.target.value 
                                        })}
                                      />
                                    </div>
                                  ))}
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Notes (optional)</label>
                              <FormInput
                                inputType='textarea'
                                rows={2}
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                              />
                            </div>
                            
                            <div className="flex flex-col sm:flex-row justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingEntry(null)}
                                className="px-3 py-2 border border-input-theme rounded-lg text-gray-700 dark:text-gray-200 hover:bg-secondary-theme transition-colors text-sm"
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
                        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 lg:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400 mr-2 flex-shrink-0" />
                              <span className="font-medium text-gray-900 dark:text-gray-100 text-sm lg:text-base">
                                {formatDate(entry.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEdit(entry)}
                                className="p-2 text-gray-400 hover:text-blue-600 dark:text-blue-400 transition-colors"
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
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                            {entry.values.length > 0 && (
                              <>
                                {entry.values.map((value) => (                             
                                  <div key={value.id} className="text-center p-3 bg-secondary-theme rounded-lg">
                                    <p className="text-xs text-secondary-label-theme uppercase tracking-wide truncate">
                                      {value.field?.field_name}
                                    </p>
                                    <p className="text-sm lg:text-base font-semibold text-gray-900 dark:text-gray-100">
                                      {value.value} {value.field?.unit}
                                    </p>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                          
                          {entry.notes && (
                            <div className="mt-4 p-3 bg-blue-theme rounded-lg">
                              <p className="text-sm text-blue-theme">{entry.notes}</p>
                            </div>
                          )}
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
                  className="mt-2 text-blue-theme hover:text-blue-700 dark:text-blue-300 text-sm font-medium"
                >
                  Add your first measurement
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}