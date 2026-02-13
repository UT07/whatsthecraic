// src/pages/Organizer.jsx
import React, { useEffect, useMemo, useState } from 'react';
import eventsAPI from '../services/eventsAPI';
import { getUser } from '../services/apiClient';

/* ── helpers ─────────────────────────────────────────────────────── */
const parseList = (value) => {
  if (!value) return [];
  return value.split(/[,/|]+/).map(item => item.trim()).filter(Boolean);
};

const MATCH_COLORS = {
  high: '#00d67d',
  medium: '#f5a623',
  low: '#ff5c5c'
};
const matchColor = (score) => {
  if (!score && score !== 0) return MATCH_COLORS.medium;
  if (score >= 70) return MATCH_COLORS.high;
  if (score >= 40) return MATCH_COLORS.medium;
  return MATCH_COLORS.low;
};

/* ── Skeleton ────────────────────────────────────────────────────── */
const CardSkeleton = ({ height = 80 }) => (
  <div className="skeleton" style={{ height, borderRadius: 12 }} />
);

/* ── Small section header ────────────────────────────────────────── */
const SectionHead = ({ badge, title, subtitle }) => (
  <div style={{ marginBottom: '1rem' }}>
    {badge && <div className="badge" style={{ marginBottom: 6 }}>{badge}</div>}
    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{title}</h2>
    {subtitle && <p style={{ fontSize: '0.82rem', color: 'var(--ink-3)' }}>{subtitle}</p>}
  </div>
);

/* ── Result card (DJ or Venue) ───────────────────────────────────── */
const MatchCard = ({ type, item, onAdd }) => {
  const isDj = type === 'dj';
  const name = isDj ? item.dj_name : item.name;
  const meta = isDj ? (item.city || '—') : (item.address || '—');
  const extra = isDj ? (item.genres || '—') : `${item.capacity || '?'} cap · ${item.genreFocus || '—'}`;
  const score = item.match?.score;
  const initial = (name || '?')[0].toUpperCase();

  return (
    <div style={{
      display: 'flex', gap: '0.75rem', padding: '0.75rem',
      background: 'rgba(255,255,255,0.03)', borderRadius: 12,
      border: '1px solid var(--line)', transition: 'background 0.2s'
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
    >
      {/* Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: 10, flexShrink: 0,
        background: isDj
          ? 'linear-gradient(135deg, rgba(0,214,125,0.15), rgba(0,214,125,0.05))'
          : 'linear-gradient(135deg, rgba(100,100,255,0.15), rgba(100,100,255,0.05))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1rem', fontWeight: 700, color: isDj ? 'var(--emerald)' : '#8b8bff'
      }}>
        {initial}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)' }}>{name}</span>
          {score != null && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem',
              borderRadius: 6, background: `${matchColor(score)}18`, color: matchColor(score)
            }}>
              {score}%
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginBottom: 2 }}>{meta}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>{extra}</div>
        {isDj && (item.instagram || item.email) && (
          <div style={{ display: 'flex', gap: '0.35rem', marginTop: 4, flexWrap: 'wrap' }}>
            {item.instagram && <span className="chip" style={{ fontSize: '0.62rem' }}>IG: {item.instagram}</span>}
            {item.email && <span className="chip" style={{ fontSize: '0.62rem' }}>{item.email}</span>}
          </div>
        )}
      </div>

      {/* Add button */}
      <button onClick={() => onAdd(type, isDj ? item.dj_id : item.id)}
        style={{
          alignSelf: 'center', flexShrink: 0,
          padding: '0.35rem 0.65rem', borderRadius: 8,
          background: 'var(--emerald)', color: '#000',
          border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600
        }}>
        + Shortlist
      </button>
    </div>
  );
};

/* ── Shortlist item ──────────────────────────────────────────────── */
const ShortlistItem = ({ entry, onContact }) => {
  const item = entry.item || {};
  const isDj = entry.item_type === 'dj';
  const label = isDj ? item.dj_name : item.name;
  const meta = isDj ? item.city : item.address;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem',
      background: 'rgba(255,255,255,0.03)', borderRadius: 10,
      border: '1px solid var(--line)'
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: isDj ? 'rgba(0,214,125,0.1)' : 'rgba(100,100,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 700, color: isDj ? 'var(--emerald)' : '#8b8bff'
      }}>
        {isDj ? '🎧' : '📍'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}>
          {label || 'Unknown'}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)' }}>{meta || '—'}</div>
      </div>
      <span className="chip" style={{ fontSize: '0.62rem', textTransform: 'uppercase' }}>
        {entry.item_type}
      </span>
      <button onClick={() => onContact(entry.item_type, item)}
        style={{
          padding: '0.3rem 0.55rem', borderRadius: 8,
          background: 'none', border: '1px solid var(--line)',
          color: 'var(--emerald)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600
        }}>
        Contact
      </button>
    </div>
  );
};

