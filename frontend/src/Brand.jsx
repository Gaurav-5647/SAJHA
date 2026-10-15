import React from 'react';
import {Link} from 'react-router-dom';
import {localizedElement} from './i18n.jsx';

/*
  SAJHA logo lockup:  [mark logo] sajha. (light mode = blue mark, dark mode = white mark)
  Logo + text ek hi <Link> hain, isliye dono par (aur dot par) click karne se home page khulta hai.
  Logo ki height text ke font-size ke saath scale hoti hai (em) aur width auto (3:2 rectangle),
  isliye poora logo bina kate dikhta hai aur har screen par text ke barabar rehta hai.
  Dot "." ab text ke baseline par (neeche) baithta hai — .brand-text ke andar flex baseline.
  Size alag karne ke liye variant ya className se CSS me font-size badlo (brand.css dekho).
*/
export default function Brand({to='/',variant='header',className='',onClick}){
  return <Link className={'logo brand-lockup brand-'+variant+(className?' '+className:'')} to={to} onClick={onClick} aria-label="SAJHA — Home"><img className="brand-icon brand-icon-light" src="/logo-mark.png" alt="" aria-hidden="true" width="402" height="433" decoding="async" draggable="false" data-raw="true"/><img className="brand-icon brand-icon-dark" src="/logo-mark-dark.png" alt="" aria-hidden="true" width="402" height="433" decoding="async" draggable="false" data-raw="true"/><b className="brand-text">sajha<span className="brand-dot" aria-hidden="true"/></b></Link>;
}
