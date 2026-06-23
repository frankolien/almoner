import { useEffect, useState } from 'react';
import { IconCopy, IconCheck, IconArrow } from '../landing/icons.js';

export interface ActiveCred {
  index: number;
  name: string;
  url: string;
  qr: string;
}

export default function ClaimLinkDrawer({ cred, onClose }: { cred: ActiveCred | null; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!cred) return;
    setCopied(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    return () => {
      cancelAnimationFrame(id);
      setOpen(false);
    };
  }, [cred]);

  if (!cred) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={`drawer ${open ? 'open' : ''}`} role="dialog" aria-label="Claim link">
        <div className="drawer-head">
          <div className="tinylabel" style={{ margin: 0 }}>
            Claim link · {cred.name}
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-body">
          <div className="qr-frame">
            <img src={cred.qr} width={224} height={224} alt="claim QR" style={{ borderRadius: 10, display: 'block' }} />
          </div>
          <p className="note" style={{ margin: '16px 0' }}>
            {cred.name}’s private aid voucher (recipient #{cred.index}). Deliver it however suits them — a
            printed card, a QR at a registration desk, or an encrypted message. Whoever holds it can claim{' '}
            <b>once</b>, and every fee is covered for them.
          </p>
          <div className="proofbox" style={{ marginBottom: 14 }}>{cred.url.slice(0, 96)}…</div>
          <div className="row">
            <button
              className="ghost"
              onClick={() => {
                navigator.clipboard?.writeText(cred.url);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                {copied ? (<><IconCheck size={14} /> Copied</>) : (<><IconCopy size={14} /> Copy link</>)}
              </span>
            </button>
            <button className="primary" onClick={() => window.open(cred.url, '_blank')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                Open claim app <IconArrow size={14} />
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
