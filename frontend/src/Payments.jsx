import React,{useState,useEffect,useContext} from 'react';
import {localizedElement,LanguageContext} from './i18n.jsx';
import {Link} from 'react-router-dom';
import {ShieldCheck,Clock,Wallet} from 'lucide-react';
const INR=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const short=s=>String(s||'').slice(-6).toUpperCase();

/* ---------- Cashfree checkout (JS SDK v3) ---------- */
let sdkPromise;
function loadCashfree(){
 if(window.Cashfree)return Promise.resolve(window.Cashfree);
 sdkPromise??=new Promise((ok,bad)=>{const s=document.createElement('script');s.src='https://sdk.cashfree.com/js/v3/cashfree.js';s.onload=()=>ok(window.Cashfree);s.onerror=()=>{sdkPromise=null;bad(new Error('Could not load the payment window. Check your internet connection.'))};document.head.appendChild(s)});
 return sdkPromise;
}
export async function startCheckout(post,bookingId){
 const o=await post('/payments/create-order',{booking:bookingId});
 const Cashfree=await loadCashfree();
 const cf=Cashfree({mode:o.mode});
 await cf.checkout({paymentSessionId:o.paymentSessionId,redirectTarget:'_self'});
}
/* After Cashfree redirects back to /bookings?cf_order=... confirm the payment with the server. */
export function useReturnVerify(post,onDone){
 useEffect(()=>{
  const q=new URLSearchParams(location.search),order=q.get('cf_order');if(!order)return;
  history.replaceState({},'',location.pathname);
  post('/payments/verify',{orderId:order}).then(p=>onDone(p)).catch(e=>onDone(null,e.message));
 },[]);
}
function useMinutesLeft(deadline){
 const[,tick]=useState(0);useEffect(()=>{const t=setInterval(()=>tick(x=>x+1),15000);return()=>clearInterval(t)},[]);
 return deadline?Math.max(0,Math.ceil((new Date(deadline)-Date.now())/60000)):null;
}

