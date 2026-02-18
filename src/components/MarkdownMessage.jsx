import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export default function MarkdownMessage({ children }) {
  const content = typeof children === "string" ? children : String(children || "");

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p style={{ margin: "10px 0", lineHeight: 1.65 }}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong style={{ fontWeight: 700 }}>{children}</strong>
        ),
        em: ({ children }) => (
          <em style={{ fontStyle: "italic" }}>{children}</em>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#2563eb", textDecoration: "underline" }}
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: "10px 0", paddingLeft: 22 }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: "10px 0", paddingLeft: 22 }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ margin: "6px 0", lineHeight: 1.6 }}>{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote
            style={{
              margin: "12px 0",
              padding: "10px 12px",
              borderLeft: "4px solid rgba(15, 23, 42, 0.22)",
              background: "rgba(15, 23, 42, 0.04)",
              borderRadius: 10,
            }}
          >
            {children}
          </blockquote>
        ),
        h1: ({ children }) => (
          <h1 style={{ margin: "14px 0 10px", fontSize: 22, lineHeight: 1.2 }}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 style={{ margin: "14px 0 10px", fontSize: 19, lineHeight: 1.25 }}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ margin: "14px 0 10px", fontSize: 16, lineHeight: 1.25 }}>{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 style={{ margin: "14px 0 10px", fontSize: 14, lineHeight: 1.25 }}>{children}</h4>
        ),
        hr: () => (
          <hr style={{ border: "none", borderTop: "1px solid rgba(15, 23, 42, 0.12)", margin: "14px 0" }} />
        ),
        code: ({ inline, className, children }) => {
          const raw = String(children || "");
          const text = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
          const m = /language-([\w-]+)/.exec(String(className || ""));
          const lang = m ? m[1] : "";

          if (inline) {
            return (
              <code
                style={{
                  fontFamily:
                    "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace",
                  fontSize: "0.92em",
                  padding: "2px 6px",
                  borderRadius: 8,
                  background: "rgba(15, 23, 42, 0.06)",
                  border: "1px solid rgba(15, 23, 42, 0.10)",
                }}
              >
                {text}
              </code>
            );
          }

          return (
            <div style={{ margin: "12px 0" }}>
              {lang ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(15, 23, 42, 0.55)",
                      fontFamily:
                        "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace",
                    }}
                  >
                    {lang}
                  </span>
                </div>
              ) : null}

              <pre
                style={{
                  margin: 0,
                  padding: "12px 12px",
                  overflowX: "auto",
                  background: "#0b1220",
                  color: "#e5e7eb",
                  borderRadius: 14,
                  boxShadow: "0 18px 50px rgba(2, 6, 23, 0.18)",
                }}
              >
                <code
                  style={{
                    fontFamily:
                      "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace",
                    fontSize: clamp(13, 13, 15),
                    lineHeight: 1.5,
                    whiteSpace: "pre",
                  }}
                >
                  {text}
                </code>
              </pre>
            </div>
          );
        },
        table: ({ children }) => (
          <div style={{ overflowX: "auto", margin: "12px 0" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th
            style={{
              textAlign: "left",
              fontSize: 12,
              fontWeight: 800,
              padding: "10px 10px",
              borderBottom: "1px solid rgba(15, 23, 42, 0.14)",
              color: "rgba(15, 23, 42, 0.75)",
              background: "rgba(15, 23, 42, 0.03)",
            }}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td
            style={{
              padding: "10px 10px",
              borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
              fontSize: 13,
              verticalAlign: "top",
            }}
          >
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
