import styles from "./HowItWorks.module.css";

type Step = {
  title: string;
  desc: string;
};

type Props = {
  heading: string;
  steps: [Step, Step, Step];
};

export default function HowItWorks({ heading, steps }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.heading}>{heading}</p>
        <div className={styles.grid}>
          {steps.map((step, i) => (
            <div key={i} className={styles.step}>
              <span className={styles.num}>0{i + 1}</span>
              <h3 className={styles.title}>{step.title}</h3>
              <p className={styles.desc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
