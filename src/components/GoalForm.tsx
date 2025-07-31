import React from "react";
import { X, Scale, Ruler, Save } from "lucide-react";
import { GoalFormData, MeasurementField, WeightEntry, BodyMeasurement } from "../types";
import FormInput from "./ui/FormInput";
import { formatDate } from "../lib/date";

type GoalFormProps = {
    formRef: React.RefObject<HTMLDivElement>;
    xOnClick: () => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    formData: GoalFormData;
    setFormData: React.Dispatch<React.SetStateAction<GoalFormData>>;
    measurementFields: MeasurementField[];
    latestWeight: WeightEntry | null;
    latestMeasurements: BodyMeasurement | null;
    saving: boolean;
    formTitle?: string;
    editForm?: boolean;
};

export const GoalForm = ({
    formRef,
    xOnClick,
    handleSubmit,
    formData,
    setFormData,
    measurementFields,
    latestWeight,
    latestMeasurements,
    saving,
    formTitle='Create New Goal',
    editForm=false
}: GoalFormProps) => {
    const submitLabel = editForm ?
        (saving ? 'Updating...' : 'Update Goal') :
        (saving ? 'Creating...' : 'Create Goal');

    const cssClasses = editForm ?
        "bg-blue-50 dark:bg-blue-300/10 border-blue-200 dark:border-blue-200/50" :
        "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600";

    return (
        <div ref={formRef} className={`${cssClasses} rounded-lg shadow-sm border p-4 lg:p-6`}>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">{formTitle}</h2>
                <button
                onClick={xOnClick}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 p-1"
                >
                <X className="h-5 w-5" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Goal Category Selection */}
                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                    Goal Category
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                    formData.goal_category === 'weight'
                        ? 'border-blue-500 dark:border-blue-200 bg-blue-200/50 dark:bg-blue-300/20'
                        : 'border-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/70'
                    }`}>
                    <input
                        type="radio"
                        name="goal_category"
                        value="weight"
                        checked={formData.goal_category === 'weight'}
                        onChange={(e) => setFormData(prev => ({ ...prev, goal_category: e.target.value, measurement_field_id: '' }))}
                        className="sr-only"
                    />
                    <div className="flex items-center">
                        <Scale className="h-5 w-5 mr-3 dark:text-gray-100 flex-shrink-0" />
                        <div>
                        <div className="text-sm dark:text-gray-100 font-medium">Weight Goal</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Target weight changes</div>
                        </div>
                    </div>
                    </label>

                    <label className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                    formData.goal_category === 'measurement'
                        ? 'border-blue-500 dark:border-blue-200 bg-blue-200/50 dark:bg-blue-300/20'
                        : 'border-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/70'
                    }`}>
                    <input
                        type="radio"
                        name="goal_category"
                        value="measurement"
                        checked={formData.goal_category === 'measurement'}
                        onChange={(e) => setFormData(prev => ({ ...prev, goal_category: e.target.value, target_weight: '' }))}
                        className="sr-only"
                    />
                    <div className="flex items-center">
                        <Ruler className="h-5 w-5 dark:text-gray-100 mr-3 flex-shrink-0" />
                        <div>
                        <div className="text-sm dark:text-gray-100 font-medium">Measurement Goal</div>
                        <div className="text-sm dark:text-gray-400 text-gray-500">Target body measurements</div>
                        </div>
                    </div>
                    </label>
                </div>
                </div>

                {/* Measurement Field Selection (only for measurement goals) */}
                {formData.goal_category === 'measurement' && (
                <div>
                    <label htmlFor="measurement_field_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Measurement Field
                    </label>
                    <FormInput
                    inputType="select"
                    id="measurement_field_id"
                    required
                    value={formData.measurement_field_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, measurement_field_id: e.target.value }))}
                    >
                    <>
                        <option value="">Select measurement field</option>
                        {measurementFields.map((field) => (
                        <option key={field.id} value={field.id}>
                            {field.field_name} ({field.unit})
                        </option>
                        ))}
                    </>
                    </FormInput>
                </div>
                )}

                {/* Target Value */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                    <label htmlFor={formData.goal_category === 'weight' ? 'target_weight' : 'target_value'} className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Target {formData.goal_category === 'weight' ? 'Weight (lbs)' : 'Value'}
                    {formData.goal_category === 'measurement' && formData.measurement_field_id && (
                        <span className="text-gray-500">
                        {' '}({measurementFields.find(f => f.id === formData.measurement_field_id)?.unit})
                        </span>
                    )}
                    </label>
                    <FormInput
                    type="number"
                    id={formData.goal_category === 'weight' ? 'target_weight' : 'target_value'}
                    step="0.1"
                    required
                    value={formData.goal_category === 'weight' ? formData.target_weight : formData.target_value}
                    onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        [formData.goal_category === 'weight' ? 'target_weight' : 'target_value']: e.target.value 
                    }))}
                    placeholder={`Enter target ${formData.goal_category === 'weight' ? 'weight' : 'value'}`}
                    />
                </div>

                <div>
                    <label htmlFor="target_date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Target Date (optional)
                    </label>
                    <FormInput
                    type="date"
                    id="target_date"
                    value={formData.target_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    />
                </div>
                </div>

                <div>
                <label htmlFor="weekly_goal" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Weekly Goal (optional)
                </label>
                <FormInput
                    type="number"
                    id="weekly_goal"
                    step="0.1"
                    value={formData.weekly_goal}
                    onChange={(e) => setFormData(prev => ({ ...prev, weekly_goal: e.target.value }))}
                    placeholder={`Units per week (${formData.goal_category === 'weight' ? 'lbs' : 'measurement units'})`}
                />
                </div>

                {/* Current Value Info */}
                {(() => {
                let currentValue = null;
                let unit = '';
                let source = '';

                if (formData.goal_category === 'weight' && latestWeight) {
                    currentValue = latestWeight.weight;
                    unit = 'lbs';
                    source = formatDate(latestWeight.date).toLocaleDateString();
                } else if (formData.goal_category === 'measurement' && formData.measurement_field_id && latestMeasurements) {
                    const value = latestMeasurements.values?.find(v => v.field_id === formData.measurement_field_id);
                    if (value) {
                    currentValue = value.value;
                    unit = value.field?.unit || '';
                    source = formatDate(latestMeasurements.date).toLocaleDateString();
                    }
                }

                if (currentValue) {
                    return (
                    <div className="bg-blue-200/50 dark:bg-blue-200/10 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center">
                        {formData.goal_category === 'weight' ? (
                            <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        ) : (
                            <Ruler className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        )}
                        <div>
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Starting from current value: {currentValue} {unit}
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                            Logged on {source}
                            </p>
                        </div>
                        </div>
                    </div>
                    );
                }
                return null;
                })()}

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-600">
                <button
                    type="button"
                    onClick={xOnClick}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
                >
                    <Save className="h-4 w-4 mr-2" />
                    {submitLabel}
                </button>
                </div>
            </form>
        </div>
    );
};