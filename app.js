 // ══════════════════════════════════════════════════════
  // SECURITY: Supabase publishable key (safe for frontend)
  // NEVER put your service_role key here.
  // All AI/DB operations must go through Edge Functions
  // with server-side auth validation.
  // ══════════════════════════════════════════════════════
  const SB_URL = 'https://ngxkiuokbulqezxvrkxq.supabase.co';
  const SB_KEY = 'sb_publishable__9fTb2Z2-OMFAILIQ0KNZw_rGgIEMe2';
  const _sb    = supabase.createClient(SB_URL, SB_KEY);

  // ── Rate limiting (client-side, defence-in-depth) ──
  const RATE = { count:0, limit:20, window:60000, last:Date.now() };
  function checkRate() {
    const now = Date.now();
    if (now - RATE.last > RATE.window) { RATE.count = 0; RATE.last = now; }
    if (RATE.count >= RATE.limit) return false;
    RATE.count++; return true;
  }

  // ── Input/output sanitization ──
  function sanitize(str, max = 2000) {
    return String(str || '')
      .slice(0, max)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeFmt(text) {
    return fmt(sanitize(text, 8000));
  }

  // ── State ──
  let currentKB   = 'bu1';
  let chatOpen    = false;
  let lang        = 'en';
  let user        = null;
  let history     = [];

  // ══════════════════════════════════════════════════════
  // TRANSLATIONS
  // ══════════════════════════════════════════════════════
  const T = {
    en: {
      heroTag:'TERMINAL ACCESS · KNOWLEDGE STREAMS', heroTitle:'SZS AI Knowledge Base',
      heroDesc:'Select a data stream below, then open the assistant to query it. Each stream is isolated and access-controlled.',
      streamsLabel:'Data Streams',
      card1Title:'A Product Database', card1Desc:'Structured knowledge index for A Product — specifications, test data, and engineering records.',
      card2Title:'Non-A Product Database', card2Desc:'Flexible knowledge index for Non-A Product — diverse formats and multi-domain data.',
      card3Title:'Newcomer Training', card3Desc:'Onboarding protocols, induction materials, and department standard operating procedures.',
      card4Title:'General R&D Database', card4Desc:'Research findings, legacy technical archives, and collaborative discovery records.',
      cardCta:'QUERY →', securityNotice:'AUTHORIZED PERSONNEL ONLY · INTERNAL USE ONLY',
      chatTitle:'SZS AI Assistant', chatSubtitle:'RIZEN · POPUP INTERFACE',
      sendBtn:'Send', chatPh:'Type your question…',
      welcomeSys:'Stream selected. Ready.', welcomeAi:'Hello. Select a stream card, then ask your question.',
      kbPrefix:'Stream:',
      switched:'Stream switched to ', connErr:'Connection error. Try again.',
      sending:'Sending…',
      authTitle:'Authenticate', loginTab:'LOGIN', signupTab:'SIGN UP',
      loginBtn:'Login', logoutBtn:'Logout', signupBtn:'Create Account',
      companyIdLabel:'COMPANY ID', passwordLabel:'PASSWORD',
      confirmPasswordLabel:'CONFIRM PASSWORD', fullNameLabel:'FULL NAME',
      signupHint:'Secured via Supabase Auth.',
      loginOk:'Authenticated successfully.', logoutOk:'Signed out.',
      signupOk:'Account created. You may now log in.',
      fieldReq:'Complete all fields.', pwMismatch:'Passwords do not match.',
      pwShort:'Password must be at least 6 characters.',
      userExists:'This Company ID is already registered.',
      badCreds:'Incorrect Company ID or password.',
      loginReq:'Please authenticate to send messages.',
      loggedAs:'Session:',
      agentBtn:'RIZEN Workspace →',
    },
    'zh-TW': {
      heroTag:'終端存取 · 知識資料流', heroTitle:'SZS AI 知識核心',
      heroDesc:'請選擇下方資料流，再開啟助理進行查詢。每個資料流均獨立控管。',
      streamsLabel:'資料流',
      card1Title:'A Product 資料庫', card1Desc:'A Product 的結構化知識索引 — 規格、測試資料與工程紀錄。',
      card2Title:'Non-A Product 資料庫', card2Desc:'Non-A Product 的彈性知識索引 — 多樣格式與跨領域資料。',
      card3Title:'新人訓練資料庫', card3Desc:'新進人員入職流程、訓練模組與研發部門標準作業程序。',
      card4Title:'研發通用資料庫', card4Desc:'研究成果、歷史技術檔案與協作知識紀錄。',
      cardCta:'查詢 →', securityNotice:'僅限授權人員 · 內部使用',
      chatTitle:'SZS AI 助理', chatSubtitle:'RIZEN · 彈出介面',
      sendBtn:'送出', chatPh:'請輸入您的問題…',
      welcomeSys:'資料流已選擇，就緒。', welcomeAi:'您好，請選擇資料流卡片後輸入問題。',
      kbPrefix:'資料流：',
      switched:'已切換至 ', connErr:'連線錯誤，請重試。',
      sending:'傳送中…',
      authTitle:'身份驗證', loginTab:'登入', signupTab:'註冊',
      loginBtn:'登入', logoutBtn:'登出', signupBtn:'建立帳號',
      companyIdLabel:'公司工號', passwordLabel:'密碼',
      confirmPasswordLabel:'確認密碼', fullNameLabel:'姓名',
      signupHint:'透過 Supabase Auth 安全建立帳號。',
      loginOk:'驗證成功。', logoutOk:'已登出。',
      signupOk:'帳號已建立，請登入。',
      fieldReq:'請填寫所有欄位。', pwMismatch:'密碼不一致。',
      pwShort:'密碼至少需 6 個字元。',
      userExists:'此工號已被註冊。',
      badCreds:'工號或密碼錯誤。',
      loginReq:'請先驗證身份再傳送訊息。',
      loggedAs:'目前登入：',
      agentBtn:'RIZEN 工作區 →',
    }
  };

  const KB = {
    en:    { bu1:'BU1', bu3:'BU3', training:'NEWCOMER TRAINING', general:'GENERAL R&D', line:'LINE MESSAGING FEED' },
    'zh-TW':{ bu1:'BU1', bu3:'BU3', training:'新人訓練', general:'研發通用', line:'LINE 訊息饋送' }
  };

  // ══════════════════════════════════════════════════════
  // I18N
  // ══════════════════════════════════════════════════════
  function applyLang(l) {
    lang = l;
    document.documentElement.lang = l;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (T[l][k]) el.textContent = T[l][k];
    });
    const ci = document.getElementById('chatInput');
    if (ci) ci.placeholder = T[l].chatPh;
    const ws = document.getElementById('welcomeSys');
    if (ws) ws.textContent = T[l].welcomeSys;
    const wa = document.getElementById('welcomeAi');
    if (wa) wa.innerHTML = safeFmt(T[l].welcomeAi);
    document.getElementById('langBtn').textContent = l === 'en' ? '繁中' : 'EN';
    updateKB();
    updateUserUI();
  }
  function toggleLang() { applyLang(lang === 'en' ? 'zh-TW' : 'en'); }

  function applySavedTheme() {
    const saved = localStorage.getItem('szs_theme');
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const useLight = saved ? saved === 'light' : prefersLight;
    document.body.classList.toggle('light-mode', useLight);
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = useLight ? '🌙' : '☀️';
  }

  function toggleTheme() {
    const useLight = !document.body.classList.contains('light-mode');
    document.body.classList.toggle('light-mode', useLight);
    localStorage.setItem('szs_theme', useLight ? 'light' : 'dark');
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = useLight ? '🌙' : '☀️';
  }

  function updateKB() {
    const el = document.getElementById('kbText');
    if (el) el.innerHTML = T[lang].kbPrefix + ' <strong>' + (KB[lang][currentKB] || currentKB.toUpperCase()) + '</strong>';
  }


  // ══════════════════════════════════════════════════════
  // CHAT POPUP
  // ══════════════════════════════════════════════════════
  function dismissTeaser() {
    const t = document.getElementById('teaserBubble');
    if (t) t.style.display = 'none';
  }
  function toggleChat() {
    chatOpen = !chatOpen;
    document.getElementById('chatPopup').classList.toggle('open', chatOpen);
    if (chatOpen) { document.getElementById('chatInput').focus(); dismissTeaser(); }
  }
  function selectKB(kb, el) {
    currentKB = kb; updateKB();
    document.querySelectorAll('.stream-card').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    sysMsg(T[lang].switched + (KB[lang][kb] || kb.toUpperCase()));
  }

  // ── Message rendering ──
  function fmt(text) {
  if (!text) return '';
  return String(text)
    .replace(/^### (.+)$/gm, '<div style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent);margin:12px 0 4px;letter-spacing:0.05em">$1</div>')
    .replace(/^## (.+)$/gm,  '<div style="font-family:var(--mono);font-size:13px;font-weight:700;color:#fff;margin:16px 0 6px;letter-spacing:0.05em">$1</div>')
    .replace(/^# (.+)$/gm,   '<div style="font-family:var(--mono);font-size:15px;font-weight:700;color:#fff;margin:20px 0 8px;letter-spacing:0.05em;border-bottom:1px solid var(--rim);padding-bottom:6px">$1</div>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(\d+)\.\s+(.+)$/gm, '<div style="display:flex;gap:7px;margin:2px 0"><span style="color:var(--accent);font-weight:700;min-width:14px">$1.</span><span>$2</span></div>')
    .replace(/^[•\-\*]\s+(.+)$/gm, '<div style="display:flex;gap:7px;margin:2px 0"><span style="color:var(--accent)">•</span><span>$1</span></div>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--rim);margin:12px 0">')
    .replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
}

  function addMsg(role, text) {
    const c = document.getElementById('chatMsgs');
    const d = document.createElement('div');
    d.className = 'msg ' + role;
    if (role === 'ai') d.innerHTML = safeFmt(text); else d.textContent = text;
    c.appendChild(d); c.scrollTop = c.scrollHeight;
    return d;
  }
  function sysMsg(text) {
    const c = document.getElementById('chatMsgs');
    const d = document.createElement('div');
    d.className = 'msg sys'; d.textContent = text;
    c.appendChild(d); c.scrollTop = c.scrollHeight;
  }
  function clearChat() {
    history = [];
    const c = document.getElementById('chatMsgs'); c.innerHTML = '';
    const s = document.createElement('div'); s.className='msg sys'; s.textContent = T[lang].welcomeSys;
    const a = document.createElement('div'); a.className='msg ai'; a.innerHTML = safeFmt(T[lang].welcomeAi);
    c.appendChild(s); c.appendChild(a);
    sysMsg('New session started.');
  }
  function handleKey(e) {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(e); }
  }

  // ── SEND MESSAGE ──
  async function sendMsg(e) {
    e.preventDefault();
    if (!user) { sysMsg(T[lang].loginReq); openAuth(); return; }
    if (!checkRate()) { sysMsg('Rate limit reached. Please wait a moment.'); return; }

    const input   = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const raw = input.value.trim();
    if (!raw) return;
    const message = raw.slice(0, 2000); // hard cap

    const { data:{ session } } = await _sb.auth.getSession();
    if (!session) { openAuth(); return; }

    addMsg('user', raw);
    history.push({ role:'user', parts:[{ text: message }] });
    input.value = '';
    sendBtn.disabled = true; sendBtn.textContent = T[lang].sending;

    const c = document.getElementById('chatMsgs');
    const bubble = document.createElement('div');
    bubble.className = 'msg ai streaming';
    c.appendChild(bubble); c.scrollTop = c.scrollHeight;

    try {
      const res = await fetch(`${SB_URL}/functions/v1/ai-chat`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` },
        body: JSON.stringify({ message, knowledgeBaseId: currentKB, history: history.slice(-10) })
      });
      if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.error||'Request failed'); }

      const srcHdr = res.headers.get('X-Sources');
      const srcs   = srcHdr ? JSON.parse(srcHdr) : [];
      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let full = '';
      while(true) {
        const { done, value } = await reader.read(); if(done) break;
        full += dec.decode(value, { stream:true });
        bubble.innerHTML = safeFmt(full); c.scrollTop = c.scrollHeight;
      }

      if (full.startsWith('__OPEN_URL__')) {
        const m = full.match(/__OPEN_URL__(.+?)__TITLE__(.+)/);
        if (m) { bubble.innerHTML = safeFmt(`Opening **${m[2]}**...`); window.open(m[1], '_blank', 'noopener,noreferrer'); }
      } else {
        history.push({ role:'model', parts:[{ text: full }] });
      }
      bubble.classList.remove('streaming');
      bubble.innerHTML = safeFmt(full);

      if (srcs.length) {
        const sd = document.createElement('div');
        sd.style.cssText='display:flex;flex-wrap:wrap;gap:4px;padding:4px 0 0';
        srcs.forEach(n=>{
          const t=document.createElement('span');
          t.style.cssText='font-size:10px;padding:2px 7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:var(--muted);font-family:var(--mono)';
          t.textContent='📄 '+n; sd.appendChild(t);
        });
        bubble.after(sd);
      }
    } catch(err) {
      console.error(err); bubble.remove();
      sysMsg(T[lang].connErr + ' ' + err.message);
    } finally {
      sendBtn.disabled=false; sendBtn.textContent=T[lang].sendBtn;
    }
  }

  // ══════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════
  function openAuth()  { document.getElementById('authOverlay').classList.add('show'); document.body.classList.add('modal-open'); clearAuthMsg(); }
  function closeAuth() { document.getElementById('authOverlay').classList.remove('show'); document.body.classList.remove('modal-open'); }
  function switchTab(t) {
    ['Login','Signup'].forEach(x=>{
      document.getElementById('tab'+x).classList.toggle('on', (x.toLowerCase())===t);
      document.getElementById(x.toLowerCase()+'Form').classList.toggle('on', (x.toLowerCase())===t);
    });
    clearAuthMsg();
  }
  function setAuthMsg(txt, err) {
    const el=document.getElementById('authMsg');
    el.textContent=txt; el.className='auth-msg'+(err?' err':'');
  }
  function clearAuthMsg() { const el=document.getElementById('authMsg'); el.textContent=''; el.className='auth-msg'; }
  function setBtnLoad(id, loading, key) {
    const b=document.getElementById(id); b.disabled=loading; b.textContent=loading?'…':T[lang][key];
  }

  async function doSignup(e) {
    e.preventDefault();
    const t=T[lang];
    const name=document.getElementById('signupName').value.trim();
    const cid =document.getElementById('signupId').value.trim();
    const pw  =document.getElementById('signupPw').value;
    const pw2 =document.getElementById('signupPw2').value;
    if(!name||!cid||!pw||!pw2){setAuthMsg(t.fieldReq,true);return;}
    if(pw!==pw2){setAuthMsg(t.pwMismatch,true);return;}
    if(pw.length<6){setAuthMsg(t.pwShort,true);return;}
    setBtnLoad('signupBtn',true,'signupBtn'); clearAuthMsg();
    const {error}=await _sb.auth.signUp({
      email:`${cid.toLowerCase()}@szs.internal`, password:pw,
      options:{data:{full_name:name, company_id:cid}}
    });
    setBtnLoad('signupBtn',false,'signupBtn');
    if(error){setAuthMsg(error.message.toLowerCase().includes('already')?t.userExists:error.message,true);return;}
    setAuthMsg(t.signupOk,false);
    document.getElementById('signupForm').reset();
    setTimeout(()=>switchTab('login'),1200);
  }

  async function doLogin(e) {
    e.preventDefault();
    const t=T[lang];
    const cid=document.getElementById('loginId').value.trim();
    const pw =document.getElementById('loginPw').value;
    if(!cid||!pw){setAuthMsg(t.fieldReq,true);return;}

    setBtnLoad('loginBtn',true,'loginBtn');
    clearAuthMsg();

    const { data, error } = await _sb.auth.signInWithPassword({
      email:`${cid.toLowerCase()}@szs.internal`,
      password:pw
    });

    setBtnLoad('loginBtn',false,'loginBtn');

    if(error){
      setAuthMsg(error.message.toLowerCase().includes('invalid')?t.badCreds:error.message,true);
      return;
    }

    document.getElementById('loginForm').reset();
    setUserFromSession(data.session);
    closeAuth();
    updateUserUI();
    sysMsg(t.loginOk);
  }

  function setUserFromSession(session) {
    if (!session?.user) {
      user = null;
      return;
    }

    const m = session.user.user_metadata || {};
    user = {
      id: session.user.id,
      cid: m.company_id || session.user.email.replace('@szs.internal',''),
      name: m.full_name || ''
    };
  }

  async function doLogout() {
    const t = T[lang];
    await _sb.auth.signOut();
    user = null;
    closeAuth();
    updateUserUI();
    sysMsg(t.logoutOk);
  }

  _sb.auth.onAuthStateChange(async(event,session)=>{
    const wasLoggedIn = !!user;
    setUserFromSession(session);
    updateUserUI();

    if(event === 'SIGNED_IN') {
      closeAuth();
    }

    if(event === 'SIGNED_OUT' && wasLoggedIn) {
      closeAuth();
    }
  });

  function updateUserUI() {
    const chip=document.getElementById('userChip');
    const lb=document.getElementById('loginOpenBtn');
    const lo=document.getElementById('logoutBtn');
    if(user){
      chip.style.display='inline-flex'; chip.textContent=T[lang].loggedAs+' '+user.cid;
      lb.style.display='none'; lo.style.display='inline-block';
    } else {
      chip.style.display='none'; lb.style.display='inline-block'; lo.style.display='none';
    }
  }

  // ══════════════════════════════════════════════════════
  // PAGE NAV
  // ══════════════════════════════════════════════════════
  function goAgent() {
    document.getElementById('mainPage').style.display='none';
    document.getElementById('agentPage').style.display='block';
    document.getElementById('chatToggleBtn').style.display='none';
    dismissTeaser();
    countSrcs();
  }
  function goMain() {
    document.getElementById('mainPage').style.display='';
    document.getElementById('agentPage').style.display='none';
    document.getElementById('chatToggleBtn').style.display='';
  }

  // ══════════════════════════════════════════════════════
  // SOURCES
  // ══════════════════════════════════════════════════════
  function toggleSrc(el) {
    el.classList.toggle('active');
    el.querySelector('.src-check').textContent = el.classList.contains('active') ? '✓' : '';
    countSrcs();
  }
  function countSrcs() {
    const n=document.querySelectorAll('#srcList .src-item.active').length;
    const b=document.getElementById('srcBadge');
    const r=document.getElementById('agentSrcCount');
    if(b) b.textContent=n;
    if(r) r.textContent=n+' source'+(n!==1?'s':'')+' selected';
  }
  function filterSrc(q) {
    document.querySelectorAll('#srcList .src-item').forEach(item=>{
      const n=item.querySelector('.src-name')?.textContent?.toLowerCase()||'';
      item.style.display=n.includes(q.toLowerCase())?'':'none';
    });
  }
  function triggerUpload() { document.getElementById('fileInput').click(); }
  function handleUpload(e) {
    const f=e.target.files[0]; if(!f) return;
    const item=document.createElement('div');
    item.className='src-item active';
    item.innerHTML=`<div class="src-icon pdf">📄</div><div class="src-info"><div class="src-name">${sanitize(f.name, 120)}</div><div class="src-meta">${(f.size/1024).toFixed(0)} KB</div></div><div class="src-check">✓</div>`;
    item.onclick=()=>toggleSrc(item);
    document.getElementById('uploadedSrcs').appendChild(item);
    countSrcs(); e.target.value='';
  }
  function addWebSrc() {
    const url=prompt('Paste a URL:'); if(!url||!url.startsWith('http')) return;
    const domain=new URL(url).hostname.replace('www.','');
    const item=document.createElement('div');
    item.className='src-item active';
    item.innerHTML=`<div class="src-icon web">🌐</div><div class="src-info"><div class="src-name">${sanitize(domain, 80)}</div><div class="src-meta">${sanitize(url.slice(0,28), 80)}…</div></div><div class="src-check">✓</div>`;
    item.onclick=()=>toggleSrc(item);
    document.getElementById('webSrcs').appendChild(item);
    countSrcs();
  }
  function addNoteSrc() {
    const txt=prompt('Type or paste your note:'); if(!txt) return;
    const item=document.createElement('div');
    item.className='src-item active';
    item.innerHTML=`<div class="src-icon note">📝</div><div class="src-info"><div class="src-name">Note</div><div class="src-meta">${sanitize(txt.slice(0,36), 120)}…</div></div><div class="src-check">✓</div>`;
    item.onclick=()=>toggleSrc(item);
    document.getElementById('noteSrcs').appendChild(item);
    const nl=document.getElementById('savedNotes'); nl.innerHTML='';
    const ne=document.createElement('div'); ne.className='saved-note';
    ne.innerHTML=`<div class="note-dot"></div>${sanitize(txt.slice(0,38), 120)}${txt.length>38?'…':''}`;
    nl.appendChild(ne); countSrcs();
  }
  function addSrcPrompt() {
    const c=prompt('1 = Upload file\n2 = Add URL\n3 = Add note\n\nEnter 1, 2, or 3:');
    if(c==='1') triggerUpload();
    else if(c==='2') addWebSrc();
    else if(c==='3') addNoteSrc();
  }

  // ══════════════════════════════════════════════════════
  // AGENT CHAT
  // ══════════════════════════════════════════════════════
  function agentKey(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();agentSend();} }
  function agentResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,96)+'px'; }
  async function agentSend() {
  if (!user) { addAgentMsg('ai', 'Please log in to use the workspace.'); openAuth(); return; }
  if (!checkRate()) { addAgentMsg('ai', 'Rate limit reached. Please wait a moment.'); return; }

  const input = document.getElementById('agentInput');
const msg = input.value.trim();
if (!msg) return;

// Block if no sources selected
const selectedSrcs = [...document.querySelectorAll('#srcList .src-item.active')];
if (selectedSrcs.length === 0) {
  addAgentMsg('ai', '⚠️ No sources selected. Please select at least one source from the left panel.');
  return;
}

  input.value = ''; input.style.height = 'auto';
  addAgentMsg('user', msg);

  // ── Orchestrator: detect task intent and auto-route to tool ──
  const lower = msg.toLowerCase();
  const intentMap = [
    { tool: 'dfm',          keys: ['dfm','design for manufacture','design for manufacturability'] },
    { tool: 'bom',          keys: ['bom','bill of material','parts list'] },
    { tool: 'report',       keys: ['report','r&d report','generate report'] },
    { tool: 'summary',      keys: ['summary','summarize','executive brief','brief'] },
    { tool: 'line-digest',  keys: ['line digest','line feed','line summary','messaging digest'] },
    { tool: 'meeting',      keys: ['meeting','action item','minutes'] },
    { tool: 'fea',          keys: ['fea','finite element','binning','simulation result'] },
    { tool: 'torque',       keys: ['torque','torque spec','hinge torque'] },
    { tool: 'slide',        keys: ['slide','presentation','deck','pptx'] },
  ];
  const matched = intentMap.find(({ keys }) => keys.some(k => lower.includes(k)));
  if (matched) {
    // Show intent detection notice in chat, then open tool modal with user's message as extra context
    addAgentMsg('ai', `🔍 Task detected: **${TOOLS[matched.tool].name}**. Running against your active sources…`);
    runToolWithContext(matched.tool, msg);
    return; // skip plain chat, tool handles the response
  }
  // No tool intent → fall through to normal agent chat below

  const { data: { session } } = await _sb.auth.getSession();
  if (!session) { openAuth(); return; }

  // Get all active KB sources
  const activeSrcs = [...document.querySelectorAll('#srcList .src-item.active')]
    .map(el => el.dataset.src).filter(Boolean);
  const kbSources = activeSrcs.filter(s => ['bu1','bu3','training','general'].includes(s));
  const kb = kbSources.length > 0 ? kbSources[0] : currentKB;
  const allActiveSources = activeSrcs; // pass full list to edge function

  document.getElementById('agentScan').classList.add('on');
  document.getElementById('agentSendBtn').disabled = true;

  // Create streaming bubble
  const c = document.getElementById('agentMsgs');
  const w = document.createElement('div'); w.className = 'agent-msg ai';
  const b = document.createElement('div'); b.className = 'agent-bubble streaming';
  const ts = document.createElement('div'); ts.className = 'agent-ts'; ts.textContent = 'RIZEN · thinking…';
  w.appendChild(b); w.appendChild(ts); c.appendChild(w); c.scrollTop = c.scrollHeight;

  try {
    const res = await fetch(`${SB_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ message: msg, knowledgeBaseId: kb, activeSources: allActiveSources, mode: 'agent' })
    });

    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Request failed'); }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let full = '';

    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      full += dec.decode(value, { stream: true });
      if (!full.startsWith('__OPEN_URL__')) {
        b.innerHTML = safeFmt(full); c.scrollTop = c.scrollHeight;
      }
    }

    b.classList.remove('streaming');
    b.innerHTML = safeFmt(full);
    ts.textContent = 'RIZEN · ' + new Date().toLocaleTimeString();

  } catch (err) {
    b.innerHTML = safeFmt('Error: ' + err.message);
    ts.textContent = 'RIZEN · error';
  } finally {
    document.getElementById('agentScan').classList.remove('on');
    document.getElementById('agentSendBtn').disabled = false;
  }
}
  function addAgentMsg(role,text) {
    const c=document.getElementById('agentMsgs');
    const w=document.createElement('div'); w.className='agent-msg '+role;
    const b=document.createElement('div'); b.className='agent-bubble'; b.innerHTML=safeFmt(text);
    const ts=document.createElement('div'); ts.className='agent-ts';
    ts.textContent=role==='user'?'You':'RIZEN · '+new Date().toLocaleTimeString();
    w.appendChild(b); w.appendChild(ts); c.appendChild(w); c.scrollTop=c.scrollHeight;
  }
  function clearAgentChat() {
    const c=document.getElementById('agentMsgs'); c.innerHTML='';
    addAgentMsg('ai','Session cleared. Select sources and ask anything.');
  }

  // ══════════════════════════════════════════════════════
  // TOOLS
  // ══════════════════════════════════════════════════════
  const TOOLS = {
    report:      { icon:'📊', name:'R&D Report Generator',   prompt:'Generate a structured R&D report from active sources.' },
    dfm:         { icon:'🔧', name:'DFM Document Maker',     prompt:'Generate a DFM document from specs in active sources.' },
    bom:         { icon:'📋', name:'BOM Extractor',          prompt:'Extract Bill of Materials from active documents.' },
    summary:     { icon:'⚡', name:'Smart Summary',          prompt:'Generate an executive summary of all active sources.' },
    'line-digest':{ icon:'💬', name:'LINE Feed Digest',       prompt:'Summarize and extract insights from LINE AI feed data.' },
    meeting:     { icon:'🎙️', name:'Meeting Notes AI',       prompt:'Extract action items from meeting notes.' },
    fea:         { icon:'🔬', name:'FEA Binning Agent',      prompt:'Analyze and categorize FEA simulation results.' },
    torque:      { icon:'⚙️', name:'Torque Calculator',      prompt:'Calculate torque specifications from hinge parameters.' },
    slide:       { icon:'🖼️', name:'Slide Deck Builder',     prompt:'Convert source content into a structured slide outline.' },
  };

    // Called by orchestrator — merges user's natural language with the tool prompt
