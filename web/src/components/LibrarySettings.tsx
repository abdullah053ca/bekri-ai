import { useEffect, useMemo, useRef, useState } from 'react';
import { shrinkImage } from '../lib/image';
import { addBook, addFromPhoto, coverUrl, deleteBook, fillBook, getLibrary, patchBook, uploadCover, type Durum, type Kitap } from '../lib/library';

/**
 * Ayarlar → Kitaplık: her kitabın durumu, sayfası, notları, alıntıları, özeti ve kapağı. Kitaplık El Kontrolü'nde
 * kameradan taranır (K tuşu); burada yalnızca bilgiler düzenlenir. Telefondan açıp kapak fotoğrafı da yüklenebilir.
 */
export function LibrarySettings({ flash, version }: { flash(t: string): void; version: number }) {
  const [books, setBooks] = useState<Kitap[] | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [newAd, setNewAd] = useState('');
  const [newYazar, setNewYazar] = useState('');
  const [reading, setReading] = useState<string | null>(null);
  const photos = useRef<HTMLInputElement>(null);

  const reload = () => getLibrary().then(k => setBooks(k.kitaplar)).catch(() => setBooks([]));
  useEffect(() => { reload(); }, [version]);

  const add = () => {
    if (!newAd.trim()) return;
    addBook(newAd, newYazar || undefined)
      .then(r => { flash(r.yeni ? `تمت إضافة ${r.kitap.ad} إلى المكتبة` : `${r.kitap.ad} موجود بالفعل في المكتبة`); setNewAd(''); setNewYazar(''); reload(); })
      .catch(e => flash(e.message));
  };
  /** Yakın çekim raf fotoğrafları: her biri görüntü modeline gider, okunan kitaplar eklenir */
  const fromPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    let yeni = 0, var_ = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        setReading(`جارٍ قراءة الصورة ${i + 1}/${files.length}…`);
        const r = await addFromPhoto(await shrinkImage(files[i], 2000, 0.9));
        yeni += r.eklenen.length; var_ += r.zatenVar.length;
      }
      flash(`تمت إضافة ${yeni} كتاب${var_ ? ` · ${var_} منها موجودة مسبقاً` : ''}`);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setReading(null);
      reload();
      if (photos.current) photos.current.value = '';
    }
  };

  const named = useMemo(() => (books ?? []).filter(b => b.ad), [books]);
  const list = useMemo(() => {
    const n = q.trim().toLocaleLowerCase('tr');
    return named.filter(b => !n || `${b.ad} ${b.yazar ?? ''}`.toLocaleLowerCase('tr').includes(n));
  }, [named, q]);
  const put = (k: Kitap) => setBooks(bs => (bs ?? []).map(b => (b.id === k.id ? k : b)));
  const save = (id: string, patch: Partial<Kitap>) => patchBook(id, patch).then(r => put(r.kitap)).catch(e => flash(e.message));

  if (books === null) return null;
  const okunuyor = named.filter(b => b.durum === 'okunuyor').length;
  const adsiz = books.filter(b => !b.ad && b.kutu).length;
  const yersiz = named.filter(b => !b.kutu).length;
  return (
    <>
      <label>المكتبة · {named.length} كتاب{okunuyor ? ` · ${okunuyor} قيد القراءة` : ''}</label>
      <div className="lib-add">
        <button className="lib-btn" disabled={!!reading} onClick={() => photos.current?.click()}>{reading ?? '📷 أضف من صورة الرفوف'}</button>
        <input ref={photos} type="file" accept="image/*" multiple hidden onChange={e => fromPhotos(e.target.files)} />
        <span className="muted small">التقط صورة قريبة للرفوف بهاتفك (رف أو رفّان في كل صورة). سيحفظ بكري الكتب التي يتعرّف عليها.</span>
      </div>
      <form className="memory-add" onSubmit={e => { e.preventDefault(); add(); }}>
        <input value={newAd} onChange={e => setNewAd(e.target.value)} placeholder="اسم الكتاب" maxLength={160} />
        <input value={newYazar} onChange={e => setNewYazar(e.target.value)} placeholder="اسم الكاتب (اختياري)" maxLength={120} />
        <button type="submit" disabled={!newAd.trim()}>إضافة</button>
      </form>
      {(adsiz > 0 || yersiz > 0) && (
        <p className="muted small">
          {adsiz > 0 && <>تعذّر التعرّف على أسماء {adsiz} من الكتب التي مسحتها الكاميرا. </>}
          {yersiz > 0 && <>لا يوجد مكان محدد على الرف لـ {yersiz} كتاب. </>}
          في وضع التحكم باليد، اضغط <b>K</b> ثم اختر خانة كتاب بلا اسم وابدأ بكتابة اسمه؛ ستظهر اقتراحات ويمكنك اختيار الكتاب لوضعه في الخانة.
        </p>
      )}
      {!named.length ? null : !show ? (
        <button className="profile-peek" onClick={() => setShow(true)}>
          <span>{named.slice(0, 4).map(b => b.ad).join(' · ')}{named.length > 4 ? ' …' : ''}</span>
          <em>الملاحظات والحالة والغلاف · تعديل</em>
        </button>
      ) : (
        <>
          <div className="memory-add">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث عن كتاب" />
            <button onClick={() => { setShow(false); setOpen(null); }}>إغلاق</button>
          </div>
          <ul className="lib-list">
            {list.map(b => (
              <li key={b.id} className={open === b.id ? 'open' : ''}>
                <button className="lib-row" onClick={() => setOpen(o => (o === b.id ? null : b.id))}>
                  <span>{b.ad}{!b.kutu && <i className="lib-noplace" title="لا يوجد مكان على الرف (اضغط K لتحديده)"> · بلا مكان على الرف</i>}</span>
                  <em>{b.yazar ?? ''}</em>
                  <i className={`lib-st ${b.durum}`}>{b.durum === 'okunacak' ? 'للقراءة' : b.durum === 'okunuyor' ? 'قيد القراءة' : 'مكتمل'}</i>
                </button>
                {open === b.id && <BookEditor k={b} save={save} put={put} flash={flash} onDelete={() => setBooks(bs => (bs ?? []).filter(x => x.id !== b.id))} />}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted small">يمكنك أيضاً استخدام الصوت: «بكري، أضف ملاحظة إلى كتاب ...»، «أنهيت قراءة ...»، «وصلت إلى الصفحة 120 من ...». يتذكّر بكري الكتب المسجّلة ويستفيد منها عند تقديم الاقتراحات.</p>
    </>
  );
}

function BookEditor({ k, save, put, flash, onDelete }: { k: Kitap; save(id: string, p: Partial<Kitap>): void; put(k: Kitap): void; flash(t: string): void; onDelete(): void }) {
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState('');
  const [busy, setBusy] = useState(false);
  const [coverV, setCoverV] = useState(k.kapak ?? '');
  const [hasCover, setHasCover] = useState(true);
  const file = useRef<HTMLInputElement>(null);

  const add = (key: 'notlar' | 'alintilar', text: string, clear: () => void) => {
    const t = text.trim();
    if (!t) return;
    save(k.id, { [key]: [...k[key], t] });
    clear();
  };
  const del = (key: 'notlar' | 'alintilar', i: number) => save(k.id, { [key]: k[key].filter((_, j) => j !== i) });
  const summary = () => {
    setBusy(true);
    fillBook(k.id, !!k.jarvis)
      .then(r => { put(r.kitap); if (r.bilinmiyor) flash('لم يتمكّن بكري من التعرّف على هذا الكتاب، لذلك لم يخمّن تفاصيله. هل الاسم صحيح؟'); })
      .catch(e => flash(e.message))
      .finally(() => setBusy(false));
  };
  const onCover = async (f: File | undefined) => {
    if (!f) return;
    try {
      const r = await uploadCover(k.id, await shrinkImage(f, 900, 0.88));
      put(r.kitap); setCoverV(String(Date.now())); setHasCover(true);
      flash('تم رفع الغلاف');
    } catch (e) { flash((e as Error).message); }
  };

  return (
    <div className="lib-edit">
      <div className="lib-top">
        {hasCover ? <img src={coverUrl(k.id, coverV)} alt="" onError={() => setHasCover(false)} /> : <div className="lib-nocover">لا يوجد غلاف</div>}
        <div className="lib-meta">
          <div className="seg">
            {(['okunacak', 'okunuyor', 'bitti'] as Durum[]).map(d => <button key={d} className={k.durum === d ? 'on' : ''} onClick={() => save(k.id, { durum: d })}>{d === 'okunacak' ? 'للقراءة' : d === 'okunuyor' ? 'قيد القراءة' : 'مكتمل'}</button>)}
          </div>
          <div className="lib-pages">
            <input type="number" min={1} placeholder="الصفحة" defaultValue={k.sayfa ?? ''} onBlur={e => save(k.id, { sayfa: Number(e.target.value) || undefined })} />
            <span>/</span>
            <input type="number" min={1} placeholder="الإجمالي" defaultValue={k.toplamSayfa ?? ''} onBlur={e => save(k.id, { toplamSayfa: Number(e.target.value) || undefined })} />
          </div>
          <button className="lib-btn" onClick={() => file.current?.click()}>رفع صورة الغلاف</button>
          <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={e => onCover(e.target.files?.[0])} />
        </div>
      </div>
      <p className="lib-ozet">{k.ozet ?? <span className="muted">لا يوجد ملخص.</span>}</p>
      {k.jarvis && !k.jarvis.bilinmiyor && (
        <div className="lib-jarvis">
          {k.jarvis.anaFikirler.length > 0 && <ol>{k.jarvis.anaFikirler.map((x, i) => <li key={i}>{x}</li>)}</ol>}
          {k.jarvis.benzer.length > 0 && <p className="muted small">كتب مشابهة من مكتبتك: {k.jarvis.benzer.join(' · ')}</p>}
        </div>
      )}
      <button className="lib-btn" disabled={busy} onClick={summary}>{busy ? 'بكري يكتب…' : k.jarvis ? 'أعد إنشاء ملخص الكتاب' : 'دع بكري يملأ التفاصيل (الملخص والأفكار والكتب المشابهة)'}</button>
      <label>ملاحظاتي</label>
      <ul className="memory">{k.notlar.map((n, i) => <li key={i}><span>{n}</span><button onClick={() => del('notlar', i)} aria-label="حذف">✕</button></li>)}</ul>
      <form className="memory-add" onSubmit={e => { e.preventDefault(); add('notlar', note, () => setNote('')); }}>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="أضف ملاحظة" maxLength={600} />
        <button type="submit" disabled={!note.trim()}>إضافة</button>
      </form>
      <label>اقتباسات</label>
      <ul className="memory">{k.alintilar.map((n, i) => <li key={i}><span>“{n}”</span><button onClick={() => del('alintilar', i)} aria-label="حذف">✕</button></li>)}</ul>
      <form className="memory-add" onSubmit={e => { e.preventDefault(); add('alintilar', quote, () => setQuote('')); }}>
        <input value={quote} onChange={e => setQuote(e.target.value)} placeholder="أضف اقتباساً" maxLength={600} />
        <button type="submit" disabled={!quote.trim()}>إضافة</button>
      </form>
      <button className="lib-btn danger" onClick={() => { if (confirm(`هل تريد حذف ${k.ad} من المكتبة؟ ستُحذف ملاحظاته أيضاً.`)) deleteBook(k.id).then(onDelete).catch(e => flash(e.message)); }}>حذف من المكتبة</button>
    </div>
  );
}
