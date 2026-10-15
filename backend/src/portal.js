import express from 'express';
export function createPortal(app, portal, port) {
  const site=express();
  site.get('/portal-config.js',(req,res)=>res.type('application/javascript').set('Cache-Control','no-store').send(`window.SAJHA_PORTAL=${JSON.stringify(portal)};`));
  site.use((req,res,next)=>{
    req.portal=portal;req.portalPort=port;
    if(portal==='public'&&(req.path==='/admin'||req.path.startsWith('/admin/')))return res.status(404).type('html').send('<!doctype html><title>SAJHA</title><h1>Page unavailable</h1><a href="/login">Go to login</a>');
    if(portal==='public'&&req.path.startsWith('/api/admin'))return res.status(403).json({message:'Access denied'});
    if(portal!=='public'&&req.path==='/api/auth/register')return res.status(403).json({message:'Registration is unavailable on the admin portal'});
    if(portal==='public'&&(req.path==='/agent'||req.path.startsWith('/agent/')||req.path.startsWith('/api/agent')))return res.status(403).send('Access denied');
    next();
  });
  site.use(app);return site;
}
