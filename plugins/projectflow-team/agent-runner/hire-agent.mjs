#!/usr/bin/env node
/**
 * Stellt autonom einen neuen Agenten ein.
 * Mintet kurzlebig einen Service-Account-Key (gcloud, am Mac eingeloggt), legt
 * Account + /users + Custom-Rolle + Mitgliedschaft + API-Token an (createdBy=uid),
 * ordnet optional einem Projekt zu, mergt in mcp/tokens.json und LOESCHT den Key
 * danach wieder (Datei + GCP-Key) – kein stehender Admin-Key.
 *
 *   node hire-agent.mjs --key <agentKey> --name "Vorname Nachname" --function "Rolle" \
 *        --tenant <TENANT> [--role-name "Label" --role-color "#RRGGBB"] \
 *        [--perms "tasks:read,tasks:write,projects:read,projects:write"] \
 *        [--project <projectFlowId>] [--confirm] [--dry]
 *
 * Ohne --confirm und ohne --dry: Abbruch (Sicherheitsnetz).
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEnabled, getState } from '../autonomy-state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a,x,i,arr)=>{ if(x.startsWith('--')){const k=x.slice(2);const n=arr[i+1];a.push([k,(n&&!n.startsWith('--'))?n:true]);}return a;},[]));
const DRY = !!args.dry;
const tokensPath = resolve(__dirname, '../mcp/tokens.json');
const tokens = existsSync(tokensPath) ? JSON.parse(readFileSync(tokensPath,'utf8')) : { agents:{} };
const tenantId = args.tenant || tokens.tenantId;
const SA = 'firebase-adminsdk-fbsvc@projectflow-labestin.iam.gserviceaccount.com';
const PROJECT = 'projectflow-labestin';

const key = (args.key||'').trim();
const name = (args.name||'').trim();
const fn = (args.function||'').trim();
const roleName = args['role-name'] || 'Staff';
const roleColor = args['role-color'] || '#64748B';
const perms = (args.perms || 'projects:read,projects:write,tasks:read,tasks:write,initiatives:read').split(',').map(s=>s.trim()).filter(Boolean);
const die=(m)=>{console.error('FEHLER:',m);process.exit(1);};
if(!key||!name||!fn) die('--key, --name und --function sind Pflicht');
if(!tenantId) die('--tenant fehlt');
if(!DRY && !args.confirm) die('Schreiben braucht --confirm (Sicherheitsnetz). Sonst --dry.');
if(!DRY && !isEnabled()) die(`Autonomie ist deaktiviert (Kill-Switch): ${getState().reason||''}. Aktivieren mit: node ../killswitch.mjs on`);
if(tokens.agents?.[key]?.token && !String(tokens.agents[key].token).startsWith('pfat_DRY')) die(`Agent-Key "${key}" existiert bereits in tokens.json.`);

const hashToken=(t)=>createHash('sha256').update(t).digest('hex');
const genToken=()=>`pfat_${randomBytes(32).toString('base64url')}`;
const avatar=(s)=>`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(s)}`;
const email=`${key}@${'agents.labestindigital.internal'}`;
const photoURL=avatar(name);

console.log(`\n=== Hire ${DRY?'[DRY]':'[WRITE]'} ===`);
console.log(`${name} — ${fn}  <${email}>  Rolle=${roleName}  perms=[${perms.join(', ')}]${args.project?`  Projekt=${args.project}`:''}`);

if (DRY) { console.log('\n[DRY] wuerde Key minten, Account+Rolle+Member+Token anlegen, tokens.json mergen, Key loeschen.'); process.exit(0); }

const tmpKey = `/tmp/pf-hire-${key}-${Date.now()}.json`;
let keyId = null, admin=null;
try {
  execSync(`gcloud iam service-accounts keys create "${tmpKey}" --iam-account=${SA} --project=${PROJECT}`, { stdio:'pipe' });
  const sa = JSON.parse(readFileSync(tmpKey,'utf8'));
  keyId = sa.private_key_id;
  admin = (await import('firebase-admin')).default;
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  const db=admin.firestore(), auth=admin.auth(), FV=admin.firestore.FieldValue;
  // Frisch geminteter Key braucht ein paar Sekunden Propagation, sonst invalid_grant.
  console.log('Warte kurz auf Key-Propagation…');
  await new Promise(r => setTimeout(r, 18000));

  let uid;
  try { const u=await auth.getUserByEmail(email); uid=u.uid; await auth.updateUser(uid,{displayName:name,photoURL}); }
  catch { const u=await auth.createUser({email,emailVerified:true,displayName:name,photoURL,password:randomBytes(24).toString('base64url')}); uid=u.uid; }

  await db.collection('users').doc(uid).set({ uid,email,displayName:name,photoURL,
    aiUsage:{tokensUsed:0,tokenLimit:0}, isAgent:true, agentKey:key, agentFunction:fn,
    updatedAt:FV.serverTimestamp(), createdAt:FV.serverTimestamp() },{merge:true});

  // Rolle
  let roleId=null; const rr=db.collection('tenants').doc(tenantId).collection('roles');
  const ex=await rr.where('name','==',roleName).limit(1).get();
  if(!ex.empty) roleId=ex.docs[0].id;
  else { const r=await rr.add({name:roleName,color:roleColor,description:`${roleName} (AI agent role)`,position:1,isSystem:false,systemKey:null,permissions:{allow:[],deny:[]},createdBy:tenantId,createdAt:FV.serverTimestamp(),updatedAt:FV.serverTimestamp()}); roleId=r.id; }

  await db.collection('tenants').doc(tenantId).collection('members').doc(uid).set({ uid,role:'Member',roleIds:roleId?[roleId]:[],groupIds:[],joinedAt:FV.serverTimestamp() },{merge:true});

  const token=genToken();
  const tref=await db.collection('tenants').doc(tenantId).collection('api_tokens').add({ tenantId,name,tokenHash:hashToken(token),tokenPrefix:token.substring(0,12),projectScope:null,permissions:perms,createdAt:FV.serverTimestamp(),lastUsedAt:null,expiresAt:null,createdBy:uid,agentKey:key });

  let projName=null;
  if (args.project) {
    const psnap=await db.collection('tenants').doc(tenantId).collection('projects').doc(args.project).get();
    if (psnap.exists){ projName=psnap.data().title; await psnap.ref.update({members:FV.arrayUnion(uid),memberIds:FV.arrayUnion(uid)}); }
  }

  tokens.tenantId=tokens.tenantId||tenantId;
  tokens.agents=tokens.agents||{};
  tokens.agents[key]={ uid,displayName:name,shortName:name.split(' ')[0],function:fn,email,token,tokenId:tref.id,photoURL, projectId:args.project||null, projectName:projName };
  writeFileSync(tokensPath, JSON.stringify(tokens,null,2));

  console.log(`OK: uid=${uid}  token=${token.substring(0,12)}…  -> tokens.json (gesamt ${Object.keys(tokens.agents).length})${projName?`  Projekt: ${projName}`:''}`);
} finally {
  try { if(existsSync(tmpKey)) rmSync(tmpKey); } catch {}
  try { if(keyId) execSync(`gcloud iam service-accounts keys delete ${keyId} --iam-account=${SA} --project=${PROJECT} --quiet`, {stdio:'pipe'}); } catch(e){ console.log('Hinweis: GCP-Key konnte nicht geloescht werden:', e.message?.slice(0,120)); }
}
console.log('Key aufgeraeumt. Fertig.');
process.exit(0);
