import { useState } from 'react';
import { ToastCtx } from './ui';
import { session } from './api';
import Auth from './Auth';
import Home from './Home';
import Catalog from './Catalog';
import Loans from './Loans';
import Students from './Students';

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(session.get('user') || 'null'));
  const [view, setView] = useState('home'), [msg, setMsg] = useState(null);
  const toast = (text, bad) => { setMsg({ text, bad }); setTimeout(() => setMsg(null), 3000); };
  const login = (d, remember) => { session.clear(); session.set('token', d.token, remember); session.set('user', JSON.stringify(d.user), remember); setUser(d.user); setView('home'); };
  const logout = () => { session.clear(); setUser(null); };
  if (!user) return <Auth onLogin={login} />;
  const admin = user.role === 'admin';
  const tabs = admin ? [['home', 'Dashboard'], ['catalog', 'Catalogue'], ['loans', 'Loans'], ['students', 'Students']]
    : [['home', 'Home'], ['catalog', 'Catalogue'], ['loans', 'My books']];
  const pages = { home: <Home user={user} go={setView} />, catalog: <Catalog user={user} />, loans: <Loans user={user} />, students: <Students /> };
  return (
    <ToastCtx.Provider value={toast}>
      <div className="app">
        <aside>
          <div className="brand">Stacks</div>
          <nav>{tabs.map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}</nav>
          <div className="me"><b>{user.name}</b><span>{admin ? 'Librarian' : `${user.studentId} · ${user.department || 'Student'}`}</span><button onClick={logout}>Log out</button></div>
        </aside>
        <main>
          <h2 className="title">{tabs.find(t => t[0] === view)?.[1]}</h2>
          {pages[view]}
        </main>
        {msg && <div className={msg.bad ? 'toast bad' : 'toast'} role="status">{msg.text}</div>}
      </div>
    </ToastCtx.Provider>
  );
}
