import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

export function ChatArea({ activeDoc, messages, onSendMessage, isTyping }) {
  const [input, setInput] = React.useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isTyping) {
      onSendMessage(input);
      setInput('');
    }
  };

  if (!activeDoc) {
    return (
      <main className="main-content empty">
        <div className="empty-state">
          <h2>Select a document to start chatting</h2>
          <p>Upload a file and ask questions about its content.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <header className="chat-header">
        <span className="doc-title">{activeDoc.filename}</span>
        <span className="badge">{activeDoc.chunkCount} chunks</span>
      </header>

      <div ref={scrollRef} className="messages-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-content">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
              {msg.sources && msg.sources.length > 0 && (
                <div className="sources">
                  <strong>Sources:</strong>
                  {msg.sources.map((s, i) => (
                    <span key={i} className="source-tag" title={s.content}>
                      {s.page ? `Page ${s.page}` : `Source ${i+1}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && <div className="message assistant typing">Typing...</div>}
      </div>

      <form onSubmit={handleSubmit} className="input-area">
        <textarea 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Ask a question about this document..."
          rows={1}
        />
        <button type="submit" disabled={!input.trim() || isTyping}>
          Send
        </button>
      </form>
    </main>
  );
}
