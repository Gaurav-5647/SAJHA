import crypto from 'node:crypto';
import {Payment,Ledger,Booking,Worker,Transaction,Support,User,Notification} from './models.js';

/* ------------------------------------------------------------------ *
 *  SAJHA payment rules (percent of the total booking amount)
 *   agent 3%  | admin 7%  | visiting charge 10% (always goes to worker)
 *   remaining 80% = "work portion": worker earns it only if the work
 *   was done. Agent can refund any part of it (0..80%) to the customer.
 *  Customer/worker APIs NEVER expose these percentages.
 * ------------------------------------------------------------------ */
export const SPLIT={agent:3,admin:7,visit:10};
export const COMPLAINT_MIN=15;   // complaint window after completion
export const SETTLE_MIN=30;      // everything must be settled within this
const MIN=60000;
export const toPaise=r=>Math.round(Number(r)*100);
export const toRupees=p=>Math.round(p)/100;

export function computeSplit(total){
 const agent=Math.round(total*SPLIT.agent/100),admin=Math.round(total*SPLIT.admin/100),visit=Math.round(total*SPLIT.visit/100);
 return {agent,admin,visit,work:total-agent-admin-visit};
}
export function settlementAmounts(total,refund=0){
 const s=computeSplit(total);
 if(!Number.isInteger(refund)||refund<0||refund>s.work)throw Object.assign(new Error('Refund must be between 0 and the work portion of this booking'),{status:400});
 return {...s,refund,worker:s.visit+s.work-refund};
}

