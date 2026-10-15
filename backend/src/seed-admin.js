import bcrypt from 'bcryptjs';
import {User} from './models.js';

// Creates / syncs the admin account from backend/.env (ADMIN_EMAIL, ADMIN_PASSWORD).
// .env is the source of truth: if the admin exists and the password differs, it is updated.
export async function ensureAdmin(){
  const email=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  const password=process.env.ADMIN_PASSWORD||'';
  if(!email||!password)return;
  const name=process.env.ADMIN_NAME||'SAJHA Administrator';
  const u=await User.findOne({email}).select('+password');
  if(!u){
    await User.create({name,email,phone:'admin-'+Date.now(),password:await bcrypt.hash(password,12),role:'admin'});
    console.log('Admin account created from .env:',email);
    return;
  }
  if(u.role!=='admin'){console.warn('ADMIN_EMAIL belongs to a non-admin account; admin seed skipped');return}
  let changed=false;
  if(!u.password||!await bcrypt.compare(password,u.password)){u.password=await bcrypt.hash(password,12);u.sessionVersion=(u.sessionVersion||0)+1;changed=true}
  if(u.accountStatus!=='active'){u.accountStatus='active';changed=true}
  if(changed){await u.save();console.log('Admin account synced from .env:',email)}
}
