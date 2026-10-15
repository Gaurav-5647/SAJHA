// Admin CSV reports: every report exports ALL records with ALL meaningful columns.
// - Nested records (customer, worker, service, address...) are flattened into readable columns
// - UTF-8 BOM so Excel shows Hindi/regional text correctly
// - Dates in IST, money in rupees (online payments are stored in paise)
// - Spreadsheet formula injection is neutralised without damaging phone numbers / numbers
import {User,Worker,Booking,Review,Support,Service,Address,Audit,SkillRequest,Transaction,Payment,Ledger,WorkerRemark} from './models.js';

const IST=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
export const dt=v=>{if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);const p=Object.fromEntries(IST.formatToParts(d).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day} ${p.hour==='24'?'00':p.hour}:${p.minute}:${p.second}`};
const rs=p=>p==null||p===''?'':Math.round(Number(p))/100;
const yn=v=>v?'Yes':'No';
const id=v=>v?String(v._id||v):'';
const join=(a,sep=', ')=>Array.isArray(a)?a.filter(x=>x!==undefined&&x!==null&&x!=='').join(sep):'';
const uname=u=>u&&typeof u==='object'?u.name||'':'';
const addr=a=>a?join([a.house,a.locality,a.landmark,a.city,a.district,a.state,a.pin]):'';

export function cell(v){
  if(v===null||v===undefined)return '""';
  if(v instanceof Date)v=dt(v);
  else if(typeof v==='object')v=JSON.stringify(v);
  let s=String(v).replace(/\r\n|\r|\n/g,'\n');
  const plainNumber=/^[+-]?\d+(\.\d+)?$/.test(s),phone=/^\+\d[\d\s-]{6,}$/.test(s);
  if(/^[=+\-@\t]/.test(s)&&!plainNumber&&!phone)s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}

const verification=w=>{const m=w.verification;if(!m)return '';const o=m instanceof Map?Object.fromEntries(m):m;return Object.entries(o).map(([k,v])=>`${k}: ${v}`).join('; ')};

// resource -> {model, filter, populate, columns:[[header, fn(row, ctx)]], load?: async()=>ctx}
export const reportDefs={
  workers:{model:Worker,populate:'user',columns:[
    ['Worker ID',r=>id(r)],['Name',r=>uname(r.user)],['Email',r=>r.user?.email],['Phone',r=>r.user?.phone],['Account Status',r=>r.user?.accountStatus],['Language',r=>r.user?.language],
    ['Category',r=>r.category],['Skill',r=>r.skill],['Additional Skills',r=>join(r.additionalSkills)],['Experience (years)',r=>r.experience],['Bio',r=>r.bio],
    ['Locality',r=>r.locality],['City',r=>r.city],['District',r=>r.district],['State',r=>r.state],['PIN',r=>r.pin],['Service Area',r=>join(r.serviceArea)],
    ['Price (INR)',r=>r.price],['Approval Status',r=>r.approvalStatus],['Approved',r=>yn(r.isApproved)],['Availability',r=>r.availability],['Verification',verification],['Admin Reason',r=>r.reason],
    ['Rating',r=>r.rating],['Review Count',r=>r.reviewCount],['Completed Jobs',r=>r.completedJobs],['Approved At',r=>dt(r.approvedAt)],['Created At',r=>dt(r.createdAt)],['Updated At',r=>dt(r.updatedAt)]]},
  customers:{model:User,filter:{role:'customer'},columns:[
    ['Customer ID',r=>id(r)],['Name',r=>r.name],['Email',r=>r.email],['Phone',r=>r.phone],['Language',r=>r.language],['Account Status',r=>r.accountStatus],['Photo Uploaded',r=>yn(r.photo)],['Created At',r=>dt(r.createdAt)],['Updated At',r=>dt(r.updatedAt)]]},
  bookings:{model:Booking,populate:[{path:'customer',select:'name email phone'},{path:'worker',populate:{path:'user',select:'name email phone'}},{path:'service'}],
    load:async()=>{const remarks=await WorkerRemark.find().lean(),by={};for(const x of remarks)(by[String(x.booking)]||=[]).push(x.text);return by},
    columns:[
    ['Booking ID',r=>id(r)],['Booking Ref',r=>id(r).slice(-6).toUpperCase()],['Service',r=>r.service?.name],['Category',r=>r.service?.category],
    ['Customer',r=>uname(r.customer)],['Customer Email',r=>r.customer?.email],['Customer Phone',r=>r.customer?.phone],
    ['Worker',r=>uname(r.worker?.user)],['Worker Email',r=>r.worker?.user?.email],['Worker Phone',r=>r.worker?.user?.phone],
    ['Service Date',r=>r.date],['Service Time',r=>r.time],['Amount (INR)',r=>r.amount],['Status',r=>r.status],['Payment Status',r=>r.paymentStatus],
    ['Address',r=>addr(r.addressSnapshot)],['City',r=>r.addressSnapshot?.city],['PIN',r=>r.addressSnapshot?.pin],['Customer Notes',r=>r.notes],
    ['Worker Remarks',(r,c)=>join(c[id(r)],' | ')],['Timeline',r=>join((r.timeline||[]).map(t=>`${t.status} @ ${dt(t.at)}`),' > ')],['Created At',r=>dt(r.createdAt)],['Updated At',r=>dt(r.updatedAt)]]},
  payments:{model:Transaction,populate:[{path:'booking',populate:{path:'service'}},{path:'worker',populate:{path:'user',select:'name email phone'}},{path:'customer',select:'name email phone'}],columns:[
    ['Transaction ID',r=>id(r)],['Booking ID',r=>id(r.booking)],['Booking Ref',r=>id(r.booking).slice(-6).toUpperCase()],['Service',r=>r.booking?.service?.name],['Booking Status',r=>r.booking?.status],
    ['Customer',r=>uname(r.customer)],['Customer Phone',r=>r.customer?.phone],['Worker',r=>uname(r.worker?.user)],['Worker Phone',r=>r.worker?.user?.phone],
    ['Amount (INR)',r=>r.amount],['Method',r=>r.method],['Status',r=>r.status],['Created At',r=>dt(r.createdAt)],['Updated At',r=>dt(r.updatedAt)]]},
  'online-payments':{model:Payment,populate:[{path:'booking',populate:{path:'service'}},{path:'worker',populate:{path:'user',select:'name phone'}},{path:'customer',select:'name email phone'}],columns:[
    ['Payment ID',r=>id(r)],['Booking ID',r=>id(r.booking)],['Service',r=>r.booking?.service?.name],['Customer',r=>uname(r.customer)],['Customer Phone',r=>r.customer?.phone],['Worker',r=>uname(r.worker?.user)],['Worker Phone',r=>r.worker?.user?.phone],
    ['Total (INR)',r=>rs(r.total)],['Status',r=>r.status],['Cashfree Order ID',r=>r.cfOrderId],['Cashfree Payment ID',r=>r.cfPaymentId],
    ['Paid At',r=>dt(r.paidAt)],['Job Completed At',r=>dt(r.completedAt)],['Complaint Deadline',r=>dt(r.complaintDeadline)],['Settle By',r=>dt(r.settleBy)],['Settled At',r=>dt(r.settledAt)],
    ['Escalated',r=>yn(r.escalated)],['Complaint Ticket',r=>id(r.complaint)],['Decision By',r=>r.decision?.decidedBy],['Decision Note',r=>r.decision?.note],['Decision At',r=>dt(r.decision?.at)],
    ['Refund Amount (INR)',r=>rs(r.refundAmount)],['Refund Status',r=>r.refund?.status],['Refund ID',r=>r.refund?.cfRefundId],['Settlement Error',r=>r.settleError],
    ['Split: Worker (INR)',r=>rs(r.split?.worker)],['Split: Agent (INR)',r=>rs(r.split?.agent)],['Split: Admin (INR)',r=>rs(r.split?.admin)],['Split: Refund (INR)',r=>rs(r.split?.refund)],['Created At',r=>dt(r.createdAt)]]},
  ledger:{model:Ledger,populate:'user',columns:[
    ['Ledger ID',r=>id(r)],['Payment ID',r=>id(r.payment)],['Booking ID',r=>id(r.booking)],['Party',r=>r.party],['User',r=>uname(r.user)],['Amount (INR)',r=>rs(r.amount)],['Status',r=>r.status],['Note',r=>r.note],['Created At',r=>dt(r.createdAt)]]},
  reviews:{model:Review,populate:[{path:'customer',select:'name email'},{path:'worker',populate:{path:'user',select:'name'}}],columns:[
    ['Review ID',r=>id(r)],['Booking ID',r=>id(r.booking)],['Customer',r=>uname(r.customer)],['Customer Email',r=>r.customer?.email],['Worker',r=>uname(r.worker?.user)],['Worker Skill',r=>r.worker?.skill],
    ['Rating',r=>r.rating],['Review',r=>r.text],['Flagged',r=>yn(r.flagged)],['Created At',r=>dt(r.createdAt)]]},
  support:{model:Support,populate:[{path:'user',select:'name email phone role'},{path:'messages.sender',select:'name role'}],columns:[
    ['Ticket ID',r=>id(r)],['Subject',r=>r.subject],['Category',r=>r.category],['Priority',r=>r.priority],['Status',r=>r.status],
    ['User',r=>uname(r.user)],['User Role',r=>r.user?.role],['User Email',r=>r.user?.email],['User Phone',r=>r.user?.phone],['Booking ID',r=>id(r.booking)],
    ['Evidence Required',r=>yn(r.evidenceRequired)],['Evidence Deadline',r=>dt(r.evidenceDeadline)],['Attachments',r=>(r.attachments||[]).length],['Attachment Names',r=>join((r.attachments||[]).map(a=>a.name))],
    ['Message Count',r=>(r.messages||[]).length],['Conversation',r=>join((r.messages||[]).map(m=>`[${dt(m.at)}] ${m.sender?.name||'User'}${m.sender?.role?' ('+m.sender.role+')':''}: ${m.text}`),'\n')],['Created At',r=>dt(r.createdAt)],['Updated At',r=>dt(r.updatedAt)]]},
  services:{model:Service,columns:[
    ['Service ID',r=>id(r)],['Name',r=>r.name],['Category',r=>r.category],['Description',r=>r.description],['Icon',r=>r.icon],['Order',r=>r.order],['Enabled',r=>yn(r.enabled)],['Created At',r=>dt(r.createdAt)],['Updated At',r=>dt(r.updatedAt)]]},
  locations:{model:Address,populate:{path:'user',select:'name email phone role'},columns:[
    ['Address ID',r=>id(r)],['User',r=>uname(r.user)],['User Role',r=>r.user?.role],['User Email',r=>r.user?.email],['User Phone',r=>r.user?.phone],['Label',r=>r.label],
    ['House',r=>r.house],['Locality',r=>r.locality],['Landmark',r=>r.landmark],['PIN',r=>r.pin],['City',r=>r.city],['District',r=>r.district],['State',r=>r.state],['Default',r=>yn(r.isDefault)],['Created At',r=>dt(r.createdAt)]]},
  'audit-logs':{model:Audit,populate:{path:'admin',select:'name email'},columns:[
    ['Log ID',r=>id(r)],['Admin',r=>uname(r.admin)],['Admin Email',r=>r.admin?.email],['Action',r=>r.action],['Target Type',r=>r.targetType],['Target ID',r=>r.targetId],['Reason',r=>r.reason],['Time (IST)',r=>dt(r.createdAt)]]},
  'skill-requests':{model:SkillRequest,populate:{path:'worker',populate:{path:'user',select:'name phone'}},columns:[
    ['Request ID',r=>id(r)],['Worker',r=>uname(r.worker?.user)],['Worker Phone',r=>r.worker?.user?.phone],['Current Skill',r=>r.worker?.skill],['Requested Skills',r=>join(r.skills)],['Status',r=>r.status],['Created At',r=>dt(r.createdAt)],['Updated At',r=>dt(r.updatedAt)]]}
};
reportDefs.verification=reportDefs.workers;
reportDefs.earnings=reportDefs.payments;
reportDefs.approvals=reportDefs.workers;

export function buildCsv(def,rows,ctx={}){
  const head=def.columns.map(([h])=>cell(h)).join(',');
  const body=rows.map(r=>def.columns.map(([,fn])=>{try{return cell(fn(r,ctx))}catch{return '""'}}).join(','));
  return '\ufeff'+[head,...body].join('\r\n')+'\r\n';
}

export function reportRoutes(app,{wrap,fail}){
  app.get('/api/admin/reports/:resource',wrap(async(req,res)=>{
    const def=reportDefs[req.params.resource];if(!def)fail('Unknown report',404);
    let q=def.model.find(def.filter||{});if(def.populate)q=q.populate(def.populate);
    // Optional ?status= filter, same semantics as the on-screen list
    const rows=await q.sort({createdAt:-1}).lean();
    const status=typeof req.query.status==='string'?req.query.status:'';
    const filtered=status?rows.filter(r=>[r.status,r.approvalStatus,r.accountStatus,r.availability].includes(status)):rows;
    const ctx=def.load?await def.load():{};
    const stamp=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
    res.set('Content-Type','text/csv; charset=utf-8').set('Cache-Control','no-store').attachment(`sajha-${req.params.resource}-${stamp}.csv`).send(buildCsv(def,filtered,ctx));
  }));
}
