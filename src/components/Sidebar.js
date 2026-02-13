import { useState, useEffect } from 'react';

export default function Sidebar({
  chats,
  activeChatId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  visible,
  onClose,
  username = "",
  isLoggedIn = true,
  onLogout,
}) {
  const SIDEBAR_WIDTH = 260;
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [showSearch, setShowSearch] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [closingMenuId, setClosingMenuId] = useState(null);

  useEffect(() => {
    function handleClickOutside() {
      if (openMenuId) {
        setClosingMenuId(openMenuId);
        setTimeout(() => {
          setOpenMenuId(null);
          setClosingMenuId(null);
        }, 120);
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const filtered = chats.filter(c => c.title.toLowerCase().includes(query.toLowerCase()));
  const visibleChats = filtered.slice(0, visibleCount);

  return (
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
            setVisibleCount((c) => Math.min(c + 20, filtered.length));
          }
        }}
        style={{
          width: SIDEBAR_WIDTH,
          borderRight: visible ? '1px solid #e5e5e5' : 'none',
          padding: 12,
          background: '#f7f7f8',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: visible ? 0 : -SIDEBAR_WIDTH,
          transition: 'left 0.25s ease',
          zIndex: 20,
          overflowY: 'auto',
          boxSizing: 'border-box',
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          fontSize: 16,
          lineHeight: 1.45,
          letterSpacing: '0px',
        }}
    >
      {onClose && (
        <button
          onClick={onClose}
          style={{
            marginBottom: 8,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          ←
        </button>
      )}
      {/* New chat (match chat item style) */}
      <button
        onClick={onNew}
        onMouseEnter={e => (e.currentTarget.style.background = '#ededed')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.3,
        }}
      >
        {/* ChatGPT-style New chat icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        New chat
      </button>

      {/* Search chats (match chat item style) */}
      <button
        onClick={() => setShowSearch(true)}
        onMouseEnter={e => (e.currentTarget.style.background = '#ededed')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        style={{
          width: '100%',
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.3,
          color: '#333'
        }}
      >
        {/* ChatGPT-style Search icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        Search chats
      </button>

      {showSearch && (
        <div
          onClick={() => setShowSearch(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 80
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 520,
              maxWidth: '90%',
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              padding: 16,
              fontFamily: 'inherit'
            }}
          >
            <input
              autoFocus
              placeholder="Search chats"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 2px 20px',
                border: 'none',
                borderBottom: '1px solid #ccc',
                borderRadius: 0,
                fontSize: 17,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={() => {
                onNew();
                setShowSearch(false);
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#ededed')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              style={{
                width: '100%',
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 600,
                lineHeight: 1.3
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              New chat
            </button>
            <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div style={{ padding: 12, color: '#777', fontSize: 15 }}>
                  No chats found
                </div>
              )}
              {(query ? filtered : filtered.slice(0, 7)).map(chat => (
                <div
                  key={chat._id}
                  onClick={() => {
                    onSelect(chat._id);
                    setShowSearch(false);
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f2f2f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {chat.title}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

       <div style={{ marginTop: 12, paddingBottom: 72 }}>
        <div
          style={{
            marginTop: 20,
            marginBottom: 2,
            padding: '0 4px',
            fontSize: 14,
            color: '#666',
            fontWeight: 400,
            letterSpacing: '0.01em'
          }}
        >
          Your chats
        </div>
        {visibleChats.map(chat => {
          const active = chat._id === activeChatId;
          return (
             <div
               key={chat._id}
               onClick={() => onSelect(chat._id)}
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 14,
                background: active ? '#e5e5e5' : 'transparent',
                transition: 'background 0.15s',
                lineHeight: 1.45
              }}
              onMouseEnter={e => !active && (e.currentTarget.style.background = '#ededed')}
              onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {chat.title}
                </span>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === chat._id ? null : chat._id);
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 18,
                    color: '#666',
                    padding: '0 4px'
                  }}
                >
                  ⋯
                </button>

                {(openMenuId === chat._id || closingMenuId === chat._id) && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: 6,
                      transform:
                        openMenuId === chat._id
                          ? 'translateX(8px) scale(1)'
                          : 'translateX(8px) scale(0.96)',
                      opacity: openMenuId === chat._id ? 1 : 0,
                      background: '#fff',
                      border: '1px solid #e5e5e5',
                      borderRadius: 8,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                      zIndex: 30,
                      minWidth: 150,
                      transformOrigin: 'top right',
                      transition: 'opacity 120ms ease, transform 120ms ease'
                    }}
                  >
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        onRename(chat);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        onDelete(chat._id);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: '#d11a2a'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
       </div>
       {/* Account panel */}
        <div
           style={{
             position: 'fixed',
             bottom: 0,
             left: visible ? 0 : -SIDEBAR_WIDTH,
             width: SIDEBAR_WIDTH,
             padding: '12px',
             background: '#f7f7f8',
             borderTop: '1px solid #e5e5e5',
             boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
             transition: 'left 0.25s ease',
             zIndex: 25,
             boxSizing: 'border-box',
             fontFamily: 'inherit'
           }}
         >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: isLoggedIn ? '#22c55e' : '#d1d5db',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  color: '#ffffff'
                }}
              >
                {(username || 'A').trim().slice(0, 1).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {username || 'Account'}
                </div>
                <div style={{ fontSize: 14, color: '#666' }}>
                  {isLoggedIn ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                onLogout?.();
              }}
              title="Log out"
             onMouseEnter={(e) => {
               const icon = e.currentTarget.querySelector('svg');
               if (icon) icon.style.opacity = '1';
             }}
             onMouseLeave={(e) => {
               const icon = e.currentTarget.querySelector('svg');
               if (icon) icon.style.opacity = '0.45';
             }}
             style={{
               border: 'none',
               background: 'transparent',
               cursor: 'pointer',
               padding: 6,
               borderRadius: 6,
             }}
           >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.45, transition: 'opacity 0.15s ease' }}
              >
               <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
               <polyline points="16 17 21 12 16 7" />
               <line x1="21" y1="12" x2="9" y2="12" />
             </svg>
           </button>
         </div>
       </div>
    </div>
  );
}
