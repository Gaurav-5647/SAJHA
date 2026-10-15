import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import { User, Worker, Booking, Payment, Transaction, Notification } from '../src/models.js';
import { cashfree, completePaidBooking } from '../src/payments.js';
import { canTransition } from '../src/logic.js';

let db, customer, workerUser, worker, stranger;
const secret = 'test-only-signing-secret-not-a-real-cashfree-key';
process.env.JWT_SECRET = 'test-only-jwt-secret-at-least-32-characters';
process.env.CASHFREE_SECRET_KEY = secret;
process.env.CASHFREE_APP_ID = 'test-only-app-id';
process.env.CASHFREE_ENV = 'sandbox';
const cookie = user => 'sajha=' + jwt.sign({ id: user._id, v: 0 }, process.env.JWT_SECRET);

before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: {
    count: 1,
    args: ['--nounixsocket', '--setParameter', 'diagnosticDataCollectionEnabled=false']
  } });
  await mongoose.connect(db.getUri());
  customer = await User.create({ name: 'Customer', email: 'c@example.test', phone: '9000000001', role: 'customer' });
  workerUser = await User.create({ name: 'Worker', email: 'w@example.test', phone: '9000000002', role: 'worker' });
  stranger = await User.create({ name: 'Other', email: 'o@example.test', phone: '9000000003', role: 'customer' });
  worker = await Worker.create({ user: workerUser._id, isApproved: true, approvalStatus: 'approved' });
  await Promise.all(Object.values(mongoose.models).map(m => m.init()));
});
after(async () => { await mongoose.disconnect(); await db?.stop(); });

async function booking(status = 'In Progress') {
  return Booking.create({
    customer: customer._id, worker: worker._id, amount: 100, status,
    timeline: [{ status, at: new Date() }],
    location: { customer: { lat: 25, lng: 85, updatedAt: new Date() } }
  });
}
async function payment(b) {
  return Payment.create({ booking: b._id, customer: customer._id, worker: worker._id, total: 10000, cfOrderId: 'SJ_' + b._id });
}
function webhook(p, amount = 100, valid = true) {
  const body = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: {
    order: { order_id: p.cfOrderId, order_amount: amount },
    payment: { cf_payment_id: 'payment_' + p._id, payment_status: 'SUCCESS' }
  } });
  const timestamp = String(Date.now());
  const signature = crypto.createHmac('sha256', secret).update(timestamp + body).digest('base64');
  return request(app).post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-webhook-timestamp', timestamp)
    .set('x-webhook-signature', valid ? signature : 'invalid')
    .send(body);
}

test('worker completion becomes a payment request, even with the old frontend or env=false', async () => {
  process.env.REQUIRE_PAYMENT_BEFORE_COMPLETE = 'false';
  const b = await booking();
  const beforeCount = (await Worker.findById(worker._id)).completedJobs;
  const r = await request(app).patch(`/api/bookings/${b._id}/status`)
    .set('Cookie', cookie(workerUser)).send({ status: 'Completed' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'Awaiting Payment');
  assert.equal((await Worker.findById(worker._id)).completedJobs, beforeCount);
  assert.equal(await Transaction.countDocuments({ booking: b._id }), 0);
  await completePaidBooking(b._id);
  assert.equal((await Booking.findById(b._id)).status, 'Awaiting Payment');
  assert.equal(canTransition('worker', 'Awaiting Payment', 'Completed'), false);
});

test('customer cannot request completion; other customers cannot pay', async () => {
  const b = await booking();
  const r = await request(app).patch(`/api/bookings/${b._id}/status`)
    .set('Cookie', cookie(customer)).send({ status: 'Completed' });
  assert.equal(r.status, 400);
  const denied = await request(app).post('/api/payments/create-order')
    .set('Cookie', cookie(stranger)).send({ booking: b._id });
  assert.equal(denied.status, 403);
});

test('Pay Now is accepted only after work is finished, with a server price', async () => {
  const b = await booking();
  const r = await request(app).post('/api/payments/create-order')
    .set('Cookie', cookie(customer)).send({ booking: b._id });
  assert.equal(r.status, 400);
  await request(app).patch(`/api/bookings/${b._id}/status`)
    .set('Cookie', cookie(workerUser)).send({ status: 'Awaiting Payment' }).expect(200);
  const original = cashfree.request;
  try {
    cashfree.request = async (method, path, body) => {
      assert.equal(method, 'POST'); assert.equal(path, '/orders');
      assert.equal(body.order_amount, 100);
      return { payment_session_id: 'test_session' };
    };
    const paid = await request(app).post('/api/payments/create-order')
      .set('Cookie', cookie(customer)).send({ booking: b._id, amount: 1 });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.amount, 100);
    assert.equal(paid.body.paymentSessionId, 'test_session');
    assert.equal((await Booking.findById(b._id)).status, 'Awaiting Payment');
  } finally { cashfree.request = original; }
});

