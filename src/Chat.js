import { useState } from 'react';
import { API_BASE } from './lib/net';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatId, setChatId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;
    setLoading(true);

    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token')}`
      },
      body: JSON.stringify({ message: input, chatId })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = '';

    setMessages(m => [...m, { role: 'user', content: input }, { role: 'assistant', content: '' }]);
    setInput('');

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n\n')) {
        if (line.startsWith('data: ')) {
          assistantText += line.replace('data: ', '');
          setMessages(m => {
            const updated = [...m];
            updated[updated.length - 1].content = assistantText;
            return updated;
          });
        }
        if (line.startsWith('event: done')) {
          setChatId(line.split('data: ')[1]);
        }
      }
    }

    setLoading(false);
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ height: 400, overflowY: 'auto', border: '1px solid #ccc', padding: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ textAlign: m.role === 'user' ? 'right' : 'left', margin: '8px 0' }}>
            <strong>{m.role === 'user' ? 'You' : 'GPT'}:</strong> {m.content}
          </div>
        ))}
        {loading && <i>GPT typing…</i>}
      </div>

      <div style={{ marginTop: 10 }}>
        <input
          style={{ width: '80%' }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} style={{ width: '18%', marginLeft: '2%' }}>Send</button>
      </div>
    </div>
  );
}
