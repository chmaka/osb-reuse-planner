import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Download, Layers, PackageCheck, Ruler, ShieldAlert } from 'lucide-react';
import type { Remnant } from '../../types';
import { analyzeInventory, exportInventorySummaryCsv, type AnalyticsPeriod } from './summary';
import './analytics.css';

function readableArea(mm2: number): string {
  return (mm2 / 1_000_000).toLocaleString('sr-RS', { maximumFractionDigits: 3 });
}
function LocalMetric({ title, value, unit, icon }: {
  title: string; value: string; unit?: string; icon: ReactNode
}) {
  return <div className="inventory-insight-metric">
    <div className="inventory-insight-metric-head">{icon}<span>{title}</span></div>
    <div className="inventory-insight-metric-value">{value} <small>{unit}</small></div>
  </div>;
}
function AreaBars({ rows, emptyLabel }: {
  rows: { label: string; areaMm2: number; count: number }[];
  emptyLabel: string
}) {
  const reducedMotion = useReducedMotion();
  const max = Math.max(0, ...rows.map(g => g.areaMm2));
  if (!rows.length) return <div className="inventory-insight-empty">{emptyLabel}</div>;
  return <div className="inventory-insight-bars" role="list" aria-label="Evidentirane površine po grupama">
    {rows.map(g => <div role="listitem" className="inventory-insight-bar-row" key={g.label}>
      <div className="inventory-insight-bar-text">
        <strong>{g.label}</strong><span>{g.count} zapisa · {readableArea(g.areaMm2)} m²</span>
      </div>
      <div className="inventory-insight-track" aria-hidden="true">
        <motion.div className="inventory-insight-bar"
          initial={reducedMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: max > 0 ? g.areaMm2 / max : 0 }}
          style={{ transformOrigin: 'left' }}
          transition={{ duration: reducedMotion ? 0 : 0.5, ease: 'easeOut' }}/>
      </div>
    </div>)}
  </div>;
}

export default function InventoryAnalytics({ remnants }: { remnants: Remnant[] }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('all');
  const [thicknessMm, setThicknessMm] = useState<number | null>(null);
  const [group, setGroup] = useState<'thickness' | 'materials'>('thickness');
  const data = useMemo(
    () => analyzeInventory(remnants, { period, thicknessMm }),
    [remnants, period, thicknessMm]
  );

  function exportSummary() {
    const csv = exportInventorySummaryCsv(data);
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'osb-inventar-agregati.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const rows = group === 'thickness' ? data.thickness : data.materials;
  return <section className="inventory-insight" aria-label="Analitika inventara">
    <div className="inventory-insight-controls">
      <div><strong>Inventar · izmjerena geometrija</strong><p>Podaci iz lokalne baze ovog uređaja, bez procjene ušteda.</p></div>
      <div className="inventory-insight-filters">
        <label>Period
          <select aria-label="Period analitike" value={period}
            onChange={e => setPeriod(e.target.value as AnalyticsPeriod)}>
            <option value="all">Svi zapisi</option>
            <option value="30d">Posljednjih 30 dana</option>
            <option value="90d">Posljednjih 90 dana</option>
          </select>
        </label>
        <label>Debljina
          <select aria-label="Debljina materijala"
            value={thicknessMm === null ? 'all' : String(thicknessMm)}
            onChange={e => setThicknessMm(e.target.value === 'all' ? null : Number(e.target.value))}>
            <option value="all">Sve debljine</option>
            {data.availableThicknesses.map(mm => <option value={mm} key={mm}>{mm} mm</option>)}
          </select>
        </label>
        <button className="inventory-insight-export" type="button" onClick={exportSummary}>
          <Download size={16} aria-hidden="true"/> CSV agregati
        </button>
      </div>
    </div>

    <div className="inventory-insight-metrics" aria-live="polite">
      <LocalMetric icon={<PackageCheck size={18}/>} title="Broj zapisa" value={String(data.total)}/>
      <LocalMetric icon={<Layers size={18}/>} title="Evidentirana površina" value={readableArea(data.totalAreaMm2)} unit="m²"/>
      <LocalMetric icon={<Ruler size={18}/>} title="Čeka fizičku provjeru" value={String(data.measuredCount)}/>
    </div>

    <div className="inventory-insight-layout">
      <article className="inventory-insight-card">
        <header className="inventory-insight-card-head">
          <div><h2>Raspodjela površine</h2><p>Stvarni zapisi iz inventara, ne procijenjeno iskorišćenje CNC ploča.</p></div>
          <div className="inventory-insight-switch" role="group" aria-label="Grupisanje analitike">
            <button type="button" aria-pressed={group === 'thickness'} onClick={() => setGroup('thickness')}>Debljina</button>
            <button type="button" aria-pressed={group === 'materials'} onClick={() => setGroup('materials')}>Materijal</button>
          </div>
        </header>
        <AreaBars rows={rows} emptyLabel="Nema sačuvanih ostataka za izabrane filtere."/>
        <small className="inventory-insight-footnote">Podaci su zbir evidentiranih površina u mm², prikazan u m². Vrijednosti nijesu verifikacija kvaliteta ili bezbjednosti za CNC.</small>
      </article>
      <article className="inventory-insight-card">
        <header className="inventory-insight-card-head">
          <div><h2>Status zapisa</h2><p>Trenutni inventarski status, bez automatske promjene.</p></div>
        </header>
        <div className="inventory-insight-status-list">
          {data.status.map(item => <div className="inventory-insight-status" key={item.status} data-status={item.status}>
            <span className="inventory-insight-status-dot" aria-hidden="true"/>
            <div><strong>{item.label}</strong><small>{readableArea(item.areaMm2)} m²</small></div>
            <b>{item.count}</b>
          </div>)}
        </div>
      </article>
    </div>
    {data.invalidAreaCount > 0 && <p role="alert" className="inventory-insight-warning">
      <ShieldAlert size={17} aria-hidden="true"/>
      {data.invalidAreaCount} zapis(a) ima neispravnu površinu i uračunati su samo u broj zapisa.
    </p>}
    <p className="inventory-insight-disclaimer"><ShieldAlert size={18} aria-hidden="true"/>
      Ovo nije prikaz ostvarenih ušteda, realizovanih rezova ili CNC odobrenja. Fizičke dimenzije, stezanje, konture, nulti položaj i rezultat rezanja moraju biti zasebno provjereni.
    </p>
  </section>;
}
