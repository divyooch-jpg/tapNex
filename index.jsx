import { useState, useRef, useEffect } from "react";

/* ─────────────────────────────────────────────
   KNOWLEDGE BASE  (7 semantic chunks)
───────────────────────────────────────────── */
const KB = [
  {
    id: "overview",
    title: "Company Overview",
    icon: "🏢",
    content: `TapNex is an event technology platform that provides NFC-based payment systems and event infrastructure for events such as college fests, concerts, exhibitions, and conferences. TapNex enables cashless transactions at events using NFC cards or wristbands. Attendees can recharge their cards and use them to make payments at stalls or outlets during the event. The system helps organizers manage payments, access control, ticketing, and event operations efficiently.`,
  },
  {
    id: "nfc",
    title: "NFC Payment System",
    icon: "📡",
    content: `TapNex allows attendees to make payments using NFC cards or wristbands. Users simply tap their card at a payment device installed at event stalls to complete a transaction instantly. This system eliminates the need for cash transactions at the event.`,
  },
  {
    id: "recharge",
    title: "Card Recharge System",
    icon: "💳",
    content: `Users must recharge their NFC cards before making purchases. Recharge is done at top-up counters located inside the event venue. Supported recharge methods include Cash and UPI. Once recharged, the card balance can be used for purchases across all participating outlets.`,
  },
  {
    id: "services",
    title: "Event Technology Services",
    icon: "⚙️",
    content: `In addition to payments, TapNex provides several event management tools, including: Ticketing systems, Entry and exit management, Stall management, Volunteer management, and Payment analytics for organizers. These tools help organizers manage events efficiently.`,
  },
  {
    id: "branding",
    title: "Sponsor Branding",
    icon: "🎯",
    content: `TapNex provides branding opportunities for event sponsors. Examples include sponsor-branded recharge counters and sponsor-branded NFC cards. For example, a recharge counter may be branded as "Zomato Recharge Zone". This helps sponsors gain visibility during events.`,
  },
  {
    id: "refund",
    title: "Refund Policy",
    icon: "🔄",
    content: `TapNex NFC cards do not allow refunds or balance transfers after the event ends. Any unused balance remaining on the card cannot be withdrawn or transferred after the event.`,
  },
  {
    id: "usage",
    title: "How It Works",
    icon: "📋",
    content: `At a typical event: Attendees receive an NFC card or wristband. They recharge their card at a recharge counter. They tap their card at stalls to make purchases. Vendors receive payments through the TapNex system. This enables faster and cashless transactions across the event.`,
  },
];

/* ─────────────────────────────────────────────
   RAG RETRIEVAL
───────────────────────────────────────────── */
const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","can","i","me",
  "my","we","you","your","it","its","of","in","on","at","to","for","with","about",
  "and","or","but","not","what","how","who","when","where","why","tell","please",
  "help","get","give","want","need","know",
]);

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function retrieveChunks(query, topK = 3) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  const scored = KB.map(chunk => {
    const docTokens = tokenize(chunk.title + " " + chunk.content);
    const docSet = new Set(docTokens);
    let score = 0;
    qTokens.forEach(t => {
      if (docSet.has(t)) score += 2;
      else if (docTokens.some(dt => dt.includes(t) || t.includes(dt))) score += 1;
    });
    return { ...chunk, score };
  });
  return scored.sort((a,b) => b.score - a.score).slice(0, topK).filter(c => c.score > 0);
}

