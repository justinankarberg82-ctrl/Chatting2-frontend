export default function ChatInput({ input, setInput, sendMessage }) {
  return (
    <div
      style={{
        padding: '12px 0',
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        background: 'transparent'
      }}
    >
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && sendMessage()}
        placeholder="Send a message"
        style={{
          width: '60%',
          padding: '12px 14px',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 15,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        }}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
