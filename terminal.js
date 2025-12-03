/* terminal.js
   Simple interactive fake terminal for /void::phase0
   Commands: help, ls, cat readme.txt, cat key.bin, cat clue.txt, hint, clear
*/
(function(){
  // use the inner area so the static header stays intact
  const OUTPUT = document.getElementById('console-output') || document.getElementById('console-inner') || document.getElementById('console');
  const PROMPT_USER = 'root';
  const PROMPT_HOST = 'void';
  const PROMPT_TAIL = ':~$';

  // Files visible under `ls`
  const FILES = ['readme.txt','key.bin','clue.txt'];

  // history and completion support
  const HISTORY = [];
  let historyIndex = -1;
  const COMMANDS = ['help','ls','cat','hint','copy','open','clear','fix','unlock'];
  const COPY_BTN = document.getElementById('copy-key-btn');
  let mode = 'init'; // 'init' -> phase0 sequence will run, 'phase0' -> waiting for 'fix', 'normal' -> full commands

  // The key.bin content intentionally misses the last character — user must infer it.
  // Use a placeholder URL that the user can edit later. The final character (ASCII 102 = 'f') is missing.
  // Replace placeholder with the user's GitHub Pages URL (intentionally missing final char)
  const KEY_BIN = 'https://poovaragamukeshkumar.github.io/void-genesis/gate'; // missing final char (ASCII 102 = 'f')

  // Gate hosting: set to the project's GitHub Pages URL for `rvavodie.html`.
  // GATE_INCOMPLETE intentionally shows one character replaced with an underscore.
  const GATE_FULL = 'https://void-bengaluru.github.io/temp/rvavodie.html';
  // the 'o' in 'rvavodie' is hidden in the displayed URL (replace it with underscore)
  const GATE_INCOMPLETE = 'https://void-bengaluru.github.io/temp/rvav_die.html';
  const GATE_MISSING = 'o'; // the missing character students must provide (ASCII 111)
  const GATE_MISSING_ASCII = String(GATE_MISSING.charCodeAt(0)); // '111'
  let gateUnlocked = false;

  // --- Logging / passcode configuration (replace LOG_ENDPOINT after deploying Apps Script) ---
  const LOG_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwxXAdmxmphhAS6JztF-clWSXq1CLBu-N7XprKBtKR2uC8OPlDlueu1UflJ1Woya8tZug/exec'; // e.g. 'https://script.google.com/macros/s/XXXX/exec'
  const LOG_SECRET = ''; // optional shared secret if you enable it server-side

  // helper: send non-blocking log to configured endpoint (fire-and-forget)
  function sendLog(payload){
    // Only send logs to the configured remote endpoint. Do nothing when LOG_ENDPOINT is empty.
    if(!LOG_ENDPOINT) return;
    try{
      const base = {
        uname: sessionStorage.getItem('uname') || '',
        device: navigator.userAgent || '',
        page: window.location.pathname || '',
        passcode: sessionStorage.getItem('passcode') || ''
      };
      const body = Object.assign({}, base, payload || {});
      // add ISO timestamp for server logs
      try{ body.ts = body.ts || new Date().toISOString(); }catch(e){}
      // include simple shared secret if configured
      try{ if(LOG_SECRET) body.secret = LOG_SECRET; }catch(e){}
      // Use form-encoded POST (URLSearchParams) to avoid CORS preflight OPTIONS in browsers.
      try{
        const params = new URLSearchParams();
        Object.keys(body).forEach(k => {
          const v = body[k];
          params.append(k, typeof v === 'string' ? v : JSON.stringify(v));
        });
        fetch(LOG_ENDPOINT, { method: 'POST', body: params }).catch(()=>{});
      }catch(err){
        // fallback to JSON POST if URLSearchParams isn't available
        fetch(LOG_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }).catch(()=>{});
      }
    }catch(e){}
  }

  // (Logging is handled server-side via LOG_ENDPOINT.)

  // Ensure username is present; ask once per session
  function ensureUname(){
    // require a non-empty username (no anonymous allowed)
    let u = sessionStorage.getItem('uname') || '';
    try{
      while(!u || !String(u).trim()){
        u = prompt('Enter your name (required) — this will be logged (no anonymous):') || '';
        if(u === null) u = '';
      }
    }catch(e){ u = ''; }
    u = String(u).trim();
    sessionStorage.setItem('uname', u);
    // send session start to server (if configured)
    try{ sendLog({ event: 'session_start', uname: u }); }catch(e){}
  }

  function el(cls, txt){
    const d = document.createElement('div');
    d.className = 'console-line' + (cls? ' '+cls:'');
    if(txt !== undefined) d.textContent = txt;
    return d;
  }

  function append(...nodes){
    nodes.forEach(n=>OUTPUT.appendChild(n));
    scrollBottom();
  }

  function scrollBottom(){
    OUTPUT.scrollTop = OUTPUT.scrollHeight;
  }

  function printIntro(){
    OUTPUT.innerHTML = '';
    // print a macOS-style "Last login" line with current date/time
    const now = new Date();
    const last = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    append(el('muted', `Last login: ${last} on ttys000`));
    append(el('', ''));
    append(el('', '/void::phase0 — terminal access'));
    append(el('muted','type "help" for a list of commands.'));
    append(el('',''));
  }

  // dynamic inline input: create an input row inside OUTPUT and keep focus there
  let inputEl = null;
  function makeInputRow(){
    // remove any existing input row to avoid duplicates
    const exist = OUTPUT.querySelector('.input-line');
    if(exist) exist.remove();

    const row = document.createElement('div');
    row.className = 'input-line input-inline';
    const p = document.createElement('span'); p.className = 'prompt';
    const user = document.createElement('span'); user.className = 'user'; user.textContent = PROMPT_USER;
    const at = document.createElement('span'); at.className = 'sep'; at.textContent = '@';
    const host = document.createElement('span'); host.className = 'host'; host.textContent = PROMPT_HOST;
    const tail = document.createElement('span'); tail.className = 'sep'; tail.textContent = PROMPT_TAIL + ' ';
    p.appendChild(user); p.appendChild(at); p.appendChild(host); p.appendChild(tail);

    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'cmd-input';
    inputEl.autocomplete = 'off';
    inputEl.spellcheck = false;
    inputEl.setAttribute('aria-label','terminal input');
    // create input wrapper to hold the input and caret; add ruler for measurement
    const wrapper = document.createElement('span'); wrapper.className = 'input-wrapper';
    const ruler = document.createElement('span'); ruler.className = 'ruler'; wrapper.appendChild(ruler);
    const caret = document.createElement('span'); caret.className = 'caret-block'; caret.setAttribute('aria-hidden','true'); wrapper.appendChild(caret);

    inputEl.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){
        const v = inputEl.value.trim();
        // echo the entered command as a static line
        const echoed = document.createElement('div');
        echoed.className = 'console-line';
        const pe = p.cloneNode(true);
        const cmdSpan = document.createElement('span'); cmdSpan.className = 'cmd-echo'; cmdSpan.textContent = v;
        echoed.appendChild(pe); echoed.appendChild(cmdSpan);
        // remove input row and append echoed command
        row.remove();
        append(echoed);
        // push history
        if(v){ HISTORY.push(v); historyIndex = HISTORY.length; }
        // handle according to current mode
        if(mode === 'phase0'){
          // only accept 'fix'
          if(v.toLowerCase() === 'fix'){
            append(el('muted','Repairing...'));
            // generate a short session passcode for this user and log it
            const pass = String(Math.floor(100000 + Math.random() * 900000));
            sessionStorage.setItem('passcode', pass);
            setTimeout(()=>{
              clearOutput();
              mode = 'normal';
              printIntro();
              append(el('','/void::phase0 complete. terminal unlocked.'));
              append(el('muted','Your session passcode: ' + pass));
              append(el('muted','type "help" to view available commands.'));
              // log the repair event
              try{ sendLog({ command: 'repair', extra: 'passcode:' + pass }); }catch(e){}
              makeInputRow();
            },600);
          } else {
            append(el('error','command not found. try "fix"'));
            makeInputRow();
          }
        } else if(mode === 'gate'){
          // In gate mode we accept either a direct unlock attempt (single char or ascii)
          // OR allow normal commands like 'help', 'cat clue.txt', 'unlock <val>', etc.
          const trimmed = String(v).trim();
          const lowerV = trimmed.toLowerCase();
          const looksLikeCommand = ['help','ls','cat','hint','clear','copy','open','unlock'].some(cmd => lowerV === cmd || lowerV.startsWith(cmd + ' '));

          if(looksLikeCommand){
            // treat as a normal command (e.g., 'cat clue.txt') so user can inspect files while in gate mode
            handleCommand(v);
          } else if(trimmed === GATE_MISSING || trimmed === GATE_MISSING_ASCII){
            gateUnlocked = true;
            append(el('muted','Gate unlocked. Opening the full link now...'));
            // log successful unlock to server
            try{ sendLog({ event: 'unlock_attempt', attempted: trimmed, expected: GATE_MISSING, correct: true }); }catch(e){}
            mode = 'normal';
            // open the gate automatically in a new tab and leave a message
            try{
              window.open(GATE_FULL, '_blank');
              append(el('muted','Gate opened in a new tab.'));
            }catch(e){ append(el('error','failed to open the gate link')) }
            makeInputRow();
          } else {
            // log failed unlock attempt to server
            try{ sendLog({ event: 'unlock_attempt', attempted: trimmed, expected: GATE_MISSING, correct: false }); }catch(e){}
            append(el('error','incorrect value. consult clue.txt and try again.'));
            makeInputRow();
          }
        } else {
          handleCommand(v);
          // ensure a fresh prompt is created for the next command
          // delay slightly to allow appended output to render before focusing
          setTimeout(()=>{
            // don't create duplicate input if command already moved us into a special mode
            if(mode !== 'phase0') makeInputRow();
          }, 20);
        }
      } else if((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')){
        e.preventDefault(); clearOutput(); makeInputRow();
      } else if(e.key === 'c' && e.ctrlKey){
        // Ctrl+C: cancel current input, echo ^C and return a fresh prompt
        e.preventDefault();
        const v = inputEl.value.trim();
        // remove current input row
        row.remove();
        // echo the canceled input as a line with ^C marker
        const cancelled = document.createElement('div');
        cancelled.className = 'console-line';
        const pe = p.cloneNode(true);
        const cmdSpan = document.createElement('span'); cmdSpan.className = 'cmd-echo'; cmdSpan.textContent = '^C';
        cancelled.appendChild(pe); cancelled.appendChild(cmdSpan);
        append(cancelled);
        // don't add to history; create a fresh prompt
        setTimeout(()=>{ makeInputRow(); }, 10);
        return;
      }
      else if(e.key === 'ArrowUp'){
        if(HISTORY.length){ historyIndex = Math.max(0, historyIndex-1); inputEl.value = HISTORY[historyIndex] || ''; updateCaret(); }
        e.preventDefault();
      } else if(e.key === 'ArrowDown'){
        if(HISTORY.length){ historyIndex = Math.min(HISTORY.length, historyIndex+1); inputEl.value = HISTORY[historyIndex] || ''; updateCaret(); }
        e.preventDefault();
      } else if(e.key === 'Tab'){
        e.preventDefault();
        const cur = inputEl.value;
        const parts = cur.split(/\s+/);
        const last = parts[parts.length-1] || '';
        const pool = COMMANDS.concat(FILES);
        const matches = pool.filter(p=>p.startsWith(last));
        if(matches.length === 1){ parts[parts.length-1] = matches[0]; inputEl.value = parts.join(' '); updateCaret(); }
        else if(matches.length > 1){ append(el('muted','Possible completions: ' + matches.join('  '))); makeInputRow(); }
      }
      // update caret position on key events (also handled on input)
      setTimeout(updateCaret,0);
    });
    inputEl.addEventListener('input', updateCaret);

    function updateCaret(){
      // set ruler text to input value (use a space if empty so width isn't zero)
      ruler.style.font = window.getComputedStyle(inputEl).font;
      ruler.textContent = inputEl.value.replace(/ /g,'\u00a0') || '\u00a0';
      const w = ruler.offsetWidth;
      // clamp left within wrapper
      caret.style.left = (w + 2) + 'px';
    }

    row.appendChild(p);
    wrapper.appendChild(inputEl);
    row.appendChild(wrapper);
    append(row);
    // focus last input
    setTimeout(()=>{ inputEl.focus(); updateCaret(); },40);
  }

  // Command handlers
  function handleCommand(raw){
    const cmd = String(raw||'').trim();
    if(!cmd){
      return;
    }

    const parts = cmd.split(/\s+/);
    const base = parts[0].toLowerCase();

    switch(base){
      case 'help':
        append(el('muted','available commands:'), el('',"help — show this message"), el('',"ls — list files"), el('',"cat <file> — show file contents"), el('',"hint — show a hint"), el('',"clear — clear the console"), el('',"open key — attempt to open the gate (prompts for missing char)"), el('',"unlock <char|ascii> — try the missing character or its ascii directly"));
        break;
      case 'ls':
        append(el('',' ' + FILES.join('  ')));
        break;
      case 'cat':
        if(parts.length < 2){ append(el('error','usage: cat <filename>')); break; }
        const fname = parts.slice(1).join(' ');
        handleCat(fname);
        break;
      case 'hint':
        append(el('','one character is missing from the gate URL. ascii value: ' + GATE_MISSING_ASCII));
        break;
      case 'clear':
        clearOutput();
        break;
      case 'copy':
        // copy key.bin or full key
        if(parts.length >= 2 && (parts[1].toLowerCase().indexOf('key') !== -1)){
          copyGateToClipboard();
        } else {
          append(el('muted','usage: copy key'));
        }
        break;
      case 'open':
        // open <resource> — support 'open key' or 'open key.bin' or 'open gate'
        if(parts.length >= 2 && (parts[1].toLowerCase().indexOf('key') !== -1 || parts[1].toLowerCase().indexOf('gate') !== -1)){
          if(gateUnlocked){
            try{ window.open(GATE_FULL, '_blank'); append(el('muted','opening gate in a new tab...')); } catch(e){ append(el('error','failed to open new tab')) }
          } else {
            append(el('muted','Gate is incomplete: ' + GATE_INCOMPLETE));
            append(el('muted','Enter the missing character to complete the URL (consult clue.txt)'));
            mode = 'gate';
            makeInputRow();
          }
        } else {
          append(el('muted','usage: open key'));
        }
        break;
      case 'unlock':
        if(parts.length < 2){ append(el('muted','usage: unlock <char|ascii>')); break; }
        const attempt = parts.slice(1).join(' ').trim();
        if(attempt === GATE_MISSING || attempt === GATE_MISSING_ASCII){
          gateUnlocked = true;
          append(el('muted','Correct — opening gate now...'));
          try{ sendLog({ event: 'unlock_attempt', attempted: attempt, expected: GATE_MISSING, correct: true }); }catch(e){}
          try{ window.open(GATE_FULL, '_blank'); append(el('muted','Gate opened in a new tab.')); } catch(e){ append(el('error','failed to open the gate link')) }
        } else {
          try{ sendLog({ event: 'unlock_attempt', attempted: attempt, expected: GATE_MISSING, correct: false }); }catch(e){}
          append(el('error','incorrect value. consult clue.txt and try again.'));
        }
        break;
      // (No local log commands — logs are sent server-side via LOG_ENDPOINT)
      default:
        append(el('error','command not found. try "help"'));
    }

    // send a log for this command (if logging enabled)
    try{ sendLog({ command: cmd, page: 'terminal' }); }catch(e){}

    // ensure a fresh prompt is available after command output
    // delay slightly to allow appended output to render
    setTimeout(()=>{
      if(mode !== 'phase0') makeInputRow();
    }, 20);
  }

  function clearOutput(){
    OUTPUT.innerHTML = '';
    // reprint intro lines
    append(el('','/void::phase0 — terminal access'), el('muted','type "help" for a list of commands.'), el('',''));
  }

  function copyGateToClipboard(){
    // copy full gate URL if unlocked, otherwise copy the incomplete placeholder
    const full = gateUnlocked ? GATE_FULL : GATE_INCOMPLETE;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(full).then(()=>{
        append(el('muted','Gate URL copied to clipboard')); 
      }).catch(()=>{ append(el('error','failed to copy to clipboard')) });
    } else {
      // fallback: create temporary textarea
      try{
        const ta = document.createElement('textarea'); ta.value = full; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        append(el('muted','Gate URL copied to clipboard'));
      } catch(e){ append(el('error','copy not supported in this browser')) }
    }
  }

  // attach copy button handler (if present)
  if(COPY_BTN){ COPY_BTN.addEventListener('click', copyGateToClipboard); }

  function handleCat(fname){
    const lower = fname.toLowerCase();
    if(lower === 'readme.txt'){
      append(el('muted','readme.txt'), el('', 'Phase 0 — this is a simple integrity repair exercise.'), el('', 'Inspect key.bin to find the site gate (one character missing).'));
    } else if(lower === 'key.bin'){
      append(el('muted','key.bin contents:'), el('', GATE_INCOMPLETE));
    } else if(lower === 'clue.txt'){
      append(el('muted','clue.txt'), el('', 'one character is missing from the gate URL. ascii value: ' + GATE_MISSING_ASCII));
    } else {
      append(el('error','cat: ' + fname + ': No such file'));
    }
  }

  // Initialize: ensure uname, print intro and create the inline input row
  ensureUname();
  printIntro();
  // start the phase0 guided sequence: echo cat phase0.txt and show binary
  function startPhase0Sequence(){
    // clear any existing input row
    const exist = OUTPUT.querySelector('.input-line'); if(exist) exist.remove();
    // echo the command
    append(el('','> cat phase0.txt'));
    // show the binary and decoded hint after a short delay
    setTimeout(()=>{
      append(el('', '01100110 01101001 01111000'));
      append(el('muted', 'decoded: fix'));
      append(el('', 'Type "fix" to repair the damaged block and continue.'));
      mode = 'phase0';
      makeInputRow();
    }, 300);
  }

  startPhase0Sequence();

})();
