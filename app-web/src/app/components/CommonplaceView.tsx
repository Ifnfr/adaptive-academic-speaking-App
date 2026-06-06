import { useState } from "react";

export function CommonplaceView() {
  const [creationNoticeVisible, setCreationNoticeVisible] = useState(false);

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="commonplace-view"
      aria-labelledby="commonplace-title"
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid">
        <div className="border-b border-[var(--brand-border)] bg-[#EEEDFE] px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#534AB7]">
            Library
          </p>
          <h2
            id="commonplace-title"
            className="mt-1 text-2xl font-semibold tracking-tight text-[var(--brand-ink)]"
          >
            Commonplace
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--brand-ink-soft)]">
            Capture book ideas, connect insights, and prepare them for speaking
            practice.
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            <button
              type="button"
              onClick={() => setCreationNoticeVisible(true)}
              className="flex min-h-[180px] flex-col items-start justify-between rounded-lg border border-dashed border-[#534AB7]/45 bg-white p-5 text-left transition-colors hover:bg-[#EEEDFE] focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)]"
              aria-describedby="commonplace-empty-helper"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#534AB7] text-white">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 5v14m7-7H5"
                  />
                </svg>
              </span>
              <span>
                <span className="block text-base font-semibold text-[var(--brand-ink)]">
                  Tambah note
                </span>
                <span
                  id="commonplace-empty-helper"
                  className="mt-2 block text-sm leading-6 text-[var(--brand-ink-soft)]"
                >
                  Start by saving one idea from a book.
                </span>
              </span>
            </button>
          </div>

          {creationNoticeVisible && (
            <p
              role="status"
              className="mt-4 rounded-lg border border-[#534AB7]/25 bg-[#EEEDFE] px-4 py-3 text-sm text-[#332C85]"
            >
              Note creation coming next.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
