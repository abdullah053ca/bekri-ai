import { useState } from 'react';

/**
 * Sunucu erişim anahtarı (ACCESS_TOKEN) istiyor ve bu cihazda yoksa/yanlışsa: anahtarı yapıştırma ekranı.
 * iPhone/iPad ana ekran uygulaması Safari'den ayrı depolama kullanır; "?token=" bağlantısı oraya geçmez, bu yüzden gerekli.
 */
export function TokenGate({ wrong }: { wrong: boolean }) {
  const [v, setV] = useState('');
  const save = () => {
    const t = v.trim();
    if (!t) return;
    try { localStorage.setItem('jarvis.token', t); } catch { /* yok say */ }
    location.reload();
  };
  return (
    <div className="tokengate">
      <div className="tg-box">
        <div className="tg-title">بكري · مفتاح الدخول</div>
        <p>{wrong ? 'مفتاح الدخول على هذا الجهاز غير صالح، ربما تم تغييره.' : 'هذا المساعد محمي بمفتاح دخول.'} ألصق المفتاح هنا؛ وسيُحفظ على هذا الجهاز.</p>
        <form onSubmit={e => { e.preventDefault(); save(); }}>
          <input value={v} onChange={e => setV(e.target.value)} placeholder="مفتاح الدخول" autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false} type="password" />
          <button type="submit" disabled={!v.trim()}>دخول</button>
        </form>
        <p className="tg-note">تجد المفتاح في ملف server/.env ضمن السطر ACCESS_TOKEN.</p>
      </div>
    </div>
  );
}
