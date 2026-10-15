import React, {useState, useEffect, useMemo} from 'react';
import {localizedElement} from './i18n.jsx';
import {RecordDetails} from './RecordDetails.jsx';
import {X, ArrowLeft, Search, ChevronRight, Users, Wrench, CalendarCheck, CircleCheck, CircleX, Hourglass, Wallet, LifeBuoy, ShieldCheck, Ban, Activity, Star, IndianRupee, TrendingUp, Phone, Mail, MapPin} from 'lucide-react';
import './insights.css';

/* ------------------------------------------------------------------ helpers */
export const COLORS = {blue: '#3b82f6', green: '#10b981', amber: '#f59e0b', red: '#ef4444', violet: '#8b5cf6', teal: '#14b8a6', cyan: '#06b6d4', slate: '#94a3b8', pink: '#ec4899'};
const STATUS_COLOR = {Pending: COLORS.amber, Accepted: COLORS.blue, 'On The Way': COLORS.violet, Reached: COLORS.teal, 'In Progress': COLORS.cyan, Completed: COLORS.green, Cancelled: COLORS.red, Open: COLORS.amber, Resolved: COLORS.green, Closed: COLORS.slate, available: COLORS.green, busy: COLORS.amber, offline: COLORS.slate, approved: COLORS.green, pending: COLORS.amber, rejected: COLORS.red, suspended: COLORS.slate, active: COLORS.green, needs_correction: COLORS.violet};
const SERIES = [COLORS.blue, COLORS.teal, COLORS.violet, COLORS.amber, COLORS.pink, COLORS.cyan, COLORS.green, COLORS.slate];
export const statusColor = (s, i = 0) => STATUS_COLOR[s] || SERIES[i % SERIES.length];
const INR = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const short = s => String(s || '').slice(-6).toUpperCase();
const dt = v => (v && !isNaN(Date.parse(v)) ? new Date(v).toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'}) : '—');
const dOnly = v => (v && !isNaN(Date.parse(v)) ? new Date(v).toLocaleDateString('en-IN', {dateStyle: 'medium'}) : '—');
const label = k => String(k).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const dm = iso => { const [, m, d] = iso.split('-'); return d + '/' + m; };
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

/* --------------------------------------------------------------- primitives */
export function Badge({status}) {
  return <span className="viz-badge" style={{'--c': statusColor(status)}}>{label(status ?? '—')}</span>;
}

export function Kpi({icon: Icon = Activity, label: text, value, hint, color = COLORS.blue, onClick, sub}) {
  const body = <>
    <span className="viz-kpi-icon" style={{'--c': color}}><Icon size={18}/></span>
    <span className="viz-kpi-label">{text}</span>
    <strong className="viz-kpi-value">{value}</strong>
    {sub && <small className="viz-kpi-sub">{sub}</small>}
    {onClick && <span className="viz-kpi-go"><ChevronRight size={15}/></span>}
  </>;
  return onClick
    ? <button type="button" className="viz-kpi clickable" onClick={onClick} title={hint || 'Click to see details'}>{body}</button>
    : <div className="viz-kpi">{body}</div>;
}

export function Panel({title, sub, children, right, className = ''}) {
  return <section className={'viz-panel ' + className}>
    <header><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>{right}</header>
    {children}
  </section>;
}

/* Donut chart – every slice and legend row is clickable */
export function Donut({data, onSelect, centerValue, centerLabel, size = 168}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  return <div className="viz-donut">
    <svg viewBox="0 0 36 36" width={size} height={size} role="img" aria-label={centerLabel}>
      <circle className="viz-track" cx="18" cy="18" r="15.9155" fill="none" strokeWidth="4.2"/>
      {total > 0 && data.filter(d => d.value > 0).map((d, i) => {
        const len = d.value / total * 100, off = 25 - acc;
        acc += len;
        return <circle key={d.name} cx="18" cy="18" r="15.9155" fill="none" stroke={d.color} strokeWidth="4.2"
          strokeDasharray={Math.max(0, len - (data.length > 1 ? 0.6 : 0)) + ' ' + (100 - len + (data.length > 1 ? 0.6 : 0))} strokeDashoffset={off}
          className={'viz-slice' + (onSelect && d.key ? ' clickable' : '')} tabIndex={onSelect && d.key ? 0 : undefined}
          onClick={() => onSelect && d.key && onSelect(d)} onKeyDown={e => e.key === 'Enter' && onSelect && d.key && onSelect(d)}>
          <title>{d.name}: {d.value} ({pct(d.value, total)}%)</title>
        </circle>;
      })}
      <text x="18" y="18.4" textAnchor="middle" className="viz-donut-num">{centerValue ?? total}</text>
      <text x="18" y="22.6" textAnchor="middle" className="viz-donut-cap">{centerLabel}</text>
    </svg>
    <ul className="viz-legend">
      {data.map(d => <li key={d.name}>
        <button type="button" disabled={!onSelect || !d.key} onClick={() => onSelect && d.key && onSelect(d)}>
          <i style={{background: d.color}}/><span>{d.name}</span><strong>{d.value}</strong><em>{pct(d.value, total)}%</em>
        </button>
      </li>)}
    </ul>
  </div>;
}

/* Horizontal bars – each bar clickable */
export function HBars({data, onSelect, format = v => v, empty = 'No data yet.', color}) {
  const max = Math.max(1, ...data.map(d => d.value));
  if (!data.length) return <p className="viz-empty">{empty}</p>;
  return <div className="viz-hbars">
    {data.map((d, i) => <button type="button" key={d.name + i} className="viz-hbar" disabled={!onSelect} onClick={() => onSelect && onSelect(d)} title={d.name + ': ' + format(d.value)}>
      <span className="viz-hbar-name" data-raw>{d.name}</span>
      <span className="viz-hbar-track"><i style={{width: Math.max(2, d.value / max * 100) + '%', background: d.color || color || SERIES[i % SERIES.length]}}/></span>
      <strong>{format(d.value)}</strong>
    </button>)}
  </div>;
}

/* Stacked horizontal segment bar (funnel / composition) */
export function Stack({data, onSelect}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return <div>
    <div className="viz-stack">{total ? data.filter(d => d.value).map(d => <button type="button" key={d.name} style={{flex: d.value, background: d.color}} title={d.name + ': ' + d.value} onClick={() => onSelect && onSelect(d)} disabled={!onSelect}/>) : <span/>}</div>
    <div className="viz-stack-legend">{data.map(d => <span key={d.name}><i style={{background: d.color}}/>{d.name} <b>{d.value}</b></span>)}</div>
  </div>;
}

/* Ring gauge */
export function Gauge({value, label: text, color, onClick, sub}) {
  const r = 15.9155;
  const body = <>
    <svg viewBox="0 0 36 36" width="104" height="104">
      <circle className="viz-track" cx="18" cy="18" r={r} fill="none" strokeWidth="3.4"/>
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeDasharray={value + ' ' + (100 - value)} strokeDashoffset="25"/>
      <text x="18" y="20.2" textAnchor="middle" className="viz-gauge-num">{value}%</text>
    </svg>
    <strong>{text}</strong>{sub && <small>{sub}</small>}
  </>;
  return onClick ? <button type="button" className="viz-gauge clickable" onClick={onClick}>{body}</button> : <div className="viz-gauge">{body}</div>;
}

/* Multi-series line / area chart, clickable points */
export function TrendChart({data, series, xKey = 'date', onSelect, height = 220, formatX = v => v}) {
  const W = 640, H = height, L = 34, R = 12, T = 14, B = 28;
  const max = Math.max(3, ...data.flatMap(d => series.map(s => d[s.key] || 0)));
  const nice = Math.ceil(max / 3) * 3, step = nice / 3;
  const x = i => L + (data.length <= 1 ? (W - L - R) / 2 : i * (W - L - R) / (data.length - 1));
  const y = v => T + (H - T - B) * (1 - v / nice);
  const [hover, setHover] = useState(null);
  if (!data.length) return <p className="viz-empty">No activity in this period.</p>;
  const every = Math.ceil(data.length / 8);
  return <div className="viz-trend">
    <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Trend chart">
      {[0, 1, 2, 3].map(i => <g key={i}><line className="viz-grid" x1={L} x2={W - R} y1={y(i * step)} y2={y(i * step)}/><text className="viz-axis" x={L - 6} y={y(i * step) + 3} textAnchor="end">{Math.round(i * step)}</text></g>)}
      {data.map((d, i) => i % every === 0 || i === data.length - 1 ? <text className="viz-axis" key={i} x={x(i)} y={H - 8} textAnchor="middle">{formatX(d[xKey])}</text> : null)}
      {series.map((s, si) => {
        const pts = data.map((d, i) => [x(i), y(d[s.key] || 0)]);
        const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
        return <g key={s.key}>
          {si === 0 && <path d={line + ' L' + pts[pts.length - 1][0] + ' ' + y(0) + ' L' + pts[0][0] + ' ' + y(0) + ' Z'} fill={s.color} opacity=".12"/>}
          <path d={line} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/>
          {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 5 : 3.2} fill={s.color} className={onSelect ? 'viz-dot clickable' : 'viz-dot'}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onSelect && onSelect(data[i], s)}>
            <title>{formatX(data[i][xKey])} · {s.label}: {data[i][s.key] || 0}</title>
          </circle>)}
        </g>;
      })}
    </svg>
    <div className="viz-stack-legend">{series.map(s => <span key={s.key}><i style={{background: s.color}}/>{s.label}</span>)}</div>
  </div>;
}