/* ---------- Customer / worker line on each booking card ---------- */
const Note=({icon:Icon,title,text,children})=><div className="notice"><Icon size={18}/><div><strong>{title}</strong>{text&&<p>{text}</p>}</div>{children}</div>;
class Safe extends React.Component{state={bad:false};static getDerivedStateFromError(){return{bad:true}}componentDidCatch(e){console.error('Payment widget failed:',e)}render(){return this.state.bad?null:this.props.children}}
function Bar({booking,payment,worker,run,post,refresh,toast}){
 const hi=useContext(LanguageContext)==='hi',t=(en,h)=>hi?h:en;
 const left=useMinutesLeft(payment?.complaintDeadline);
 const payable=['Accepted','On The Way','Reached','In Progress'].includes(booking.status);
 const amount=INR(booking.amount);
 if(booking.status==='Cancelled'&&!payment?.paid)return null;
 if(worker){
  if(!payment||!payment.paid)return payable?<Note icon={Clock} title={t('Waiting for customer payment','ग्राहक के भुगतान की प्रतीक्षा')} text={t('The customer pays online. SAJHA records the payment, and admin handles manual transfers after the job and complaint review.','ग्राहक ऑनलाइन भुगतान करेगा। SAJHA भुगतान दर्ज करेगा और काम तथा शिकायत समीक्षा के बाद एडमिन मैनुअल ट्रांसफर करेगा।')}/>:null;
  const label=({Held:t('Customer payment received','ग्राहक का भुगतान मिला'),Disputed:t('Payment under review','भुगतान की समीक्षा चल रही है'),Settling:t('Payment processing','भुगतान प्रक्रिया में है'),PendingPayout:t('Awaiting admin payout','एडमिन भुगतान की प्रतीक्षा'),Settled:t('Paid out','भुगतान हो गया'),Refunded:t('Paid out','भुगतान हो गया')})[payment.state]||payment.status;
  return <Note icon={ShieldCheck} title={label} text={payment.payout!==undefined?t('Credited to your earnings: ','आपकी कमाई में जमा: ')+INR(payment.payout):t('Your payment is recorded. Admin will transfer your share after the complaint window and review.','आपका भुगतान दर्ज है। शिकायत अवधि और समीक्षा के बाद एडमिन आपका हिस्सा ट्रांसफर करेगा।')}/>;
 }
 if(payment?.state==='Created')return <Note icon={Clock} title={t('Payment confirmation pending','भुगतान की पुष्टि हो रही है')} text={t('We are checking your payment with Cashfree. Please check the status before trying again.','Cashfree से भुगतान की पुष्टि की जा रही है। दोबारा भुगतान करने से पहले स्थिति जाँचें।')}><button className="btn secondary" onClick={()=>run(async()=>{const p=await post('/payments/check',{booking:booking._id});if(p?.paid)toast?.(t('Payment received and secured','भुगतान प्राप्त और सुरक्षित'));else toast?.(t('Payment is still pending','भुगतान की पुष्टि अभी बाकी है'));refresh?.()})}>{t('Check payment status','भुगतान स्थिति जाँचें')}</button></Note>;
 if(!payment||!payment.paid)return payable?<Note icon={Wallet} title={t('Pay securely with Cashfree','Cashfree से सुरक्षित भुगतान करें')} text={t('Your '+amount+' is collected through Cashfree. After the job and 15-minute complaint window, any refund is processed and admin records manual transfers.','आपका '+amount+' Cashfree से लिया जाता है। काम और 15 मिनट की शिकायत अवधि के बाद रिफंड और मैनुअल ट्रांसफर एडमिन संभालता है।')+(payment?.state==='Failed'?t(' Your last attempt failed — please try again.',' पिछला भुगतान असफल रहा — कृपया फिर कोशिश करें।'):'')}><button className="btn" onClick={()=>run(async()=>{await startCheckout(post,booking._id)})}>{t('Pay ','भुगतान करें ')+amount}</button></Note>:null;
 if(payment.state==='Held'&&booking.status==='Completed'&&left>0)return <Note icon={Clock} title={t('Problem with the work? Tell us within '+left+' min','काम में दिक्कत? '+left+' मिनट के अंदर बताएं')} text={t('If the job was not done properly, raise a complaint before the window closes. A SAJHA agent will decide any refund.','काम ठीक से नहीं हुआ तो समय खत्म होने से पहले शिकायत करें। रिफंड SAJHA एजेंट तय करेगा।')}><Link className="btn secondary" to="/help">{t('Report a problem','समस्या बताएं')}</Link></Note>;
 if(payment.state==='Held')return <Note icon={ShieldCheck} title={t('Payment received','भुगतान मिला')} text={booking.status==='Completed'?t('Complaint window closed. Payment is being completed.','शिकायत का समय खत्म। भुगतान पूरा किया जा रहा है।'):t('Your payment is recorded. The 15-minute complaint window starts when the job is completed.','आपका भुगतान दर्ज है। काम पूरा होने पर 15 मिनट की शिकायत अवधि शुरू होगी।')}/>;
 if(payment.state==='Disputed')return <Note icon={Clock} title={t('Complaint under review','शिकायत की समीक्षा चल रही है')} text={t('An agent is reviewing your complaint. Any refund will be decided and processed shortly.','एजेंट आपकी शिकायत देख रहा है। रिफंड जल्द तय होकर भेजा जाएगा।')}/>;
 const refunded=payment.refundAmount>0;
 return <Note icon={ShieldCheck} title={payment.state==='Settling'?t('Processing','प्रक्रिया में'):t('Payment completed','भुगतान पूरा')} text={refunded?INR(payment.refundAmount)+t(' refund '+(payment.state==='Settling'?'is being processed':'has been initiated')+' to your original payment method.',' का रिफंड आपके मूल भुगतान माध्यम में '+(payment.state==='Settling'?'भेजा जा रहा है।':'शुरू कर दिया गया है।')):undefined}/>;
}
/* A failure inside the payment widget must never blank the bookings page. */
export function PaymentBar(props){return <Safe><Bar {...props}/></Safe>}

