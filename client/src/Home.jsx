import { useState, useEffect } from 'react';
import { api, fmt, loanState } from './api';
import { Cover } from './ui';

const Stat = ({ v, k, tone }) => <div className={'card stat ' + (tone || '')}><b>{v ?? '–'}</b><span>{k}</span></div>;

function Student({ user, go }) {
  const [loans, setLoans] = useState([]), [res, setRes] = useState([]);
  useEffect(() => { api('/loans').then(setLoans).catch(() => {}); api('/reservations').then(setRes).catch(() => {}); }, []);
  const active = loans.filter(l => !l.returnedAt), soon = active.filter(l => new Date(l.dueAt) - Date.now() < 3 * 864e5);
  const owed = loans.filter(l => !l.finePaid).reduce((a, l) => a + l.fine, 0);
  return (
    <>
      <p className="lead">Hi {user.name.split(' ')[0]}, here is what is on your shelf.</p>
      <div className="stats">
        <Stat v={`${active.length} / 3`} k="Books on loan" />
        <Stat v={soon.length} k="Due within 3 days" tone={soon.length ? 'amber' : ''} />
        <Stat v={'₹' + owed} k="Fines owed" tone={owed ? 'red' : ''} />
        <Stat v={res.filter(r => r.status === 'ready').length} k="Reservations ready" />
      </div>
      <h3 className="sub">Your books</h3>
      {!active.length ? <p className="empty">Nothing borrowed yet. <a href="#" onClick={e => { e.preventDefault(); go('catalog'); }}>Find your next read</a></p> :
        <div className="card table">{active.map(l => { const [c, t] = loanState(l); return (
          <div className="row2" key={l._id}><Cover b={l.book} mini /><div className="info"><h4>{l.book?.title}</h4><p className="muted">{l.book?.author}</p></div><span className={'badge ' + c}>{t}</span></div>); })}</div>}
    </>
  );
}

function Admin({ go }) {
  const [s, setS] = useState({ genres: [], top: [] }), [loans, setLoans] = useState([]);
  useEffect(() => { api('/stats').then(setS).catch(() => {}); api('/loans').then(setLoans).catch(() => {}); }, []);
  const late = loans.filter(l => !l.returnedAt && new Date(l.dueAt) < Date.now()).slice(0, 5), max = Math.max(1, ...s.genres.map(g => g.n));
  return (
    <>
      <div className="stats">
        <Stat v={s.titles} k="Titles" /><Stat v={s.students} k="Students" /><Stat v={s.out} k="Books on loan" />
        <Stat v={s.overdue} k="Overdue" tone={s.overdue ? 'red' : ''} />
      </div>
      <div className="two cols">
        <section className="card pad"><h3>Collection by genre</h3>
          {s.genres.map(g => <div className="bar2" key={g._id}><span>{g._id}</span><i style={{ width: (g.n / max) * 100 + '%' }} /><b>{g.n}</b></div>)}</section>
        <section className="card pad"><h3>Most borrowed</h3>
          {!s.top.length && <p className="muted">No loans yet.</p>}
          {s.top.map((t, i) => <div className="rank" key={t._id}><b>{i + 1}</b><span>{t.title}</span><em>{t.n} loans</em></div>)}</section>
      </div>
      <section className="card pad"><h3>Overdue right now</h3>
        {!late.length ? <p className="muted">No overdue books. Nice.</p> : late.map(l => (
          <div className="rank" key={l._id}><span>{l.book?.title}<br /><small className="muted">{l.user?.name} · due {fmt(l.dueAt)}</small></span><em className="red">₹{l.fine}</em></div>))}
        {!!late.length && <button className="btn sm" onClick={() => go('loans')}>Manage loans</button>}
      </section>
    </>
  );
}
export default function Home({ user, go }) { return user.role === 'admin' ? <Admin go={go} /> : <Student user={user} go={go} />; }