/* Generic overlay */
export function Overlay({title, onClose, back, children, wide = true}) {
  useEffect(() => {
    const f = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  return <div className="overlay viz-overlay" onClick={onClose}>
    <section className={'modal viz-modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
      <div className="viz-modal-head">
        {back && <button type="button" className="btn secondary small" onClick={back}><ArrowLeft size={15}/> Back</button>}
        <h2 data-raw>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X/></button>
      </div>
      {children}
    </section>
  </div>;
}

export function Timeline({events}) {
  if (!events?.length) return <p className="viz-empty">Nothing recorded yet.</p>;
  const colors = {account: COLORS.slate, booking: COLORS.blue, review: COLORS.amber, payment: COLORS.green, complaint: COLORS.red, note: COLORS.violet, remark: COLORS.pink};
  return <ol className="viz-feed">
    {events.map((e, i) => <li key={i} style={{'--c': e.type === 'booking' ? statusColor(e.status) : colors[e.type]}}>
      <i/>
      <div><strong data-raw>{e.title}</strong>{e.text && <p data-raw>{e.text}</p>}<time>{dt(e.at)} · {label(e.type)}</time></div>
    </li>)}
  </ol>;
}

function BookingTimeline({b}) {
  const tl = b.timeline?.length ? b.timeline : [{status: b.status, at: b.createdAt}];
  return <ol className="viz-steps">
    {tl.map((t, i) => <li key={i} style={{'--c': statusColor(t.status)}}><i/><strong>{t.status}</strong><time>{dt(t.at)}</time></li>)}
  </ol>;
}

/* Table with clickable rows */
function DataTable({cols, rows, onRow, empty = 'No records.'}) {
  if (!rows.length) return <p className="viz-empty">{empty}</p>;
  return <div className="viz-table-wrap"><table className="viz-table">
    <thead><tr>{cols.map(c => <th key={c.h} className={c.num ? 'num' : ''}>{c.h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r._id || i} tabIndex={0} onClick={() => onRow(r)} onKeyDown={e => e.key === 'Enter' && onRow(r)}>
      {cols.map(c => <td key={c.h} className={c.num ? 'num' : ''}>{c.cell(r)}</td>)}
    </tr>)}</tbody>
  </table></div>;
}

const nameCell = (name, sub) => <div className="viz-name"><b data-raw>{name || '—'}</b>{sub && <small data-raw>{sub}</small>}</div>;

/* ================================================================== ADMIN */
const DRILL_COLS = {
  customer: [{h: 'Customer', cell: r => nameCell(r.name, r.email)}, {h: 'Phone', cell: r => <span data-raw>{r.phone}</span>}, {h: 'Status', cell: r => <Badge status={r.accountStatus}/>}, {h: 'Joined', cell: r => dOnly(r.createdAt)}],
  user: [{h: 'Account', cell: r => nameCell(r.name, r.email)}, {h: 'Role', cell: r => label(r.role || '')}, {h: 'Phone', cell: r => <span data-raw>{r.phone}</span>}, {h: 'Status', cell: r => <Badge status={r.accountStatus}/>}],
  worker: [{h: 'Worker', cell: r => nameCell(r.user?.name, r.user?.email)}, {h: 'Skill', cell: r => <span data-raw>{r.skill || '—'}</span>}, {h: 'Area', cell: r => <span data-raw>{[r.city, r.district].filter(Boolean).join(', ') || '—'}</span>}, {h: 'Approval', cell: r => <Badge status={r.approvalStatus}/>}, {h: 'Availability', cell: r => <Badge status={r.availability}/>}, {h: 'Jobs', num: true, cell: r => r.completedJobs || 0}],
  booking: [{h: 'Booking', cell: r => <b>#{short(r._id)}</b>}, {h: 'Service', cell: r => <span data-raw>{r.service?.name || '—'}</span>}, {h: 'Customer', cell: r => <span data-raw>{r.customer?.name || '—'}</span>}, {h: 'Worker', cell: r => <span data-raw>{r.worker?.user?.name || '—'}</span>}, {h: 'When', cell: r => r.date + ' ' + (r.time || '')}, {h: 'Amount', num: true, cell: r => INR(r.amount)}, {h: 'Status', cell: r => <Badge status={r.status}/>}],
  payment: [{h: 'Payment', cell: r => <b>#{short(r._id)}</b>}, {h: 'Service', cell: r => <span data-raw>{r.booking?.service?.name || '—'}</span>}, {h: 'Customer', cell: r => <span data-raw>{r.customer?.name || '—'}</span>}, {h: 'Worker', cell: r => <span data-raw>{r.worker?.user?.name || '—'}</span>}, {h: 'Amount', num: true, cell: r => INR(r.amount)}, {h: 'Method', cell: r => r.method}, {h: 'Status', cell: r => <Badge status={r.status}/>}],
  ticket: [{h: 'Ticket', cell: r => nameCell(r.subject || 'Support ticket', '#' + short(r._id))}, {h: 'From', cell: r => <span data-raw>{r.user?.name || '—'}</span>}, {h: 'Priority', cell: r => <Badge status={r.priority}/>}, {h: 'Status', cell: r => <Badge status={r.status}/>}, {h: 'Updated', cell: r => dOnly(r.updatedAt)}]
};

function DrillDetail({type, record}) {
  const r = record;
  const head = {
    booking: {t: (r.service?.name || 'Booking') + ' · #' + short(r._id), s: r.status},
    worker: {t: r.user?.name || 'Worker', s: r.approvalStatus},
    customer: {t: r.name, s: r.accountStatus}, user: {t: r.name, s: r.accountStatus},
    payment: {t: 'Payment #' + short(r._id), s: r.status},
    ticket: {t: r.subject || 'Support ticket', s: r.status}
  }[type];
  return <div className="viz-detail">
    <div className="viz-detail-head"><h3 data-raw>{head.t}</h3><Badge status={head.s}/></div>
    {type === 'booking' && <div className="viz-cols">
      <div><h4>Progress</h4><BookingTimeline b={r}/></div>
      <div><h4>Quick facts</h4><dl className="viz-facts">
        <dt>Customer</dt><dd data-raw>{r.customer?.name || '—'}</dd>
        <dt>Worker</dt><dd data-raw>{r.worker?.user?.name || '—'}</dd>
        <dt>Scheduled</dt><dd>{r.date} {r.time}</dd>
        <dt>Amount</dt><dd>{INR(r.amount)}</dd>
        <dt>Payment</dt><dd>{r.paymentStatus}</dd>
        <dt>Address</dt><dd data-raw>{['house', 'locality', 'city', 'district', 'pin'].map(k => r.addressSnapshot?.[k]).filter(Boolean).join(', ') || '—'}</dd>
      </dl></div>
    </div>}
    <h4>Complete record</h4>
    <RecordDetails record={r}/>
  </div>;
}

export function DrillModal({drill, api, onClose}) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [q, setQ] = useState(''), [sel, setSel] = useState(null);
  useEffect(() => {
    let live = true;
    setData(null); setError(''); setSel(null); setQ('');
    api('/admin/drilldown?key=' + encodeURIComponent(drill.key) + '&value=' + encodeURIComponent(drill.value || ''))
      .then(d => live && setData(d)).catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [drill.key, drill.value]);
  const rows = useMemo(() => !data ? [] : data.items.filter(r => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())), [data, q]);
  return <Overlay title={sel ? 'Details' : (data?.title || drill.title)} onClose={onClose} back={sel ? () => setSel(null) : null}>
    {error && <p className="notice" role="alert">{error}</p>}
    {!data && !error && <p className="viz-empty">Loading…</p>}
    {data && !sel && <>
      <div className="viz-toolbar">
        <label className="viz-search"><Search size={15}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search in these records…"/></label>
        <span className="viz-count">{rows.length} of {data.total} records</span>
      </div>
      <DataTable cols={DRILL_COLS[data.type]} rows={rows} onRow={setSel} empty="No records match."/>
      {data.total > data.items.length && <p className="viz-empty">Showing the latest {data.items.length} records.</p>}
    </>}
    {data && sel && <DrillDetail type={data.type} record={sel}/>}
  </Overlay>;
}

export function AdminInsights({api, dash, dates, setDates, children}) {
  const [drill, setDrill] = useState(null);
  const go = (key, value, title) => setDrill({key, value, title});
  const total = dash.bookings;
  const trend = Object.entries(dash.trends || {}).filter(([d]) => (!dates.from || d >= dates.from) && (!dates.to || d <= dates.to)).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({date, count}));
  const demand = [...(dash.demand || [])].sort((a, b) => b.count - a.count).map((d, i) => ({name: d.name, value: d.count, color: SERIES[i % SERIES.length]}));
  const other = Math.max(0, dash.workers - dash.approved - dash.pending - dash.rejected);
  return <div className="viz">
    <div className="viz-group-title">People</div>
    <div className="viz-kpis">
      <Kpi icon={Users} label="Total Customers" value={dash.customers} color={COLORS.blue} onClick={() => go('customers')}/>
      <Kpi icon={Wrench} label="Registered Workers" value={dash.workers} color={COLORS.teal} onClick={() => go('workers')}/>
      <Kpi icon={Hourglass} label="Pending Approvals" value={dash.pending} color={COLORS.amber} onClick={() => go('pending')}/>
      <Kpi icon={ShieldCheck} label="Approved Workers" value={dash.approved} color={COLORS.green} onClick={() => go('approved')}/>
      <Kpi icon={Activity} label="Available Workers" value={dash.available} color={COLORS.cyan} onClick={() => go('available')}/>
      <Kpi icon={CircleX} label="Rejected Workers" value={dash.rejected} color={COLORS.red} onClick={() => go('rejected')}/>
      <Kpi icon={Ban} label="Suspended Accounts" value={dash.suspended} color={COLORS.slate} onClick={() => go('suspended')}/>
    </div>
    <div className="viz-group-title">Bookings &amp; money</div>
    <div className="viz-kpis">
      <Kpi icon={CalendarCheck} label="Total Bookings" value={dash.bookings} color={COLORS.blue} onClick={() => go('bookings')}/>
      <Kpi icon={TrendingUp} label="Active Bookings" value={dash.active} color={COLORS.violet} onClick={() => go('active')}/>
      <Kpi icon={CircleCheck} label="Completed Jobs" value={dash.completed} color={COLORS.green} onClick={() => go('completed')}/>
      <Kpi icon={CircleX} label="Cancelled" value={dash.cancelled} color={COLORS.red} onClick={() => go('cancelled')}/>
      <Kpi icon={Wallet} label="Recorded Revenue" value={INR(dash.revenue)} color={COLORS.green} onClick={() => go('revenue')}/>
      <Kpi icon={LifeBuoy} label="Open Support" value={dash.support} color={COLORS.amber} onClick={() => go('support')}/>
    </div>

    <div className="viz-grid-2">
      <Panel title="Booking status" sub="Click a slice to open those bookings">
        <Donut centerLabel="bookings" onSelect={d => go(d.key, '', d.name)} data={[
          {name: 'Active', value: dash.active, color: COLORS.blue, key: 'active'},
          {name: 'Completed', value: dash.completed, color: COLORS.green, key: 'completed'},
          {name: 'Cancelled', value: dash.cancelled, color: COLORS.red, key: 'cancelled'}]}/>
      </Panel>
      <Panel title="Worker pipeline" sub="Where every worker application stands">
        <Donut centerLabel="workers" onSelect={d => go(d.key, '', d.name)} data={[
          {name: 'Approved', value: dash.approved, color: COLORS.green, key: 'approved'},
          {name: 'Pending', value: dash.pending, color: COLORS.amber, key: 'pending'},
          {name: 'Rejected', value: dash.rejected, color: COLORS.red, key: 'rejected'},
          ...(other ? [{name: 'Other (correction / suspended)', value: other, color: COLORS.slate, key: 'workers'}] : [])]}/>
        <div className="viz-funnel">
          <HBars onSelect={d => go(d.key)} data={[
            {name: 'Registered', value: dash.workers, key: 'workers', color: COLORS.blue},
            {name: 'Approved', value: dash.approved, key: 'approved', color: COLORS.teal},
            {name: 'Available now', value: dash.available, key: 'available', color: COLORS.green}]}/>
        </div>
      </Panel>
    </div>

    <div className="viz-grid-2">
      <Panel title="Service demand" sub="Bookings per service · click a bar">
        <HBars data={demand} onSelect={d => go('service', d.name, d.name)} empty="No bookings yet."/>
      </Panel>
      <Panel title="Booking trend" sub="Bookings per service date · click a point"
        right={<div className="viz-dates"><label>From<input type="date" value={dates.from} onChange={e => setDates({...dates, from: e.target.value})}/></label><label>To<input type="date" value={dates.to} onChange={e => setDates({...dates, to: e.target.value})}/></label></div>}>
        <TrendChart data={trend} series={[{key: 'count', label: 'Bookings', color: COLORS.blue}]} formatX={dm} onSelect={d => go('date', d.date, 'Bookings on ' + d.date)}/>
      </Panel>
    </div>

    <div className="viz-grid-3">
      <Panel title="Completion rate" sub="Of all recorded bookings"><Gauge value={pct(dash.completed, total)} color={COLORS.green} label="Completed" sub={dash.completed + ' of ' + total + ' bookings'} onClick={() => go('completed')}/></Panel>
      <Panel title="Cancellation rate" sub="Of all recorded bookings"><Gauge value={pct(dash.cancelled, total)} color={COLORS.red} label="Cancelled" sub={dash.cancelled + ' of ' + total + ' bookings'} onClick={() => go('cancelled')}/></Panel>
      <Panel title="In progress" sub="Still moving through the pipeline"><Gauge value={pct(dash.active, total)} color={COLORS.violet} label="Active" sub={dash.active + ' of ' + total + ' bookings'} onClick={() => go('active')}/></Panel>
    </div>
    {children}
    {drill && <DrillModal drill={drill} api={api} onClose={() => setDrill(null)}/>}
  </div>;
}

/* ================================================================== AGENT */
function ActorDetail({kind, id, api, onClose}) {
  const [d, setD] = useState(null), [error, setError] = useState(''), [tab, setTab] = useState('activity'), [open, setOpen] = useState(null), [filter, setFilter] = useState('all');
  useEffect(() => {
    let live = true;
    api('/agent/insights/' + kind + '/' + id).then(x => live && setD(x)).catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [kind, id]);
  const p = d?.profile, u = kind === 'worker' ? p?.user : p;
  const tabs = d ? [['activity', 'Full activity', d.activity.length], ['bookings', 'Bookings', d.bookings.length], ['reviews', 'Reviews', d.reviews.length], ['payments', 'Payments', d.transactions.length], ['complaints', 'Complaints', d.complaints.length], ['notes', 'Agent notes', d.notes.length + (d.remarks?.length || 0)], ['profile', 'Profile', null]] : [];
  const types = d ? ['all', ...new Set(d.activity.map(a => a.type))] : [];
  const events = d ? d.activity.filter(a => filter === 'all' || a.type === filter) : [];
  return <Overlay title={kind === 'worker' ? 'Worker details' : 'Customer details'} onClose={onClose}>
    {error && <p className="notice" role="alert">{error}</p>}
    {!d && !error && <p className="viz-empty">Loading…</p>}
    {d && <>
      <div className="viz-actor">
        <div className="viz-avatar">{u?.photo && /^data:image\//.test(u.photo) ? <img src={u.photo} alt=""/> : (u?.name || '?')[0]}</div>
        <div className="viz-actor-main">
          <h3 data-raw>{u?.name}</h3>
          <div className="viz-actor-meta">
            {u?.phone && <a href={'tel:' + u.phone}><Phone size={13}/> <span data-raw>{u.phone}</span></a>}
            {u?.email && <a href={'mailto:' + u.email}><Mail size={13}/> <span data-raw>{u.email}</span></a>}
            {kind === 'worker' && (p.city || p.district) && <span><MapPin size={13}/> <span data-raw>{[p.locality, p.city, p.district].filter(Boolean).join(', ')}</span></span>}
          </div>
          <div className="viz-actor-badges">
            <Badge status={u?.accountStatus}/>{kind === 'worker' && <><Badge status={p.approvalStatus}/><Badge status={p.availability}/><span className="viz-chip" data-raw>{p.skill}</span></>}
            <span className="viz-chip">Joined {dOnly(u?.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="viz-kpis mini">
        <Kpi icon={CalendarCheck} label="Bookings" value={d.stats.total} color={COLORS.blue}/>
        <Kpi icon={TrendingUp} label="Active" value={d.stats.active} color={COLORS.violet}/>
        <Kpi icon={CircleCheck} label="Completed" value={d.stats.completed} color={COLORS.green} sub={d.stats.completionRate + '% rate'}/>
        <Kpi icon={CircleX} label="Cancelled" value={d.stats.cancelled} color={COLORS.red}/>
        <Kpi icon={IndianRupee} label={kind === 'worker' ? 'Earned (paid)' : 'Spent (paid)'} value={INR(d.stats.paid)} color={COLORS.green} sub={'Job value ' + INR(d.stats.value)}/>
        <Kpi icon={Star} label="Reviews" value={d.reviews.length} color={COLORS.amber} sub={d.reviews.length ? '★ ' + (d.reviews.reduce((s, r) => s + r.rating, 0) / d.reviews.length).toFixed(1) + ' avg' : undefined}/>
      </div>
      <div className="viz-grid-2 tight">
        <Panel title="Booking outcomes"><Donut size={132} centerLabel="bookings" data={d.bookingStatus.map(x => ({name: x.name, value: x.count, color: statusColor(x.name)}))}/></Panel>
        <Panel title={kind === 'worker' ? 'Work by service' : 'Services booked'}><HBars data={d.serviceMix.map((x, i) => ({name: x.name, value: x.count, color: SERIES[i % SERIES.length]}))} empty="No bookings yet."/></Panel>
      </div>
      <div className="viz-tabs" role="tablist">
        {tabs.map(([k, name, n]) => <button type="button" role="tab" aria-selected={tab === k} key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{name}{n !== null && <em>{n}</em>}</button>)}
      </div>
      {tab === 'activity' && <>
        <div className="viz-chips">{types.map(t => <button type="button" key={t} className={filter === t ? 'active' : ''} onClick={() => setFilter(t)}>{label(t)}</button>)}</div>
        <Timeline events={events}/>
      </>}
      {tab === 'bookings' && (d.bookings.length ? <div className="viz-list">{d.bookings.map(b => <article key={b._id} className={'viz-row' + (open === b._id ? ' open' : '')}>
        <button type="button" onClick={() => setOpen(open === b._id ? null : b._id)}>
          <div><b data-raw>{b.service?.name || 'Service'}</b><small>#{short(b._id)} · {b.date} {b.time} · <span data-raw>{kind === 'worker' ? 'Customer: ' + (b.customer?.name || '—') : 'Worker: ' + (b.worker?.user?.name || '—')}</span></small></div>
          <strong>{INR(b.amount)}</strong><Badge status={b.status}/><ChevronRight size={16} className="chev"/>
        </button>
        {open === b._id && <div className="viz-row-body">
          <div className="viz-cols"><div><h4>Progress</h4><BookingTimeline b={b}/></div>
            <div><h4>Details</h4><dl className="viz-facts"><dt>Payment</dt><dd>{b.paymentStatus} · paid {INR(b.paid)}</dd><dt>Address</dt><dd data-raw>{['house', 'locality', 'city', 'district', 'pin'].map(k => b.addressSnapshot?.[k]).filter(Boolean).join(', ') || '—'}</dd>{b.notes && <><dt>Notes</dt><dd data-raw>{b.notes}</dd></>}</dl></div></div>
          {d.notes.filter(n => String(n.booking) === String(b._id)).length > 0 && <><h4>Agent follow-ups</h4>{d.notes.filter(n => String(n.booking) === String(b._id)).map(n => <p className="viz-note" key={n._id} data-raw><b>{n.agent?.name} · {n.method}:</b> {n.text}</p>)}</>}
        </div>}
      </article>)}</div> : <p className="viz-empty">No bookings yet.</p>)}
      {tab === 'reviews' && (d.reviews.length ? <div className="viz-list">{d.reviews.map(r => <article className="viz-row static" key={r._id}><div><b>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</b><small data-raw>{r.booking?.service?.name} · {kind === 'worker' ? r.customer?.name : ''} · {dOnly(r.createdAt)}</small><p data-raw>{r.text || 'No written review.'}</p></div></article>)}</div> : <p className="viz-empty">No reviews yet.</p>)}
      {tab === 'payments' && <DataTable rows={d.transactions} onRow={() => {}} empty="No payments recorded." cols={[{h: 'Payment', cell: r => <b>#{short(r._id)}</b>}, {h: 'Booking', cell: r => '#' + short(r.booking)}, {h: 'Amount', num: true, cell: r => INR(r.amount)}, {h: 'Method', cell: r => r.method}, {h: 'Status', cell: r => <Badge status={r.status}/>}, {h: 'Date', cell: r => dOnly(r.createdAt)}]}/>}
      {tab === 'complaints' && (d.complaints.length ? <div className="viz-list">{d.complaints.map(c => <article className="viz-row static" key={c._id}><div><b data-raw>{c.subject || 'Support ticket'}</b><small>#{short(c._id)} · {c.messages} message(s) · {dOnly(c.createdAt)} · raised by <span data-raw>{c.user?.name}</span></small></div><Badge status={c.priority}/><Badge status={c.status}/></article>)}</div> : <p className="viz-empty">No complaints.</p>)}
      {tab === 'notes' && <>
        {d.notes.map(n => <p className="viz-note" key={n._id} data-raw><b>{n.agent?.name} · {n.method} · {n.party} · {dt(n.createdAt)}</b><br/>{n.text}</p>)}
        {d.remarks?.map(n => <p className="viz-note remark" key={n._id} data-raw><b>Worker remark · {dt(n.createdAt)}</b><br/>{n.text}</p>)}
        {!d.notes.length && !d.remarks?.length && <p className="viz-empty">No agent notes or worker remarks.</p>}
      </>}
      {tab === 'profile' && <RecordDetails record={kind === 'worker' ? p : {...p, addresses: d.addresses}}/>}
    </>}
  </Overlay>;
}

const sortFns = {
  total: (a, b) => b.stats.total - a.stats.total, completed: (a, b) => b.stats.completed - a.stats.completed,
  money: (a, b) => b.stats.paid - a.stats.paid, name: (a, b) => String(a.name).localeCompare(String(b.name)),
  recent: (a, b) => (b.lastActivity || 0) - (a.lastActivity || 0), rating: (a, b) => (b.rating || 0) - (a.rating || 0)
};

function Bar({done, active, cancelled}) {
  const t = done + active + cancelled;
  return <span className="viz-mini" title={done + ' completed · ' + active + ' active · ' + cancelled + ' cancelled'}>
    {t ? <><i style={{flex: done, background: COLORS.green}}/><i style={{flex: active, background: COLORS.blue}}/><i style={{flex: cancelled, background: COLORS.red}}/></> : <i style={{flex: 1}} className="empty"/>}
  </span>;
}

export function AgentInsights({api}) {
  const [view, setView] = useState('workers'), [data, setData] = useState(null), [error, setError] = useState(''), [q, setQ] = useState(''), [sort, setSort] = useState('total'), [seg, setSeg] = useState('all'), [sel, setSel] = useState(null);
  useEffect(() => {
    let live = true;
    const load = () => api('/agent/insights').then(d => { if (live) { setData(d); setError(''); } }).catch(e => live && setError(e.message));
    load();
    const t = setInterval(load, 15000);
    return () => { live = false; clearInterval(t); };
  }, []);
  useEffect(() => { setQ(''); setSeg('all'); setSort('total'); }, [view]);
  if (error && !data) return <p className="notice" role="alert">{error}</p>;
  if (!data) return <p className="viz-empty">Loading insights…</p>;
  const W = data.workers, C = data.customers, isW = view === 'workers';
  const rows0 = isW ? W : C;

  const wSegs = {all: () => true, available: w => w.availability === 'available' && w.approvalStatus === 'approved', busy: w => w.availability === 'busy' && w.approvalStatus === 'approved', offline: w => w.availability === 'offline' && w.approvalStatus === 'approved', pending: w => w.approvalStatus === 'pending', unapproved: w => !['approved', 'pending'].includes(w.approvalStatus), withComplaint: w => w.stats.complaints > 0, working: w => w.stats.active > 0, idle: w => w.approvalStatus === 'approved' && w.stats.total === 0};
  const cSegs = {all: () => true, active: c => c.stats.active > 0, repeat: c => c.stats.total > 1, completedOnly: c => c.stats.total > 0 && c.stats.active === 0 && c.stats.completed > 0, cancelledOnly: c => c.stats.total > 0 && c.stats.completed === 0 && c.stats.active === 0, none: c => c.stats.total === 0, withComplaint: c => c.stats.complaints > 0};
  const fn = (isW ? wSegs : cSegs)[seg] || (() => true);
  const rows = rows0.filter(fn).filter(r => !q || JSON.stringify([r.name, r.email, r.phone, r.skill, r.city, r.district]).toLowerCase().includes(q.toLowerCase())).sort(sortFns[sort] || sortFns.total);
  const segLabel = {all: 'All', available: 'Available now', busy: 'Busy', offline: 'Offline', pending: 'Pending approval', unapproved: 'Rejected / suspended', withComplaint: 'With open complaint', working: 'Working on a job', idle: 'No jobs yet', active: 'Has active booking', repeat: 'Repeat customers', completedOnly: 'Completed only', cancelledOnly: 'Cancelled only', none: 'No bookings yet'};
  const pick = key => { setSeg(key); document.getElementById('viz-actors')?.scrollIntoView({behavior: 'smooth', block: 'start'}); };

  const wTotal = (k) => W.reduce((s, w) => s + w.stats[k], 0), cTotal = k => C.reduce((s, c) => s + c.stats[k], 0);
  const top = list => [...list].sort((a, b) => b.stats.total - a.stats.total).filter(r => r.stats.total).slice(0, 6).map((r, i) => ({name: r.name, value: r.stats.total, id: r._id, color: SERIES[i % SERIES.length]}));
  const skillMix = Object.entries(W.reduce((a, w) => { if (w.skill) a[w.skill] = (a[w.skill] || 0) + 1; return a; }, {})).map(([name, value], i) => ({name, value, color: SERIES[i % SERIES.length]})).sort((a, b) => b.value - a.value);

  return <div className="viz">
    <div className="viz-switch" role="tablist" aria-label="Insight view">
      <button type="button" role="tab" aria-selected={isW} className={isW ? 'active' : ''} onClick={() => setView('workers')}><Wrench size={16}/> Workers <em>{W.length}</em></button>
      <button type="button" role="tab" aria-selected={!isW} className={!isW ? 'active' : ''} onClick={() => setView('customers')}><Users size={16}/> Customers <em>{C.length}</em></button>
      <span className="viz-updated">Live · refreshed {new Date(data.generatedAt).toLocaleTimeString('en-IN', {timeStyle: 'short'})}</span>
    </div>

    {isW ? <>
      <div className="viz-kpis">
        <Kpi icon={Wrench} label="Workers" value={W.length} color={COLORS.blue} onClick={() => pick('all')}/>
        <Kpi icon={Activity} label="Available now" value={W.filter(wSegs.available).length} color={COLORS.green} onClick={() => pick('available')}/>
        <Kpi icon={TrendingUp} label="Working on jobs" value={W.filter(wSegs.working).length} color={COLORS.violet} onClick={() => pick('working')}/>
        <Kpi icon={CircleCheck} label="Jobs completed" value={wTotal('completed')} color={COLORS.green}/>
        <Kpi icon={CircleX} label="Jobs cancelled" value={wTotal('cancelled')} color={COLORS.red}/>
        <Kpi icon={IndianRupee} label="Earnings paid" value={INR(wTotal('paid'))} color={COLORS.teal}/>
        <Kpi icon={LifeBuoy} label="Workers w/ complaints" value={W.filter(wSegs.withComplaint).length} color={COLORS.amber} onClick={() => pick('withComplaint')}/>
      </div>
      <div className="viz-grid-2">
        <Panel title="Availability" sub="Click a slice to filter the worker list below">
          <Donut centerLabel="workers" onSelect={d => pick(d.key)} data={[
            {name: 'Available', value: W.filter(wSegs.available).length, color: COLORS.green, key: 'available'},
            {name: 'Busy', value: W.filter(wSegs.busy).length, color: COLORS.amber, key: 'busy'},
            {name: 'Offline', value: W.filter(wSegs.offline).length, color: COLORS.slate, key: 'offline'},
            {name: 'Pending approval', value: W.filter(wSegs.pending).length, color: COLORS.violet, key: 'pending'},
            {name: 'Rejected / suspended', value: W.filter(wSegs.unapproved).length, color: COLORS.red, key: 'unapproved'}]}/>
        </Panel>
        <Panel title="Most active workers" sub="By total bookings · click to open"><HBars data={top(W)} onSelect={d => setSel({kind: 'worker', id: d.id})} empty="No worker has bookings yet."/></Panel>
      </div>
      <div className="viz-grid-2">
        <Panel title="Platform activity · last 14 days" sub="New, completed and cancelled bookings"><TrendChart data={data.trend} formatX={dm} series={[{key: 'created', label: 'New bookings', color: COLORS.blue}, {key: 'completed', label: 'Completed', color: COLORS.green}, {key: 'cancelled', label: 'Cancelled', color: COLORS.red}]}/></Panel>
        <Panel title="Workers by skill"><HBars data={skillMix} empty="No workers yet."/></Panel>
      </div>
    </> : <>
      <div className="viz-kpis">
        <Kpi icon={Users} label="Customers" value={C.length} color={COLORS.blue} onClick={() => pick('all')}/>
        <Kpi icon={TrendingUp} label="With active booking" value={C.filter(cSegs.active).length} color={COLORS.violet} onClick={() => pick('active')}/>
        <Kpi icon={CalendarCheck} label="Repeat customers" value={C.filter(cSegs.repeat).length} color={COLORS.teal} onClick={() => pick('repeat')}/>
        <Kpi icon={CircleCheck} label="Jobs completed" value={cTotal('completed')} color={COLORS.green}/>
        <Kpi icon={CircleX} label="Bookings cancelled" value={cTotal('cancelled')} color={COLORS.red}/>
        <Kpi icon={IndianRupee} label="Total spent (paid)" value={INR(cTotal('paid'))} color={COLORS.green}/>
        <Kpi icon={LifeBuoy} label="Customers w/ complaints" value={C.filter(cSegs.withComplaint).length} color={COLORS.amber} onClick={() => pick('withComplaint')}/>
      </div>
      <div className="viz-grid-2">
        <Panel title="Customer segments" sub="Click a slice to filter the customer list below">
          <Donut centerLabel="customers" onSelect={d => pick(d.key)} data={[
            {name: 'Active booking', value: C.filter(cSegs.active).length, color: COLORS.blue, key: 'active'},
            {name: 'Completed only', value: C.filter(c => cSegs.completedOnly(c)).length, color: COLORS.green, key: 'completedOnly'},
            {name: 'Cancelled only', value: C.filter(cSegs.cancelledOnly).length, color: COLORS.red, key: 'cancelledOnly'},
            {name: 'No bookings yet', value: C.filter(cSegs.none).length, color: COLORS.slate, key: 'none'}]}/>
        </Panel>
        <Panel title="Most active customers" sub="By total bookings · click to open"><HBars data={top(C)} onSelect={d => setSel({kind: 'customer', id: d.id})} empty="No customer has booked yet."/></Panel>
      </div>
      <div className="viz-grid-2">
        <Panel title="Platform activity · last 14 days" sub="New, completed and cancelled bookings"><TrendChart data={data.trend} formatX={dm} series={[{key: 'created', label: 'New bookings', color: COLORS.blue}, {key: 'completed', label: 'Completed', color: COLORS.green}, {key: 'cancelled', label: 'Cancelled', color: COLORS.red}]}/></Panel>
        <Panel title="Booking status (all customers)"><Donut centerLabel="bookings" data={data.bookingStatus.map(x => ({name: x.name, value: x.count, color: statusColor(x.name)}))}/></Panel>
      </div>
    </>}

    <Panel title={isW ? 'Worker activity' : 'Customer activity'} sub="Click any row for the complete work history" className="viz-actors" right={null}>
      <span id="viz-actors"/>
      <div className="viz-toolbar">
        <label className="viz-search"><Search size={15}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={isW ? 'Search name, skill, phone, area…' : 'Search name, phone, email…'}/></label>
        <label className="viz-select"><span>Show</span><select value={seg} onChange={e => setSeg(e.target.value)}>{Object.keys(isW ? wSegs : cSegs).map(k => <option key={k} value={k}>{segLabel[k] || label(k)}</option>)}</select></label>
        <label className="viz-select"><span>Sort</span><select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="total">Most bookings</option><option value="completed">Most completed</option><option value="money">{isW ? 'Highest earnings' : 'Highest spend'}</option>{isW && <option value="rating">Best rating</option>}<option value="recent">Recent activity</option><option value="name">Name</option></select></label>
        <span className="viz-count">{rows.length} of {rows0.length}</span>
      </div>
      <DataTable rows={rows} empty="No matching records." onRow={r => setSel({kind: isW ? 'worker' : 'customer', id: r._id})} cols={[
        {h: isW ? 'Worker' : 'Customer', cell: r => nameCell(r.name, isW ? [r.skill, r.city || r.district].filter(Boolean).join(' · ') : r.email)},
        {h: 'Status', cell: r => isW ? <><Badge status={r.approvalStatus === 'approved' ? r.availability : r.approvalStatus}/></> : <Badge status={r.accountStatus}/>},
        {h: 'Bookings', num: true, cell: r => r.stats.total},
        {h: 'Active', num: true, cell: r => r.stats.active},
        {h: 'Done', num: true, cell: r => r.stats.completed},
        {h: 'Cancelled', num: true, cell: r => r.stats.cancelled},
        {h: 'Outcome', cell: r => <Bar done={r.stats.completed} active={r.stats.active} cancelled={r.stats.cancelled}/>},
        {h: isW ? 'Earned' : 'Spent', num: true, cell: r => INR(r.stats.paid)},
        isW ? {h: 'Rating', num: true, cell: r => r.reviewCount ? '★ ' + r.rating : '—'} : {h: 'Reviews', num: true, cell: r => r.reviews},
        {h: 'Complaints', num: true, cell: r => r.stats.complaints ? <b className="viz-warn">{r.stats.complaints}</b> : 0}
      ]}/>
    </Panel>
    {sel && <ActorDetail kind={sel.kind} id={sel.id} api={api} onClose={() => setSel(null)}/>}
  </div>;
}
