import { useEffect, useRef, useState } from 'react';
import { SendHorizonal, MessageCircleMore, Check, CheckCheck } from 'lucide-react';
import { formatRelativeTime } from '../utils/formatters';
import { useAuth } from '../hooks/useAuth';

const ChatWindow = ({ messages = [], title = 'Chat', subtitle = 'Conversation linked to this swap', onSend, onTyping, isTyping = {}, active = true }) => {
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const [inputValue, setInputValue] = useState('');

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = inputValue.trim();
      if (content && active) {
        onSend?.(content);
        setInputValue('');
      }
    } else if (inputValue.trim() !== '') {
       onTyping?.();
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    const content = inputValue.trim();
    if (content && active) {
      onSend?.(content);
      setInputValue('');
    }
  };

  // Determine if anyone is typing right now (other than me)
  const otherUsersTyping = Object.entries(isTyping).filter(([id, typing]) => typing && id !== user?.id);

  return (
    <section className="flex flex-col overflow-hidden h-[36rem] rounded-[2rem] border border-white/10 bg-white/5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <header className="flex-shrink-0 border-b border-white/10 px-6 py-5 bg-slate-950/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xl font-bold text-white tracking-tight">{title}</p>
            <p className="mt-1 text-sm text-white/50">{subtitle}</p>
          </div>
          <div className="h-10 w-10 bg-cyan-400/10 rounded-full flex items-center justify-center">
            <MessageCircleMore className="h-5 w-5 text-cyan-300" />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center flex-col gap-3 text-white/40">
            <MessageCircleMore className="h-10 w-10 opacity-20" />
            <p className="text-sm">No messages yet. Say hi!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderId === user?.id;

            return (
              <div key={message.id} className={`flex flex-col gap-1 relative group ${isOwn ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${isOwn ? 'bg-cyan-500 text-slate-950 rounded-tr-sm' : 'bg-slate-800 text-white rounded-tl-sm border border-white/5 shadow-md shadow-black/20'}`}>
                  <p className={`text-sm ${isOwn ? 'font-medium' : ''} whitespace-pre-wrap`}>
                    {message.content || message.text || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-1 relative">
                  {/* Delete Button (visible on hover) */}
                  {isOwn && active && onSend && (
                    <button 
                      onClick={() => onSend(message.id, 'DELETE')} 
                      title="Delete message"
                      className="opacity-0 group-hover:opacity-100 absolute -left-8 top-1/2 -translate-y-1/2 text-rose-500/80 hover:text-rose-500 transition px-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                  )}
                  <p className="text-[10px] uppercase font-bold tracking-widest text-white/30">{formatRelativeTime(message.createdAt || message.sentAt)}</p>
                  {isOwn && (
                    message.readAt ? <CheckCheck className="h-3 w-3 text-cyan-400" /> : <Check className="h-3 w-3 text-white/30" />
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing Indicator */}
        {otherUsersTyping.length > 0 && (
          <div className="flex items-start">
            <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 border border-white/5">
               <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
               <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
               <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <footer className="flex-shrink-0 border-t border-white/10 p-5 bg-slate-950/20">
        <form onSubmit={handleSend} className="relative flex items-end">
          <textarea
            value={inputValue}
            onChange={(e) => {
               setInputValue(e.target.value);
               onTyping?.();
            }}
            onKeyDown={handleKeyDown}
            disabled={!active}
            placeholder={active ? "Type a message..." : "Chat is disabled"}
            rows={inputValue.split('\n').length > 1 ? Math.min(4, inputValue.split('\n').length) : 1}
            className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 pl-4 py-3 pr-14 text-sm text-white outline-none placeholder:text-white/35 focus:ring-1 focus:ring-cyan-500/50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || !active}
            className="absolute right-2 bottom-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30"
          >
            <SendHorizonal className="h-4 w-4 ml-0.5" />
          </button>
        </form>
        <p className="mt-2 text-[10px] text-center text-white/30 uppercase tracking-widest font-bold">Shift + Enter for new line</p>
      </footer>
    </section>
  );
};

export default ChatWindow;
