import React, { useState, useEffect } from 'react';
import { User, Save, Calendar, Ruler, Activity, Mail, Edit2, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userAuth, setUserAuth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    birth_date: '',
    gender: '',
    height_feet: '',
    height_inches: '',
    activity_level: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserAuth(user);

      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      setProfile(profileData);

      // Set form data
      const heightFeet = profileData?.height_inches ? Math.floor(profileData.height_inches / 12) : '';
      const heightInches = profileData?.height_inches ? profileData.height_inches % 12 : '';

      setFormData({
        name: user.user_metadata?.name || '',
        email: user.email || '',
        birth_date: user.user_metadata?.birth_date || '',
        gender: user.user_metadata?.gender || '',
        height_feet: heightFeet.toString(),
        height_inches: heightInches.toString(),
        activity_level: profileData?.activity_level || '',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      setError('Failed to load profile information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Calculate total height in inches
      const totalHeightInches = formData.height_feet && formData.height_inches 
        ? parseInt(formData.height_feet) * 12 + parseInt(formData.height_inches)
        : null;

      // Update auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          name: formData.name,
          birth_date: formData.birth_date || null,
          gender: formData.gender || null,
        }
      });

      if (authError) throw authError;

      // Update or create user profile
      const profileData = {
        user_id: user.id,
        height_inches: totalHeightInches,
        activity_level: formData.activity_level || null,
        updated_at: new Date().toISOString(),
      };

      if (profile) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', profile.id);

        if (updateError) throw updateError;
      } else {
        // Create new profile
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert([profileData]);

        if (insertError) throw insertError;
      }

      setSuccess('Profile updated successfully!');
      setEditing(false);
      await loadProfile(); // Reload to get updated data
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
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

  const formatHeight = (heightInches: number): string => {
    const feet = Math.floor(heightInches / 12);
    const inches = heightInches % 12;
    return `${feet}'${inches}"`;
  };

  const getActivityLevelLabel = (level: string): string => {
    const labels = {
      sedentary: 'Sedentary',
      lightly_active: 'Lightly Active',
      moderately_active: 'Moderately Active',
      very_active: 'Very Active',
      extremely_active: 'Extremely Active',
    };
    return labels[level as keyof typeof labels] || level;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Profile</h1>
          <p className="mt-2 text-sm lg:text-base text-gray-600">Manage your account information and preferences.</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm lg:text-base"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Profile
          </button>
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg flex items-center">
          <Check className="h-5 w-5 mr-2 flex-shrink-0" />
          <span className="text-sm lg:text-base">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm lg:text-base">
          {error}
        </div>
      )}

      {/* Profile Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {editing ? (
          /* Edit Form */
          <form onSubmit={handleSubmit} className="p-4 lg:p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">Edit Profile Information</h2>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError('');
                  setSuccess('');
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-5 w-5 lg:h-6 lg:w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm lg:text-base font-medium text-gray-900">Basic Information</h3>
                
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    disabled
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-50 text-gray-500 cursor-not-allowed text-sm lg:text-base"
                  />
                  <p className="mt-1 text-xs text-gray-500">Email cannot be changed here</p>
                </div>

                <div>
                  <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700">
                    Birth Date
                  </label>
                  <input
                    type="date"
                    id="birth_date"
                    name="birth_date"
                    value={formData.birth_date}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                  />
                </div>

                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                    Gender
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Physical Information */}
              <div className="space-y-4">
                <h3 className="text-sm lg:text-base font-medium text-gray-900">Physical Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Height
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div>
                      <select
                        name="height_feet"
                        value={formData.height_feet}
                        onChange={handleInputChange}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                      >
                        <option value="">Feet</option>
                        {[4, 5, 6, 7].map(ft => (
                          <option key={ft} value={ft}>{ft} ft</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        name="height_inches"
                        value={formData.height_inches}
                        onChange={handleInputChange}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                      >
                        <option value="">Inches</option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i} value={i}>{i} in</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="activity_level" className="block text-sm font-medium text-gray-700">
                    Activity Level
                  </label>
                  <select
                    id="activity_level"
                    name="activity_level"
                    value={formData.activity_level}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                  >
                    <option value="">Select activity level</option>
                    <option value="sedentary">Sedentary (little/no exercise)</option>
                    <option value="lightly_active">Lightly Active (light exercise 1-3 days/week)</option>
                    <option value="moderately_active">Moderately Active (moderate exercise 3-5 days/week)</option>
                    <option value="very_active">Very Active (hard exercise 6-7 days/week)</option>
                    <option value="extremely_active">Extremely Active (very hard exercise, physical job)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError('');
                  setSuccess('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm lg:text-base"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          /* View Mode */
          <div className="p-4 lg:p-6">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">Profile Information</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Basic Information */}
              <div className="space-y-6">
                <h3 className="text-sm lg:text-base font-medium text-gray-900 flex items-center">
                  <User className="h-4 w-4 lg:h-5 lg:w-5 mr-2 text-blue-600" />
                  Basic Information
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Full Name</label>
                    <p className="mt-1 text-sm lg:text-base text-gray-900">
                      {formData.name || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500">Email Address</label>
                    <div className="mt-1 flex items-center">
                      <Mail className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <p className="text-sm lg:text-base text-gray-900 truncate">{formData.email}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500">Birth Date</label>
                    <div className="mt-1 flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <p className="text-sm lg:text-base text-gray-900">
                        {formData.birth_date ? (
                          <>
                            {new Date(formData.birth_date).toLocaleDateString()} 
                            <span className="text-gray-500 ml-2">
                              (Age {calculateAge(formData.birth_date)})
                            </span>
                          </>
                        ) : (
                          'Not provided'
                        )}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500">Gender</label>
                    <p className="mt-1 text-sm lg:text-base text-gray-900 capitalize">
                      {formData.gender || 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Physical Information */}
              <div className="space-y-6">
                <h3 className="text-sm lg:text-base font-medium text-gray-900 flex items-center">
                  <Ruler className="h-4 w-4 lg:h-5 lg:w-5 mr-2 text-green-600" />
                  Physical Information
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Height</label>
                    <p className="mt-1 text-sm lg:text-base text-gray-900">
                      {profile?.height_inches ? (
                        <>
                          {formatHeight(profile.height_inches)}
                          <span className="text-gray-500 ml-2">
                            ({profile.height_inches} inches)
                          </span>
                        </>
                      ) : (
                        'Not provided'
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500">Activity Level</label>
                    <div className="mt-1 flex items-center">
                      <Activity className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <p className="text-sm lg:text-base text-gray-900">
                        {profile?.activity_level ? getActivityLevelLabel(profile.activity_level) : 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="mt-6 lg:mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm lg:text-base font-medium text-gray-900 mb-4">Account Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Member Since</label>
                  <p className="mt-1 text-sm lg:text-base text-gray-900">
                    {userAuth?.created_at ? new Date(userAuth.created_at).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="mt-1 text-sm lg:text-base text-gray-900">
                    {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}