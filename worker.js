export const BOXES = ['Sol', 'Luna', 'Terra', 'Astra'];
export const DEFAULT_TIMERS = { phaseA: 15, phaseB_R1: 45, phaseB_R23: 60, phaseC: 30 };

export function generateBaseDeck() {
  const deck = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { if (i === j) continue; const c = [1,1,1,1]; c[i]=2; c[j]=0; deck.push(c); }
  return deck;
}
const BASE_DECK = generateBaseDeck();
const POOL_CACHE = new Map();

export function buildBalancedPool(N) {
  if (!Number.isInteger(N) || N < 3 || N > 8) throw new Error('N must be 3..8');
  if (POOL_CACHE.has(N)) return POOL_CACHE.get(N);
  const valid = [], chosen = [], sums = [0,0,0,0], twoCounts = [0,0,0,0];
  function bt(start, depth) {
    if (depth === N) {
      if (sums[0]!==N||sums[1]!==N||sums[2]!==N||sums[3]!==N) return;
      if (Math.max(...twoCounts) - Math.min(...twoCounts) > 1) return;
      valid.push(chosen.map(c => [...c])); return;
    }
    for (let idx = start; idx <= BASE_DECK.length - (N - depth); idx++) {
      const c = BASE_DECK[idx];
      if (sums[0]+c[0]>N||sums[1]+c[1]>N||sums[2]+c[2]>N||sums[3]+c[3]>N) continue;
      chosen.push(c); for (let b=0;b<4;b++){ sums[b]+=c[b]; if(c[b]===2) twoCounts[b]++; }
      bt(idx+1, depth+1);
      chosen.pop(); for (let b=0;b<4;b++){ sums[b]-=c[b]; if(c[b]===2) twoCounts[b]--; }
    }
  }
  bt(0, 0); POOL_CACHE.set(N, valid); return valid;
}