/* ─────────────────────────────────────────────
   SUGGESTIONS
───────────────────────────────────────────── */
const SUGGESTIONS = [
  { text: "What is TapNex?", icon: "🏢" },
  { text: "How do NFC payments work?", icon: "📡" },
  { text: "Can I get a refund after the event?", icon: "🔄" },
  { text: "How do I recharge my NFC card?", icon: "💳" },
  { text: "What services does TapNex offer organizers?", icon: "⚙️" },
  { text: "What is sponsor branding at events?", icon: "🎯" },
];

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function TapNexAgent() {
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [activeChunks, setActiveChunks] = useState([]);
  const [typingText, setTypingText]     = useState("");
  const [isTyping, setIsTyping]         = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const started   = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingText]);

  function typeWriter(text, onDone) {
    setIsTyping(true);
    setTypingText("");
    let i = 0;
    const step = () => {
      if (i <= text.length) {
        setTypingText(text.slice(0, i));
        i++;
        setTimeout(step, 8);
      } else {
        setIsTyping(false);
        setTypingText("");
        onDone(text);
      }
    };
    step();
  }

  async function sendMessage(query) {
    const userMsg = (query || input).trim();
    if (!userMsg || loading || isTyping) return;
    setInput("");
    inputRef.current?.focus();
    setMessages(prev => [...prev, { role: "user", content: userMsg, ts: Date.now() }]);
    setLoading(true);
    setActiveChunks([]);

    const chunks = retrieveChunks(userMsg);
    setActiveChunks(chunks.map(c => c.id));

    let finalText = "";
    let sources = [];

    if (chunks.length === 0) {
      finalText = "I'm sorry, I couldn't find that information in the TapNex documentation. Please ask a question related to TapNex's NFC payment system, recharge process, event services, refund policy, or sponsor branding.";
    } else {
      const context = chunks.map(c => `[${c.title}]:\n${c.content}`).join("\n\n");
      sources = chunks.map(c => ({ id: c.id, title: c.title, icon: c.icon }));
      const systemPrompt = `You are a professional and friendly customer support agent for TapNex — an event technology platform specializing in NFC-based payments and event management.

STRICT RULES:
1. Answer ONLY using the TapNex Knowledge Base context provided below.
2. If the question is unrelated to TapNex or cannot be answered from the context, respond EXACTLY with: "I'm sorry, I couldn't find that information in the TapNex documentation."
3. Do NOT answer general knowledge questions (history, science, celebrities, geography, programming, etc.).
4. Keep answers concise, warm, and professional — 2–4 sentences unless detail is needed.
5. Never fabricate information not present in the context.

TapNex Knowledge Base:
${context}`;
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: systemPrompt,
            messages: [{ role: "user", content: userMsg }],
          }),
        });
        const data = await res.json();
        finalText = data.content?.[0]?.text || "I'm sorry, I couldn't find that information in the TapNex documentation.";
      } catch {
        finalText = "Something went wrong. Please try again in a moment.";
      }
    }

    setLoading(false);
    typeWriter(finalText, (text) => {
      setMessages(prev => [...prev, {
        role: "assistant", content: text, sources,
        retrievedIds: chunks.map(c => c.id), ts: Date.now(),
      }]);
      setActiveChunks([]);
    });
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function clearChat() {
    setMessages([]);
    setActiveChunks([]);
    setTypingText("");
    setIsTyping(false);
  }

  function fmt(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* ── SIDEBAR ── */}
      <aside style={S.sidebar}>
        <div style={S.sideTop}>
          {/* Brand */}
          <div style={S.brand}>
            <div style={S.brandIcon}><NfcIcon size={22} color="#2563EB" /></div>
            <div>
              <div style={S.brandName}>TapNex</div>
              <div style={S.brandSub}>Support Agent</div>
            </div>
          </div>

          {/* New chat */}
          <button className="newchat" style={S.newChatBtn} onClick={clearChat}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span> New Chat
          </button>

          {/* KB Section */}
          <div style={S.sectionLabel}>📚 Knowledge Base</div>
          <div style={S.kbList}>
            {KB.map(chunk => (
              <div key={chunk.id} style={{ ...S.kbItem, ...(activeChunks.includes(chunk.id) ? S.kbActive : {}) }}>
                <span style={S.kbIcon}>{chunk.icon}</span>
                <span style={S.kbText}>{chunk.title}</span>
                {activeChunks.includes(chunk.id) && <span style={S.kbPulse}>●</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={S.sideFooter}>
          <div style={S.ragBadge}>
            <span style={S.ragDot} /> RAG Pipeline Active
          </div>
          <p style={S.footNote}>Powered by Retrieval-Augmented Generation</p>
        </div>
      </aside>

      {/* ── MAIN PANEL ── */}
      <div style={S.main}>

        {/* Topbar */}
        <header style={S.topbar}>
          <div style={S.topLeft}>
            <div style={S.onlineDot} />
            <div>
              <div style={S.topTitle}>TapNex AI Support</div>
              <div style={S.topSub}>Always available · Answers from TapNex docs only</div>
            </div>
          </div>
          <div style={S.topRight}>
            {started && <span style={S.msgBadge}>{messages.length} msg{messages.length !== 1 ? "s" : ""}</span>}
            <button style={S.iconBtn} className="iconbtn" onClick={clearChat} title="Clear chat">
              <TrashIcon />
            </button>
          </div>
        </header>

        {/* Chat / Welcome */}
        <div style={S.chatArea}>
          {!started ? (
            <div style={S.welcome}>
              <div style={S.welcomeRing}>
                <div style={S.welcomeIcon}><NfcIcon size={36} color="#2563EB" /></div>
              </div>
              <h1 style={S.welcomeTitle}>Hi! How can I help you?</h1>
              <p style={S.welcomeSub}>
                Ask me anything about TapNex — NFC payments, card recharge, event services, refund policy, and more.
                I only answer questions from the official TapNex documentation.
              </p>
              <div style={S.suggGrid}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggcard" style={S.suggCard} onClick={() => sendMessage(s.text)}>
                    <span style={S.suggCardIcon}>{s.icon}</span>
                    <span style={S.suggCardText}>{s.text}</span>
                    <span style={S.suggArrow}>→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={S.msgList}>
              {messages.map((msg, i) => (
                <div key={i} style={{ ...S.msgRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  {msg.role === "assistant" && (
                    <div style={S.agentAv}><NfcIcon size={14} color="#2563EB" /></div>
                  )}
                  <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column",
                    gap: "5px", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ ...S.bubble, ...(msg.role === "user" ? S.userBubble : S.botBubble) }}>
                      {msg.content}
                    </div>
                    {msg.sources?.length > 0 && (
                      <div style={S.srcRow}>
                        <span style={S.srcLabel}>Sources:</span>
                        {msg.sources.map((s, si) => (
                          <span key={si} style={S.srcChip}>{s.icon} {s.title}</span>
                        ))}
                      </div>
                    )}
                    <span style={S.ts}>{fmt(msg.ts)}</span>
                  </div>
                  {msg.role === "user" && <div style={S.userAv}>You</div>}
                </div>
              ))}

              {/* Loading / typing */}
              {(loading || isTyping) && (
                <div style={{ ...S.msgRow, justifyContent: "flex-start" }}>
                  <div style={S.agentAv}><NfcIcon size={14} color="#2563EB" /></div>
                  <div style={{ maxWidth: "70%" }}>
                    <div style={{ ...S.bubble, ...S.botBubble }}>
                      {loading ? (
                        <div style={S.dotRow}>
                          <span className="dot" style={{ animationDelay: "0ms" }} />
                          <span className="dot" style={{ animationDelay: "160ms" }} />
                          <span className="dot" style={{ animationDelay: "320ms" }} />
                        </div>
                      ) : (
                        <span>{typingText}<span className="cursor">|</span></span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={S.inputWrap}>
          {started && (
            <div style={S.quickRow}>
              {SUGGESTIONS.slice(0, 3).map((s, i) => (
                <button key={i} style={S.quickChip} className="quickchip" onClick={() => sendMessage(s.text)}>
                  {s.icon} {s.text}
                </button>
              ))}
            </div>
          )}
          <div style={S.inputBox}>
            <textarea
              ref={inputRef}
              style={S.textarea}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about TapNex…"
              rows={1}
              disabled={loading || isTyping}
            />
            <button
              style={{ ...S.sendBtn, opacity: (!input.trim() || loading || isTyping) ? 0.4 : 1 }}
              disabled={!input.trim() || loading || isTyping}
              onClick={() => sendMessage()}
              className="sendbtn"
            >
              <SendIcon />
            </button>
          </div>
          <div style={S.hint}>
            <kbd style={S.kbd}>Enter</kbd> to send &nbsp;·&nbsp; <kbd style={S.kbd}>Shift+Enter</kbd> for new line
            &nbsp;·&nbsp; Strictly answers from TapNex documentation only
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ICONS
───────────────────────────────────────────── */
function NfcIcon({ size = 18, color = "#2563EB" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M20 12C20 16.418 16.418 20 12 20C7.582 20 4 16.418 4 12C4 7.582 7.582 4 12 4C16.418 4 20 7.582 20 12Z"
        stroke={color} strokeWidth="1.5"/>
      <path d="M15 12C15 13.657 13.657 15 12 15C10.343 15 9 13.657 9 12C9 10.343 10.343 9 12 9C13.657 9 15 10.343 15 12Z"
        fill={color} opacity="0.25"/>
      <circle cx="12" cy="12" r="1.8" fill={color}/>
      <path d="M17.5 6.5C19 8 20 9.9 20 12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6.5 6.5C5 8 4 9.9 4 12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.2" strokeLinejoin="round"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */
const S = {
  root: {
    display: "flex", height: "100vh", overflow: "hidden",
    fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    background: "#F1F5F9",
  },

  /* Sidebar */
  sidebar: {
    width: "264px", flexShrink: 0,
    background: "#FFFFFF", borderRight: "1px solid #E2E8F0",
    display: "flex", flexDirection: "column", overflowY: "auto",
  },
  sideTop: { padding: "20px 16px", flex: 1, display: "flex", flexDirection: "column", gap: "18px" },
  brand: { display: "flex", alignItems: "center", gap: "12px" },
  brandIcon: {
    width: "42px", height: "42px", borderRadius: "11px",
    background: "#EFF6FF", border: "1.5px solid #BFDBFE",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  brandName: { fontWeight: 800, fontSize: "18px", color: "#0F172A", lineHeight: 1.1 },
  brandSub: { fontSize: "11px", color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" },
  newChatBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
    padding: "10px 14px", borderRadius: "9px",
    border: "1.5px solid #E2E8F0", background: "#F8FAFC",
    color: "#334155", fontSize: "13.5px", fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
  },
  sectionLabel: { fontSize: "11px", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.07em", textTransform: "uppercase" },
  kbList: { display: "flex", flexDirection: "column", gap: "2px" },
  kbItem: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "7px 10px", borderRadius: "8px",
    fontSize: "12.5px", color: "#475569", transition: "all 0.15s",
  },
  kbActive: { background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700 },
  kbIcon: { fontSize: "14px", flexShrink: 0 },
  kbText: { flex: 1, lineHeight: 1.3 },
  kbPulse: { color: "#2563EB", fontSize: "9px", animation: "pulse 1s infinite" },
  sideFooter: {
    padding: "14px 16px", borderTop: "1px solid #F1F5F9",
    display: "flex", flexDirection: "column", gap: "6px",
  },
  ragBadge: {
    display: "flex", alignItems: "center", gap: "7px",
    padding: "7px 12px", borderRadius: "8px",
    background: "#F0FDF4", border: "1px solid #BBF7D0",
    fontSize: "12.5px", color: "#15803D", fontWeight: 700,
  },
  ragDot: { width: "8px", height: "8px", borderRadius: "50%", background: "#22C55E", display: "inline-block" },
  footNote: { fontSize: "11px", color: "#94A3B8", textAlign: "center", margin: 0, lineHeight: 1.5 },

  /* Main */
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F8FAFC" },

  topbar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 24px", background: "#FFFFFF",
    borderBottom: "1px solid #E2E8F0", flexShrink: 0,
  },
  topLeft: { display: "flex", alignItems: "center", gap: "12px" },
  onlineDot: { width: "10px", height: "10px", borderRadius: "50%", background: "#22C55E", flexShrink: 0 },
  topTitle: { fontSize: "15px", fontWeight: 800, color: "#0F172A", lineHeight: 1.1 },
  topSub: { fontSize: "12px", color: "#94A3B8", marginTop: "1px" },
  topRight: { display: "flex", alignItems: "center", gap: "10px" },
  msgBadge: {
    fontSize: "11.5px", color: "#64748B", padding: "3px 9px",
    background: "#F1F5F9", borderRadius: "100px", border: "1px solid #E2E8F0",
  },
  iconBtn: {
    width: "34px", height: "34px", borderRadius: "8px",
    border: "1px solid #E2E8F0", background: "#FFFFFF",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", transition: "all 0.15s",
  },

  chatArea: { flex: 1, overflowY: "auto", padding: "28px 28px 8px" },

  /* Welcome */
  welcome: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", textAlign: "center",
    padding: "20px 0 40px", minHeight: "100%",
  },
  welcomeRing: {
    width: "80px", height: "80px", borderRadius: "22px",
    background: "#EFF6FF", border: "2px solid #BFDBFE",
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: "22px", boxShadow: "0 4px 20px rgba(37,99,235,0.1)",
  },
  welcomeIcon: { display: "flex" },
  welcomeTitle: { fontSize: "26px", fontWeight: 800, color: "#0F172A", margin: "0 0 10px" },
  welcomeSub: { fontSize: "14.5px", color: "#64748B", maxWidth: "420px", lineHeight: 1.7, margin: "0 0 32px" },
  suggGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", width: "100%", maxWidth: "560px" },
  suggCard: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "14px 16px", borderRadius: "10px",
    border: "1.5px solid #E2E8F0", background: "#FFFFFF",
    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
    transition: "all 0.15s",
  },
  suggCardIcon: { fontSize: "18px", flexShrink: 0 },
  suggCardText: { flex: 1, fontSize: "13px", color: "#334155", fontWeight: 600, lineHeight: 1.4 },
  suggArrow: { fontSize: "14px", color: "#CBD5E1" },

  /* Messages */
  msgList: { display: "flex", flexDirection: "column", gap: "20px" },
  msgRow: { display: "flex", alignItems: "flex-end", gap: "10px", animation: "fadeUp 0.25s ease" },
  agentAv: {
    width: "32px", height: "32px", borderRadius: "9px",
    background: "#EFF6FF", border: "1.5px solid #BFDBFE",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  userAv: {
    width: "32px", height: "32px", borderRadius: "9px",
    background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "10px", fontWeight: 800, color: "#fff", flexShrink: 0,
  },
  bubble: { fontSize: "14px", lineHeight: 1.7 },
  botBubble: {
    background: "#FFFFFF", border: "1.5px solid #E2E8F0",
    borderRadius: "4px 14px 14px 14px",
    padding: "13px 17px", color: "#1E293B",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  },
  userBubble: {
    background: "#2563EB", borderRadius: "14px 4px 14px 14px",
    padding: "12px 17px", color: "#fff",
    boxShadow: "0 3px 10px rgba(37,99,235,0.3)",
  },
  srcRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px" },
  srcLabel: { fontSize: "11px", color: "#94A3B8", fontWeight: 700 },
  srcChip: {
    fontSize: "11px", padding: "2px 9px", borderRadius: "100px",
    background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1D4ED8", fontWeight: 700,
  },
  ts: { fontSize: "10.5px", color: "#CBD5E1" },
  dotRow: { display: "flex", gap: "5px", alignItems: "center", height: "16px" },

  /* Input */
  inputWrap: {
    padding: "12px 24px 20px", background: "#FFFFFF",
    borderTop: "1px solid #E2E8F0", flexShrink: 0,
    display: "flex", flexDirection: "column", gap: "9px",
  },
  quickRow: { display: "flex", gap: "6px", flexWrap: "wrap" },
  quickChip: {
    padding: "4px 12px", borderRadius: "100px",
    border: "1.5px solid #E2E8F0", background: "#F8FAFC",
    fontSize: "12px", color: "#475569", cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.15s",
  },
  inputBox: {
    display: "flex", alignItems: "flex-end", gap: "10px",
    background: "#F8FAFC", border: "1.5px solid #E2E8F0",
    borderRadius: "12px", padding: "10px 10px 10px 16px",
  },
  textarea: {
    flex: 1, border: "none", outline: "none", background: "transparent",
    fontSize: "14px", color: "#1E293B", resize: "none",
    fontFamily: "inherit", lineHeight: 1.6, maxHeight: "120px",
  },
  sendBtn: {
    width: "40px", height: "40px", borderRadius: "10px",
    background: "#2563EB", border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, transition: "all 0.15s",
  },
  hint: { fontSize: "11.5px", color: "#94A3B8", textAlign: "center" },
  kbd: {
    padding: "1px 5px", borderRadius: "4px",
    border: "1px solid #E2E8F0", background: "#F1F5F9",
    fontSize: "10.5px", color: "#475569", fontFamily: "monospace",
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:0.35} 40%{transform:translateY(-5px);opacity:1} }
  .dot { width:7px;height:7px;border-radius:50%;background:#94A3B8;display:inline-block;animation:bounce 1.2s infinite; }
  .cursor { animation:blink 0.75s infinite; color:#2563EB; }
  .newchat:hover { background:#EFF6FF !important; border-color:#93C5FD !important; color:#2563EB !important; }
  .suggcard:hover { background:#F8FAFC !important; border-color:#93C5FD !important; box-shadow:0 4px 16px rgba(37,99,235,0.1); transform:translateY(-2px); }
  .quickchip:hover { background:#EFF6FF !important; border-color:#93C5FD !important; color:#2563EB !important; }
  .sendbtn:hover:not(:disabled) { background:#1D4ED8 !important; box-shadow:0 4px 12px rgba(37,99,235,0.35); }
  .iconbtn:hover { background:#F8FAFC !important; }
  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:#E2E8F0; border-radius:10px; }
`;