async function runToolWithContext(id, userContext) {
  const tool = TOOLS[id]; if (!tool) return;
  if (!checkRate()) return;

  const { data: { session } } = await _sb.auth.getSession();
  if (!session) { openAuth(); return; }

  const activeSrcs = [...document.querySelectorAll('#srcList .src-item.active')]
    .map(el => el.dataset.src).filter(Boolean);
  const kb = activeSrcs.find(s => ['bu1','bu3','training','general'].includes(s)) || currentKB;

  const ov = document.getElementById('outputOverlay');
  const titleEl = document.getElementById('outputTitle');
  const bodyEl = document.getElementById('outputBody');
  const scanEl = document.getElementById('outputScan');

  titleEl.textContent = tool.icon + '  ' + tool.name;
  bodyEl.innerHTML = '<span style="font-family:var(--mono);font-size:11px;color:var(--muted)">Generating…</span>';
  scanEl.classList.add('on');
  ov.classList.add('show');

  // Merge user instruction with tool base prompt
  const basePrompts = {
    summary: `Generate a concise executive summary of all available information in the ${kb.toUpperCase()} knowledge base. Structure it with: Key Findings, Main Topics, and Recommendations.`,
    report:  `Generate a structured R&D report from the ${kb.toUpperCase()} knowledge base. Include: Overview, Key Technical Findings, Data Summary, Recommendations, Next Steps.`,
    bom:     `Extract all Bill of Materials information from the ${kb.toUpperCase()} knowledge base. List every component, material, part number, quantity, and specification.`,
    dfm:     `Generate a Design for Manufacturability (DFM) document based on the ${kb.toUpperCase()} knowledge base. Include: material considerations, manufacturing constraints, tolerances, assembly notes, potential issues.`,
    meeting: `Extract and organize all action items, decisions, and key discussion points from the ${kb.toUpperCase()} knowledge base.`,
    fea:     `Analyze and categorize all FEA simulation results from the ${kb.toUpperCase()} knowledge base into PASS, MARGINAL, FAIL categories.`,
    torque:  `Extract all torque specifications and mechanical data from the ${kb.toUpperCase()} knowledge base as a structured specification table.`,
    slide:   `Create a structured slide outline (6-8 slides) from the ${kb.toUpperCase()} knowledge base. Format each as: [SLIDE N: Title] + bullet points.`,
    'line-digest': `Summarize the most recent information as a daily digest with: Top Stories, Key Updates, Action Required.`,
  };

  // Append user's specific instruction to the base prompt
  const prompt = (basePrompts[id] || tool.prompt) +
    `\n\nAdditional instruction from user: "${userContext}"` +
    `\n\nActive sources: ${activeSrcs.join(', ') || kb}. Cross-reference all active sources where relevant.`;

  try {
    const res = await fetch(`${SB_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ message: prompt, knowledgeBaseId: kb, activeSources: activeSrcs, mode: 'agent' })
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||'Request failed'); }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let full = '';
    bodyEl.innerHTML = '';

    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      full += dec.decode(value, { stream: true });
      bodyEl.innerHTML = safeFmt(full);
    }
    scanEl.classList.remove('on');
    bodyEl.innerHTML = safeFmt(full);
    addAgentMsg('ai', `✅ **${tool.name}** complete. Output shown in panel →`);

  } catch (err) {
    scanEl.classList.remove('on');
    bodyEl.innerHTML = `<span style="color:var(--accent2)">Error: ${sanitize(err.message)}</span>`;
  }
}
    
  async function runTool(id) {
  const tool = TOOLS[id]; if (!tool) return;

  if (!user) { addAgentMsg('ai', 'Please log in to use workspace tools.'); openAuth(); return; }
  if (!checkRate()) { addAgentMsg('ai', 'Rate limit reached. Please wait.'); return; }

  const { data: { session } } = await _sb.auth.getSession();
  if (!session) { openAuth(); return; }

  // Get active KB sources
  const activeSrcs = [...document.querySelectorAll('#srcList .src-item.active')]
    .map(el => el.dataset.src).filter(Boolean);
  const kb = activeSrcs.find(s => ['bu1','bu3','training','general'].includes(s)) || currentKB;

  // Open output modal and show loading state
  const ov = document.getElementById('outputOverlay');
  const titleEl = document.getElementById('outputTitle');
  const bodyEl = document.getElementById('outputBody');
  const scanEl = document.getElementById('outputScan');

  titleEl.textContent = tool.icon + '  ' + tool.name;
  bodyEl.innerHTML = '<span style="font-family:var(--mono);font-size:11px;color:var(--muted)">Generating…</span>';
  scanEl.classList.add('on');
  ov.classList.add('show');

  // Tool-specific prompts sent to ai-chat
  const toolPrompts = {
    summary: `Generate a concise executive summary of all available information in the ${kb.toUpperCase()} knowledge base. Structure it with: Key Findings, Main Topics, and Recommendations. Use bullet points. Be professional and concise.`,
    report:  `Generate a structured R&D report from the ${kb.toUpperCase()} knowledge base. Include these sections: 1. Overview, 2. Key Technical Findings, 3. Data Summary, 4. Recommendations, 5. Next Steps. Be thorough and professional.`,
    bom:     `Extract all Bill of Materials information from the ${kb.toUpperCase()} knowledge base. List every component, material, part number, quantity, and specification you can find. Format as a clear numbered list with details for each item.`,
    dfm:     `Generate a Design for Manufacturability (DFM) document based on the ${kb.toUpperCase()} knowledge base. Include: material considerations, manufacturing constraints, tolerances, assembly notes, and potential issues. Structure clearly with sections.`,
    meeting: `Extract and organize all action items, decisions, and key discussion points from the ${kb.toUpperCase()} knowledge base. Format as: Action Items (with owners if mentioned), Decisions Made, and Key Discussion Points.`,
    fea:     `Analyze and categorize all FEA simulation results from the ${kb.toUpperCase()} knowledge base. Bin results into: PASS, MARGINAL, FAIL categories with criteria. List all components analyzed and their status.`,
    torque:  `Extract all torque specifications, calculations, and related mechanical data from the ${kb.toUpperCase()} knowledge base. Present as a structured specification table with values, units, and tolerance ranges.`,
    slide:   `Create a structured slide outline from the ${kb.toUpperCase()} knowledge base. Format each slide as: [SLIDE N: Title] followed by 3-5 bullet points. Generate 6-8 slides covering the most important information.`,
    'line-digest': `Summarize the most recent and relevant information from the knowledge base as a daily digest. Format as: Top Stories, Key Updates, and Action Required sections.`,
  };

  const prompt = toolPrompts[id] || tool.prompt;

  try {
    const res = await fetch(`${SB_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ message: prompt, knowledgeBaseId: kb })
    });

    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Request failed'); }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let full = '';
    bodyEl.innerHTML = '';

    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      full += dec.decode(value, { stream: true });
      bodyEl.innerHTML = safeFmt(full);
    }

    scanEl.classList.remove('on');
    bodyEl.innerHTML = safeFmt(full);

    // Also add to agent chat as a message
    addAgentMsg('ai', `✅ **${tool.name}** complete. Output shown in modal.`);

  } catch (err) {
    scanEl.classList.remove('on');
    bodyEl.innerHTML = `<span style="color:var(--accent2)">Error: ${sanitize(err.message)}</span>`;
  }
}
    
  function closeOutput() {
    document.getElementById('outputOverlay').classList.remove('show');
    document.getElementById('outputScan').classList.remove('on');
  }
  function copyOutput() {
    const t=document.getElementById('outputBody').innerText;
    navigator.clipboard.writeText(t).then(()=>{
      const b=document.querySelector('.out-btn.primary');
      b.textContent='✓ Copied'; setTimeout(()=>b.textContent='Copy Output',1500);
    });
  }

  // ══════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════
  async function initApp() {
    applySavedTheme();
    applyLang('en');
    updateKB();

    const { data:{ session } } = await _sb.auth.getSession();
    setUserFromSession(session);
    updateUserUI();
  }

  initApp();