function cryptoRandomInt(max) {
  const arr = new Uint32Array(1), limit = Math.floor(0x100000000 / max) * max;
  let val; do { crypto.getRandomValues(arr); val = arr[0]; } while (val >= limit); return val % max;
}
function shuffleArray(arr) { const a = [...arr]; for (let i=a.length-1;i>0;i--){ const j=cryptoRandomInt(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }

export function dealRoundHoldings(teamIds) {
  const pool = buildBalancedPool(teamIds.length), combo = shuffleArray(pool[cryptoRandomInt(pool.length)]);
  const holdingsByTeam = {};
  teamIds.forEach((id, i) => { const c = combo[i]; holdingsByTeam[id] = { Sol: c[0], Luna: c[1], Terra: c[2], Astra: c[3] }; });
  return { holdingsByTeam };
}

export function validateVotes(votes) {
  if (!votes || typeof votes !== 'object') return { valid: false, error: '無效投票資料' };
  let total = 0;
  for (const b of BOXES) {
    const v = votes[b];
    if (!Number.isInteger(v) || v < 0) return { valid: false, error: b + ' 票數必須為非負整數' };
    if (v > 2) return { valid: false, error: '嚴禁 3-0 全押！單一黑盒上限 2 票' };
    total += v;
  }
  return total === 3 ? { valid: true } : { valid: false, error: '每組必須投出剛好 3 票' };
}

export function generateRandomValidVote() { const o = shuffleArray(BOXES), v = { Sol:0, Luna:0, Terra:0, Astra:0 }; v[o[0]]=2; v[o[1]]=1; return v; }

export function resolveRound({ votesByTeam, holdingsByTeam, preAuras, teamList }) {
  const voteTotals = { Sol:0, Luna:0, Terra:0, Astra:0 };
  for (const t of teamList) { const v = votesByTeam[t.id]; if (!v) continue; for (const b of BOXES) voteTotals[b] += (v[b] || 0); }
  const wheelEvents = [];
  function pickWinner(cands, rank) {
    const maxV = Math.max(...cands.map(b => voteTotals[b])), topV = cands.filter(b => voteTotals[b] === maxV);
    if (topV.length === 1) return { winner: topV[0], method: 'votes' };
    const maxA = Math.max(...topV.map(b => preAuras[b])), topA = topV.filter(b => preAuras[b] === maxA);
    if (topA.length === 1) return { winner: topA[0], method: 'aura' };
    const winner = topA[cryptoRandomInt(topA.length)];
    wheelEvents.push({ targetRank: rank, candidates: [...topA], winner, votes: maxV, preAura: maxA, reason: '票數（'+maxV+' 票）及賽前光環（+'+maxA+'）並列，公開轉盤抽籤決出第 '+rank+' 名' });
    return { winner, method: 'wheel' };
  }
  const firstRes = pickWinner([...BOXES], 1), rem = BOXES.filter(b => b !== firstRes.winner), secondRes = pickWinner(rem, 2);
  const others = rem.filter(b => b !== secondRes.winner).sort((a,b) => voteTotals[b]!==voteTotals[a]?voteTotals[b]-voteTotals[a]:preAuras[b]-preAuras[a]);
  const first = firstRes.winner, second = secondRes.winner;
  const baseScores = { Sol:0, Luna:0, Terra:0, Astra:0 }; baseScores[first]=3; baseScores[second]=2;
  const unitValues = { Sol:0, Luna:0, Terra:0, Astra:0 }; unitValues[first]=3+preAuras[first]; unitValues[second]=2+preAuras[second];
  const postAuras = { ...preAuras }; postAuras[first]+=1; postAuras[second]+=1;
  const teamBreakdowns = {};
  for (const t of teamList) {
    const h = holdingsByTeam[t.id] || { Sol:0, Luna:0, Terra:0, Astra:0 };
    const fp = h[first]*unitValues[first], sp = h[second]*unitValues[second];
    teamBreakdowns[t.id] = { teamId: t.id, teamName: t.name, holdings: {...h}, votes: votesByTeam[t.id]?{...votesByTeam[t.id]}:null, firstBox: first, firstShares: h[first], firstPts: fp, secondBox: second, secondShares: h[second], secondPts: sp, roundScore: fp+sp };
  }
  return { voteTotals, preAuras: {...preAuras}, postAuras, first, second, firstMethod: firstRes.method, secondMethod: secondRes.method, ranking: [first, second, ...others], baseScores, unitValues, wheelEvents, teamBreakdowns };
}

export function computeFinalRankings(teams) {
  const sorted = [...teams].sort((a,b) => b.totalScore!==a.totalScore ? b.totalScore-a.totalScore : ((b.roundScores?.[2]||0)-(a.roundScores?.[2]||0)) || a.name.localeCompare(b.name,'zh-Hant'));
  let rank = 1;
  return sorted.map((t, i) => {
    if (i > 0) { const p = sorted[i-1]; if (t.totalScore!==p.totalScore || (t.roundScores?.[2]||0)!==(p.roundScores?.[2]||0)) rank = i + 1; }
    return { ...t, rank, round3Score: t.roundScores?.[2] || 0 };
  });
}

function generateToken() { const b = new Uint8Array(12); crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2,'0')).join(''); }
function makeInitialRoom(roomCode) { return { roomCode, hostToken: generateToken(), status: 'LOBBY', round: 0, auras: { Sol:0, Luna:0, Terra:0, Astra:0 }, timers: {...DEFAULT_TIMERS}, timerEndsAt: null, timerPaused: false, timerRemainingMs: 0, teams: [], holdings: {}, votes: {}, lastResolution: null, history: [], wheelComplete: false, updatedAt: Date.now() }; }