/* ----------------------------- Cashfree ---------------------------- */
const cfBase=()=>clean(process.env.CASHFREE_ENV).toLowerCase()==='production'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg';
// Trim spaces/quotes that are easy to paste into .env by accident
const clean=v=>String(v||'').trim().replace(/^['"]|['"]$/g,'').trim();
export const cashfree={
 configured:()=>!!(clean(process.env.CASHFREE_APP_ID)&&clean(process.env.CASHFREE_SECRET_KEY)),
 mode:()=>clean(process.env.CASHFREE_ENV).toLowerCase()==='production'?'production':'sandbox',
 async request(method,path,body){
  if(!cashfree.configured())throw Object.assign(new Error('Online payment is not configured yet. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.'),{status:503});
  const r=await fetch(cfBase()+path,{method,headers:{'Content-Type':'application/json','x-client-id':clean(process.env.CASHFREE_APP_ID),'x-client-secret':clean(process.env.CASHFREE_SECRET_KEY),'x-api-version':process.env.CASHFREE_API_VERSION||'2023-08-01'},body:body?JSON.stringify(body):undefined});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){
   console.error(`[Cashfree] ${method} ${path} -> ${r.status} ${d.type||''} ${d.code||''} ${d.message||''} (mode=${cashfree.mode()}, appId=${clean(process.env.CASHFREE_APP_ID).slice(0,6)}…)`);
   const hint=r.status===401||r.status===403?' Check that CASHFREE_APP_ID / CASHFREE_SECRET_KEY are correct, belong to the same mode as CASHFREE_ENV (sandbox keys need CASHFREE_ENV=sandbox), and that this server IP is whitelisted in Cashfree for production. Restart the server after editing .env.':'';
   throw Object.assign(new Error((d.message||'Cashfree request failed')+hint),{status:502});
  }
  return d;
 },
 verifySignature(raw,signature,timestamp){
  const secret=clean(process.env.CASHFREE_SECRET_KEY);if(!secret||!signature||!timestamp)return false;
  const expected=crypto.createHmac('sha256',secret).update(String(timestamp)+raw).digest('base64');
  const a=Buffer.from(expected),b=Buffer.from(String(signature));
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
 }
};

const payoutConfig=()=>({id:clean(process.env.CASHFREE_PAYOUT_APP_ID),secret:clean(process.env.CASHFREE_PAYOUT_SECRET_KEY),base:clean(process.env.CASHFREE_PAYOUT_ENV).toLowerCase()==='production'?'https://api.cashfree.com/payout':'https://sandbox.cashfree.com/payout',version:clean(process.env.CASHFREE_PAYOUT_API_VERSION)||'2024-01-01'});
async function cashfreePayout(method,path,body){
 const c=payoutConfig();if(!c.id||!c.secret)throw Object.assign(new Error('Cashfree Payouts is not configured. Add the separate Payouts App ID and Secret Key to backend/.env.'),{status:503});
 const r=await fetch(c.base+path,{method,headers:{'Content-Type':'application/json','x-client-id':c.id,'x-client-secret':c.secret,'x-api-version':c.version,'x-request-id':crypto.randomUUID()},body:body?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(data.message||data.status_description||data.status_code||'Cashfree payout request failed ('+r.status+')'),{status:502});return data;
}

/* ---------------------------- helpers ------------------------------ */
const notify=(user,text,type='information')=>Notification.create({user,text,type});
async function notifyRole(role,text){const us=await User.find({role,accountStatus:'active'}).select('_id');if(us.length)await Notification.insertMany(us.map(u=>({user:u._id,text,type:'information'})));}
const inr=p=>'₹'+toRupees(p).toLocaleString('en-IN');

/* Views: what each role is allowed to see */
export const customerView=p=>({booking:p.booking,status:({Created:'Awaiting payment',Failed:'Payment failed',Held:'Payment received',Disputed:'Under review',Settling:'Processing',PendingPayout:'Awaiting admin payout',Settled:'Completed',Refunded:'Refunded'})[p.status]||p.status,state:p.status,paid:!['Created','Failed'].includes(p.status),amount:toRupees(p.total),paidAt:p.paidAt,complaintDeadline:p.complaintDeadline,refundAmount:['PendingPayout','Settled','Refunded'].includes(p.status)?toRupees(p.refundAmount):undefined,refundStatus:p.refundAmount?p.refund?.status||'Initiated':undefined});
export const workerView=p=>({booking:p.booking,status:({Created:'Awaiting customer payment',Failed:'Awaiting customer payment',Held:'Customer payment received',Disputed:'Under review',Settling:'Processing',PendingPayout:'Awaiting admin payout',Settled:'Paid out',Refunded:'Paid out'})[p.status]||p.status,state:p.status,paid:!['Created','Failed'].includes(p.status),payout:['Settled','Refunded'].includes(p.status)&&p.split?toRupees(p.split.worker):undefined});
export const staffView=p=>{const s=computeSplit(p.total);return {...p.toObject?p.toObject():p,totalRupees:toRupees(p.total),breakdown:{agent:toRupees(s.agent),admin:toRupees(s.admin),visiting:toRupees(s.visit),workPortion:toRupees(s.work),maxRefund:toRupees(s.work)},percent:SPLIT}};

/* ---------------------------- state changes ------------------------ */
export async function markPaid(p,cfPaymentId){
 const u=await Payment.findOneAndUpdate({_id:p._id,status:{$in:['Created','Failed']}},{status:'Held',paidAt:new Date(),cfPaymentId},{new:true});
 if(!u)return p;
 await Booking.updateOne({_id:u.booking},{paymentStatus:'Secured'});
 const w=await Worker.findById(u.worker);
 await Promise.all([notifyRole('agent',`Payment confirmed for booking ${String(u.booking).slice(-6).toUpperCase()} (${inr(u.total)})`),w&&notify(w.user,`Customer payment received for booking ${String(u.booking).slice(-6).toUpperCase()}. It is recorded by SAJHA; admin will handle manual transfers after completion and complaint review.`),notify(u.customer,`Payment of ${inr(u.total)} received and recorded.`)]);
 return u;
}

/** Reconcile a customer payment with Cashfree before allowing another attempt. */
async function syncGatewayPayment(p){
 if(!p||!['Created','Failed'].includes(p.status))return p;
 const order=await cashfree.request('GET',`/orders/${p.cfOrderId}`);
 if(order.order_status==='PAID'&&Math.round(Number(order.order_amount)*100)===p.total){
  return await markPaid(p,'')||await Payment.findById(p._id);
 }
 // Only permit a fresh checkout after Cashfree confirms the previous order is terminal.
 if(['FAILED','EXPIRED','TERMINATED','CANCELLED'].includes(order.order_status)){
  await Payment.updateOne({_id:p._id,status:{$in:['Created','Failed']}},{status:'Failed'});
 }else if(p.status==='Failed'){
  await Payment.updateOne({_id:p._id,status:'Failed'},{status:'Created'});
 }
 return await Payment.findById(p._id);
}

/** Called when the worker marks a booking Completed: starts the 15/30 minute clocks. */
export async function onBookingCompleted(booking){
 const now=Date.now();
 await Payment.updateOne({booking:booking._id,status:{$in:['Held','Disputed']},completedAt:{$exists:false}},{completedAt:new Date(now),complaintDeadline:new Date(now+COMPLAINT_MIN*MIN),settleBy:new Date(now+SETTLE_MIN*MIN)});
}

/** Called when a customer files a complaint linked to a booking. */
export async function onComplaint(ticket,booking,user){
 if(String(booking.customer)!==String(user._id))return false;
 const p=await Payment.findOne({booking:booking._id});
 if(!p||!['Held','Disputed'].includes(p.status))return false;
 if(p.complaintDeadline&&Date.now()>p.complaintDeadline.getTime())return false;   // window over
 await Payment.updateOne({_id:p._id,status:{$in:['Held','Disputed']}},{status:'Disputed',complaint:ticket._id});
 await Promise.all([notifyRole('agent',`Complaint on a paid booking ${String(booking._id).slice(-6).toUpperCase()}: decide the refund within ${SETTLE_MIN} min of completion.`),notifyRole('admin',`Payment on hold because of a complaint (booking ${String(booking._id).slice(-6).toUpperCase()}).`)]);
 return true;
}

/** Cancelled after payment -> refund everything. */
export async function onBookingCancelled(booking){
 const p=await Payment.findOneAndUpdate({booking:booking._id,status:{$in:['Held','Disputed']}},{status:'Settling',refundAmount:0},{new:true});
 if(!p)return;
 p.refundAmount=p.total;p.cancelRefund=true;await p.save();
 await fullRefund(p);
}
async function startRefund(p,amountPaise,note){
 if(p.refund?.cfRefundId)return;                      // already requested (idempotent)
 const refundId='RF_'+String(p._id);
 const r=await cashfree.request('POST',`/orders/${p.cfOrderId}/refunds`,{refund_amount:toRupees(amountPaise),refund_id:refundId,refund_note:note||'SAJHA refund',refund_speed:'STANDARD'});
 p.refund={cfRefundId:r.refund_id||refundId,status:r.refund_status||'PENDING',requestedAt:new Date()};
 await p.save();
}
async function fullRefund(p){
 try{await startRefund(p,p.total,'Booking cancelled');}catch(e){p.settleError=e.message;await p.save();return;}
 p.status='Refunded';p.settledAt=new Date();p.split={agent:0,admin:0,visit:0,work:0,worker:0,refund:p.total};await p.save();
 await Booking.updateOne({_id:p.booking},{paymentStatus:'Refunded'});
 await notify(p.customer,`Booking cancelled. Your payment of ${inr(p.total)} is being refunded.`);
}

/** Final money movement. Payment must already be claimed as 'Settling'. Safe to retry. */
export async function settle(p){
 const a=settlementAmounts(p.total,p.refundAmount||0);
 if(a.refund>0){try{await startRefund(p,a.refund,'SAJHA service adjustment')}catch(e){p.settleError=e.message;await p.save();return false}}
 const agentUser=p.decision?.agent||null;
 const entries=[['worker',a.worker,(await Worker.findById(p.worker))?.user],['agent',a.agent,agentUser],['admin',a.admin,null]];
 for(const [party,amount,user] of entries)if(amount>0)await Ledger.updateOne({payment:p._id,party},{$setOnInsert:{payment:p._id,booking:p.booking,party,user,amount,status:'Pending',note:''}},{upsert:true});
 const w=await Worker.findById(p.worker);
 await Transaction.findOneAndUpdate({booking:p.booking},{$set:{amount:toRupees(a.worker),method:'Cashfree',status:'Pending',worker:p.worker,customer:p.customer}},{upsert:true});
 p.split={agent:a.agent,admin:a.admin,visit:a.visit,work:a.work,worker:a.worker,refund:a.refund};
 p.status=a.refund===p.total?'Refunded':'PendingPayout';p.settledAt=new Date();p.settleError=undefined;await p.save();
 await Booking.updateOne({_id:p.booking},{paymentStatus:a.refund>0?'Refund initiated':'Awaiting admin payout'});
 const code=String(p.booking).slice(-6).toUpperCase();
 await Promise.all([notify(p.customer,a.refund>0?`Booking ${code}: ${inr(a.refund)} will be refunded to your original payment method.`:`Booking ${code}: payment completed. Thank you!`),w&&notify(w.user,`Booking ${code}: ${inr(a.worker)} is ready for manual payout by admin.`)]);
 return true;
}

/* Agent/admin decision for a disputed payment */
export async function decide(paymentId,refundRupees,note,user){
 const p0=await Payment.findById(paymentId);if(!p0)throw Object.assign(new Error('Payment not found'),{status:404});
 if(p0.status!=='Disputed')throw Object.assign(new Error('Only payments on hold because of a complaint can be decided'),{status:409});
 const refund=toPaise(refundRupees);settlementAmounts(p0.total,refund); // validates range
 const p=await Payment.findOneAndUpdate({_id:p0._id,status:'Disputed'},{status:'Settling',refundAmount:refund,decision:{agent:user.role==='agent'?user._id:undefined,decidedBy:user.role,note:String(note||'').slice(0,1000),at:new Date()}},{new:true});
 if(!p)throw Object.assign(new Error('Already decided'),{status:409});
 await settle(p);return p;
}

/* Periodic sweep: auto-settle after 15 min, escalate, retry failures */
export async function sweep(now=new Date()){
 const out={settled:0,escalated:0,retried:0};
 const due=await Payment.find({status:'Held',complaintDeadline:{$lte:now}});
 for(const d of due){const p=await Payment.findOneAndUpdate({_id:d._id,status:'Held'},{status:'Settling',refundAmount:0},{new:true});if(p&&await settle(p))out.settled++}
 const payoutLate=await Payment.find({status:'PendingPayout',settleBy:{$lte:now},escalated:false});for(const d of payoutLate){const p=await Payment.findOneAndUpdate({_id:d._id,status:'PendingPayout',escalated:false},{escalated:true},{new:true});if(p){await notifyRole('admin',`URGENT: manual payout is overdue for booking ${String(p.booking).slice(-6).toUpperCase()}. Record the worker, agent and admin transfers in Online Payments.`);out.escalated++}}
 const late=await Payment.find({status:'Disputed',settleBy:{$lte:now},escalated:false});
 for(const d of late){const p=await Payment.findOneAndUpdate({_id:d._id,escalated:false},{escalated:true},{new:true});if(p){await Promise.all([notifyRole('agent',`URGENT: refund decision overdue for booking ${String(p.booking).slice(-6).toUpperCase()}`),notifyRole('admin',`URGENT: agent has not decided a disputed payment (booking ${String(p.booking).slice(-6).toUpperCase()}). You can decide it from Payments.`)]);out.escalated++}}
 const stuck=await Payment.find({status:'Settling',settleError:{$exists:true,$ne:null}});
 for(const p of stuck){if(p.cancelRefund){await fullRefund(p)}else if(await settle(p))out.retried++}
 return out;
}
let timer;
export function startSweep(ms=30000){if(timer)return;timer=setInterval(()=>sweep().catch(e=>console.error('Payment sweep failed:',e.message)),ms);timer.unref?.();sweep().catch(()=>{})}

/* ------------------------------ routes ------------------------------ */
// Public (no cookie): Cashfree calls this. Signature-verified against the raw body.
export function paymentWebhook(app,{wrap}){
 app.post('/api/payments/webhook',wrap(async(req,res)=>{
  const raw=req.rawBody?req.rawBody.toString('utf8'):'';
  if(!cashfree.verifySignature(raw,req.get('x-webhook-signature'),req.get('x-webhook-timestamp')))return res.status(401).json({message:'Invalid signature'});
  const {type,data}=req.body||{};const orderId=data?.order?.order_id||data?.refund?.order_id;
  const p=orderId&&await Payment.findOne({cfOrderId:orderId});
  if(!p)return res.json({ok:true});
  if(type==='PAYMENT_SUCCESS_WEBHOOK'&&Math.round(Number(data.order?.order_amount)*100)===p.total)await markPaid(p,String(data.payment?.cf_payment_id||''));
  else if(type==='PAYMENT_FAILED_WEBHOOK'&&p.status==='Created')await Payment.updateOne({_id:p._id,status:'Created'},{status:'Failed'});
  else if(type==='REFUND_STATUS_WEBHOOK'&&data.refund?.refund_status)await Payment.updateOne({_id:p._id},{'refund.status':data.refund.refund_status});
  res.json({ok:true});
 }));
}

export function paymentRoutes(app,{wrap,role,active,fail,id,txt,audit}){
 const ownBooking=async(req,bid)=>{const b=await Booking.findById(id(bid));if(!b)fail('Booking not found',404);if(String(b.customer)!==String(req.user._id))fail('Access denied',403);return b};

 // Customer: start a Cashfree order for an accepted booking
 app.post('/api/payments/create-order',role('customer'),active,wrap(async(req,res)=>{
  const b=await ownBooking(req,req.body.booking);
  if(!['Accepted','On The Way','Reached','In Progress'].includes(b.status))fail('You can pay once the worker has accepted the booking');
  const total=toPaise(b.amount);if(!(total>0))fail('This booking has no price set. Please contact support.');
  let p=await Payment.findOne({booking:b._id});
  if(p&&!['Created','Failed'].includes(p.status))fail('This booking is already paid');
  if(p){
   try{p=await syncGatewayPayment(p)}catch(e){fail('Payment confirmation is pending. Check payment status before trying again.',409)}
   if(p.status==='Held'||!['Created','Failed'].includes(p.status))fail('This booking is already paid');
   if(p.status==='Created')fail('Payment confirmation is pending. Check payment status before trying again.',409);
  }
  const orderId=`SJ_${b._id}_${Date.now().toString(36)}`;
  const base=(process.env.APP_URL||'http://localhost:5000').replace(/\/$/,'');
  const order=await cashfree.request('POST','/orders',{order_id:orderId,order_amount:toRupees(total),order_currency:'INR',customer_details:{customer_id:String(req.user._id),customer_name:req.user.name,customer_phone:req.user.phone,customer_email:req.user.email},order_meta:{return_url:`${base}/bookings?cf_order=${orderId}`,...(base.startsWith('https://')?{notify_url:`${base}/api/payments/webhook`}:{})},order_note:'SAJHA booking '+String(b._id).slice(-6).toUpperCase()});
  if(!order.payment_session_id)fail('Could not start payment. Try again.',502);
  if(p)await Payment.updateOne({_id:p._id},{cfOrderId:orderId,total,status:'Created'});
  else await Payment.create({booking:b._id,customer:b.customer,worker:b.worker,total,cfOrderId:orderId});
  res.json({orderId,paymentSessionId:order.payment_session_id,mode:cashfree.mode(),amount:toRupees(total)});
 }));

 // Customer: confirm after returning from Cashfree (webhook may also do this)
 app.post('/api/payments/verify',role('customer'),active,wrap(async(req,res)=>{
  const orderId=txt(req.body.orderId,80);const p=await Payment.findOne({cfOrderId:orderId,customer:req.user._id});
  if(!p)fail('Payment not found',404);
  res.json(customerView(await syncGatewayPayment(p)));
 }));

 // Customer: check the latest order from a booking card. This is safe to repeat.
 app.post('/api/payments/check',role('customer'),active,wrap(async(req,res)=>{
  const b=await ownBooking(req,req.body.booking);const p=await Payment.findOne({booking:b._id,customer:req.user._id});
  if(!p)fail('Payment not found',404);
  res.json(customerView(await syncGatewayPayment(p)));
 }));

 // Customer / worker: sanitized payment state (no percentages, no split)
 app.get('/api/payments/mine',role('customer','worker'),wrap(async(req,res)=>{
  if(req.user.role==='customer'){
   const rows=await Payment.find({customer:req.user._id}).sort({createdAt:-1}).limit(200);
   const synced=await Promise.all(rows.map(p=>syncGatewayPayment(p).catch(()=>p)));
   return res.json(synced.map(customerView));
  }
  const w=await Worker.findOne({user:req.user._id});if(!w)return res.json([]);
  res.json((await Payment.find({worker:w._id}).sort({createdAt:-1}).limit(200)).map(workerView));
 }));

 // Agent: list + decide
 const staffPaymentView=async p=>({...staffView(p),ledger:await Ledger.find({payment:p._id}).select('party amount status note user cashfreeTransferId cashfreeStatus transferMode payoutRequestedAt payoutPaidAt')});
 app.get('/api/agent/payments',role('agent'),active,wrap(async(req,res)=>{
  const f={};if(txt(req.query.status,20))f.status=txt(req.query.status,20);
  const rows=await Payment.find(f).populate('customer','name phone').populate({path:'worker',populate:{path:'user',select:'name phone'}}).populate('complaint','subject status').populate({path:'booking',populate:{path:'service',select:'name'}}).sort({createdAt:-1}).limit(100);
  res.json(await Promise.all(rows.map(staffPaymentView)));
 }));
 app.post('/api/agent/payments/:id/decide',role('agent','admin'),active,wrap(async(req,res)=>{
  const refund=Number(req.body.refundAmount);if(!Number.isFinite(refund)||refund<0)fail('Enter the refund amount for the customer (0 if none)');
  const p=await decide(id(req.params.id),refund,txt(req.body.note,1000),req.user);
  await audit(req,'Payment decision','payment',p._id,`refund ${toRupees(p.refundAmount)}`);
  res.json(await staffPaymentView(p));
 }));

 // Workers and agents see only payouts assigned to their own account.
 app.get('/api/payments/payout-history',role('worker','agent'),active,wrap(async(req,res)=>{
  const rows=await Ledger.find({user:req.user._id,party:req.user.role}).populate({path:'booking',populate:{path:'service',select:'name'}}).sort({createdAt:-1}).limit(200);
  res.json(rows.map(x=>({id:x._id,party:x.party,amount:toRupees(x.amount),status:x.status,service:x.booking?.service?.name||'Service',bookingId:String(x.booking?._id||x.booking||''),transferId:x.cashfreeTransferId||'',transferReference:x.note||'',transferMode:x.transferMode||'',paidAt:x.payoutPaidAt||null,createdAt:x.createdAt})));
 }));
 app.get('/api/admin/payout-recipients',role('admin'),active,wrap(async(req,res)=>res.json(await User.find({role:'agent',accountStatus:'active'}).select('_id name phone').sort({name:1}))));
 // Admin explicitly initiates a Cashfree Payout V2 transfer for a worker or agent.
 app.post('/api/admin/payments/:id/payouts',role('admin'),active,wrap(async(req,res)=>{
  const p=await Payment.findById(id(req.params.id));if(!p)fail('Payment not found',404);
  if(p.status!=='PendingPayout')fail('Payment is not ready for payout',409);
  const party=txt(req.body.party,10);if(!['worker','agent','admin'].includes(party))fail('Choose a payout recipient');
  const row=await Ledger.findOne({payment:p._id,party});if(!row)fail('No payout entry exists for this party',404);
  // Keep the existing reconciled-transfer path for payments made outside Cashfree.
  const manualReference=txt(req.body.reference,120);if(manualReference){if(row.status!=='Pending')fail('This payout is already processing or complete',409);row.status='Paid';row.note=manualReference;row.payoutPaidAt=new Date();await row.save();if(party==='worker')await Transaction.updateOne({booking:p.booking},{status:'Paid'});await audit(req,'Manual payout recorded','payment',p._id,party+': '+manualReference);const left=await Ledger.countDocuments({payment:p._id,status:{$in:['Pending','Processing','Failed']}});if(!left){p.status='Settled';await p.save();await Booking.updateOne({_id:p.booking},{paymentStatus:'Paid'});}return res.json({ok:true,pending:left,status:p.status});}
  if(party==='admin'){
   if(row.status!=='Pending')fail('Admin share is already recorded',409);
   row.status='Paid';row.note='Retained by SAJHA';row.payoutPaidAt=new Date();await row.save();
  }else{
   if(!['Pending','Failed'].includes(row.status))fail('This payout is already processing or complete',409);
   const recipientId=party==='worker'?(await Worker.findById(p.worker))?.user:req.body.recipientId;
   const recipient=recipientId&&await User.findOne({_id:id(recipientId),role:party,accountStatus:'active'});if(!recipient)fail('Choose a valid active '+party+' account',400);
   const amount=toRupees(row.amount);if(amount<1)fail('Cashfree Payouts requires a minimum transfer of ₹1.00');
   const mode=txt(req.body.transferMode,20).toLowerCase();const name=txt(req.body.beneficiaryName,100).replace(/[^a-zA-Z ]/g,' ').trim();if(!name)fail('Enter the beneficiary name');
   let instrument;
   if(mode==='upi'){const vpa=txt(req.body.vpa,100).toLowerCase();if(!/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/.test(vpa))fail('Enter a valid UPI ID');instrument={vpa};}
   else if(['banktransfer','imps','neft','rtgs'].includes(mode)){const account=txt(req.body.bankAccountNumber,34).replace(/\s/g,'');const ifsc=txt(req.body.bankIfsc,11).toUpperCase();if(!/^[a-zA-Z0-9]{6,34}$/.test(account)||! /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))fail('Enter a valid bank account number and IFSC');instrument={bank_account_number:account,bank_ifsc:ifsc};}
   else fail('Choose UPI, IMPS, NEFT, RTGS, or Bank transfer');
   const transferId=('SJ_'+String(row._id)+'_'+Date.now().toString(36)).slice(0,40);
   const payload={transfer_id:transferId,transfer_amount:amount,transfer_currency:'INR',transfer_mode:mode,transfer_remarks:`SAJHA ${party} payout booking ${String(p.booking).slice(-6)}`,beneficiary_details:{beneficiary_name:name,beneficiary_instrument_details:instrument}};
   // Reserve before calling Cashfree so repeated clicks cannot submit duplicate transfers.
   row.status='Processing';row.user=recipient._id;row.cashfreeTransferId=transferId;row.transferMode=mode;row.payoutRequestedAt=new Date();row.cashfreeStatus='REQUESTING';row.note='Cashfree transfer submitted';await row.save();
   let result;try{result=await cashfreePayout('POST','/transfers',payload)}catch(e){if(e.status===502){row.cashfreeStatus='CHECK_STATUS';await row.save();fail('Cashfree response is uncertain. Use Check Status before retrying: '+e.message,502)}row.status='Failed';row.cashfreeStatus='FAILED';row.note='Cashfree request failed: '+e.message;await row.save();throw e;}
   row.cashfreeStatus=String(result.status||result.status_code||'RECEIVED').toUpperCase();row.note=`Cashfree ${row.cashfreeStatus}${result.transfer_utr?' · UTR '+result.transfer_utr:''}`;
   if(['SUCCESS','SUCCESSFUL','COMPLETED'].includes(row.cashfreeStatus)){row.status='Paid';row.payoutPaidAt=new Date();if(result.transfer_utr)row.note='UTR '+result.transfer_utr;}
   else if(['FAILED','REJECTED','REVERSED','MANUALLY_REJECTED'].includes(row.cashfreeStatus))row.status='Failed';
   await row.save();await notify(recipient._id,`SAJHA payout for booking ${String(p.booking).slice(-6).toUpperCase()}: ₹${amount.toLocaleString('en-IN')} · ${row.status}.`,'information');
  }
  await audit(req,party==='admin'?'Admin share retained':'Cashfree payout initiated','payment',p._id,party+': '+row.status+' '+(row.cashfreeTransferId||''));
  const pending=await Ledger.countDocuments({payment:p._id,status:{$in:['Pending','Processing','Failed']}});
  if(!pending&&p.status==='PendingPayout'){p.status='Settled';await p.save();await Booking.updateOne({_id:p.booking},{paymentStatus:'Paid'});}
  res.json({ok:true,pending,status:p.status,payout:{status:row.status,cashfreeStatus:row.cashfreeStatus,transferId:row.cashfreeTransferId,reference:row.note}});
 }));
 app.post('/api/admin/payouts/:ledgerId/check',role('admin'),active,wrap(async(req,res)=>{
  const row=await Ledger.findById(id(req.params.ledgerId));if(!row||!row.cashfreeTransferId)fail('Cashfree transfer not found',404);
  const result=await cashfreePayout('GET','/transfers?transfer_id='+encodeURIComponent(row.cashfreeTransferId));const state=String(result.status||result.status_code||'PENDING').toUpperCase();row.cashfreeStatus=state;
  if(['SUCCESS','SUCCESSFUL','COMPLETED'].includes(state)){row.status='Paid';row.payoutPaidAt=new Date();row.note=result.transfer_utr?'UTR '+result.transfer_utr:'Cashfree transfer successful';}
  else if(['FAILED','REJECTED','REVERSED','MANUALLY_REJECTED'].includes(state)){row.status='Failed';row.note='Cashfree '+state+(result.status_description?': '+result.status_description:'');}
  else{row.status='Processing';row.note='Cashfree '+state;}
  await row.save();const pending=await Ledger.countDocuments({payment:row.payment,status:{$in:['Pending','Processing','Failed']}});const p=await Payment.findById(row.payment);if(!pending&&p?.status==='PendingPayout'){p.status='Settled';await p.save();await Booking.updateOne({_id:p.booking},{paymentStatus:'Paid'});}
  res.json({status:row.status,cashfreeStatus:state,reference:row.note,pending});
 }));
 // Admin: ledger summary
 app.get('/api/admin/payment-ledger',role('admin'),active,wrap(async(req,res)=>{
  const rows=await Ledger.aggregate([{$group:{_id:'$party',total:{$sum:'$amount'},count:{$sum:1}}}]);
  const sum=Object.fromEntries(rows.map(r=>[r._id,{total:toRupees(r.total),count:r.count}]));
  const held=await Payment.aggregate([{$match:{status:{$in:['Held','Disputed','Settling','PendingPayout']}}},{$group:{_id:null,total:{$sum:'$total'},count:{$sum:1}}}]);
  res.json({ledger:sum,held:{total:toRupees(held[0]?.total||0),count:held[0]?.count||0},percent:SPLIT,payments:await Promise.all((await Payment.find().sort({createdAt:-1}).limit(100)).map(staffPaymentView))});
 }));
}
