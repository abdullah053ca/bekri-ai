import { useEffect, useState } from 'react';
import { addMemory, deleteMemory, getProfile, saveProfile, type MemoryItem } from '../lib/api';

/**
 * الإعدادات ← عنّي: المعلومات التي يعرفها بكري عنك والملاحظات التي يحتفظ بها.
 * İkisi de yalnızca bu bilgisayardaki sunucuda saklanır; her istekte modele gönderilir.
 */
export function ProfileSettings({ flash }: { flash(t: string): void }) {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const [updated, setUpdated] = useState<string | null>(null);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getProfile()
      .then(d => { setText(d.profile.text); setSaved(d.profile.text); setUpdated(d.profile.updated_at); setMemory(d.memory); })
      .catch(() => setText(''));
  }, []);

  const save = () => {
    if (text === null) return;
    saveProfile(text)
      .then(r => { setSaved(r.profile.text); setUpdated(r.profile.updated_at); flash('تم حفظ المعلومات · سيستخدمها بكري ابتداءً من رده القادم'); })
      .catch(e => flash(e.message));
  };
  const add = () => {
    if (!note.trim()) return;
    addMemory(note).then(r => { setMemory(r.memory); setNote(''); }).catch(e => flash(e.message));
  };

  const dirty = text !== null && text !== saved;
  return (
    <>
      <label>عنّي (هذه المعلومات تساعد بكري على التعرّف عليك)</label>
      {text === null ? <p className="muted small">جارٍ التحميل…</p> : (
        <>
          {!open ? (
            <button className="profile-peek" onClick={() => setOpen(true)}>
              <span>{saved.split('\n').find(l => l.trim() && !l.startsWith('━')) ?? 'لا توجد معلومات بعد'}</span>
              <em>{saved.length} karakter{updated ? ` · ${new Date(updated).toLocaleDateString('ar-SY', { day: 'numeric', month: 'long' })}` : ''} · تعديل</em>
            </button>
          ) : (
            <>
              <textarea className="profile-text" value={text} onChange={e => setText(e.target.value)} rows={14} maxLength={8000} />
              <div className="seg">
                <button className={dirty ? 'on' : ''} disabled={!dirty} onClick={save}>حفظ</button>
                <button onClick={() => { setText(saved); setOpen(false); }}>{dirty ? 'إلغاء' : 'إغلاق'}</button>
              </div>
            </>
          )}
          <p className="muted small">تُحفظ هذه المعلومات على خادمك ولا تُرفع إلى GitHub. تُرسل إلى نموذج الذكاء الاصطناعي مع كل سؤال؛ لا تكتب معلومات حساسة مثل رقم الهوية أو العنوان أو البيانات الصحية.</p>
        </>
      )}

      <label>ذاكرة بكري · {memory.length} ملاحظة</label>
      <p className="muted small">أثناء المحادثة يمكنك قول «بكري، تذكّر: …» ليحفظ المعلومة، أو «انسَ هذه المعلومة» لحذفها.</p>
      {memory.length > 0 && (
        <ul className="memory">
          {memory.map(m => (
            <li key={m.id}>
              <span>{m.text}</span>
              <em>{new Date(m.at).toLocaleDateString('ar-SY', { day: 'numeric', month: 'short' })}</em>
              <button aria-label="حذف الملاحظة" onClick={() => deleteMemory(m.id).then(r => setMemory(r.memory)).catch(e => flash(e.message))}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <form className="memory-add" onSubmit={e => { e.preventDefault(); add(); }}>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Elle not ekle (ör. Cuma günleri çekim yapıyorum)" maxLength={300} />
        <button type="submit" disabled={!note.trim()}>إضافة</button>
      </form>
    </>
  );
}
