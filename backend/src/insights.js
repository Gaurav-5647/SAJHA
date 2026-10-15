// Visualization / insight endpoints.
//  - Agent : GET /api/agent/insights                (worker + customer overview rows and trends)
//            GET /api/agent/insights/:kind/:id      (kind = worker | customer, full activity detail)
//  - Admin : GET /api/admin/drilldown?key=&value=   (records behind every dashboard metric)
import {User, Worker, Address, Booking, Support, Review, Transaction, AgentNote, WorkerRemark} from './models.js';

const person = 'name email phone photo role accountStatus createdAt';
const personLite = 'name email phone role accountStatus createdAt';
const bookingPopulate = [{path: 'customer', select: personLite}, {path: 'worker', populate: {path: 'user', select: personLite}}, {path: 'service'}];
const day = d => new Date(d).toISOString().slice(0, 10);
const open = s => !['Resolved', 'Closed'].includes(s);
const live = s => !['Completed', 'Cancelled'].includes(s);
const sid = v => String(v?._id || v || '');
const count = (rows, pick) => Object.entries(rows.reduce((a, r) => { const k = pick(r); if (k) a[k] = (a[k] || 0) + 1; return a; }, {})).map(([name, count]) => ({name, count}));

function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(day(Date.now() - i * 864e5));
  return out;
}

function bookingStats(list, paidByBooking) {
  const completed = list.filter(b => b.status === 'Completed'), cancelled = list.filter(b => b.status === 'Cancelled');
  const money = completed.reduce((s, b) => s + (b.amount || 0), 0);
  const paid = list.reduce((s, b) => s + (paidByBooking.get(sid(b)) || 0), 0);
  return {
    total: list.length,
    pending: list.filter(b => b.status === 'Pending').length,
    active: list.filter(b => live(b.status)).length,
    completed: completed.length,
    cancelled: cancelled.length,
    value: money,
    paid,
    completionRate: list.length ? Math.round(completed.length / list.length * 100) : 0
  };
}

function bookingEvents(bookings) {
  const events = [];
  for (const b of bookings) {
    const tl = b.timeline?.length ? b.timeline : [{status: b.status, at: b.createdAt}];
    for (const t of tl) events.push({at: t.at, type: 'booking', title: (b.service?.name || 'Service') + ' → ' + t.status, text: 'Customer: ' + (b.customer?.name || '—') + ' · Worker: ' + (b.worker?.user?.name || '—'), status: t.status, ref: sid(b)});
  }
  return events;
}

const slimBooking = b => ({_id: b._id, service: b.service?.name, customer: b.customer?.name, worker: b.worker?.user?.name, date: b.date, time: b.time, amount: b.amount, status: b.status, paymentStatus: b.paymentStatus, createdAt: b.createdAt});

