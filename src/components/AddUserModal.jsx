import { useEffect, useState } from "react";

export default function AddUserModal({ open, onClose, onCreate }) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("user");
  const [status, setStatus] = useState("active");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername("");
      setRole("user");
      setStatus("active");
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay (same behavior as Login modal) */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(6px)",
          zIndex: 100,
        }}
      />

      {/* Modal Card (Login-style) */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
           transform: `translate(-50%, -50%) scale(${visible ? 1 : 0.96})`,
           opacity: visible ? 1 : 0,
          width: 380,
          padding: "32px 28px",
          background: "#ffffff",
          borderRadius: 18,
          boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
          zIndex: 110,
           fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
           transition: "opacity 220ms ease-out, transform 220ms ease-out",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            border: "none",
            background: "transparent",
            fontSize: 20,
            cursor: "pointer",
            color: "#6b7280",
          }}
        >
          ×
        </button>

        {/* Title */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            marginBottom: 6,
            textAlign: "center",
          }}
        >
          Add New User
        </div>
        <div
          style={{
            fontSize: 14,
            color: "#6b7280",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          Create a new user account
        </div>

        {/* Username */}
        <input
          autoFocus
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            height: 44,
            boxSizing: "border-box",
            marginBottom: 14,
            borderRadius: 10,
            border: "1px solid #d1d5db",
            fontSize: 14,
            outline: "none",
          }}
        />

        {/* Role */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{
            width: "100%",
            padding: "11px 14px",
            marginBottom: 14,
            borderRadius: 10,
            border: "1px solid #d1d5db",
            fontSize: 14,
            background: "#ffffff",
          }}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{
            width: "100%",
            padding: "11px 14px",
            marginBottom: 22,
            borderRadius: 10,
            border: "1px solid #d1d5db",
            fontSize: 14,
            background: "#ffffff",
          }}
        >
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>

        {/* Submit */}
        <button
          onClick={() => {
            onCreate({ username, role, status });
            onClose();
          }}
          disabled={!username.trim()}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: username.trim() ? "#000000" : "#9ca3af",
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 600,
            cursor: username.trim() ? "pointer" : "not-allowed",
          }}
        >
          Create User
        </button>
      </div>
    </>
  );
}
