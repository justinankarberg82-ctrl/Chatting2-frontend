import MarkdownMessage from "./MarkdownMessage";

export default function MessageList({ messages, isTyping, bottomRef }) {
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div
        style={{
          width: "70%",
          margin: "0 auto",
          padding: "32px 0",
          boxSizing: "border-box",
        }}
      >
        {messages.map((m, i) => (
          <div
            style={{
              width: "70%",
              margin: "0 auto",
              padding: "32px 0",
              boxSizing: "border-box",
              fontFamily:
                "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            }}
          >
            <div
              style={{
                width: "fit-content",
                maxWidth: "75%",
                padding: "12px 16px",
                background: m.role === "user" ? "transparent" : "#f9fafb",
                border:
                  m.role === "user"
                    ? "1.5px solid #cbd5e1"
                    : "1px solid transparent",
                borderRadius: "18px",
                lineHeight: 1.6,
                fontSize: 15,
                marginLeft: m.role === "user" ? "auto" : 0,
                marginRight: m.role === "user" ? 0 : "auto",
              }}
            >
              <MarkdownMessage>
                {m.content.replace(/^You:\s*/i, "").replace(/^ChatGPT:\s*/i, "")}
              </MarkdownMessage>
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{ marginBottom: 24, color: "#777" }}>Typing now</div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