/* ---------- Agent / admin: payments & refund decisions ---------- */
function Countdown({to}){const m=useMinutesLeft(to);return to?<small>{m>0?m+' min left to decide':'Decision overdue'}</small>:null}
function PayoutForm({p,party,recipients,onClose,onSubmit,busy}){const entry=p.ledger?.find(x=>x.party===party);const[mode,setMode]=useState('upi'),[recipient,setRecipient]=useState(recipients[0]?._id||'');const agent=recipients.find(x=>x._id===recipient);return <div className="overlay" onClick={onClose}><section className="modal payout-modal" role="dialog" aria-modal="true" aria-label="Send payout via Cashfree" onClick={e=>e.stopPropagation()}><div className="row between"><div><span className="eyebrow">CASHFREE PAYOUT</span><h2>Send {party} share</h2></div><button type="button" className="btn secondary small" onClick={onClose}>Close</button></div><div className="payout-amount"><small>{p.booking?.service?.name||'SAJHA service'} · Booking #{short(p.booking?._id||p.booking)}</small><strong>{INR((entry?.amount||0)/100)}</strong></div><form onSubmit={e=>{e.preventDefault();onSubmit(p,party,Object.fromEntries(new FormData(e.currentTarget)))}}>{party==='agent'&&<label className="field"><span>Agent account</span><select name="recipientId" required value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">Choose an active agent</option>{recipients.map(a=><option key={a._id} value={a._id}>{a.name} · {a.phone}</option>)}</select></label>}<label className="field"><span>Account holder / beneficiary name</span><input name="beneficiaryName" required maxLength="100" defaultValue={party==='worker'?p.worker?.user?.name:agent?.name}/></label><label className="field"><span>Transfer method</span><select name="transferMode" value={mode} onChange={e=>setMode(e.target.value)}><option value="upi">UPI</option><option value="imps">IMPS bank transfer</option><option value="neft">NEFT</option><option value="rtgs">RTGS</option></select></label>{mode==='upi'?<label className="field"><span>Recipient UPI ID</span><input name="vpa" required placeholder="name@bank" autoComplete="off"/></label>:<div className="grid two"><label className="field"><span>Bank account number</span><input name="bankAccountNumber" required autoComplete="off" inputMode="numeric"/></label><label className="field"><span>IFSC code</span><input name="bankIfsc" required placeholder="ABCD0123456" autoCapitalize="characters"/></label></div>}<p className="muted">This submits the transfer to Cashfree from SAJHA. You stay on this page; the payment is marked successful only after Cashfree confirms the bank transfer. Confirm the recipient details before sending.</p><div className="row end"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>Send {INR((entry?.amount||0)/100)} via Cashfree</button></div></form></section></div>}
export function PaymentCard({p,busy,decide,admin,onPayout,recipients=[],onCheck}){const[target,setTarget]=useState(null);return <article className="card">
   <div className="row between"><h3>Booking #{short(p.booking?._id||p.booking)}</h3><span className="badge">{p.status}</span></div>
   {p.booking?.service?.name&&<p>{p.booking.service.name}</p>}
   {p.customer?.name&&<p>Customer: {p.customer.name} · Worker: {p.worker?.user?.name}</p>}
   <p><strong>Paid: {INR(p.totalRupees)}</strong></p>
   <p><small>Agent {INR(p.breakdown.agent)} ({p.percent.agent}%) · Admin {INR(p.breakdown.admin)} ({p.percent.admin}%) · Visiting {INR(p.breakdown.visiting)} ({p.percent.visit}%) · Work portion {INR(p.breakdown.workPortion)}</small></p>
   {p.complaint?.subject&&<p>Complaint: {p.complaint.subject}</p>}
   {p.status==='Disputed'&&<><Countdown to={p.settleBy}/>
    <form onSubmit={e=>decide(e,p)}>
     <label className="field"><span>Refund to customer (₹, max {INR(p.breakdown.maxRefund)})</span><input name="refundAmount" type="number" min="0" max={p.breakdown.maxRefund} step="0.01" defaultValue="0" required/></label>
     <label className="field"><span>Decision note</span><textarea name="note" maxLength={1000} placeholder="Why this refund amount?"/></label>
     <div className="row wrap"><button type="button" className="btn secondary small" onClick={e=>{e.currentTarget.form.refundAmount.value=0}}>Work done – no refund</button><button type="button" className="btn secondary small" onClick={e=>{e.currentTarget.form.refundAmount.value=p.breakdown.maxRefund}}>Work not done – max refund</button></div>
     <button className="btn" disabled={busy}>Save refund decision &amp; queue admin payout</button>
    </form></>}
   {p.split&&<p>Customer refund {INR((p.refundAmount||0)/100)} · Worker share {INR((p.split.worker||0)/100)} · Agent {INR((p.split.agent||0)/100)} · Admin {INR((p.split.admin||0)/100)}</p>}{admin&&p.status==='PendingPayout'&&<section className="card"><h4>Send worker and agent shares via Cashfree</h4>{['worker','agent','admin'].map(k=>{const entry=p.ledger?.find(x=>x.party===k);return <div key={k} className="row between wrap"><span><strong>{k==='admin'?'SAJHA retained share':k}</strong>: {INR((entry?.amount||0)/100)} · {entry?.status||'Not queued'}{entry?.cashfreeStatus&&<small className="block">Cashfree: {entry.cashfreeStatus} · {entry.cashfreeTransferId}</small>}</span>{entry?.status==='Pending'&&<button className="btn secondary small" disabled={busy} onClick={()=>k==='admin'?onPayout(p,k):setTarget(k)}>{k==='admin'?'Record retained share':'Send via Cashfree'}</button>}{entry?.status==='Processing'&&<button className="btn secondary small" disabled={busy} onClick={()=>onCheck(entry)}>Check Cashfree status</button>}{entry?.status==='Failed'&&<button className="btn secondary small" disabled={busy} onClick={()=>setTarget(k)}>Retry via Cashfree</button>}</div>})}</section>}{p.status==='PendingPayout'&&<p>Customer refund is processed through Cashfree. The admin sends the worker and agent transfers individually.</p>}
   {p.settleError&&<p className="notice" role="alert">Retrying: {p.settleError}</p>}
   {target&&<PayoutForm p={p} party={target} recipients={recipients} busy={busy} onClose={()=>setTarget(null)} onSubmit={async(...args)=>{await onPayout(...args);setTarget(null)}}/>}
  </article>;}
export function PaymentsDesk({api,post,admin=false}){
 const[rows,setRows]=useState(null),[summary,setSummary]=useState(null),[recipients,setRecipients]=useState([]),[filter,setFilter]=useState(''),[err,setErr]=useState(''),[ok,setOk]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{if(admin){const d=await api('/admin/payment-ledger');setSummary(d);setRows(filter?d.payments.filter(p=>p.status===filter):d.payments);api('/admin/payout-recipients').then(setRecipients).catch(()=>{})}else setRows(await api('/agent/payments'+(filter?'?status='+filter:'')))}catch(e){setErr(e.message)}}
 async function markPayout(p,party,details={}){const entry=p.ledger?.find(x=>x.party===party),body={party,...details};if(party!=='admin'&&!window.confirm(`Send ₹${INR((entry?.amount||0)/100)} via Cashfree to this ${party}?`))return;setBusy(true);setErr('');try{const d=await post('/admin/payments/'+p._id+'/payouts',body);setOk(party==='admin'?'SAJHA retained share recorded':d.payout?.status==='Paid'?'Cashfree confirms the transfer is successful.':'Cashfree accepted the payout request. Check its status until the bank confirms it.');await load()}catch(e){setErr(e.message);throw e}finally{setBusy(false)}}
 async function checkPayout(entry){setBusy(true);setErr('');try{const d=await post('/admin/payouts/'+entry._id+'/check',{});setOk(d.status==='Paid'?'Cashfree confirms the bank transfer is successful.':'Cashfree status: '+d.cashfreeStatus+' — still processing.');await load()}catch(e){setErr(e.message)}finally{setBusy(false)}}
 useEffect(()=>{load();const t=setInterval(load,10000);return()=>clearInterval(t)},[filter]);
 async function decide(e,p){e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);setErr('');setOk('');try{await post('/agent/payments/'+p._id+'/decide',{refundAmount:Number(f.refundAmount||0),note:f.note});setOk('Agent decision saved. Admin can now send the transfers through Cashfree.');await load()}catch(x){setErr(x.message)}finally{setBusy(false)}}
 return <>
  {admin&&summary&&<div className="grid agent-stats"><div className="card"><small>Unresolved customer payments</small><h2>{INR(summary.held.total)}</h2><small>{summary.held.count} payments</small></div>{['worker','agent','admin'].map(k=><div className="card" key={k}><small>{k} share total</small><h2>{INR(summary.ledger[k]?.total)}</h2></div>)}</div>}
  <div className="agent-filters"><label className="field"><span>Status</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All</option>{['Created','Held','Disputed','Settling','PendingPayout','Settled','Refunded','Failed'].map(s=><option key={s}>{s}</option>)}</select></label></div>
  {err&&<p className="notice" role="alert">{err}</p>}{ok&&<p className="notice" role="status">{ok}</p>}
  {!rows?<p>Loading…</p>:!rows.length?<p>No payments yet.</p>:<div className="agent-records">{rows.map(p=><PaymentCard key={p._id} p={p} busy={busy} decide={decide} admin={admin} recipients={recipients} onPayout={markPayout} onCheck={checkPayout}/>)}</div>}
 </>;
}

export function PayoutHistory({api}){const[rows,setRows]=useState(null),[error,setError]=useState('');useEffect(()=>{api('/payments/payout-history').then(setRows).catch(e=>setError(e.message))},[]);return <section className="card payout-history"><h3><Wallet size={18}/> Payout history</h3><p>Payments the admin has sent for your completed service work.</p>{error?<p className="notice" role="alert">{error}</p>:!rows?<p>Loading payment history…</p>:!rows.length?<p>No payments have been assigned to this profile yet.</p>:<div className="payout-history-list">{rows.map(r=><article key={r.id} className="payout-history-row"><div><strong>{r.service}</strong><small>Booking #{short(r.bookingId)} · {new Date(r.createdAt).toLocaleDateString('en-IN')}</small>{r.transferId&&<small>Cashfree ref: {r.transferId}{r.transferReference?' · '+r.transferReference:''}</small>}</div><div className="payout-history-money"><strong>{INR(r.amount)}</strong><span className="badge">{r.status}</span></div></article>)}</div>}</section>}
