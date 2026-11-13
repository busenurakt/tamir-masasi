import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowRight, CheckCheck, ChevronRight, ClipboardList, Clock3, Inbox, Plus, RefreshCw, Search, Wrench } from 'lucide-react';
import { elapsedDays, labels, statuses, ticket, type Repair, type Status } from '../shared/domain';
import { api, message } from './api';
import { Badge, IntakeForm, RepairDetail } from './forms';
import './styles.css';

type Filter = 'active' | 'all' | Status;
function App() {
  const [rows, setRows] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [newIntake, setNewIntake] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const controller = new AbortController();
    api<{repairs: Repair[]; now: string}>('/repairs', {signal: controller.signal}).then(result => {setRows(result.repairs); setNow(Date.parse(result.now)); setHasLoaded(true); setError('');}).catch(error => {if (error.name !== 'AbortError') setError(message(error));}).finally(() => {if (!controller.signal.aborted) {setLoading(false); setRefreshing(false);}});
    return () => controller.abort();
  }, [reload]);
  function refresh() {setRefreshing(true); setReload(r => r + 1);}
  const active = rows.filter(row => row.status !== 'collected');
  const ready = active.filter(row => row.status === 'ready' || row.status === 'unrepairable');
  const waiting = active.filter(row => elapsedDays(row.createdAt, now) >= 5).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
  const filtered = useMemo(() => rows.filter(row => (filter === 'all' || (filter === 'active' ? row.status !== 'collected' : row.status === filter)) && `${ticket(row.id)} ${row.item} ${row.customer} ${row.issue}`.toLocaleLowerCase('tr-TR').includes(query.trim().toLocaleLowerCase('tr-TR'))), [rows, filter, query]);
  const count = (status: Status) => rows.filter(row => row.status === status).length;
  const today = new Intl.DateTimeFormat('tr-TR', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul'}).format(now);
  return <><a className="skip-link" href="#main">İçeriğe geç</a><div className="app-shell">
    <aside className="sidebar"><a href="/" className="brand" aria-label="Tamir Masası ana sayfa"><span className="brand-icon"><Wrench size={24}/></span><span>Tamir<span className="brand-second">Masası<span className="brand-dot">.</span></span></span></a><div className="workshop"><span className="online-dot"/><div>Moda Tamir Atölyesi<small>YEREL ÇALIŞMA ALANI</small></div></div><nav aria-label="İş durumları"><p className="nav-label">ATÖLYE DEFTERİ</p><button className={filter === 'active' ? 'nav-item selected' : 'nav-item'} onClick={() => setFilter('active')}><ClipboardList size={18}/>Açık işler<span>{active.length}</span></button><button className={filter === 'all' ? 'nav-item selected' : 'nav-item'} onClick={() => setFilter('all')}><Inbox size={18}/>Tüm kayıtlar<span>{rows.length}</span></button><div className="nav-rule"/><p className="nav-label">İŞİN HANGİ AŞAMASINDA?</p>{statuses.map(status => <button key={status} className={filter === status ? 'nav-item selected' : 'nav-item'} onClick={() => setFilter(status)}><i className={`nav-dot dot-${status}`}/>{labels[status]}<span>{count(status)}</span></button>)}</nav><div className="sidebar-bottom"><Wrench size={28}/><p>İyi eşyalara<br/>ikinci bir şans.</p><small>Tek atölye · Örnek çalışma alanı</small></div></aside>
    <div className="workspace"><header className="topbar"><span><span className="crumb">Çalışma alanı</span><ChevronRight size={14}/>İş defteri</span><span className="top-date">{today}<span className="avatar" aria-label="Atölye operatörü">MA</span></span></header>
    <main id="main"><div className="page-heading"><div><p className="eyebrow">KABUL ET. ONAR. YENİDEN KULLAN.</p><h1>Atölyenin bugünü<span>.</span></h1><p>Küçük işleri takip et, büyük bir fark yarat.</p></div><button className="primary" onClick={() => {setNotice(''); setNewIntake(true);}}><Plus size={19}/>Yeni kabul</button></div>
      {notice && <p className="success" role="status"><CheckCheck size={18}/>{notice}</p>}
      {error && <div className="error" role="alert">{error} {rows.length > 0 && 'Son yüklenen kayıtlar gösteriliyor.'}<button className="text-button" onClick={refresh} disabled={refreshing}>Tekrar dene</button></div>}
      <section className="stats" aria-label="Atölye özeti"><article><div><span>Açık iş</span><ClipboardList size={19}/></div><strong>{!hasLoaded ? '—' : active.length.toString().padStart(2,'0')}</strong><small>Kabulden teslimata takipte</small></article><article><div><span>Parça bekliyor</span><Clock3 size={19}/></div><strong>{!hasLoaded ? '—' : count('parts').toString().padStart(2,'0')}</strong><small>Bir sonraki işlem için bekleyen</small></article><article className="ready-stat"><div><span>Teslime hazır</span><CheckCheck size={20}/></div><strong>{!hasLoaded ? '—' : count('ready').toString().padStart(2,'0')}</strong><small>Onarımı tamamlanan eşya</small></article><article><div><span>Teslim edilen</span><ArrowDownLeft size={20}/></div><strong>{!hasLoaded ? '—' : count('collected').toString().padStart(2,'0')}</strong><small>Yeniden sahibinin yanında</small></article></section>
      <div className="desk-grid"><section className="ledger" aria-labelledby="ledger-title"><div className="ledger-heading"><div><h2 id="ledger-title">İş defteri <span>{loading ? '…' : filtered.length}</span></h2><p>{filter === 'active' ? 'Atölyede devam eden tüm işler.' : filter === 'all' ? 'Tüm kabul ve teslim kayıtları.' : labels[filter] + ' durumundaki kayıtlar.'}</p></div><button className="icon-button" aria-label="Kayıtları yenile" onClick={refresh} disabled={refreshing || loading}><RefreshCw size={18} className={refreshing ? 'spin' : ''}/></button></div><div className="search-wrap"><Search size={18}/><input aria-label="İş kaydı ara" type="search" placeholder="Eşya, müşteri veya kayıt no ara…" value={query} onChange={e => setQuery(e.target.value)}/></div>
      {loading ? <div className="state" role="status"><span className="loader"/>İş defteri yükleniyor…</div> : !hasLoaded ? <div className="state"><Inbox size={32}/><h3>İş defteri yüklenemedi.</h3><p>Bağlantıyı kontrol edip yukarıdan tekrar deneyin.</p></div> : filtered.length ? <div className="table-scroll"><table><thead><tr><th scope="col">EŞYA / MÜŞTERİ</th><th scope="col">DURUM</th><th scope="col">KABUL</th><th scope="col"><span className="sr-only">Detay</span></th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td><span className="ticket">{ticket(row.id)} <span>· {row.category}</span></span><button className="item-link" onClick={() => setSelected(row.id)}>{row.item}</button><span className="customer">{row.customer}</span></td><td><Badge status={row.status}/></td><td><time dateTime={row.createdAt}>{new Intl.DateTimeFormat('tr-TR', {day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul'}).format(new Date(row.createdAt))}</time><small className={row.status !== 'collected' && elapsedDays(row.createdAt, now) >= 5 ? 'age old' : 'age'}>{row.status === 'collected' ? 'Tamamlandı' : elapsedDays(row.createdAt, now) === 0 ? 'Bugün geldi' : `${elapsedDays(row.createdAt, now)} gündür atölyede`}</small></td><td><button className="icon-button row-arrow" aria-label={`${ticket(row.id)} detayını aç`} onClick={() => setSelected(row.id)}><ArrowRight size={18}/></button></td></tr>)}</tbody></table></div> : <div className="state"><Inbox size={32}/><h3>{query ? 'Aradığınız kayıt bulunamadı.' : 'Bu rafta henüz bir iş yok.'}</h3><p>{query ? 'Başka bir eşya adı veya müşteri ile deneyin.' : 'Yeni bir kabul oluşturun veya diğer durumlara bakın.'}</p>{query && <button className="secondary" onClick={() => setQuery('')}>Aramayı temizle</button>}</div>}
      <footer className="ledger-footer"><span>Her işlem kayıt altında.</span><span>Geçmiş silinmez <CheckCheck size={14}/></span></footer></section>
      <aside className="desk-aside" aria-label="Atölye öncelikleri"><section className="pickup-card"><div className="section-icon"><CheckCheck size={21}/></div><p className="eyebrow">SON BİR ADIM</p><h2>Teslim rafı</h2><p className="aside-intro">İşi tamamlanan, sahibini bekleyen eşyalar.</p>{loading ? <p>Yükleniyor…</p> : ready.length ? ready.map(row => <button className="pickup-item" key={row.id} onClick={() => setSelected(row.id)}><span><strong>{row.item}</strong><small>{row.customer} · {labels[row.status]}</small></span><ArrowRight size={17}/></button>) : <p className="aside-empty">Teslim bekleyen eşya yok.</p>}<small className="pickup-note">Teslimde durumu güncellemeyi unutmayın.</small></section>
      <section className="waiting-card"><div className="waiting-title"><Clock3 size={18}/><h2>Gözden kaçmasın</h2></div><p>5 gün ve üzeri açık kalan işler.</p>{loading ? <p>Yükleniyor…</p> : waiting.length ? waiting.slice(0,3).map(row => <button className="waiting-item" key={row.id} onClick={() => setSelected(row.id)}><span className="day-count">{elapsedDays(row.createdAt, now)}<small>GÜN</small></span><span><strong>{row.item}</strong><small>{ticket(row.id)} · {labels[row.status]}</small></span><ChevronRight size={16}/></button>) : <p className="aside-empty">Uzun süredir bekleyen iş yok.</p>}</section>
      <div className="repair-note"><Wrench size={18}/><p>Onarmak bir alışkanlık.<br/><strong>Takip etmek de öyle.</strong></p></div></aside></div>
      <footer className="page-footer"><span>TAMİR MASASI <b> / </b> Atölye defteri</span><span>Veriler bu bilgisayardaki SQLite dosyasında saklanır.</span></footer>
    </main></div></div>
    {newIntake && <IntakeForm onClose={() => setNewIntake(false)} onSaved={repair => {setRows(old => old.some(row => row.id === repair.id) ? old : [repair, ...old]); setNewIntake(false); setNotice(`${ticket(repair.id)} kabul edildi ve sıraya alındı.`); setFilter('active'); setQuery(''); refresh();}}/>}
    {selected !== null && <RepairDetail key={selected} id={selected} onClose={() => setSelected(null)} onChanged={refresh}/>}
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);

