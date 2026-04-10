"use client";

import { useRef, useState, type DragEvent, type ChangeEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import styles from "./UploadZone.module.css";

export default function UploadZone() {
  const t = useTranslations("HomePage.upload");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement|null>(null);

  function openFilePicker() {
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
    const file = e.dataTransfer.files[0] ?? null;
    setSelectedFile(file);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  }

  return (
    <div
      className={`${styles.zone} ${isDragOver ? styles.dragOver : ""}`}
      role="button"
      tabIndex={0}
      aria-label={t("dropPrompt")}
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
  );
}
