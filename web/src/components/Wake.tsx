import { useEffect, useRef, useState } from 'react';
import type { ClapEvents, FrameStats } from '../lib/clap';
import { DEVICE_LABEL, type Device, type GreetingPeriod, type Health, type WakeConfig, type WakeMode } from '../lib/types';

// ---------------------------------------------------------------- Uyku katmanı

/**
 * Uyku: neredeyse siyah ekran, nefes alan tek nokta. Dikkat (çift alkış duyuldu): nokta büyür, dinleme halkası çıkar.
 * Uyanış: nokta parlayıp genişler, katman 0,35 sn'de söner (altında çekirdek halkaları çizmeye başlar).
 * Tek dokunuş sesi açar (iOS), çift dokunuş uyandırır.
 */
export function SleepLayer({ mode, hint, heard, onDoubleTap }: {
  mode: 'sleep' | 'attention' | 'waking';
  hint: string | null;
  heard: string;
  onDoubleTap(): void;
}) {
  const last = useRef(0);
  const tap = () => {
    const now = performance.now();
    if (now - last.current < 350) onDoubleTap();
    last.current = now;
  };
  return (
    <div className={`sleep-layer s-${mode}`} onPointerDown={tap}>
      <div className="sleep-dot">
        <i className="ring r1" />
        <i className="ring r2" />
      </div>
      {mode === 'attention' && <div className="sleep-heard">{heard || 'أستمع…'}</div>}
      {hint && mode !== 'waking' && <div className="sleep-hint">{hint}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Açılış kontrolleri

type Mark = '✓' | '⚠' | '✗' | '…';
function rows(h: Health | null, failed: boolean): { k: string; v: string; m: Mark }[] {
  if (!h) {
    const m: Mark = failed ? '✗' : '…';
    const v = failed ? 'تعذّر الاتصال بالخادم' : 'جارٍ الفحص';
    return [{ k: 'RouteLLM', v, m }, { k: 'مصادر الأخبار', v, m }, { k: 'الأجهزة', v, m }];
  }
  const s = h.sources;
  return [
    { k: 'RouteLLM', v: h.routellm.ok ? `${h.routellm.ms} ms` : 'لا توجد استجابة', m: h.routellm.ok ? '✓' : '✗' },
    {
      k: 'مصادر الأخبار',
      v: s.known ? `${s.ok}/${s.total}` : 'لم يتم الفحص بعد',
      m: !s.known ? '⚠' : s.ok === s.total ? '✓' : s.ok > 0 ? '⚠' : '✗',
    },
    { k: 'الأجهزة', v: `${h.devices.online.length}/${h.devices.total} متصل`, m: h.devices.online.length > 0 ? '✓' : '✗' },
  ];
}

/** 1,2–2,2 sn: gerçek sistem kontrolleri satır satır (0,3 sn arayla). Sonuç gelmediyse "ölçülüyor", gelince dolar. */
export function WakeChecks({ health, failed }: { health: Health | null; failed: boolean }) {
  return (
    <div className="wake-checks">
      {rows(health, failed).map((r, i) => (
        <div key={r.k} className={'wc-row m' + ['✓', '⚠', '✗', '…'].indexOf(r.m)} style={{ animationDelay: `${i * 0.3}s` }}>
          <span className="wc-k">{r.k}</span>
          <span className="wc-v">{r.v}</span>
          <span className="wc-m">{r.m}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Ayarlar → Uyanış

/** Alkış dinleyicisinin olayları kalibrasyon ekranına bu kanaldan akar (App dinleyiciyi yönetir). */
export const calibBus: { sink: ClapEvents | null } = { sink: null };

const MODES: { id: WakeMode; label: string }[] = [
  { id: 'clap+voice', label: 'تصفيق + «بكري، استيقظ»' },
  { id: 'clap', label: 'التصفيق فقط' },
  { id: 'voice', label: '«بكري، استيقظ» فقط' },
];
const PERIODS: { id: GreetingPeriod; label: string }[] = [
  { id: 'sabah', label: '05–12' },
  { id: 'gun', label: '12–18' },
  { id: 'aksam', label: '18–05' },
];
const IDLE = [0, 2, 5, 10, 30];
const DEVICES: Device[] = ['masaustu', 'tablet', 'telefon'];

export function WakeSettings({ cfg, device, calibrating, onCalibrate, onSave, onSleep, onTestWake, onLiveSens }: {
  cfg: WakeConfig;
  device: Device;
  calibrating: boolean;
  onCalibrate(on: boolean): void;
  onSave(p: Partial<WakeConfig>): void;
  onSleep(): void;
  onTestWake(): void;
  /** Kaydırıcı sürüklenirken dedektöre anında uygula (kayıt 400 ms sonra) */
  onLiveSens(s: number): void;
}) {
  const [greet, setGreet] = useState(cfg.greetings);
  useEffect(() => setGreet(cfg.greetings), [cfg.greetings]);
  const isListener = device === cfg.listener;
  return (
    <>
      <label>التنبيه والاستيقاظ</label>
      <div className="seg">
        <button className={cfg.enabled ? 'on' : ''} onClick={() => onSave({ enabled: true })}>التنبيه بالتصفيق: مفعّل</button>
        <button className={!cfg.enabled ? 'on' : ''} onClick={() => onSave({ enabled: false })}>متوقف</button>
      </div>
      <div className="seg">
        {MODES.map(m => <button key={m.id} className={cfg.mode === m.id ? 'on' : ''} onClick={() => onSave({ mode: m.id })}>{m.label}</button>)}
      </div>
      <p className="muted small">
        التصفيق مع الصوت: إذا لم تقل «بكري، استيقظ» خلال 4 ثوانٍ بعد التصفيق مرتين، يعود إلى وضع السكون. التصفيقة الواحدة والكلام والموسيقى وصوت بكري نفسه لا تفعّل الاستيقاظ.
      </p>
      <label>جهاز الاستماع (يُفعّل الميكروفون على هذا الجهاز فقط)</label>
      <div className="seg">
        {DEVICES.map(d => <button key={d} className={cfg.listener === d ? 'on' : ''} onClick={() => onSave({ listener: d })}>{DEVICE_LABEL[d]}</button>)}
      </div>
      <label>جهاز الترحيب (يصدر الصوت من هذا الجهاز فقط)</label>
      <div className="seg">
        {DEVICES.map(d => <button key={d} className={cfg.greeter === d ? 'on' : ''} onClick={() => onSave({ greeter: d })}>{DEVICE_LABEL[d]}</button>)}
      </div>
      <label>رسالة الترحيب</label>
      {PERIODS.map(p => (
        <div key={p.id} className="greet-row">
          <span className="muted small">{p.label}</span>
          <input
            value={greet[p.id]}
            maxLength={120}
            onChange={e => setGreet({ ...greet, [p.id]: e.target.value })}
            onBlur={() => greet[p.id].trim() && greet[p.id] !== cfg.greetings[p.id] && onSave({ greetings: { ...cfg.greetings, [p.id]: greet[p.id] } })}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
      ))}
      <label>ابدأ الملخص عند الاستيقاظ</label>
      <div className="seg">
        <button className={cfg.briefOnWake ? 'on' : ''} onClick={() => onSave({ briefOnWake: true })}>مفعّل</button>
        <button className={!cfg.briefOnWake ? 'on' : ''} onClick={() => onSave({ briefOnWake: false })}>متوقف</button>
      </div>
      <label>الدخول في وضع السكون عند الخمول</label>
      <div className="seg">
        {IDLE.map(m => <button key={m} className={cfg.idleMinutes === m ? 'on' : ''} onClick={() => onSave({ idleMinutes: m })}>{m === 0 ? 'متوقف' : `${m} دقيقة`}</button>)}
      </div>
      <div className="seg">
        <button onClick={onSleep}>الدخول في وضع السكون (S)</button>
        <button onClick={onTestWake}>اختبار: إيقاظ (W)</button>
      </div>
      <label>معايرة التصفيق</label>
      {!isListener ? (
        <p className="muted small">تتم المعايرة على جهاز الاستماع فقط ({DEVICE_LABEL[cfg.listener]}).</p>
      ) : !calibrating ? (
        <button className="calib-open" onClick={() => onCalibrate(true)}>بدء المعايرة (الميكروفون)</button>
      ) : (
        <Calibration cfg={cfg} onSave={onSave} onLiveSens={onLiveSens} onClose={() => onCalibrate(false)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- Kalibrasyon

/** Genliği (0..1) -60..0 dB çubuğuna çevirir */
const pos = (a: number) => `${Math.max(0, Math.min(100, ((20 * Math.log10(Math.max(a, 1e-4)) + 60) / 60) * 100))}%`;
const GROUP_GAP = 1500;

function Calibration({ cfg, onSave, onLiveSens, onClose }: { cfg: WakeConfig; onSave(p: Partial<WakeConfig>): void; onLiveSens(s: number): void; onClose(): void }) {
  const bar = useRef<HTMLDivElement>(null);
  const thr = useRef<HTMLDivElement>(null);
  const amb = useRef<HTMLDivElement>(null);
  const [sens, setSens] = useState(cfg.sens);
  const [clapFlash, setClapFlash] = useState(0);
  const [pattern, setPattern] = useState(0);
  const [reason, setReason] = useState('');
  const [rec, setRec] = useState<null | { groups: number[][]; cur: number[] }>(null);
  const [rhythmMsg, setRhythmMsg] = useState('');
  const recRef = useRef(rec);
  recRef.current = rec;
  const groupTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Kaydırıcı: anında dedektöre, 400 ms sonra sunucuya (tüm cihazlar)
  useEffect(() => {
    if (sens === cfg.sens) return;
    onLiveSens(sens);
    const t = setTimeout(() => onSave({ sens }), 400);
    return () => clearTimeout(t);
  }, [sens]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeGroup = () => {
    const r = recRef.current;
    if (!r || !r.cur.length) return;
    const groups = r.cur.length >= 2 ? [...r.groups, r.cur] : r.groups;
    if (groups.length < 3) { setRec({ groups, cur: [] }); return; }
    setRec(null);
    // 3 tekrar: alkış sayısı aynı olmalı, her aralık ortalamanın ±%20'si içinde
    const gaps = groups.map(g => g.slice(1).map((t, i) => t - g[i]));
    const n = gaps[0].length;
    if (!gaps.every(g => g.length === n)) return setRhythmMsg('عدد التصفيقات مختلف بين المحاولات؛ حاول مجدداً.');
    const mean = gaps[0].map((_, i) => gaps.reduce((s, g) => s + g[i], 0) / gaps.length);
    if (!gaps.every(g => g.every((x, i) => Math.abs(x - mean[i]) <= mean[i] * 0.2))) return setRhythmMsg('المحاولات غير متشابهة بما يكفي (±20٪)؛ حاول مجدداً.');
    if (mean.some(m => m < 120 || m > 1400) || n > 6) return setRhythmMsg('يجب أن تكون الفواصل بين 0.12 و1.4 ثانية، وبحد أقصى 7 تصفيقات.');
    onSave({ rhythm: mean.map(Math.round), rhythmOn: true });
    setRhythmMsg(`تم حفظ الإيقاع: ${n + 1} تصفيق · ${mean.map(m => (m / 1000).toFixed(2)).join(' / ')} ثانية`);
  };

  useEffect(() => {
    calibBus.sink = {
      onFrame: (s: FrameStats) => {
        if (bar.current) bar.current.style.width = pos(s.peak);
        if (thr.current) thr.current.style.left = pos(s.threshold);
        if (amb.current) amb.current.style.left = pos(s.ambient);
      },
      onClap: t => {
        setClapFlash(x => x + 1);
        const r = recRef.current;
        if (r) {
          clearTimeout(groupTimer.current);
          setRec({ ...r, cur: [...r.cur, t] });
          groupTimer.current = setTimeout(closeGroup, GROUP_GAP);
        }
      },
      onPattern: () => setPattern(x => x + 1),
      onReject: r => setReason(r),
    };
    return () => { calibBus.sink = null; clearTimeout(groupTimer.current); };
  }); // her render'da güncel kapanışla yeniden bağlanır

  const [dot, setDot] = useState(false);
  useEffect(() => { if (!clapFlash) return; setDot(true); const t = setTimeout(() => setDot(false), 250); return () => clearTimeout(t); }, [clapFlash]);
  const [pat, setPat] = useState(false);
  useEffect(() => { if (!pattern) return; setPat(true); const t = setTimeout(() => setPat(false), 1500); return () => clearTimeout(t); }, [pattern]);

  return (
    <div className="calib">
      <div className="calib-meter">
        <div className="cm-fill" ref={bar} />
        <div className="cm-amb" ref={amb} title="الضجيج المحيط" />
        <div className="cm-thr" ref={thr} title="الحد الفاصل" />
      </div>
      <div className="calib-legend muted small"><span>−60 dB</span><span>الضجيج ┆ الحد ┃</span><span>0 dB</span></div>
      <label>الحد · مضاعف الضجيج {sens.toLocaleString('tr-TR')} {sens <= 5 ? '(حساسية عالية)' : sens >= 12 ? '(غرفة صاخبة)' : ''}</label>
      <input className="range" type="range" min={3} max={20} step={0.5} value={sens} onChange={e => setSens(Number(e.target.value))} />
      <div className="calib-test">
        <span className={'clap-dot' + (dot ? ' on' : '')} />
        <span>{pat ? (cfg.rhythmOn ? 'تم التعرّف على الإيقاع ✓' : 'تصفيقتان ✓') : 'صفّق مرة واحدة: يجب أن تضيء النقطة. تكلّم: يجب ألا تضيء.'}</span>
      </div>
      {reason && <p className="muted small">آخر رفض: {reason}</p>}
      <label>إيقاع مخصّص (اختياري)</label>
      {rec ? (
        <p className="small">صفّق بالإيقاع المطلوب ثم توقّف؛ كرّر ذلك 3 مرات. المحاولة {Math.min(3, rec.groups.length + 1)}/3 · {rec.cur.length} تصفيق</p>
      ) : (
        <div className="seg">
          <button onClick={() => { setRhythmMsg(''); setRec({ groups: [], cur: [] }); }}>حفظ الإيقاع (3 مرات)</button>
          {cfg.rhythm && <button className={cfg.rhythmOn ? 'on' : ''} onClick={() => onSave({ rhythmOn: !cfg.rhythmOn })}>{cfg.rhythmOn ? 'الإيقاع مفعّل' : 'الإيقاع متوقف'}</button>}
          {cfg.rhythm && <button onClick={() => onSave({ rhythm: null, rhythmOn: false })}>حذف الإيقاع</button>}
        </div>
      )}
      {rhythmMsg && <p className="muted small">{rhythmMsg}</p>}
      <p className="muted small">عند تفعيل الإيقاع، يبحث النظام عن النمط المحفوظ بدلاً من تصفيقتين عاديتين (بهامش ±20٪ لكل فاصلة).</p>
      <button className="calib-open" onClick={onClose}>إغلاق المعايرة</button>
    </div>
  );
}
