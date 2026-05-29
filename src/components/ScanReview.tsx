"use client";

import { useTranslations } from "next-intl";
import type { ScanItem } from "./useScanSession";
import styles from "./ScanReview.module.css";

interface ScanReviewProps {
  items: ScanItem[];
  pageCount: number;
  finishing: boolean;
  failedCount: number;
  errorMessage: string | null;
  onDelete: (item: ScanItem) => void;
  onRetake: (item: ScanItem) => void;
  onMoveUp: (item: ScanItem) => void;
  onMoveDown: (item: ScanItem) => void;
  onRetryFailed: () => void;
  onAddAnother: () => void;
  onFinish: () => void;
}

export default function ScanReview({
  items,
  pageCount,
  finishing,
  failedCount,
  errorMessage,
  onDelete,
  onRetake,
  onMoveUp,
  onMoveDown,
  onRetryFailed,
  onAddAnother,
  onFinish,
}: ScanReviewProps) {
  const t = useTranslations("ScanPage.review");

  // Keys of confirmed content pages in order — used to disable the first/last
  // reorder arrows. Pending captures aren't reorderable (no server id yet).
  const movableKeys = items
    .filter((i) => i.kind === "page" && i.status === "uploaded")
    .map((i) => i.key);

  // All content-page keys in display order, so each cell's page number is its
  // position here (derived, not mutated during render).
  const contentKeys = items.filter((i) => i.kind === "page").map((i) => i.key);

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h2 className={styles.heading}>{t("heading")}</h2>
        <p className={styles.count}>{t("count", { count: pageCount })}</p>
      </header>

      {items.length === 0 ? (
        <p className={styles.empty}>{t("empty")}</p>
      ) : (
        <ul className={styles.grid}>
          {items.map((item) => {
            const isCover = item.kind === "cover";
            const pageNo = isCover ? null : contentKeys.indexOf(item.key) + 1;
            const src = item.status === "uploaded" ? item.thumbUrl : item.previewUrl;
            const movableIdx = movableKeys.indexOf(item.key);
            const canMove = movableIdx !== -1;
            const busy = item.status !== "uploaded";

            return (
              <li key={item.key} className={styles.item}>
                <div className={styles.thumbWrap}>
                  {src && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={isCover ? t("coverBadge") : `Page ${pageNo}`}
                      className={styles.thumb}
                      loading="lazy"
                      data-pending={busy || undefined}
                    />
                  )}
                  <span className={styles.index} data-cover={isCover || undefined}>
                    {isCover ? t("coverBadge") : pageNo}
                  </span>
                  {item.status === "uploading" && (
                    <span className={styles.statusBadge} data-state="uploading">
                      {t("status.uploading")}
                    </span>
                  )}
                  {item.status === "queued" && (
                    <span className={styles.statusBadge} data-state="queued">
                      {t("status.queued")}
                    </span>
                  )}
                  {item.status === "failed" && (
                    <span className={styles.statusBadge} data-state="failed">
                      {t("status.failed")}
                    </span>
                  )}
                </div>

                <div className={styles.itemActions}>
                  {canMove && (
                    <>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => onMoveUp(item)}
                        disabled={finishing || movableIdx === 0}
                        aria-label={t("moveUp")}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => onMoveDown(item)}
                        disabled={finishing || movableIdx === movableKeys.length - 1}
                        aria-label={t("moveDown")}
                      >
                        ↓
                      </button>
                    </>
                  )}
                  {item.status === "uploaded" && (
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => onRetake(item)}
                      disabled={finishing}
                    >
                      {t("retake")}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => onDelete(item)}
                    disabled={finishing}
                  >
                    {t("delete")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {failedCount > 0 && (
        <button type="button" className={styles.retryBtn} onClick={onRetryFailed}>
          {t("retryFailed", { count: failedCount })}
        </button>
      )}

      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={onAddAnother}
          disabled={finishing}
        >
          {t("addAnother")}
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={onFinish}
          disabled={pageCount === 0 || finishing}
        >
          {finishing ? t("uploading") : t("finish")}
        </button>
      </div>
    </section>
  );
}
