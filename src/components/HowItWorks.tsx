import type { ReactElement } from "react";
import styles from "./HowItWorks.module.css";

export interface PipelineStep {
  stage: string;
  title: string;
  desc: string;
  bullets: [string, string, string];
}

interface HowItWorksProps {
  eyebrow: string;
  heading: string;
  steps: [PipelineStep, PipelineStep, PipelineStep];
}

const ICONS: [ReactElement, ReactElement, ReactElement] = [
  /* phone — capture */
  <svg key="capture" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10.5 5.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>,
  /* processor — process */
  <svg key="process" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4.5" y="4.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M9 2.5v2M15 2.5v2M9 19.5v2M15 19.5v2M2.5 9h2M2.5 15h2M19.5 9h2M19.5 15h2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>,
  /* open book — deliver */
  <svg key="deliver" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 6.8S10 5 6.8 5C5.2 5 4 5.4 4 5.4v12.2s1.2-.4 2.8-.4C10 17.2 12 19 12 19s2-1.8 5.2-1.8c1.6 0 2.8.4 2.8.4V5.4S18.8 5 17.2 5C14 5 12 6.8 12 6.8Zm0 0V19"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>,
];

function Tick() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HowItWorks({ eyebrow, heading, steps }: HowItWorksProps) {
  return (
    <section id="how" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.heading}>{heading}</h2>
        </div>

        <div className={styles.grid}>
          {steps.map((step, i) => (
            <div key={step.stage} className={styles.step}>
              <div className={styles.icon}>
                {ICONS[i]}
                <span className={styles.stage}>{step.stage}</span>
              </div>
              <h3 className={styles.title}>{step.title}</h3>
              <p className={styles.desc}>{step.desc}</p>
              <ul className={styles.bullets}>
                {step.bullets.map((bullet) => (
                  <li key={bullet}>
                    <Tick />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
