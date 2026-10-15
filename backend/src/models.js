import mongoose from 'mongoose';
const {Schema}=mongoose, ref=(m)=>({type:Schema.Types.ObjectId,ref:m});
const make=(n,s,indexes=[])=>{const schema=new Schema(s,{timestamps:true});indexes.forEach(idx=>schema.index(...(Array.isArray(idx)?idx:[idx])));return mongoose.model(n,schema)};

// ===== USER & AUTH =====
export const User=make('User',
{name:{type:String,required:true},email:{type:String,unique:true,required:true},phone:{type:String,unique:true,required:true},password:{type:String,select:false},role:{type:String,enum:['customer','worker','admin','agent']},photo:String,language:{type:String,default:'en'},accountStatus:{type:String,default:'active'},sessionVersion:{type:Number,default:0},resetHash:{type:String,select:false},resetExpires:Date},
[[{role:1},{accountStatus:1}],[{createdAt:-1}]]); // Speed up role+status filters, recent users

// ===== WORKER PROFILE & MATCHING =====
export const Worker=make('WorkerProfile',
{user:{...ref('User'),unique:true},category:String,skill:String,additionalSkills:[String],experience:Number,bio:String,pin:String,city:String,district:String,state:String,locality:String,serviceArea:[String],price:{type:Number,default:0},approvalStatus:{type:String,default:'pending'},isApproved:{type:Boolean,default:false},approvedBy:ref('User'),approvedAt:Date,reason:String,availability:{type:String,default:'offline'},location:{lat:Number,lng:Number,accuracy:Number,updatedAt:Date},verification:{type:Map,of:String,default:{}},rating:{type:Number,default:0},reviewCount:{type:Number,default:0},completedJobs:{type:Number,default:0}},
[[{approvalStatus:1,isApproved:1}],[{district:1,skill:1,availability:1}],[{rating:-1}],[{user:1}],[{skill:1,additionalSkills:1,availability:1},{background:true}]]); // Match by district+skill+availability, approval workflow, rating sort

// ===== BOOKING & TRANSACTIONS =====
export const Customer=make('CustomerProfile',{user:{...ref('User'),unique:true},favorites:[ref('WorkerProfile')]});
export const Availability=make('WorkerAvailability',{worker:{...ref('WorkerProfile'),unique:true},status:String},[]);
export const Address=make('Address',
{user:ref('User'),house:String,locality:String,landmark:String,pin:String,city:String,district:String,state:String,label:String,isDefault:Boolean},
[[{user:1,isDefault:1}],[{district:1}]]); // Speed up user's default address, district grouping

export const Service=make('Service',{name:{type:String,unique:true},category:String,description:String,icon:String,order:Number,enabled:{type:Boolean,default:true}},[{enabled:1,order:1}]); // Speed up enabled service list

export const Booking=make('Booking',
{customer:ref('User'),worker:ref('WorkerProfile'),service:ref('Service'),address:ref('Address'),addressSnapshot:Object,date:String,time:String,notes:String,amount:Number,status:{type:String,default:'Pending'},timeline:[{status:String,at:Date}],paymentStatus:{type:String,default:'Pending'},location:{customer:{lat:Number,lng:Number,accuracy:Number,updatedAt:Date},worker:{lat:Number,lng:Number,accuracy:Number,updatedAt:Date}}},
[[{customer:1,status:1},{background:true}],[{worker:1,status:1},{background:true}],[{service:1,status:1},{background:true}],[{date:1,status:1},{background:true}],[{createdAt:-1}]]); // Speed up booking list filters by customer/worker/service

export const Review=make('Review',
{booking:{...ref('Booking'),unique:true},customer:ref('User'),worker:ref('WorkerProfile'),rating:Number,text:String,flagged:{type:Boolean,default:false}},
[[{worker:1,rating:-1}],[{flagged:1}]]); // Worker ratings, flagged content

export const Notification=make('Notification',
{user:ref('User'),text:String,read:{type:Boolean,default:false},relatedTicket:ref('SupportMessage'),type:{type:String,default:'information'}},
[[{user:1,read:1,createdAt:-1},{background:true}]]); // User's unread notifications

export const Support=make('SupportMessage',
{user:ref('User'),booking:ref('Booking'),subject:String,category:String,priority:{type:String,default:'normal'},status:{type:String,default:'Open'},evidenceRequired:Boolean,evidenceDeadline:Date,attachments:[{file:String,name:String,mime:String,size:Number,duration:Number,captureId:String,at:Date}],messages:[{sender:ref('User'),text:String,language:String,at:Date}]},
[[{user:1,status:1},{background:true}],[{booking:1},{background:true}],[{status:1,priority:1},{background:true}]]); // Support ticket queries

export const Transaction=make('Transaction',
{booking:{...ref('Booking'),unique:true},worker:ref('WorkerProfile'),customer:ref('User'),amount:Number,method:{type:String,default:'Cash'},status:{type:String,default:'Pending'}},
[[{worker:1,status:1},{background:true}],[{customer:1},{background:true}],[{createdAt:-1}]]); // Worker/customer transaction history

export const Audit=make('AuditLog',
{admin:ref('User'),action:String,targetType:String,targetId:String,reason:String},
[[{createdAt:-1}]]); // Recent audit logs first

export const SkillRequest=make('SkillRequest',
{worker:ref('WorkerProfile'),skills:[String],status:{type:String,default:'pending'}},
[[{status:1,createdAt:-1}]]); // Pending skill requests

// ===== AGENT FEATURES =====
export const AgentNote=make('AgentNote',{booking:ref('Booking'),agent:ref('User'),party:String,method:String,text:String},[{booking:1}]);
export const WorkerRemark=make('WorkerRemark',{booking:ref('Booking'),worker:ref('User'),text:String,language:String},[{booking:1,createdAt:-1}]);

// ===== CACHING & TRANSLATIONS =====
export const Translation=make('TranslationCache',{key:{type:String,unique:true},text:String},[]);

// ===== PAYMENTS (Cashfree escrow + settlement) =====
// All money is stored in paise (integers) to avoid rounding drift.
export const Payment=make('Payment',{
 booking:{...ref('Booking'),unique:true},customer:ref('User'),worker:ref('WorkerProfile'),
 total:Number,
 cfOrderId:{type:String,index:true},cfPaymentId:String,
 status:{type:String,default:'Created'}, // Created | Held | Disputed | Settling | Settled | Refunded | Failed | PendingPayout
 paidAt:Date,completedAt:Date,complaintDeadline:Date,settleBy:Date,
 complaint:ref('SupportMessage'),
 decision:{agent:ref('User'),decidedBy:String,note:String,at:Date},
 refundAmount:{type:Number,default:0},
 refund:{cfRefundId:String,status:String,requestedAt:Date},
 settleError:String,cancelRefund:Boolean,escalated:{type:Boolean,default:false},
 settledAt:Date,
 split:{agent:Number,admin:Number,visit:Number,work:Number,worker:Number,refund:Number}
},[{status:1,createdAt:-1},{worker:1,status:1},{customer:1,status:1}]); // Payment status/worker/customer queries

export const Ledger=make('PaymentLedger',
{payment:ref('Payment'),booking:ref('Booking'),party:{type:String,enum:['worker','agent','admin']},user:ref('User'),amount:Number,status:{type:String,default:'Pending'},note:String,cashfreeTransferId:String,cashfreeStatus:String,transferMode:String,payoutRequestedAt:Date,payoutPaidAt:Date},
[[{payment:1,party:1},{unique:true}],[{user:1,status:1},{background:true}]]);// Payment ledger lookups
