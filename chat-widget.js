/**
 * Bot Consultant Intake Widget
 * Self-contained — drop one <script> tag into any page.
 *
 * Config (set before the script tag, or as data attributes):
 *   window.BCW_CONFIG = {
 *     workerUrl: 'https://your-worker.workers.dev',  // required
 *     position:  'bottom-right',                     // optional
 *   };
 */

(function () {
  'use strict';

  // ─── Config ──────────────────────────────────────────────────────
  const config = Object.assign(
    { workerUrl: '', position: 'bottom-right' },
    window.BCW_CONFIG || {}
  );

  if (!config.workerUrl) {
    console.error('[BCW] No workerUrl set in BCW_CONFIG. Widget will not function.');
  }

  // ─── State ───────────────────────────────────────────────────────
  let messages = [];      // { role: 'user'|'assistant', content: string }[]
  let streaming = false;
  let panelOpen = false;
  let hasOpened = false;  // track first open to auto-trigger greeting

  // ─── CSS Injection ───────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('bcw-styles')) return;
    const link = document.createElement('link');
    link.id = 'bcw-styles';
    link.rel = 'stylesheet';
    // Try same-origin relative path, fallback to inline
    link.href = (document.currentScript?.src || '')
      .replace(/chat-widget\.js$/, 'chat-widget.css');
    document.head.appendChild(link);
  }

  // ─── DOM Build ───────────────────────────────────────────────────
  function buildWidget() {
    const root = document.createElement('div');
    root.id = 'bcw-root';
    root.innerHTML = `
      <!-- Prompt bubble -->
      <div id="bcw-prompt">Describe your idea → get a real brief, free.</div>

      <!-- Launcher button -->
      <button id="bcw-launcher" aria-label="Open bot consultant">
        <div id="bcw-launcher-dot"></div>
        <!-- Chat icon -->
        <svg class="bcw-icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
        <!-- Close icon -->
        <svg class="bcw-icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

      <!-- Chat panel -->
      <div id="bcw-panel" role="dialog" aria-label="Bot consultant chat">
        <div id="bcw-header">
          <div id="bcw-avatar">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          <div id="bcw-header-text">
            <div id="bcw-header-name">Bot Consultant</div>
            <div id="bcw-header-status">Online</div>
          </div>
          <button id="bcw-header-close" aria-label="Close">
            <svg viewBox="0 0 14 14"><line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/></svg>
          </button>
        </div>

        <div id="bcw-messages"></div>

        <div id="bcw-input-area">
          <textarea
            id="bcw-input"
            placeholder="Type a message…"
            rows="1"
            aria-label="Your message"
          ></textarea>
          <button id="bcw-send" aria-label="Send">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    return root;
  }

  // ─── Message Rendering ───────────────────────────────────────────
  function isBrief(text) {
    return text.includes('BOT BRIEF:') && text.includes('═══');
  }

  function appendMessage(role, content, id) {
    const messagesEl = document.getElementById('bcw-messages');
    const wrap = document.createElement('div');
    wrap.className = `bcw-msg bcw-msg-${role}`;
    if (id) wrap.id = id;

    const bubble = document.createElement('div');
    bubble.className = 'bcw-bubble';

    if (role === 'assistant' && isBrief(content)) {
      bubble.classList.add('bcw-brief');
      bubble.textContent = content;

      const actions = document.createElement('div');
      actions.className = 'bcw-brief-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'bcw-copy-btn';
      copyBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
        Copy brief
      `;
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => {
          copyBtn.textContent = '✓ Copied';
          copyBtn.classList.add('bcw-copied');
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
              Copy brief
            `;
            copyBtn.classList.remove('bcw-copied');
          }, 2500);
        });
      });

      actions.appendChild(copyBtn);
      wrap.appendChild(bubble);
      wrap.appendChild(actions);
    } else {
      bubble.textContent = content;
      wrap.appendChild(bubble);
    }

    messagesEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function showTyping() {
    const messagesEl = document.getElementById('bcw-messages');
    const el = document.createElement('div');
    el.className = 'bcw-msg bcw-msg-bot';
    el.id = 'bcw-typing-indicator';
    el.innerHTML = `<div class="bcw-typing"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function hideTyping() {
    document.getElementById('bcw-typing-indicator')?.remove();
  }

  function scrollToBottom() {
    const el = document.getElementById('bcw-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  // ─── Streaming ───────────────────────────────────────────────────
  async function sendMessage(userText) {
    if (streaming || !userText.trim()) return;
    streaming = true;
    setInputState(false);

    // Add to state and render
    messages.push({ role: 'user', content: userText.trim() });
    appendMessage('user', userText.trim());

    // Show typing indicator while waiting for first token
    showTyping();

    let fullText = '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(config.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      fullText = data.text || '';
      hideTyping();
      const msgEl = appendMessage('assistant', fullText);

      if (isBrief(fullText)) {
        const bubble = msgEl.querySelector('.bcw-bubble');
        upgradeToBrief(msgEl, bubble, fullText);
      }

    } catch (err) {
      hideTyping();
      appendMessage('assistant', "Sorry, I hit a snag connecting to the server. Try refreshing or check back in a moment.");
      console.error('[BCW] Error:', err);
    }

    // Persist to message history
    if (fullText) {
      messages.push({ role: 'assistant', content: fullText });
    }

    streaming = false;
    setInputState(true);
  }

  function upgradeToBrief(wrapper, bubble, text) {
    // Swap plain bubble for styled brief + copy button
    bubble.classList.add('bcw-brief');
    bubble.textContent = text;

    const actions = document.createElement('div');
    actions.className = 'bcw-brief-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'bcw-copy-btn';
    copyBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
      </svg>
      Copy brief
    `;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✓ Copied';
        copyBtn.classList.add('bcw-copied');
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Copy brief
          `;
          copyBtn.classList.remove('bcw-copied');
        }, 2500);
      });
    });

    actions.appendChild(copyBtn);
    wrapper.appendChild(actions);
    scrollToBottom();
  }

  // ─── Input Helpers ───────────────────────────────────────────────
  function setInputState(enabled) {
    const input = document.getElementById('bcw-input');
    const send = document.getElementById('bcw-send');
    if (input) input.disabled = !enabled;
    if (send) send.disabled = !enabled;
    if (enabled && input) input.focus();
  }

  function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  }

  // ─── Greeting ────────────────────────────────────────────────────
  async function triggerGreeting() {
    if (messages.length > 0) return; // already have a conversation
    streaming = true;
    setInputState(false);
    showTyping();

    let fullText = '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(config.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      fullText = data.text || '';
      hideTyping();
      appendMessage('assistant', fullText);
      messages.push({ role: 'user', content: 'hi' });
      messages.push({ role: 'assistant', content: fullText });

    } catch (err) {
      hideTyping();
      const fallback = "Hey — I'm here to help you scope out a custom bot. What problem are you trying to solve?";
      appendMessage('assistant', fallback);
      messages.push({ role: 'assistant', content: fallback });
      console.error('[BCW] Greeting error:', err);
    }

    streaming = false;
    setInputState(true);
  }

  // ─── Panel Toggle ────────────────────────────────────────────────
  function openPanel() {
    const root = document.getElementById('bcw-root');
    root.classList.add('bcw-open');
    document.getElementById('bcw-prompt').classList.remove('bcw-prompt-visible');
    panelOpen = true;

    if (!hasOpened) {
      hasOpened = true;
      triggerGreeting();
    } else {
      document.getElementById('bcw-input')?.focus();
    }
  }

  function closePanel() {
    document.getElementById('bcw-root').classList.remove('bcw-open');
    panelOpen = false;
  }

  // ─── Event Wiring ────────────────────────────────────────────────
  function wireEvents() {
    document.getElementById('bcw-launcher').addEventListener('click', () => {
      panelOpen ? closePanel() : openPanel();
    });

    document.getElementById('bcw-header-close').addEventListener('click', closePanel);

    const input = document.getElementById('bcw-input');
    const send = document.getElementById('bcw-send');

    send.addEventListener('click', () => {
      const text = input.value;
      input.value = '';
      autoResizeTextarea(input);
      sendMessage(text);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = input.value;
        input.value = '';
        autoResizeTextarea(input);
        sendMessage(text);
      }
    });

    input.addEventListener('input', () => autoResizeTextarea(input));

    // Close panel on outside click
    document.addEventListener('click', (e) => {
      const root = document.getElementById('bcw-root');
      if (panelOpen && !root.contains(e.target)) closePanel();
    });

    // Show prompt bubble after 1.5s, dismiss on click
    const prompt = document.getElementById('bcw-prompt');
    setTimeout(() => {
      if (!hasOpened) prompt.classList.add('bcw-prompt-visible');
    }, 1500);

    prompt.addEventListener('click', () => {
      prompt.classList.remove('bcw-prompt-visible');
      openPanel();
    });
  }

  // ─── Init ────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildWidget();
    wireEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
