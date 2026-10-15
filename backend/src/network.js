import os from 'node:os';
export function localNetworkLinks(port=5000,interfaces,protocol='http'){
 try{interfaces??=os.networkInterfaces()}catch{return [];}
 const seen=new Set(),links=[];
 for(const [adapter,addresses] of Object.entries(interfaces))for(const entry of addresses||[]){
  const ip=entry.address;
  if(entry.internal||![4,'IPv4'].includes(entry.family)||seen.has(ip))continue;
  // Share private LAN addresses only; public and link-local interfaces are excluded.
  const octets=ip.split('.').map(Number);
  if(octets.length!==4||!octets.every(n=>Number.isInteger(n)&&n>=0&&n<=255))continue;
  if(!(octets[0]===10||octets[0]===192&&octets[1]===168||octets[0]===172&&octets[1]>=16&&octets[1]<=31))continue;
  seen.add(ip);links.push({adapter,address:ip,url:`${protocol}://${ip}:${port}`});
 }
 return links.sort((a,b)=>Number(/docker|veth|vmware|virtual|wsl|vpn/i.test(a.adapter))-Number(/docker|veth|vmware|virtual|wsl|vpn/i.test(b.adapter)));
}
export function printNetworkLinks(port,protocol='http'){
 console.log(`\nDesktop: ${protocol}://localhost:${port}`);
 const links=localNetworkLinks(port,undefined,protocol);
 for(const link of links)console.log(`Phone / same Wi-Fi (${link.adapter}): ${link.url}`);
 if(!links.length)console.log('No private LAN address found. Connect the laptop to Wi-Fi, then restart.');
 console.log('Use the Wi-Fi adapter link. Keep this terminal open; allow Node.js on Private networks in Windows Firewall.\n');
}