/* ── Contact history row ─────────────────────────────────────────── */
const ContactRow = ({ request }) => {
  const statusColor = request.status === 'sent' ? 'var(--emerald)' :
    request.status === 'failed' ? '#ff5c5c' : 'var(--ink-3)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem',
      background: 'rgba(255,255,255,0.02)', borderRadius: 8,
      border: '1px solid var(--line)'
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: statusColor
      }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)' }}>
          {request.item_type?.toUpperCase()} #{request.item_id}
        </span>
      </div>
      <span style={{ fontSize: '0.68rem', color: 'var(--ink-3)' }}>{request.status || 'pending'}</span>
      <span style={{ fontSize: '0.65rem', color: 'var(--ink-3)' }}>
        {request.created_at ? new Date(request.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : ''}
      </span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
const Organizer = () => {
  const user = getUser();
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';

  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [planSaving, setPlanSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showNewPlan, setShowNewPlan] = useState(false);

  const [planForm, setPlanForm] = useState({
    name: '', city: '', start_date: '', end_date: '',
    capacity: '', budget_min: '', budget_max: '',
    genres: '', gear_needs: '', vibe_tags: ''
  });

  const [searchFilters, setSearchFilters] = useState({
    city: '', genres: '', budget_max: '', capacity: ''
  });

  const [djResults, setDjResults] = useState([]);
  const [venueResults, setVenueResults] = useState([]);
  const [shortlist, setShortlist] = useState([]);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('djs');

  const [templates, setTemplates] = useState([]);
  const [contactForm, setContactForm] = useState({
    item_type: 'dj', item_id: '', template_id: '', message: ''
  });
  const [contactStatus, setContactStatus] = useState('');
  const [contactRequests, setContactRequests] = useState([]);

  const selectedPlan = useMemo(
    () => plans.find(plan => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  /* ── data fetching ─────────────────────────────────────────────── */
  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await eventsAPI.getPlans();
      const nextPlans = data.plans || [];
      setPlans(nextPlans);
      if (nextPlans.length && !selectedPlanId) {
        setSelectedPlanId(nextPlans[0].id);
      }
    } catch {
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
    } catch { setShortlist([]); }
    finally { setShortlistLoading(false); }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadPlans();
    eventsAPI.getContactTemplates()
      .then(data => {
        const list = data.templates || [];
        setTemplates(list);
        if (list.length) setContactForm(prev => ({ ...prev, template_id: prev.template_id || list[0].id }));
      })
      .catch(() => setTemplates([]));
    eventsAPI.getContactRequests()
      .then(data => setContactRequests(data.requests || []))
      .catch(() => setContactRequests([]));
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedPlanId) loadShortlist(selectedPlanId); }, [selectedPlanId]);

  /* ── actions ───────────────────────────────────────────────────── */
  const handleCreatePlan = async () => {
    setErrorMessage('');
    if (!planForm.name.trim()) { setErrorMessage('Plan name is required.'); return; }
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
      setPlans(prev => [data.plan, ...prev]);
      setSelectedPlanId(data.plan.id);
      setPlanForm({ name: '', city: '', start_date: '', end_date: '', capacity: '', budget_min: '', budget_max: '', genres: '', gear_needs: '', vibe_tags: '' });
      setShowNewPlan(false);
    } catch { setErrorMessage('Plan creation failed. Confirm organizer role.'); }
    finally { setPlanSaving(false); }
  };

  const runDjSearch = async () => {
    if (!selectedPlanId) return;
    try {
      const data = await eventsAPI.searchPlanDjs(selectedPlanId, {
        city: searchFilters.city || undefined,
        genres: parseList(searchFilters.genres),
        budget_max: searchFilters.budget_max ? Number(searchFilters.budget_max) : undefined
      });
      setDjResults(data.results || []);
      setActiveTab('djs');
    } catch { setDjResults([]); }
  };

  const runVenueSearch = async () => {
    if (!selectedPlanId) return;
    try {
      const data = await eventsAPI.searchPlanVenues(selectedPlanId, {
        city: searchFilters.city || undefined,
        genres: parseList(searchFilters.genres),
        capacity: searchFilters.capacity ? Number(searchFilters.capacity) : undefined
      });
      setVenueResults(data.results || []);
      setActiveTab('venues');
    } catch { setVenueResults([]); }
  };

  const addToShortlist = async (item_type, item_id) => {
    if (!selectedPlanId) return;
    try {
      await eventsAPI.addShortlistItem(selectedPlanId, { item_type, item_id });
      await loadShortlist(selectedPlanId);
    } catch { setErrorMessage('Unable to add shortlist item.'); }
  };

  const selectContactTarget = (item_type, item) => {
    setContactStatus('');
    setContactForm(prev => ({ ...prev, item_type, item_id: item?.dj_id || item?.id || '', message: '' }));
  };

  const sendContactRequest = async () => {
    if (!selectedPlanId || !contactForm.item_id) { setContactStatus('Select a shortlist item first.'); return; }
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
    } catch { setContactStatus('Contact request failed.'); }
  };

  /* ── guards ────────────────────────────────────────────────────── */
  if (!isOrganizer) {
    return (
      <div style={{
        maxWidth: 480, margin: '4rem auto', textAlign: 'center',
        padding: '2.5rem', background: 'var(--card)', borderRadius: 20,
        border: '1px solid var(--line)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
          Organizer access required
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-3)' }}>
          Switch your account role to organizer to unlock plans, shortlists, and contact workflows.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 600, margin: '2rem auto' }}>
        {[...Array(3)].map((_, i) => <CardSkeleton key={i} height={100} />)}
      </div>
    );
  }

  /* ── render ────────────────────────────────────────────────────── */
  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div className="badge" style={{ marginBottom: 6 }}>Organizer</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
            Event Planning Hub
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-3)' }}>
            Create plans, match with artists and venues, build your lineup
          </p>
        </div>
        <button
          onClick={() => setShowNewPlan(!showNewPlan)}
          style={{
            padding: '0.55rem 1.1rem', borderRadius: 10,
            background: showNewPlan ? 'rgba(255,255,255,0.06)' : 'var(--emerald)',
            color: showNewPlan ? 'var(--ink)' : '#000',
            border: showNewPlan ? '1px solid var(--line)' : 'none',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
          }}>
          {showNewPlan ? 'Cancel' : '+ New Plan'}
        </button>
      </div>

      {errorMessage && (
        <div style={{
          padding: '0.6rem 1rem', marginBottom: '1rem', borderRadius: 10,
          background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.2)',
          color: '#ff5c5c', fontSize: '0.82rem'
        }}>
          {errorMessage}
        </div>
      )}

      {/* ── New Plan Form (collapsible) ──────────────────────────────── */}
      {showNewPlan && (
        <div style={{
          padding: '1.25rem', marginBottom: '1.5rem',
          background: 'var(--card)', borderRadius: 16, border: '1px solid var(--line)'
        }}>
          <SectionHead title="Create a new plan" subtitle="Define your event parameters to start matching" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <input className="input" placeholder="Plan name *" value={planForm.name}
              onChange={e => setPlanForm({ ...planForm, name: e.target.value })} />
            <input className="input" placeholder="City" value={planForm.city}
              onChange={e => setPlanForm({ ...planForm, city: e.target.value })} />
            <input className="input" type="datetime-local" placeholder="Start date" value={planForm.start_date}
              onChange={e => setPlanForm({ ...planForm, start_date: e.target.value })} />
            <input className="input" type="datetime-local" placeholder="End date" value={planForm.end_date}
              onChange={e => setPlanForm({ ...planForm, end_date: e.target.value })} />
            <input className="input" type="number" placeholder="Capacity" value={planForm.capacity}
              onChange={e => setPlanForm({ ...planForm, capacity: e.target.value })} />
            <input className="input" type="number" placeholder="Budget min" value={planForm.budget_min}
              onChange={e => setPlanForm({ ...planForm, budget_min: e.target.value })} />
            <input className="input" type="number" placeholder="Budget max" value={planForm.budget_max}
              onChange={e => setPlanForm({ ...planForm, budget_max: e.target.value })} />
            <input className="input" placeholder="Genres (comma sep)" value={planForm.genres}
              onChange={e => setPlanForm({ ...planForm, genres: e.target.value })} />
            <input className="input" placeholder="Gear needs (comma sep)" value={planForm.gear_needs}
              onChange={e => setPlanForm({ ...planForm, gear_needs: e.target.value })} />
            <input className="input" placeholder="Vibe tags (comma sep)" value={planForm.vibe_tags}
              onChange={e => setPlanForm({ ...planForm, vibe_tags: e.target.value })} />
          </div>
          <button
            onClick={handleCreatePlan} disabled={planSaving}
            style={{
              padding: '0.5rem 1.2rem', borderRadius: 10,
              background: 'var(--emerald)', color: '#000', border: 'none',
              cursor: planSaving ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: 600,
              opacity: planSaving ? 0.6 : 1
            }}>
            {planSaving ? 'Creating…' : 'Create Plan'}
          </button>
        </div>
      )}

      {/* ── Plans strip (horizontal scroll) ──────────────────────────── */}
      {plans.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Your plans
          </p>
          <div className="scroll-row" style={{ gap: '0.5rem' }}>
            {plans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                style={{
                  flexShrink: 0, padding: '0.55rem 1rem', borderRadius: 10,
                  background: plan.id === selectedPlanId ? 'var(--emerald)' : 'var(--card)',
                  color: plan.id === selectedPlanId ? '#000' : 'var(--ink)',
                  border: plan.id === selectedPlanId ? 'none' : '1px solid var(--line)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{plan.name}</div>
                <div style={{
                  fontSize: '0.68rem',
                  color: plan.id === selectedPlanId ? 'rgba(0,0,0,0.6)' : 'var(--ink-3)'
                }}>
                  {plan.city || 'No city'} · {plan.start_date ? new Date(plan.start_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : 'TBA'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {plans.length === 0 && !showNewPlan && (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          background: 'var(--card)', borderRadius: 16, border: '1px solid var(--line)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
          <h3 style={{ color: 'var(--ink)', marginBottom: 4 }}>No plans yet</h3>
          <p style={{ color: 'var(--ink-3)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Create your first event plan to start matching with artists and venues
          </p>
          <button onClick={() => setShowNewPlan(true)} style={{
            padding: '0.5rem 1.2rem', borderRadius: 10,
            background: 'var(--emerald)', color: '#000', border: 'none',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600
          }}>
            + Create Plan
          </button>
        </div>
      )}

      {/* ── Active Plan Workspace ────────────────────────────────────── */}
      {selectedPlan && (
        <>
          {/* Search filters */}
          <div style={{
            padding: '1rem', marginBottom: '1rem',
            background: 'var(--card)', borderRadius: 14, border: '1px solid var(--line)'
          }}>
            <SectionHead badge="Matching" title={`Search for "${selectedPlan.name}"`}
              subtitle="Find DJs and venues that fit your plan" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input className="input" placeholder="City" value={searchFilters.city}
                onChange={e => setSearchFilters({ ...searchFilters, city: e.target.value })} />
              <input className="input" placeholder="Genres" value={searchFilters.genres}
                onChange={e => setSearchFilters({ ...searchFilters, genres: e.target.value })} />
              <input className="input" type="number" placeholder="Budget max (DJ)" value={searchFilters.budget_max}
                onChange={e => setSearchFilters({ ...searchFilters, budget_max: e.target.value })} />
              <input className="input" type="number" placeholder="Capacity (Venue)" value={searchFilters.capacity}
                onChange={e => setSearchFilters({ ...searchFilters, capacity: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={runDjSearch} style={{
                padding: '0.45rem 1rem', borderRadius: 10,
                background: 'var(--emerald)', color: '#000', border: 'none',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600
              }}>
                Search Artists
              </button>
              <button onClick={runVenueSearch} style={{
                padding: '0.45rem 1rem', borderRadius: 10,
                background: 'none', color: 'var(--ink)', border: '1px solid var(--line)',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500
              }}>
                Search Venues
              </button>
            </div>
          </div>

          {/* Results + Shortlist layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Left: Results */}
            <div style={{
              padding: '1rem', background: 'var(--card)', borderRadius: 14,
              border: '1px solid var(--line)', minHeight: 200
            }}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem' }}>
                {[
                  { key: 'djs', label: 'Artists', count: djResults.length },
                  { key: 'venues', label: 'Venues', count: venueResults.length }
                ].map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '0.4rem 0.85rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: activeTab === tab.key ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: activeTab === tab.key ? 'var(--ink)' : 'var(--ink-3)',
                      fontSize: '0.8rem', fontWeight: activeTab === tab.key ? 600 : 400
                    }}>
                    {tab.label}
                    {tab.count > 0 && (
                      <span style={{ marginLeft: 4, fontSize: '0.68rem', opacity: 0.6 }}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* DJ results */}
              {activeTab === 'djs' && (
                djResults.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--ink-3)', fontSize: '0.82rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>🎧</div>
                    Search for artists to see matches
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {djResults.map(dj => (
                      <MatchCard key={dj.dj_id} type="dj" item={dj} onAdd={addToShortlist} />
                    ))}
                  </div>
                )
              )}

              {/* Venue results */}
              {activeTab === 'venues' && (
                venueResults.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--ink-3)', fontSize: '0.82rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>📍</div>
                    Search for venues to see matches
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {venueResults.map(venue => (
                      <MatchCard key={venue.id} type="venue" item={venue} onAdd={addToShortlist} />
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Right: Shortlist */}
            <div style={{
              padding: '1rem', background: 'var(--card)', borderRadius: 14,
              border: '1px solid var(--line)', minHeight: 200
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--ink)' }}>
                  Shortlist
                  {shortlist.length > 0 && (
                    <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--ink-3)', fontWeight: 400 }}>
                      {shortlist.length} item{shortlist.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </h3>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <a href={eventsAPI.getShortlistExportUrl(selectedPlanId, 'csv')}
                    target="_blank" rel="noreferrer"
                    style={{
                      padding: '0.25rem 0.5rem', borderRadius: 6, fontSize: '0.68rem',
                      color: 'var(--ink-3)', border: '1px solid var(--line)',
                      textDecoration: 'none', fontWeight: 500
                    }}>
                    CSV
                  </a>
                  <a href={eventsAPI.getShortlistExportUrl(selectedPlanId, 'json')}
                    target="_blank" rel="noreferrer"
                    style={{
                      padding: '0.25rem 0.5rem', borderRadius: 6, fontSize: '0.68rem',
                      color: 'var(--ink-3)', border: '1px solid var(--line)',
                      textDecoration: 'none', fontWeight: 500
                    }}>
                    JSON
                  </a>
                </div>
              </div>

              {shortlistLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[...Array(3)].map((_, i) => <CardSkeleton key={i} height={56} />)}
                </div>
              ) : shortlist.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--ink-3)', fontSize: '0.82rem' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>📝</div>
                  Add artists or venues from your search results
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {shortlist.map(entry => (
                    <ShortlistItem
                      key={`${entry.item_type}-${entry.item_id}`}
                      entry={entry}
                      onContact={selectContactTarget}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Contact + History */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Contact relay */}
            <div style={{
              padding: '1rem', background: 'var(--card)', borderRadius: 14,
              border: '1px solid var(--line)'
            }}>
              <SectionHead title="Contact Relay" subtitle="Send booking inquiries to shortlisted artists and venues" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <select className="input" value={contactForm.template_id}
                  onChange={e => setContactForm({ ...contactForm, template_id: e.target.value })}>
                  <option value="">Choose template</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <textarea className="input" rows="4" placeholder="Optional custom message"
                  value={contactForm.message}
                  onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
                <button onClick={sendContactRequest} style={{
                  padding: '0.5rem 1rem', borderRadius: 10,
                  background: 'var(--emerald)', color: '#000', border: 'none',
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, alignSelf: 'flex-start'
                }}>
                  Send request
                </button>
                {contactStatus && (
                  <p style={{
                    fontSize: '0.75rem', marginTop: 4,
                    color: contactStatus.includes('sent') ? 'var(--emerald)' :
                      contactStatus.includes('failed') ? '#ff5c5c' : 'var(--ink-3)'
                  }}>
                    {contactStatus}
                  </p>
                )}
              </div>
            </div>

            {/* Contact history */}
            <div style={{
              padding: '1rem', background: 'var(--card)', borderRadius: 14,
              border: '1px solid var(--line)'
            }}>
              <SectionHead title="Contact History" />
              {contactRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--ink-3)', fontSize: '0.82rem' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>📬</div>
                  No contact requests yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {contactRequests.map(request => (
                    <ContactRow key={request.id} request={request} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Organizer;
