import React, { useEffect, useState } from 'react';
import authAPI from '../services/authAPI';

const toList = (value) => {
  if (!value) return [];
  return value
    .split(/[,/|]+/)
    .map(item => item.trim())
    .filter(Boolean);
};

const Preferences = () => {
  const [form, setForm] = useState({
    preferred_genres: '',
    preferred_artists: '',
    preferred_cities: '',
    preferred_venues: '',
    preferred_djs: '',
    budget_max: '',
    radius_km: '',
    night_preferences: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await authAPI.getPreferences();
        setForm({
          preferred_genres: (data.preferred_genres || []).join(', '),
          preferred_artists: (data.preferred_artists || []).join(', '),
          preferred_cities: (data.preferred_cities || []).join(', '),
          preferred_venues: (data.preferred_venues || []).join(', '),
          preferred_djs: (data.preferred_djs || []).join(', '),
          budget_max: data.budget_max ?? '',
          radius_km: data.radius_km ?? '',
          night_preferences: data.night_preferences || []
        });
      } catch (error) {
        setStatus('Unable to load preferences.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleNightPreference = (value) => {
    setForm(prev => {
      const existing = new Set(prev.night_preferences || []);
      if (existing.has(value)) {
        existing.delete(value);
      } else {
        existing.add(value);
      }
      return { ...prev, night_preferences: Array.from(existing) };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const payload = {
        preferred_genres: toList(form.preferred_genres),
        preferred_artists: toList(form.preferred_artists),
        preferred_cities: toList(form.preferred_cities),
        preferred_venues: toList(form.preferred_venues),
        preferred_djs: toList(form.preferred_djs),
        budget_max: form.budget_max === '' ? null : Number(form.budget_max),
        radius_km: form.radius_km === '' ? null : Number(form.radius_km),
        night_preferences: form.night_preferences
      };
      await authAPI.savePreferences(payload);
      setStatus('Preferences saved.');
    } catch (error) {
      setStatus('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-muted">Loading preferences…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="card space-y-3">
        <div>
          <div className="badge mb-2">Personalization</div>
          <h1 className="section-title">Preference tuning</h1>
          <p className="section-subtitle">Boost the feed with explicit signals. Comma-separate lists.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="input"
            placeholder="Genres (techno, house...)"
            value={form.preferred_genres}
            onChange={(e) => setForm({ ...form, preferred_genres: e.target.value })}
          />
          <input
            className="input"
            placeholder="Artists"
            value={form.preferred_artists}
            onChange={(e) => setForm({ ...form, preferred_artists: e.target.value })}
          />
          <input
            className="input"
            placeholder="Cities"
            value={form.preferred_cities}
            onChange={(e) => setForm({ ...form, preferred_cities: e.target.value })}
          />
          <input
            className="input"
            placeholder="Venues"
            value={form.preferred_venues}
            onChange={(e) => setForm({ ...form, preferred_venues: e.target.value })}
          />
          <input
            className="input"
            placeholder="DJs"
            value={form.preferred_djs}
            onChange={(e) => setForm({ ...form, preferred_djs: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Max budget (EUR)"
            value={form.budget_max}
            onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Radius (km)"
            value={form.radius_km}
            onChange={(e) => setForm({ ...form, radius_km: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className={`chip ${form.night_preferences.includes('weekday') ? 'chip-active' : ''}`}
            onClick={() => toggleNightPreference('weekday')}
          >
            Weekday
          </button>
          <button
            className={`chip ${form.night_preferences.includes('weekend') ? 'chip-active' : ''}`}
            onClick={() => toggleNightPreference('weekend')}
          >
            Weekend
          </button>
        </div>
        {status && <div className="text-sm text-muted">{status}</div>}
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </div>
  );
};

export default Preferences;