test('invalid signature and wrong amount cannot complete a booking', async () => {
  const b = await booking('Awaiting Payment'), p = await payment(b);
  await webhook(p, 100, false).expect(401);
  await webhook(p, 1).expect(200);
  assert.equal((await Booking.findById(b._id)).status, 'Awaiting Payment');
  assert.equal((await Payment.findById(p._id)).status, 'Created');
});

test('verified webhook completes both portals, starts clocks and clears location exactly once', async () => {
  const b = await booking('Awaiting Payment'), p = await payment(b);
  const beforeCount = (await Worker.findById(worker._id)).completedJobs;
  await webhook(p).expect(200);
  const first = await Payment.findById(p._id);
  assert.equal(first.status, 'Held');
  assert.ok(first.completedAt);
  assert.equal(first.complaintDeadline - first.completedAt, 15 * 60000);
  assert.equal(first.settleBy - first.completedAt, 30 * 60000);
  await Promise.all([webhook(p).expect(200), webhook(p).expect(200)]);
  const done = await Booking.findById(b._id).lean();
  assert.equal(done.status, 'Completed');
  assert.equal(done.paymentStatus, 'Secured');
  assert.equal(done.location, undefined);
  assert.equal(done.timeline.filter(t => t.status === 'Completed').length, 1);
  assert.equal((await Worker.findById(worker._id)).completedJobs, beforeCount + 1);
  assert.equal(await Transaction.countDocuments({ booking: b._id }), 1);
  assert.equal((await Payment.findById(p._id)).complaintDeadline.getTime(), first.complaintDeadline.getTime());
  for (const user of [customer, workerUser]) {
    const response = await request(app).get('/api/bookings').set('Cookie', cookie(user));
    assert.equal(response.body.find(x => x._id === String(b._id)).status, 'Completed');
  }
});

test('return verification completes the job if the webhook was delayed', async () => {
  const b = await booking('Awaiting Payment'), p = await payment(b);
  const original = cashfree.request;
  try {
    cashfree.request = async () => ({ order_status: 'PAID', order_amount: 100 });
    const r = await request(app).post('/api/payments/verify')
      .set('Cookie', cookie(customer)).send({ orderId: p.cfOrderId });
    assert.equal(r.status, 200); assert.equal(r.body.paid, true);
    assert.ok(r.body.complaintDeadline);
    assert.equal((await Booking.findById(b._id)).status, 'Completed');
  } finally { cashfree.request = original; }
});

test('an earlier verified payment completes only after the worker requests payment', async () => {
  const b = await booking(), p = await payment(b);
  await webhook(p).expect(200);
  assert.equal((await Booking.findById(b._id)).status, 'In Progress');
  assert.equal((await Payment.findById(p._id)).complaintDeadline, undefined);
  const r = await request(app).patch(`/api/bookings/${b._id}/status`)
    .set('Cookie', cookie(workerUser)).send({ status: 'Awaiting Payment' });
  assert.equal(r.status, 200); assert.equal(r.body.status, 'Completed');
});

test('a dismissed checkout can resume the same ACTIVE order without creating another one', async () => {
  const b = await booking('Awaiting Payment'), p = await payment(b);
  const original = cashfree.request;
  try {
    cashfree.request = async method => {
      assert.equal(method, 'GET');
      return { order_status: 'ACTIVE', payment_session_id: 'resume_session' };
    };
    const r = await request(app).post('/api/payments/create-order')
      .set('Cookie', cookie(customer)).send({ booking: b._id });
    assert.equal(r.status, 200);
    assert.equal(r.body.orderId, p.cfOrderId);
    assert.equal(r.body.paymentSessionId, 'resume_session');
  } finally { cashfree.request = original; }
});