export class BlackboxRoom {
  constructor(state, env) { this.state = state; this.env = env; this.room = null; this.sessions = new Map(); }
  async loadRoom(code = 'ROOM') { if (!this.room) { const s = await this.state.storage.get('room'); this.room = s || makeInitialRoom(code); if (!s) await this.saveRoom(); } return this.room; }
  async saveRoom() { if (!this.room) return; this.room.updatedAt = Date.now(); await this.state.storage.put('room', this.room); }
  isTeamConnected(id) { for (const m of this.sessions.values()) if (m.role==='player' && m.teamId===id) return true; return false; }
  buildPublicSnapshot() {
    const r = this.room, hide = r.status === 'ROUND_C';
    return { roomCode: r.roomCode, status: r.status, round: r.round, auras: {...r.auras}, timers: {...r.timers}, timerEndsAt: r.timerEndsAt, timerPaused: r.timerPaused, timerRemainingMs: r.timerRemainingMs, serverNow: Date.now(), teams: r.teams.map(t => ({ id: t.id, name: t.name, connected: this.isTeamConnected(t.id), hasVoted: Boolean(r.votes[t.id]), totalScore: hide?null:t.totalScore, manualDelta: hide?null:t.manualDelta, roundScores: hide?null:t.roundScores })), votedCount: Object.keys(r.votes).length, totalTeams: r.teams.length, lastResolution: (r.status==='ROUND_D'||r.status==='FINAL'||r.status==='REVEAL')?r.lastResolution:null, history: (r.status==='FINAL'||r.status==='REVEAL')?r.history:[], finalRankings: (r.status==='FINAL'||r.status==='REVEAL')?computeFinalRankings(r.teams):null, wheelComplete: r.wheelComplete };
  }
  buildHostSnapshot() { const b = this.buildPublicSnapshot(); b.hostTeams = this.room.teams.map(t => ({ id: t.id, name: t.name, connected: this.isTeamConnected(t.id), hasVoted: Boolean(this.room.votes[t.id]), totalScore: t.totalScore, manualDelta: t.manualDelta, roundScores: t.roundScores })); return b; }
  buildPlayerSnapshot(id) { const b = this.buildPublicSnapshot(), t = this.room.teams.find(x => x.id === id); b.myTeam = t ? { id: t.id, name: t.name, totalScore: t.totalScore, roundScores: t.roundScores, holdings: this.room.holdings[id]||null, myVotes: this.room.votes[id]||null } : null; return b; }
  broadcast() { for (const [ws, m] of this.sessions.entries()) { try { ws.send(JSON.stringify({ type: 'state', state: m.role==='host'?this.buildHostSnapshot():(m.role==='player'&&m.teamId?this.buildPlayerSnapshot(m.teamId):this.buildPublicSnapshot()) })); } catch(_) { this.sessions.delete(ws); } } }
  startTimer(sec) { const ms = Math.max(0, sec*1000); this.room.timerPaused=false; this.room.timerRemainingMs=ms; this.room.timerEndsAt=Date.now()+ms; }
  beginRound(num) { const r = this.room; r.round=num; r.status='ROUND_A'; r.votes={}; r.lastResolution=null; r.wheelComplete=false; r.holdings=dealRoundHoldings(r.teams.map(t=>t.id)).holdingsByTeam; this.startTimer(r.timers.phaseA); }
  finalizeRound() {
    const r = this.room, res = resolveRound({ votesByTeam: r.votes, holdingsByTeam: r.holdings, preAuras: r.auras, teamList: r.teams });
    for (const t of r.teams) { t.roundScores[r.round-1] = res.teamBreakdowns[t.id]?.roundScore || 0; t.totalScore = (t.roundScores[0]||0)+(t.roundScores[1]||0)+(t.roundScores[2]||0)+(t.manualDelta||0); }
    r.auras = {...res.postAuras}; r.lastResolution = { round: r.round, ...res }; r.history.push(r.lastResolution); r.status='ROUND_D'; r.wheelComplete = res.wheelEvents.length===0; r.timerEndsAt=null; r.timerPaused=false; r.timerRemainingMs=0;
  }
  async handleMessage(ws, meta, msg) {
    const r = this.room, sendErr = (e) => ws.send(JSON.stringify({ type: 'error', error: e }));
    if (msg.type === 'join_team') {
      const name = String(msg.teamName||'').trim().slice(0,20), tok = msg.token ? String(msg.token) : null;
      if (tok) { const ex = r.teams.find(t => t.token === tok); if (ex) { meta.role='player'; meta.teamId=ex.id; ws.send(JSON.stringify({type:'joined',teamId:ex.id,teamName:ex.name,token:ex.token})); this.broadcast(); return; } }
      if (name) { const bn = r.teams.find(t => t.name.toLowerCase() === name.toLowerCase()); if (bn) { meta.role='player'; meta.teamId=bn.id; ws.send(JSON.stringify({type:'joined',teamId:bn.id,teamName:bn.name,token:bn.token})); this.broadcast(); return; } }
      if (r.status !== 'LOBBY') { sendErr('遊戲已經開始，請輸入原有隊名重連'); return; }
      if (!name) { sendErr('請輸入隊名'); return; }
      if (r.teams.length >= 8) { sendErr('房間已滿（最多 8 組）'); return; }
      const nt = { id: 't_'+generateToken().slice(0,8), name, token: generateToken(), totalScore: 0, manualDelta: 0, roundScores: [0,0,0] };
      r.teams.push(nt); meta.role='player'; meta.teamId=nt.id; await this.saveRoom(); ws.send(JSON.stringify({type:'joined',teamId:nt.id,teamName:nt.name,token:nt.token})); this.broadcast(); return;
    }
    if (msg.type === 'submit_vote') {
      if (meta.role!=='player'||!meta.teamId||r.status!=='ROUND_C'||r.votes[meta.teamId]) { sendErr('目前無法投票'); return; }
      const chk = validateVotes(msg.votes); if (!chk.valid) { sendErr(chk.error); return; }
      r.votes[meta.teamId] = { Sol: msg.votes.Sol, Luna: msg.votes.Luna, Terra: msg.votes.Terra, Astra: msg.votes.Astra };
      if (Object.keys(r.votes).length === r.teams.length) this.finalizeRound();
      await this.saveRoom(); this.broadcast(); return;
    }
    if (meta.role !== 'host') { sendErr('需要主持權限'); return; }
    if (msg.type === 'host_next') {
      if (r.status==='LOBBY') { if (r.teams.length<3||r.teams.length>8) { sendErr('必須有 3 至 8 組'); return; } this.beginRound(1); }
      else if (r.status==='ROUND_A') { r.status='ROUND_B'; this.startTimer(r.round===1?r.timers.phaseB_R1:r.timers.phaseB_R23); }
      else if (r.status==='ROUND_B') { r.status='ROUND_C'; this.startTimer(r.timers.phaseC); }
      else if (r.status==='ROUND_C') { if (r.teams.some(t=>!r.votes[t.id])) { sendErr('仍有組別未投票'); return; } this.finalizeRound(); }
      else if (r.status==='ROUND_D') { if (r.round<3) this.beginRound(r.round+1); else { r.status='FINAL'; r.timerEndsAt=null; } }
    } else if (msg.type === 'host_pause_toggle') {
      if (r.timerPaused) { r.timerPaused=false; r.timerEndsAt=Date.now()+r.timerRemainingMs; }
      else if (r.timerEndsAt) { r.timerPaused=true; r.timerRemainingMs=Math.max(0, r.timerEndsAt-Date.now()); r.timerEndsAt=null; }
    } else if (msg.type === 'host_extend_timer') {
      const add = (Number(msg.seconds)||15)*1000; if (r.timerPaused) r.timerRemainingMs+=add; else if (r.timerEndsAt) r.timerEndsAt=Math.max(Date.now(),r.timerEndsAt)+add;
    } else if (msg.type === 'host_force_end_vote' && r.status==='ROUND_C') {
      if (msg.autoVote) for (const t of r.teams) if (!r.votes[t.id]) r.votes[t.id] = generateRandomValidVote();
      this.finalizeRound();
    } else if (msg.type === 'host_nudge_unvoted') {
      for (const [sock, m] of this.sessions.entries()) if (m.role==='player'&&m.teamId&&!r.votes[m.teamId]) try { sock.send(JSON.stringify({type:'nudge',message:'⏰ 主持人催票啦！請盡快鎖定 3 票！'})); } catch(_) {}
      return;
    } else if (msg.type === 'host_adjust_score') {
      const t = r.teams.find(x => x.id === msg.teamId); if (t) { t.manualDelta=(t.manualDelta||0)+(Number(msg.delta)||0); t.totalScore=(t.roundScores[0]||0)+(t.roundScores[1]||0)+(t.roundScores[2]||0)+t.manualDelta; }
    } else if (msg.type === 'host_rename_team') {
      const t = r.teams.find(x => x.id === msg.teamId); if (t && msg.newName) t.name = String(msg.newName).trim().slice(0,20);
    } else if (msg.type === 'host_kick_team' && r.status==='LOBBY') {
      r.teams = r.teams.filter(x => x.id !== msg.teamId);
      for (const [sock, m] of this.sessions.entries()) if (m.teamId===msg.teamId) { try { sock.send(JSON.stringify({type:'kicked'})); sock.close(); } catch(_) {} this.sessions.delete(sock); }
    } else if (msg.type === 'host_update_timers' && msg.timers) {
      r.timers = { phaseA: Math.max(5,Number(msg.timers.phaseA)||15), phaseB_R1: Math.max(10,Number(msg.timers.phaseB_R1)||45), phaseB_R23: Math.max(10,Number(msg.timers.phaseB_R23)||60), phaseC: Math.max(10,Number(msg.timers.phaseC)||30) };
    } else if (msg.type === 'host_wheel_done') { r.wheelComplete = true; }
    else if (msg.type === 'host_jump_final') { r.status='FINAL'; r.timerEndsAt=null; }
    else if (msg.type === 'host_enter_reveal') { r.status='REVEAL'; }
    else if (msg.type === 'host_reset') {
      const oldTeams = msg.keepTeams ? r.teams.map(t=>({...t,totalScore:0,manualDelta:0,roundScores:[0,0,0]})) : [];
      const oldTok = r.hostToken, oldCode = r.roomCode, oldTimers = {...r.timers};
      this.room = makeInitialRoom(oldCode); this.room.hostToken=oldTok; this.room.timers=oldTimers; this.room.teams=oldTeams;
    }
    await this.saveRoom(); this.broadcast();
  }
  async fetch(request) {
    const url = new URL(request.url);
    await this.loadRoom((url.searchParams.get('room')||'ROOM').toUpperCase());
    if (url.pathname.endsWith('/create')) return new Response(JSON.stringify({ roomCode: this.room.roomCode, hostToken: this.room.hostToken }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair(), [client, server] = Object.values(pair); server.accept();
      const meta = { role: (url.searchParams.get('role')==='host' && url.searchParams.get('hostToken')===this.room.hostToken) ? 'host' : 'viewer', teamId: null };
      this.sessions.set(server, meta);
      server.addEventListener('message', async ev => { try { await this.handleMessage(server, meta, JSON.parse(ev.data)); } catch(e) { try { server.send(JSON.stringify({type:'error',error:e.message})); } catch(_) {} } });
      const cleanup = () => { this.sessions.delete(server); this.broadcast(); };
      server.addEventListener('close', cleanup); server.addEventListener('error', cleanup);
      server.send(JSON.stringify({ type: 'state', state: meta.role==='host'?this.buildHostSnapshot():this.buildPublicSnapshot() }));
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response(JSON.stringify({ status: 'ok', roomCode: this.room.roomCode }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
}

function randomRoomCode() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(4); crypto.getRandomValues(b); return Array.from(b, x => c[x % c.length]).join(''); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (url.pathname === '/health') return new Response(JSON.stringify({ ok: true, app: 'blackbox-idol', version: '2.1.2' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    if (url.pathname === '/api/create-room' && request.method === 'POST') {
      const roomCode = randomRoomCode(), stub = env.BLACKBOX_ROOM.get(env.BLACKBOX_ROOM.idFromName(roomCode));
      const doUrl = new URL(request.url); doUrl.pathname = '/create'; doUrl.searchParams.set('room', roomCode);
      return stub.fetch(doUrl.toString());
    }
    if (url.pathname === '/ws') {
      const roomCode = (url.searchParams.get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
      if (!roomCode || roomCode.length < 3 || roomCode.length > 8) return new Response('無效房號', { status: 400 });
      return env.BLACKBOX_ROOM.get(env.BLACKBOX_ROOM.idFromName(roomCode)).fetch(request);
    }
    return new Response('黑盒造神：Sol / Luna / Terra / Astra API (v2.1.2)', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
  }
};
