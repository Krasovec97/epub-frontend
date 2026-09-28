import styles from "./Faq.module.css";

export interface FaqItem {
  q: string;
  a: string;
}

interface FaqProps {
  eyebrow: string;
  heading: string;
  items: FaqItem[];
}

export default function Faq({ eyebrow, heading, items }: FaqProps) {
  return (
    <section id="faq" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.heading}>{heading}</h2>
        </div>

        <div className={styles.list}>
          {items.map((item, i) => (
            <details key={item.q} open={i === 0}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
