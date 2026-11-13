import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Clock3 } from 'lucide-react';
import { categories, labels, ticket, transitions, type Detail, type Repair, type Status } from '../shared/domain';
import { api, ApiError, message } from './api';
import { Modal } from './modal';
export function Badge({status}: {status: Status}) {return <span className={`badge badge-${status}`}><span/>{labels[status]}</span>;}
export const dateTime = (value: string) => new Intl.DateTimeFormat('tr-TR', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul'}).format(new Date(value));

export function IntakeForm({onClose, onSaved}: {onClose: () => void; onSaved: (repair: Repair) => void}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setFields({});
    try {onSaved(await api<Repair>('/repairs', {method: 'POST', body: JSON.stringify({...Object.fromEntries(form), requestId})}));}
    catch (error) {setError(message(error)); if (error instanceof ApiError) setFields(error.fields);}
    finally {setBusy(false);}
  }
  function fieldError(name: string) {return fields[name] ? <small className="field-error" id={`${name}-error`}>{fields[name]}</small> : null;}
  return <Modal title="Yeni eşya kabulü" onClose={onClose}><p className="dialog-intro">Önce eşyayı tanıyalım. Kabul kaydı otomatik olarak sıraya alınır.</p><form onSubmit={submit}>
    {error && <p className="error" role="alert">{error}</p>}
    <fieldset disabled={busy}><legend className="sr-only">Kabul bilgileri</legend>
      <label htmlFor="customer">Müşteri adı <span>*</span></label><input id="customer" name="customer" required minLength={2} maxLength={80} autoComplete="name" aria-invalid={!!fields.customer} aria-describedby={fields.customer ? 'customer-error' : undefined} placeholder="Örn. Deniz Aksoy"/>{fieldError('customer')}
      <label htmlFor="contact">İletişim <span className="optional">isteğe bağlı</span></label><input id="contact" name="contact" maxLength={100} autoComplete="off" placeholder="Telefon veya e-posta"/>
      <label htmlFor="item">Eşya / marka / model <span>*</span></label><input id="item" name="item" required minLength={3} maxLength={100} aria-invalid={!!fields.item} aria-describedby={fields.item ? 'item-error' : undefined} placeholder="Örn. Philips masa lambası"/>{fieldError('item')}
      <label htmlFor="category">Kategori <span>*</span></label><select id="category" name="category">{categories.map(category => <option key={category}>{category}</option>)}</select>
      <label htmlFor="issue">Bildirilen sorun <span>*</span></label><textarea id="issue" name="issue" required minLength={8} maxLength={1000} rows={3} aria-invalid={!!fields.issue} aria-describedby={fields.issue ? 'issue-error' : undefined} placeholder="Ne çalışmıyor? Eşya ile birlikte ne teslim alındı?"/>{fieldError('issue')}
    </fieldset><footer className="form-footer"><span>* Zorunlu alan</span><button className="primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kabul kaydını oluştur'}<ArrowRight size={17}/></button></footer>
  </form></Modal>;
}

export function RepairDetail({id, onClose, onChanged}: {id: number; onClose: () => void; onChanged: () => void}) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<Status | ''>('');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<Detail>(`/repairs/${id}`, {signal: controller.signal}).then(detail => {setData(detail); setNext(transitions[detail.repair.status][0] || ''); setError('');}).catch(error => {if (error.name !== 'AbortError') setError(message(error));}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [id, reload]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!data || !next) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/repairs/${id}`, {method: 'PATCH', body: JSON.stringify({status: next, note, version: data.repair.version})});
      setNote(''); setNotice('İşlem kaydedildi.'); setReload(r => r + 1); onChanged();
    } catch (error) {setError(message(error));}
    finally {setBusy(false);}
  }
  return <Modal title={`${ticket(id)} · İş detayı`} onClose={onClose}>
    {loading && <p className="state" role="status">İş kaydı yükleniyor…</p>}
    {error && <div className="error" role="alert">{error} <button className="text-button" onClick={() => {setLoading(true); setReload(r => r + 1);}} disabled={busy}>Güncel kaydı yükle</button></div>}
    {data && <><section className="detail-summary"><Badge status={data.repair.status}/><h3>{data.repair.item}</h3><p>{data.repair.customer} <span>· {data.repair.category}</span></p>{data.repair.contact && <p>İletişim: {data.repair.contact}</p>}<div className="issue"><span>BİLDİRİLEN SORUN</span><p>{data.repair.issue}</p></div><small>Kabul: {dateTime(data.repair.createdAt)}</small></section>
      <section className="history"><h3><Clock3 size={17}/> İşlem geçmişi</h3><ol>{data.events.map(event => <li key={event.id}><div><strong>{labels[event.status]}</strong><time dateTime={event.createdAt}>{dateTime(event.createdAt)}</time></div><p>{event.note}</p></li>)}</ol></section>
      {notice && <p role="status" className="success"><Check size={17}/>{notice}</p>}
      {transitions[data.repair.status].length ? <form className="change-form" onSubmit={submit}><h3>Sıradaki adım</h3><fieldset disabled={busy || loading}><legend className="sr-only">Durum güncelle</legend><label htmlFor="next-status">Yeni durum</label><select id="next-status" value={next} onChange={e => setNext(e.target.value as Status)}>{transitions[data.repair.status].map(status => <option key={status} value={status}>{labels[status]}</option>)}</select><label htmlFor="note">İşlem notu</label><textarea id="note" value={note} onChange={e => setNote(e.target.value)} required minLength={5} maxLength={1000} rows={3} placeholder="Yapılan işlemi veya beklenen parçayı yazın."/></fieldset><button className="primary" disabled={busy || loading}>{busy ? 'Kaydediliyor…' : 'İşlemi kaydet'}<ArrowRight size={17}/></button></form> : <p className="closed-note"><Check size={18}/> Bu iş teslim edildi. Geçmişi defterde saklanır.</p>}
    </>}
  </Modal>;
}