export function insightRoutes(app, {wrap, role, active, fail, id}) {
  // ---------- AGENT: overview ----------
  app.get('/api/agent/insights', role('agent'), active, wrap(async (req, res) => {
    const [customers, workers, bookings, tickets, reviews, transactions] = await Promise.all([
      User.find({role: 'customer'}).select(personLite).lean(),
      Worker.find().populate('user', personLite).lean(),
      Booking.find().populate([{path: 'service', select: 'name'}]).lean(),
      Support.find().select('user booking status priority subject createdAt').lean(),
      Review.find().select('worker customer rating').lean(),
      Transaction.find().lean()
    ]);
    const paidByBooking = new Map();
    for (const t of transactions) if (t.status === 'Paid') paidByBooking.set(sid(t.booking), (paidByBooking.get(sid(t.booking)) || 0) + (t.amount || 0));

    const byWorker = new Map(), byCustomer = new Map();
    for (const b of bookings) {
      (byWorker.get(sid(b.worker)) || byWorker.set(sid(b.worker), []).get(sid(b.worker))).push(b);
      (byCustomer.get(sid(b.customer)) || byCustomer.set(sid(b.customer), []).get(sid(b.customer))).push(b);
    }
    const ticketsFor = (userId, list) => tickets.filter(t => sid(t.user) === userId || list.some(b => sid(b) === sid(t.booking)));

    const workerRows = workers.map(w => {
      const list = byWorker.get(sid(w)) || [], uid = sid(w.user);
      const mine = reviews.filter(r => sid(r.worker) === sid(w));
      return {
        _id: w._id, name: w.user?.name, email: w.user?.email, phone: w.user?.phone,
        skill: w.skill, category: w.category, city: w.city, district: w.district, experience: w.experience, price: w.price,
        availability: w.availability, approvalStatus: w.approvalStatus, accountStatus: w.user?.accountStatus, createdAt: w.createdAt,
        rating: mine.length ? Math.round(mine.reduce((s, r) => s + r.rating, 0) / mine.length * 10) / 10 : (w.rating || 0),
        reviewCount: mine.length || w.reviewCount || 0,
        stats: {...bookingStats(list, paidByBooking), complaints: ticketsFor(uid, list).filter(t => open(t.status)).length, complaintsTotal: ticketsFor(uid, list).length},
        lastActivity: list.reduce((m, b) => Math.max(m, new Date(b.updatedAt || b.createdAt).getTime()), 0) || null
      };
    });
    const customerRows = customers.map(c => {
      const list = byCustomer.get(sid(c)) || [];
      return {
        _id: c._id, name: c.name, email: c.email, phone: c.phone, accountStatus: c.accountStatus, createdAt: c.createdAt,
        reviews: reviews.filter(r => sid(r.customer) === sid(c)).length,
        stats: {...bookingStats(list, paidByBooking), complaints: ticketsFor(sid(c), list).filter(t => open(t.status)).length, complaintsTotal: ticketsFor(sid(c), list).length},
        lastActivity: list.reduce((m, b) => Math.max(m, new Date(b.updatedAt || b.createdAt).getTime()), 0) || null
      };
    });

    const days = lastDays(14);
    const created = {}, done = {}, cancelled = {};
    for (const b of bookings) {
      created[day(b.createdAt)] = (created[day(b.createdAt)] || 0) + 1;
      for (const t of b.timeline || []) {
        if (t.status === 'Completed') done[day(t.at)] = (done[day(t.at)] || 0) + 1;
        if (t.status === 'Cancelled') cancelled[day(t.at)] = (cancelled[day(t.at)] || 0) + 1;
      }
    }
    res.json({
      totals: {
        workers: workers.length, customers: customers.length, bookings: bookings.length,
        completed: bookings.filter(b => b.status === 'Completed').length, active: bookings.filter(b => live(b.status)).length,
        cancelled: bookings.filter(b => b.status === 'Cancelled').length, openComplaints: tickets.filter(t => open(t.status)).length,
        paid: [...paidByBooking.values()].reduce((s, v) => s + v, 0)
      },
      bookingStatus: count(bookings, b => b.status),
      serviceMix: count(bookings, b => b.service?.name || 'Unknown'),
      trend: days.map(d => ({date: d, created: created[d] || 0, completed: done[d] || 0, cancelled: cancelled[d] || 0})),
      workers: workerRows, customers: customerRows,
      generatedAt: new Date().toISOString()
    });
  }));

  // ---------- AGENT: full detail ----------
  app.get('/api/agent/insights/:kind/:id', role('agent'), active, wrap(async (req, res) => {
    const kind = req.params.kind; id(req.params.id);
    if (!['worker', 'customer'].includes(kind)) fail('Unknown record kind', 404);
    let profile, userId, bookingFilter, extra = {};
    if (kind === 'worker') {
      profile = await Worker.findById(req.params.id).populate('user', person).lean();
      if (!profile) fail('Worker not found', 404);
      userId = sid(profile.user); bookingFilter = {worker: profile._id};
    } else {
      profile = await User.findOne({_id: req.params.id, role: 'customer'}).select(person).lean();
      if (!profile) fail('Customer not found', 404);
      userId = sid(profile); bookingFilter = {customer: profile._id};
      extra.addresses = await Address.find({user: profile._id}).lean();
    }
    const bookings = await Booking.find(bookingFilter).populate(bookingPopulate).sort({createdAt: -1}).lean();
    const ids = bookings.map(b => b._id);
    const [reviews, transactions, complaints, notes, remarks] = await Promise.all([
      Review.find(kind === 'worker' ? {worker: profile._id} : {customer: profile._id}).populate('customer', 'name').populate({path: 'booking', select: 'date service', populate: {path: 'service', select: 'name'}}).sort({createdAt: -1}).lean(),
      Transaction.find({booking: {$in: ids}}).lean(),
      Support.find({$or: [{user: userId}, {booking: {$in: ids}}]}).populate('user', 'name role').select('-attachments').sort({updatedAt: -1}).lean(),
      AgentNote.find({booking: {$in: ids}}).populate('agent', 'name').sort({createdAt: -1}).lean(),
      kind === 'worker' ? WorkerRemark.find({worker: userId}).sort({createdAt: -1}).lean() : []
    ]);
    const paidByBooking = new Map();
    for (const t of transactions) if (t.status === 'Paid') paidByBooking.set(sid(t.booking), (paidByBooking.get(sid(t.booking)) || 0) + (t.amount || 0));

    const activity = [
      {at: profile.createdAt, type: 'account', title: 'Account registered', text: kind === 'worker' ? (profile.skill || '') : ''},
      ...(kind === 'worker' && profile.approvedAt ? [{at: profile.approvedAt, type: 'account', title: 'Worker approved', text: ''}] : []),
      ...bookingEvents(bookings),
      ...reviews.map(r => ({at: r.createdAt, type: 'review', title: '★ ' + r.rating + ' review', text: r.text || ''})),
      ...transactions.map(t => ({at: t.updatedAt || t.createdAt, type: 'payment', title: 'Payment ₹' + (t.amount || 0) + ' · ' + t.status, text: t.method})),
      ...complaints.map(t => ({at: t.createdAt, type: 'complaint', title: 'Complaint: ' + (t.subject || 'Support ticket'), text: t.status + ' · ' + t.priority, ref: sid(t)})),
      ...notes.map(n => ({at: n.createdAt, type: 'note', title: 'Agent ' + (n.agent?.name || '') + ' · ' + n.method + ' (' + n.party + ')', text: n.text})),
      ...remarks.map(n => ({at: n.createdAt, type: 'remark', title: 'Worker remark', text: n.text}))
    ].filter(e => e.at).sort((a, b) => new Date(b.at) - new Date(a.at));

    const serviceMix = count(bookings, b => b.service?.name || 'Unknown');
    res.json({
      kind, profile, ...extra,
      stats: bookingStats(bookings, paidByBooking),
      bookings: bookings.map(b => ({...b, paid: paidByBooking.get(sid(b)) || 0})),
      bookingStatus: count(bookings, b => b.status), serviceMix,
      reviews, transactions, complaints: complaints.map(c => ({...c, messages: (c.messages || []).length})), notes, remarks, activity
    });
  }));

  // ---------- ADMIN: dashboard drill-down ----------
  app.get('/api/admin/drilldown', role('admin'), active, wrap(async (req, res) => {
    const key = String(req.query.key || ''), value = String(req.query.value || '').slice(0, 120);
    const bookings = f => Booking.find(f).populate(bookingPopulate).sort({createdAt: -1}).lean();
    const workers = async f => {
      const rows = await Worker.find(f).populate('user', person).sort({createdAt: -1}).lean();
      return rows;
    };
    let type, title, items;
    switch (key) {
      case 'customers': type = 'customer'; title = 'All customers'; items = await User.find({role: 'customer'}).select(person).sort({createdAt: -1}).lean(); break;
      case 'workers': type = 'worker'; title = 'Registered workers'; items = await workers({}); break;
      case 'pending': type = 'worker'; title = 'Pending approvals'; items = await workers({approvalStatus: 'pending'}); break;
      case 'approved': type = 'worker'; title = 'Approved workers'; items = await workers({isApproved: true}); break;
      case 'available': type = 'worker'; title = 'Available workers'; items = await workers({isApproved: true, availability: 'available'}); break;
      case 'rejected': type = 'worker'; title = 'Rejected workers'; items = await workers({approvalStatus: 'rejected'}); break;
      case 'suspended': type = 'user'; title = 'Suspended accounts'; items = await User.find({accountStatus: 'suspended'}).select(person).sort({createdAt: -1}).lean(); break;
      case 'bookings': type = 'booking'; title = 'All bookings'; items = await bookings({}); break;
      case 'active': type = 'booking'; title = 'Active bookings'; items = await bookings({status: {$nin: ['Completed', 'Cancelled']}}); break;
      case 'completed': type = 'booking'; title = 'Completed jobs'; items = await bookings({status: 'Completed'}); break;
      case 'cancelled': type = 'booking'; title = 'Cancelled bookings'; items = await bookings({status: 'Cancelled'}); break;
      case 'status': type = 'booking'; title = 'Bookings · ' + value; items = await bookings({status: value}); break;
      case 'date': type = 'booking'; title = 'Bookings on ' + value; items = await bookings({date: value}); break;
      case 'service': {
        type = 'booking'; title = 'Bookings · ' + value;
        items = (await bookings({})).filter(b => (b.service?.name || 'Unknown') === value); break;
      }
      case 'revenue':
        type = 'payment'; title = 'Recorded revenue (paid)';
        items = await Transaction.find({status: 'Paid'}).populate('customer', personLite).populate({path: 'worker', populate: {path: 'user', select: personLite}}).populate({path: 'booking', populate: {path: 'service', select: 'name'}}).sort({createdAt: -1}).lean(); break;
      case 'support': type = 'ticket'; title = 'Open support tickets'; items = await Support.find({status: {$nin: ['Resolved', 'Closed']}}).populate('user', personLite).select('-attachments').sort({updatedAt: -1}).lean(); break;
      default: fail('Unknown metric', 404);
    }
    res.json({key, value, type, title, total: items.length, items: items.slice(0, 500)});
  }));
}
