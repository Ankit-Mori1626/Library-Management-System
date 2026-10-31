// "Remember me" keeps the login in localStorage; otherwise it lasts until the tab closes (sessionStorage).
export const session = {
  get: k => localStorage.getItem(k) ?? sessionStorage.getItem(k),
  set: (k, v, remember) => (remember ? localStorage : sessionStorage).setItem(k, v),
  clear: () => { localStorage.clear(); sessionStorage.clear(); },
};
export const api = async (path, method = 'GET', body) => {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session.get('token') || '') }, body: body && JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && session.get('token')) { session.clear(); location.reload(); }
  if (!r.ok) throw new Error(d.message || 'Something went wrong');
  return d;
};
export const hue = s => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 360;
export const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
// Returns [badge colour, label] for a loan
export const loanState = l => {
  if (l.returnedAt) return ['ok', 'Returned ' + fmt(l.returnedAt)];
  const ms = new Date(l.dueAt) - Date.now(), d = Math.ceil(Math.abs(ms) / 864e5);
  return ms < 0 ? ['no', `Overdue by ${d} day${d > 1 ? 's' : ''}`] : d <= 3 ? ['warn', `Due in ${d} day${d > 1 ? 's' : ''}`] : ['ok', 'Due ' + fmt(l.dueAt)];
};
