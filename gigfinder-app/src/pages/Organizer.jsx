import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import eventsAPI from '../services/eventsAPI';
import { getUser } from '../services/apiClient';

const parseList = (value) => {
  if (!value) return [];
  return value
    .split(/[,/|]+/)
    .map(item => item.trim())
    .filter(Boolean);
};

const Organizer = () => {
  const user = getUser();
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';

  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [planSaving, setPlanSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [planForm, setPlanForm] = useState({
    name: '',
    city: '',
    start_date: '',
    end_date: '',
    capacity: '',
    budget_min: '',
    budget_max: '',
    genres: '',
    gear_needs: '',
    vibe_tags: ''
  });

  const [searchFilters, setSearchFilters] = useState({
    city: '',
    genres: '',
    budget_max: '',
    capacity: ''
  });

  const [djResults, setDjResults] = useState([]);
  const [venueResults, setVenueResults] = useState([]);
  const [shortlist, setShortlist] = useState([]);
  const [shortlistLoading, setShortlistLoading] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [contactForm, setContactForm] = useState({
    item_type: 'dj',
    item_id: '',
    template_id: '',
    message: ''
  });
  const [contactStatus, setContactStatus] = useState('');
  const [contactRequests, setContactRequests] = useState([]);

  const selectedPlan = useMemo(
    () => plans.find(plan => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await eventsAPI.getPlans();
      const nextPlans = data.plans || [];
      setPlans(nextPlans);
      if (nextPlans.length && !selectedPlanId) {
        setSelectedPlanId(nextPlans[0].id);
      }
    } catch (error) {
      setErrorMessage('Unable to load plans. Make sure your user role is organizer.');
    } finally {
      setLoading(false);
    }
  };

  const loadShortlist = async (planId) => {
    if (!planId) return;
    setShortlistLoading(true);
    try {
      const data = await eventsAPI.getShortlist(planId);
      setShortlist(data.items || []);
    } catch (error) {
      setShortlist([]);
    } finally {
      setShortlistLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
    eventsAPI.getContactTemplates()
      .then((data) => {
        const list = data.templates || [];
        setTemplates(list);
        if (list.length) {
          setContactForm(prev => ({ ...prev, template_id: prev.template_id || list[0].id }));
        }
      })
      .catch(() => setTemplates([]));
    eventsAPI.getContactRequests()
      .then((data) => setContactRequests(data.requests || []))
      .catch(() => setContactRequests([]));
  }, []);

  useEffect(() => {
    if (selectedPlanId) {
      loadShortlist(selectedPlanId);
    }
  }, [selectedPlanId]);

  const handleCreatePlan = async () => {
    setErrorMessage('');
    if (!planForm.name.trim()) {
      setErrorMessage('Plan name is required.');
      return;
    }
    setPlanSaving(true);
    try {
      const payload = {
        name: planForm.name,
        city: planForm.city || undefined,
        start_date: planForm.start_date || undefined,
        end_date: planForm.end_date || undefined,
        capacity: planForm.capacity ? Number(planForm.capacity) : undefined,
        budget_min: planForm.budget_min ? Number(planForm.budget_min) : undefined,
        budget_max: planForm.budget_max ? Number(planForm.budget_max) : undefined,
        genres: parseList(planForm.genres),
        gear_needs: parseList(planForm.gear_needs),
        vibe_tags: parseList(planForm.vibe_tags)
      };
      const data = await eventsAPI.createPlan(payload);
      const nextPlan = data.plan;
      setPlans(prev => [nextPlan, ...prev]);
      setSelectedPlanId(nextPlan.id);
      setPlanForm({
        name: '',
        city: '',
        start_date: '',
        end_date: '',
        capacity: '',
        budget_min: '',
        budget_max: '',
        genres: '',
        gear_needs: '',
        vibe_tags: ''
      });
    } catch (error) {
      setErrorMessage('Plan creation failed. Confirm organizer role.');
    } finally {
      setPlanSaving(false);
    }
  };

  const runDjSearch = async () => {
    if (!selectedPlanId) return;
    try {
      const payload = {
        city: searchFilters.city || undefined,
        genres: parseList(searchFilters.genres),
        budget_max: searchFilters.budget_max ? Number(searchFilters.budget_max) : undefined
      };
      const data = await eventsAPI.searchPlanDjs(selectedPlanId, payload);
      setDjResults(data.results || []);
    } catch (error) {
      setDjResults([]);
    }
  };

  const runVenueSearch = async () => {
    if (!selectedPlanId) return;
    try {
      const payload = {
        city: searchFilters.city || undefined,
        genres: parseList(searchFilters.genres),
        capacity: searchFilters.capacity ? Number(searchFilters.capacity) : undefined
      };
      const data = await eventsAPI.searchPlanVenues(selectedPlanId, payload);
      setVenueResults(data.results || []);
    } catch (error) {
      setVenueResults([]);
    }
  };

  const addToShortlist = async (item_type, item_id) => {
    if (!selectedPlanId) return;
    try {
      await eventsAPI.addShortlistItem(selectedPlanId, { item_type, item_id });
      await loadShortlist(selectedPlanId);
    } catch (error) {
      setErrorMessage('Unable to add shortlist item.');
    }
  };

  const selectContactTarget = (item_type, item) => {
    setContactStatus('');
    setContactForm(prev => ({
      ...prev,
      item_type,
      item_id: item?.dj_id || item?.id || '',
      message: ''
    }));
  };

  const sendContactRequest = async () => {
    if (!selectedPlanId || !contactForm.item_id) {
      setContactStatus('Select a shortlist item first.');
      return;
    }
    try {
      setContactStatus('Sending…');
      await eventsAPI.createContactRequest({
        plan_id: selectedPlanId,
        item_type: contactForm.item_type,
        item_id: Number(contactForm.item_id),
        template_id: contactForm.template_id || undefined,
        message: contactForm.message || undefined
      });
      setContactStatus('Contact request sent.');
      setContactForm(prev => ({ ...prev, message: '' }));
      const data = await eventsAPI.getContactRequests();
      setContactRequests(data.requests || []);
    } catch (error) {
      setContactStatus('Contact request failed.');
    }
  };

  if (!isOrganizer) {
    return (
      <div className="card max-w-xl mx-auto text-center">
        <h2 className="section-title mb-2">Organizer access required</h2>
        <p className="text-muted">
          Switch your account role to organizer to unlock plans, shortlists, and contact workflows.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-muted">Loading organizer workspace…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid-auto">
        <div className="card space-y-4">
          <div>
            <div className="badge mb-2">Organizer</div>
            <h1 className="section-title">Event planning hub</h1>
            <p className="section-subtitle">Create a plan, then instantly match with DJs and venues.</p>
          </div>

          {errorMessage && <div className="text-red-500 text-sm">{errorMessage}</div>}

          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="input"
              placeholder="Plan name"
              value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
            />
            <input
              className="input"
              placeholder="City"
              value={planForm.city}
              onChange={(e) => setPlanForm({ ...planForm, city: e.target.value })}
            />
            <input
              className="input"
              type="datetime-local"
              value={planForm.start_date}
              onChange={(e) => setPlanForm({ ...planForm, start_date: e.target.value })}
            />
            <input
              className="input"
              type="datetime-local"
              value={planForm.end_date}
              onChange={(e) => setPlanForm({ ...planForm, end_date: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="Capacity target"
              value={planForm.capacity}
              onChange={(e) => setPlanForm({ ...planForm, capacity: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="Budget min"
              value={planForm.budget_min}
              onChange={(e) => setPlanForm({ ...planForm, budget_min: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="Budget max"
              value={planForm.budget_max}
              onChange={(e) => setPlanForm({ ...planForm, budget_max: e.target.value })}
            />
            <input
              className="input"
              placeholder="Genres (comma separated)"
              value={planForm.genres}
              onChange={(e) => setPlanForm({ ...planForm, genres: e.target.value })}
            />
            <input
              className="input"
              placeholder="Gear needs (comma separated)"
              value={planForm.gear_needs}
              onChange={(e) => setPlanForm({ ...planForm, gear_needs: e.target.value })}
            />
            <input
              className="input"
              placeholder="Vibe tags (comma separated)"
              value={planForm.vibe_tags}
              onChange={(e) => setPlanForm({ ...planForm, vibe_tags: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" onClick={handleCreatePlan} disabled={planSaving}>
            {planSaving ? 'Creating…' : 'Create Plan'}
          </button>
        </div>

        <div className="card space-y-3">
          <h2 className="section-title text-base">Existing plans</h2>
          {plans.length === 0 ? (
            <div className="text-muted">No plans yet.</div>
          ) : (
            <div className="grid gap-2">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  className={`card text-left ${plan.id === selectedPlanId ? 'border border-emerald-400' : ''}`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <div className="text-sm font-semibold">{plan.name}</div>
                  <div className="text-xs text-muted">{plan.city || 'No city'} · {plan.start_date || 'TBA'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedPlan && (
        <>
          <section className="card space-y-4">
            <div>
              <div className="badge mb-2">Matching</div>
              <h2 className="section-title text-base">Search by plan</h2>
              <p className="section-subtitle">Tune the filters, then build your shortlist in minutes.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <input
                className="input"
                placeholder="City"
                value={searchFilters.city}
                onChange={(e) => setSearchFilters({ ...searchFilters, city: e.target.value })}
              />
              <input
                className="input"
                placeholder="Genres"
                value={searchFilters.genres}
                onChange={(e) => setSearchFilters({ ...searchFilters, genres: e.target.value })}
              />
              <input
                className="input"
                type="number"
                placeholder="Budget max (DJ)"
                value={searchFilters.budget_max}
                onChange={(e) => setSearchFilters({ ...searchFilters, budget_max: e.target.value })}
              />
              <input
                className="input"
                type="number"
                placeholder="Capacity (Venue)"
                value={searchFilters.capacity}
                onChange={(e) => setSearchFilters({ ...searchFilters, capacity: e.target.value })}
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <button className="btn btn-primary" onClick={runDjSearch}>Search DJs</button>
              <button className="btn btn-outline" onClick={runVenueSearch}>Search Venues</button>
            </div>
          </section>

          <section className="grid-auto">
            <div className="card space-y-3">
              <h3 className="text-base font-semibold">DJ matches</h3>
              {djResults.length === 0 ? (
                <div className="text-muted text-sm">No DJ results yet.</div>
              ) : (
                djResults.map(dj => (
                  <motion.div key={dj.dj_id} className="card flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{dj.dj_name}</div>
                        <div className="text-xs text-muted">{dj.city || '—'} · {dj.genres || '—'}</div>
                      </div>
                      {dj.match && <span className="chip">Score {dj.match.score}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dj.instagram && <span className="chip">{dj.instagram}</span>}
                      {dj.email && <span className="chip">{dj.email}</span>}
                    </div>
                    <button className="btn btn-outline" onClick={() => addToShortlist('dj', dj.dj_id)}>
                      Add to shortlist
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            <div className="card space-y-3">
              <h3 className="text-base font-semibold">Venue matches</h3>
              {venueResults.length === 0 ? (
                <div className="text-muted text-sm">No venue results yet.</div>
              ) : (
                venueResults.map(venue => (
                  <motion.div key={venue.id} className="card flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{venue.name}</div>
                        <div className="text-xs text-muted">{venue.address || '—'}</div>
                      </div>
                      {venue.match && <span className="chip">Score {venue.match.score}</span>}
                    </div>
                    <div className="text-xs text-muted">
                      Capacity {venue.capacity || '—'} · {venue.genreFocus || '—'}
                    </div>
                    <button className="btn btn-outline" onClick={() => addToShortlist('venue', venue.id)}>
                      Add to shortlist
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </section>

          <section className="grid-auto">
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Shortlist</h3>
                <div className="flex gap-2">
                  <a
                    className="btn btn-outline"
                    href={eventsAPI.getShortlistExportUrl(selectedPlanId, 'csv')}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Export CSV
                  </a>
                  <a
                    className="btn btn-outline"
                    href={eventsAPI.getShortlistExportUrl(selectedPlanId, 'json')}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Export JSON
                  </a>
                </div>
              </div>
              {shortlistLoading ? (
                <div className="text-muted text-sm">Loading shortlist…</div>
              ) : shortlist.length === 0 ? (
                <div className="text-muted text-sm">No shortlist items yet.</div>
              ) : (
                shortlist.map(entry => {
                  const item = entry.item || {};
                  const label = entry.item_type === 'dj' ? item.dj_name : item.name;
                  const meta = entry.item_type === 'dj' ? item.city : item.address;
                  return (
                    <div key={`${entry.item_type}-${entry.item_id}`} className="card flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{label || 'Unknown'}</div>
                        <div className="text-xs text-muted">{meta || '—'}</div>
                      </div>
                      <button
                        className="btn btn-ghost"
                        onClick={() => selectContactTarget(entry.item_type, item)}
                      >
                        Contact
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="card space-y-3">
              <h3 className="text-base font-semibold">Contact relay</h3>
              <div className="grid gap-3">
                <select
                  className="input"
                  value={contactForm.template_id}
                  onChange={(e) => setContactForm({ ...contactForm, template_id: e.target.value })}
                >
                  <option value="">Choose template</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>{template.label}</option>
                  ))}
                </select>
                <textarea
                  className="input"
                  rows="5"
                  placeholder="Optional custom message"
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                />
                <button className="btn btn-primary" onClick={sendContactRequest}>Send contact request</button>
                {contactStatus && <p className="text-xs text-muted">{contactStatus}</p>}
              </div>
            </div>

            <div className="card space-y-3">
              <h3 className="text-base font-semibold">Contact history</h3>
              {contactRequests.length === 0 ? (
                <div className="text-muted text-sm">No contact requests yet.</div>
              ) : (
                <div className="grid gap-2">
                  {contactRequests.map(request => (
                    <div key={request.id} className="card flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">
                          {request.item_type?.toUpperCase()} #{request.item_id}
                        </div>
                        <div className="text-xs text-muted">{request.status || 'pending'}</div>
                      </div>
                      <div className="text-xs text-muted">{request.created_at}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Organizer;
