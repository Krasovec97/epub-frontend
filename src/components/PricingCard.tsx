import { Link } from "@/i18n/navigation";
import styles from "./PricingCard.module.css";

export interface PriceRow {
  label: string;
  value: string;
}

interface PricingCardProps {
  eyebrow: string;
  currency: string;
  price: string;
  unit: string;
  cta: string;
  rows: PriceRow[];
  note: string;
}

export default function PricingCard({
  eyebrow,
  currency,
  price,
  unit,
  cta,
  rows,
  note,
}: PricingCardProps) {
  return (
    <div className={styles.grid}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <p className={styles.price}>
          <sup>{currency}</sup>
          {price}
        </p>
        <p className={styles.unit}>{unit}</p>
        <Link href="/scan" className={styles.cta}>
          {cta}
        </Link>
      </div>

      <dl className={styles.sheet}>
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        <p className={styles.note}>{note}</p>
      </dl>
    </div>
  );
}
