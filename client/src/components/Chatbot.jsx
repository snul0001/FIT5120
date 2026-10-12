import React, { useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles
} from 'lucide-react';
import { sendChat } from '../api/client';

// Quiet safety limit on session length. No counter is shown to the user.
const MAX_MESSAGES = 30;

const SUGGESTIONS = [
  'Which career match should I explore first?',
  'How could AI affect my top career?',
  'What should I focus on next?'
];

function buildCareerSummary(careers = []) {
  return careers.slice(0, 10).map((career) => ({
    anzsco_code: career?.occupation_id ?? career?.anzsco_code ?? null,
    title: career?.title ?? career?.name ?? null,
    rank: career?.rank ?? null,
    match_score: career?.match_score ?? null,
    ai: career?.ai ?? null
  }));
}

function buildOccupationSummary(occupation) {
  if (!occupation) return null;

  return {
    anzsco_code: occupation?.occupation_id ?? occupation?.anzsco_code ?? null,
    title: occupation?.title ?? occupation?.name ?? null,
    rank: occupation?.rank ?? null,
    match_score: occupation?.match_score ?? null,
    ai: occupation?.ai ?? null,
    tasks: occupation?.tasks ?? null
  };
}

export default function Chatbot({
  visible,
  currentPage,
  matchedCareers = [],
  selectedOccupation = null,
  skillGap = null,
  region = null,
  sessionId = 0,
  chatRequest = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  const messagesEndRef = useRef(null);
  const previousVisible = useRef(false);
  const sessionRef = useRef(0);
  const sendRef = useRef(null);
  const handledRequest = useRef(null);
  const [sendError, setSendError] = useState('');

  // A new quiz starts a fresh chatbot session.
  useEffect(() => {
    sessionRef.current += 1; // any reply still in flight belongs to the old session and is ignored
    setMessages([]);
    setConversationHistory([]);
    setMessageCount(0);
    setInput('');
    setSendError('');
    setIsSending(false);
  }, [sessionId]);

  // Hide the widget on Home and Quiz. Open it automatically when Results first appears.
  useEffect(() => {
    if (!visible) {
      setIsOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }, [messages, isSending]);

  // "Ask AI" buttons: open the chat and send their question once.
  useEffect(() => {
    if (!visible || !chatRequest?.id || handledRequest.current === chatRequest.id) return;
    handledRequest.current = chatRequest.id;
    setIsOpen(true);
    sendRef.current?.(chatRequest.message);
  }, [chatRequest, visible]);

  if (!visible) return null;

  const profileContext = {
    currentPage,
    matchedCareers: buildCareerSummary(matchedCareers),
    selectedOccupation: buildOccupationSummary(selectedOccupation),
    skillGap: skillGap ?? null,
    region: region ?? null
  };

  const greeting = selectedOccupation?.title
    ? `I can help you understand ${selectedOccupation.title}, your career matches, AI impact, and what to do next.`
    : 'I can help you understand your career matches, AI impact, skill gaps, and next steps.';

  const handleSend = async (messageOverride = '') => {
    const message = (messageOverride || input).trim();

    if (!message || isSending || messageCount >= MAX_MESSAGES) {
      return;
    }

    const userMessage = {
      role: 'user',
      content: message
    };

    const session = sessionRef.current;
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSendError('');
    setIsSending(true);

    try {
      const response = await sendChat({
        message,
        conversationHistory,
        profileContext
      });

      if (session !== sessionRef.current) return; // a new quiz started while waiting

      const reply =
        typeof response?.reply === 'string' && response.reply.trim()
          ? response.reply.trim()
          : 'I received your question, but I could not generate a response right now.';

      const assistantMessage = {
        role: 'assistant',
        content: reply
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Only completed exchanges become the history sent with the next request.
      setConversationHistory((prev) => [
        ...prev,
        userMessage,
        assistantMessage
      ]);

      setMessageCount((count) => count + 1);
    } catch (error) {
      console.error('[Chatbot] Failed to send message:', error);
      if (session !== sessionRef.current) return;

      // Take the unsent question back out of the chat so what the user sees matches what the
      // assistant has received, and put the text back in the box so it can be resent.
      setMessages((prev) => prev.filter((m) => m !== userMessage));
      setInput(message);
      setSendError('That message did not send, and it has not been counted. Please try again.');
    } finally {
      if (session === sessionRef.current) setIsSending(false);
    }
  };

  sendRef.current = handleSend;

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const canSend = !isSending && messageCount < MAX_MESSAGES && input.trim();

  return (
    <>
      {isOpen && (
        <section
          className="
            fixed z-[200]
            bottom-24 right-4
            w-[min(390px,calc(100vw-2rem))]
            h-[min(560px,calc(100vh-7rem))]
            flex flex-col
            rounded-2xl
            border border-zinc-200 dark:border-white/10
            bg-white dark:bg-[#111827]
            shadow-[0_24px_70px_-20px_rgba(0,0,0,0.35)]
            overflow-hidden
          "
          aria-label="AI Career Assistant"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-zinc-200 dark:border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  AI Career Assistant
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  Based on your current results
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
              className="
                w-8 h-8 rounded-full
                flex items-center justify-center
                text-zinc-400
                hover:text-zinc-900 dark:hover:text-white
                hover:bg-zinc-100 dark:hover:bg-white/10
                transition-colors
              "
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Context */}
          {(selectedOccupation || matchedCareers.length > 0) && (
            <div className="px-4 pt-3">
              <div className="flex flex-wrap gap-1.5">
                {selectedOccupation && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/15">
                    {selectedOccupation.title || selectedOccupation.name}
                  </span>
                )}

                {!selectedOccupation && matchedCareers[0] && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/15">
                    {matchedCareers[0]?.title || matchedCareers[0]?.name}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
            <div className="flex gap-2.5 items-start">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                AI
              </div>

              <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 px-3.5 py-3">
                <p className="text-xs leading-5 text-zinc-700 dark:text-zinc-300">
                  {greeting}
                </p>
              </div>
            </div>

            {messages.map((message, index) => {
              const isUser = message.role === 'user';

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex gap-2.5 items-start ${
                    isUser ? 'justify-end' : ''
                  }`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      AI
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] px-3.5 py-3 text-xs leading-5 ${
                      isUser
                        ? 'rounded-2xl rounded-tr-md bg-blue-500 text-white'
                        : 'rounded-2xl rounded-tl-md bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  AI
                </div>

                <div className="rounded-2xl rounded-tl-md bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 px-3.5 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 0 && !isSending && (
            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSend(suggestion)}
                    className="
                      px-2.5 py-1.5
                      rounded-full
                      border border-zinc-200 dark:border-white/10
                      bg-white dark:bg-white/[0.03]
                      text-[10px] font-medium
                      text-zinc-500 dark:text-zinc-400
                      hover:text-zinc-900 dark:hover:text-white
                      hover:border-blue-400/50
                      transition-colors
                    "
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-zinc-200 dark:border-white/10 p-3">
            {sendError && (
              <p role="alert" className="mb-2 text-xs text-rose-500 dark:text-rose-400">{sendError}</p>
            )}
            {messageCount >= MAX_MESSAGES ? (
              <div className="text-center py-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  This chat has reached its length limit. Start a new quiz for a fresh session.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={isSending}
                    placeholder="Ask about your career..."
                    className="
                      flex-1 min-h-[42px] max-h-24 resize-none
                      rounded-xl
                      border border-zinc-200 dark:border-white/10
                      bg-zinc-50 dark:bg-white/[0.03]
                      px-3 py-2.5
                      text-xs text-zinc-900 dark:text-white
                      placeholder:text-zinc-400
                      outline-none
                      focus:border-blue-500
                      transition-colors
                    "
                  />

                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!canSend}
                    aria-label="Send message"
                    className="
                      w-10 h-10 shrink-0
                      rounded-xl
                      bg-blue-500 text-white
                      flex items-center justify-center
                      disabled:opacity-30
                      hover:bg-blue-600
                      transition-colors
                    "
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Floating button */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        className="
          fixed z-[210]
          bottom-5 right-5
          w-13 h-13 sm:w-14 sm:h-14
          rounded-full
          bg-[#3B82F6]
          text-white
          flex items-center justify-center
          shadow-[0_10px_30px_-10px_rgba(59,130,246,0.65)]
          hover:bg-[#2563EB]
          hover:-translate-y-0.5
          active:translate-y-0
          transition-all
        "
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}

        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0B1121]" />
        )}
      </button>
    </>
  );
}