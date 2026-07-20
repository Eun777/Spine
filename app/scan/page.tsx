"use client";

import type { BookDraft } from "@/lib/types";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";

// Maximum allowed image size (12 MB)
const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;

const SAMPLE_SHELF_BOOKS: BookDraft[] = [
  {
    title: "The Midnight Library",
    author: "Matt Haig",
    isbn: "9780525559498",
    genre: "Contemporary Fiction",
    confidence_score: 0.96,
  },
  {
    title: "Braiding Sweetgrass",
    author: "Robin Wall Kimmerer",
    isbn: "9781571313560",
    genre: "Nature Writing",
    confidence_score: 0.91,
  },
  {
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    author: "Gabrielle Zevin",
    isbn: "9780593321201",
    genre: "Literary Fiction",
    confidence_score: 0.88,
  },
];

type AccessState = "loading" | "locked" | "unlocked" | "unconfigured";

export default function ScanPage() {
  const router = useRouter();

  // Access control state
  const [accessState, setAccessState] = useState<AccessState>("loading");
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);

  // Scan state
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Check access status on mount
  useEffect(() => {
    let isMounted = true;

    async function checkAccessStatus() {
      try {
        const response = await fetch("/api/access/status");
        if (!response.ok) throw new Error("Status check failed");

        const data = await response.json();
        if (isMounted) {
          if (!data.configured) {
            setAccessState("unconfigured");
          } else {
            setAccessState(data.unlocked ? "unlocked" : "locked");
          }
        }
      } catch (err) {
        if (isMounted) setAccessState("locked");
      }
    }

    checkAccessStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  // Unlock access handler
  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault();
    setAccessError(null);

    try {
      const response = await fetch("/api/access/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not verify that access code.");
      }

      setAccessCode("");
      setAccessState("unlocked");
    } catch (err) {
      setAccessError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    }
  };

  // Image selection handler
  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setScanError("Please select a valid image file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setScanError("Please choose an image under 12 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result));
      setScanError(null);
    };
    reader.onerror = () => {
      setScanError("Failed to read image file. Please try again.");
    };
    reader.readAsDataURL(file);

    // Reset input value so re-selecting the same file triggers onChange
    e.target.value = "";
  };

  // Process metadata and navigate to review
  const navigateToReview = async (booksToReview: BookDraft[]) => {
    setIsProcessing(true);
    let finalBooks = booksToReview;

    try {
      const response = await fetch("/api/book-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books: booksToReview }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.books?.length) {
          finalBooks = data.books;
        }
      }
    } catch (err) {
      console.warn("Metadata lookup failed, proceeding with initial drafts:", err);
    } finally {
      sessionStorage.setItem("detected-books", JSON.stringify(finalBooks));
      router.push("/review");
    }
  };

  // Run AI vision scan on uploaded photo
  const handleScanImage = async () => {
    if (!imageDataUrl) return;

    setIsProcessing(true);
    setScanError(null);

    try {
      const response = await fetch("/api/recognize-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Scan failed.");
      }

      if (!data.books?.length) {
        throw new Error("No books were detected. Try a clearer, closer photo.");
      }

      await navigateToReview(data.books);
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : "We couldn't scan that photo."
      );
      setIsProcessing(false);
    }
  };

  // Loading Screen
  if (accessState === "loading") {
    return (
      <div className="page-loader" aria-label="Loading page">
        <span />
      </div>
    );
  }

  // Locked Screen
  if (accessState !== "unlocked") {
    return (
      <AccessCardGuard
        accessState={accessState}
        accessCode={accessCode}
        accessError={accessError}
        onCodeChange={setAccessCode}
        onSubmit={handleUnlock}
      />
    );
  }

  // Scanner Screen
  return (
    <section className="shell scan-shell">
      <header>
        <p className="eyebrow">Add to your library</p>
        <h1>What’s on your shelf?</h1>
        <p className="lede">
          Snap a cover, a stack, or a whole row. We’ll find the books and fill in the details.
        </p>
      </header>

      <div className="dropzone">
        {imageDataUrl ? (
          <>
            <img className="preview" src={imageDataUrl} alt="Selected books preview" />
            <div className="button-row">
              <label className="secondary button-label" htmlFor="book-image">
                Choose another
              </label>
              <button
                type="button"
                className="primary"
                onClick={handleScanImage}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="loader" />
                    Reading spines…
                  </>
                ) : (
                  "Recognize books"
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="camera-orb" aria-hidden="true">▣</div>
            <h2>Take or choose a photo</h2>
            <p>Clear covers and well-lit spines work best.</p>
            <label className="primary button-label" htmlFor="book-image">
              Open camera or gallery
            </label>
          </>
        )}

        <input
          className="file-input"
          id="book-image"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageSelect}
        />
      </div>

      <div className="button-row">
        <button
          type="button"
          className="secondary"
          disabled={isProcessing}
          onClick={() => navigateToReview(SAMPLE_SHELF_BOOKS)}
        >
          {isProcessing ? "Finding book details…" : "Try a sample shelf"}
        </button>
      </div>

      {scanError && (
        <p className="form-error" role="alert">
          {scanError}
        </p>
      )}

      <footer className="privacy">
        <span aria-hidden="true">♢</span> Your photo is used only to identify books and is not stored.
      </footer>
    </section>
  );
}

// Sub-component for Access Gate UI
interface AccessCardGuardProps {
  accessState: AccessState;
  accessCode: string;
  accessError: string | null;
  onCodeChange: (code: string) => void;
  onSubmit: (e: FormEvent) => void;
}

function AccessCardGuard({
  accessState,
  accessCode,
  accessError,
  onCodeChange,
  onSubmit,
}: AccessCardGuardProps) {
  return (
    <section className="shell scan-shell">
      <div className="access-card">
        <div className="lock-orb" aria-hidden="true">⌁</div>
        <p className="eyebrow">Protected feature</p>
        <h1>Unlock book scanning</h1>
        <p className="lede">
          AI scanning uses paid credits. Enter the private access code to continue.
        </p>

        {accessState === "unconfigured" ? (
          <p className="form-error">
            The owner has not configured an access code yet.
          </p>
        ) : (
          <form className="access-form" onSubmit={onSubmit}>
            <label>
              Access code
              <input
                type="password"
                autoComplete="off"
                required
                value={accessCode}
                onChange={(e) => onCodeChange(e.target.value)}
                placeholder="Enter access code"
              />
            </label>

            {accessError && (
              <p className="form-error" role="alert">
                {accessError}
              </p>
            )}

            <button type="submit" className="primary">
              Unlock scanning
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
