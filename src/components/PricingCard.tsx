import styles from "./PricingCard.module.css";

type Props = {
  heading: string;
  price: string;
  perPage: string;
  minimumNote: string;
  paymentNote: string;
};

export default function PricingCard({
  heading,
  price,
  perPage,
  minimumNote,
  paymentNote,
}: Props) {
  return (
    <div className={styles.card}>
      <p className={styles.heading}>{heading}</p>
      <div className={styles.priceRow}>
        <span className={styles.price}>{price}</span>
        <span className={styles.perPage}>{perPage}</span>
      </div>
      <div className={styles.rule} aria-hidden="true" />
      <p className={styles.note}>{minimumNote}</p>
      <p className={styles.note}>{paymentNote}</p>
    </div>
  );
}
