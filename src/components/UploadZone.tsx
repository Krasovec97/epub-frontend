"use client";

import { useRef, useState, type DragEvent, type ChangeEvent, type KeyboardEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import styles from "./UploadZone.module.css";

type UploadStatus = "idle" | "uploading" | "error";

export default function UploadZone() {
  const t = useTranslations("HomePage.upload");
  const router = useRouter();
  const locale = useLocale();
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);

  function openFilePicker() {
    if (status === "uploading") return;
    inputRef.current?.click();
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (status === "uploading") return;
    const file = e.dataTransfer.files[0] ?? null;
    setSelectedFile(file);
    setStatus("idle");
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
    setStatus("idle");
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  }

  async function handleSubmit() {
    if (!selectedFile || status === "uploading") return;

    setStatus("uploading");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      const data: { sessionId: string } = await res.json();
      router.push(`/convert/${data.sessionId}`);
    } catch {
      setStatus("error");
    }
  }

  const uploading = status === "uploading";

  return (
    <div className={uploading ? styles.zoneDisabled : undefined}>
      <div
        className={`${styles.zone} ${isDragOver ? styles.dragOver : ""}`}
        role="button"
        tabIndex={0}
        aria-label={t("dropPrompt")}
        aria-disabled={uploading}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        onClick={openFilePicker}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          style={{ display: "none" }}
          onChange={handleInputChange}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Arrow-up icon */}
        <svg
          className={styles.icon}
          xmlns="http://www.w3.org/2000/svg"
          width="38"
          height="38"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
          <path d="M3 19h18" opacity="0.35" />
        </svg>

        {selectedFile ? (
          <>
            <p className={styles.fileName}>
              {t("fileSelected", { filename: selectedFile.name })}
            </p>
            <button
              type="button"
              className={styles.changeBtn}
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                if (inputRef.current) inputRef.current.value = "";
                openFilePicker();
              }}
            >
              {t("browse")}
            </button>
          </>
        ) : (
          <>
            <p className={styles.dropText}>{t("dropPrompt")}</p>
            <p className={styles.orText}>{t("or")}</p>
            <button
              type="button"
              className={styles.browseBtn}
              onClick={(e) => {
                e.stopPropagation();
                openFilePicker();
              }}
            >
              {t("browse")}
            </button>
          </>
        )}

        <p className={styles.formats}>{t("acceptedFormats")}</p>
      </div>

      {selectedFile && (
        <button
          type="button"
          className={styles.submitBtn}
          disabled={uploading}
          onClick={handleSubmit}
        >
          {uploading ? t("uploading") : t("submit")}
        </button>
      )}

      {status === "error" && (
        <p className={styles.errorText}>{t("uploadError")}</p>
      )}
    </div>
  );
}
