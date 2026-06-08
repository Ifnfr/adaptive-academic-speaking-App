import { useCallback, useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import type { FonetikSupabaseClient } from "../lib/supabase";
import {
  createCommonplaceNote,
  deleteCommonplaceNote,
  getCommonplaceNoteById,
  getCommonplaceNoteByShortcode,
  listCommonplaceNotes,
  updateCommonplaceNote,
} from "../lib/storage/supabase-commonplace-adapter";
import type {
  CommonplaceDeleteResult,
  CommonplaceNote,
  CommonplaceNoteListResult,
  CommonplaceNoteResult,
  CreateCommonplaceNoteInput,
  UpdateCommonplaceNoteInput,
} from "../lib/storage/supabase-commonplace-adapter";
import {
  createCommonplaceSubMindMap,
  deleteCommonplaceMindMap,
  getCommonplaceMindMapGraph,
  listCommonplaceSubMindMaps,
  saveCommonplaceMindMapGraph,
  createOrGetCommonplaceMainMindMap,
  getCommonplaceMainMindMapGraph,
  saveCommonplaceMainMindMapGraph,
  deleteCommonplaceMainMapCluster,
} from "../lib/storage/supabase-commonplace-mindmap-adapter";
import type {
  CommonplaceMindMapListResult,
  CommonplaceMindMapGraphResult,
  CommonplaceMindMapResult,
  CreateCommonplaceMindMapInput,
  SaveCommonplaceMindMapInput,
  CommonplaceMainMapGraphResult,
  SaveCommonplaceMainMapGraphInput,
  CommonplaceMainMapSaveResult,
  CommonplaceMindMapDeleteResult,
} from "../lib/storage/supabase-commonplace-mindmap-adapter";

type CommonplaceMode = "library" | "create" | "detail" | "edit" | "main_maps_placeholder";

type CommonplaceFormState = {
  sourceBook: string;
  sourcePage: string;
  title: string;
  quote: string;
  insight: string;
  tags: string;
  connections: string;
  relevance: string;
};

export type CommonplaceStorage = {
  listCommonplaceNotes(ownerId: string): Promise<CommonplaceNoteListResult>;
  createCommonplaceNote(
    input: CreateCommonplaceNoteInput,
  ): Promise<CommonplaceNoteResult>;
  getCommonplaceNoteById(
    ownerId: string,
    noteId: string,
  ): Promise<CommonplaceNoteResult>;
  getCommonplaceNoteByShortcode(
    ownerId: string,
    shortcode: string,
  ): Promise<CommonplaceNoteResult>;
  updateCommonplaceNote(
    input: UpdateCommonplaceNoteInput,
  ): Promise<CommonplaceNoteResult>;
  deleteCommonplaceNote(
    ownerId: string,
    noteId: string,
  ): Promise<CommonplaceDeleteResult>;
  createCommonplaceSubMindMap(
    input: CreateCommonplaceMindMapInput,
  ): Promise<CommonplaceMindMapResult>;
  listCommonplaceSubMindMaps(
    ownerId: string,
  ): Promise<CommonplaceMindMapListResult>;
  getCommonplaceMindMapGraph(
    ownerId: string,
    mindMapId: string,
  ): Promise<CommonplaceMindMapGraphResult>;
  saveCommonplaceMindMapGraph(
    input: SaveCommonplaceMindMapInput,
  ): Promise<CommonplaceDeleteResult>;
  deleteCommonplaceMindMap(
    ownerId: string,
    mindMapId: string,
  ): Promise<CommonplaceDeleteResult>;
  createOrGetCommonplaceMainMindMap?(
    ownerId: string,
  ): Promise<CommonplaceMindMapResult>;
  getCommonplaceMainMindMapGraph?(
    ownerId: string,
  ): Promise<CommonplaceMainMapGraphResult>;
  saveCommonplaceMainMindMapGraph?(
    input: SaveCommonplaceMainMapGraphInput,
  ): Promise<CommonplaceMainMapSaveResult>;
  deleteCommonplaceMainMapCluster?(
    ownerId: string,
    mainMapNodeId: string,
  ): Promise<CommonplaceMindMapDeleteResult>;
};

declare global {
  interface Window {
    __COMMONPLACE_TEST_ADAPTER__?: CommonplaceStorage;
  }
}

type CommonplaceViewProps = {
  ownerId?: string | null;
  isSignedIn?: boolean;
  getToken?: (() => Promise<string | null>) | null;
  supabaseConfigured?: boolean;
  onBackToFonetik?: () => void;
  onDiscussInPodchat?: (context: {
    source: "commonplace";
    shortcode: string;
    title?: string;
    sourceBook?: string;
    insight: string;
    tags: string[];
  }) => void;
};

const emptyForm: CommonplaceFormState = {
  sourceBook: "",
  sourcePage: "",
  title: "",
  quote: "",
  insight: "",
  tags: "",
  connections: "",
  relevance: "",
};

const DEFAULT_TEST_OWNER_ID = "commonplace-test-owner";

function splitList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formFromNote(note: CommonplaceNote): CommonplaceFormState {
  return {
    sourceBook: note.sourceBook,
    sourcePage: note.sourcePage ?? "",
    title: note.title ?? "",
    quote: note.quote ?? "",
    insight: note.insight,
    tags: note.tags.join(", "),
    connections: note.connections.join(", "),
    relevance: note.relevance ?? "",
  };
}

function inputFromForm(
  form: CommonplaceFormState,
): Omit<CreateCommonplaceNoteInput, "ownerId"> {
  return {
    sourceBook: form.sourceBook,
    sourcePage: form.sourcePage,
    title: form.title,
    quote: form.quote,
    insight: form.insight,
    tags: splitList(form.tags),
    connections: splitList(form.connections),
    relevance: form.relevance,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function displayTitle(note: CommonplaceNote): string {
  return note.title?.trim() || note.sourceBook || "Untitled Source";
}

function noteMatchesSearch(note: CommonplaceNote, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    note.shortcode,
    note.title ?? "",
    note.sourceBook,
    ...note.tags,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function getTestStorage(): CommonplaceStorage | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  return window.__COMMONPLACE_TEST_ADAPTER__ ?? null;
}

function createSupabaseStorage(
  supabaseClient: FonetikSupabaseClient,
): CommonplaceStorage {
  return {
    listCommonplaceNotes: (ownerId) =>
      listCommonplaceNotes(ownerId, supabaseClient),
    createCommonplaceNote: (input) =>
      createCommonplaceNote(input, supabaseClient),
    getCommonplaceNoteById: (ownerId, noteId) =>
      getCommonplaceNoteById(ownerId, noteId, supabaseClient),
    getCommonplaceNoteByShortcode: (ownerId, shortcode) =>
      getCommonplaceNoteByShortcode(ownerId, shortcode, supabaseClient),
    updateCommonplaceNote: (input) =>
      updateCommonplaceNote(input, supabaseClient),
    deleteCommonplaceNote: (ownerId, noteId) =>
      deleteCommonplaceNote(ownerId, noteId, supabaseClient),
    createCommonplaceSubMindMap: (input) =>
      createCommonplaceSubMindMap(input, supabaseClient),
    listCommonplaceSubMindMaps: (ownerId) =>
      listCommonplaceSubMindMaps(ownerId, supabaseClient),
    getCommonplaceMindMapGraph: (ownerId, mindMapId) =>
      getCommonplaceMindMapGraph(ownerId, mindMapId, supabaseClient),
    saveCommonplaceMindMapGraph: (input) =>
      saveCommonplaceMindMapGraph(input, supabaseClient),
    deleteCommonplaceMindMap: (ownerId, mindMapId) =>
      deleteCommonplaceMindMap(ownerId, mindMapId, supabaseClient),
    createOrGetCommonplaceMainMindMap: (ownerId) =>
      createOrGetCommonplaceMainMindMap(ownerId, supabaseClient),
    getCommonplaceMainMindMapGraph: (ownerId) =>
      getCommonplaceMainMindMapGraph(ownerId, supabaseClient),
    saveCommonplaceMainMindMapGraph: (input) =>
      saveCommonplaceMainMindMapGraph(input, supabaseClient),
    deleteCommonplaceMainMapCluster: (ownerId, mainMapNodeId) =>
      deleteCommonplaceMainMapCluster(ownerId, mainMapNodeId, supabaseClient),
  };
}

async function createCommonplaceNoteViaServer(
  input: Omit<CreateCommonplaceNoteInput, "ownerId">,
): Promise<CommonplaceNoteResult> {
  try {
    const response = await fetch("/api/commonplace/notes", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await response.json().catch(() => null)) as
      | { note?: CommonplaceNote; error?: string }
      | null;

    if (response.ok && data?.note) {
      return { ok: true, note: data.note };
    }

    if (data?.error === "auth_required") {
      return { ok: false, error: "commonplace_auth_required" };
    }
    if (data?.error === "invalid_note_fields") {
      return { ok: false, error: "commonplace_validation_failed" };
    }

    return { ok: false, error: "commonplace_save_failed" };
  } catch {
    return { ok: false, error: "commonplace_save_failed" };
  }
}

export function CommonplaceView({
  ownerId,
  isSignedIn = false,
  getToken,
  supabaseConfigured = isSupabaseConfigured(),
  onBackToFonetik,
  onDiscussInPodchat,
}: CommonplaceViewProps) {
  const [mode, setMode] = useState<CommonplaceMode>("library");
  const [notes, setNotes] = useState<CommonplaceNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<CommonplaceNote | null>(null);
  const [form, setForm] = useState<CommonplaceFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"sourceBook" | "title" | "insight", string>>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const testStorage = getTestStorage();
  const effectiveOwnerId = ownerId ?? (testStorage ? DEFAULT_TEST_OWNER_ID : null);

  const storage = useMemo<CommonplaceStorage | null>(() => {
    if (testStorage) return testStorage;
    if (!supabaseConfigured || !effectiveOwnerId || !isSignedIn) return null;

    const supabaseClient = createBrowserSupabaseClient({
      accessToken: async () => (await getToken?.()) ?? null,
    });

    return supabaseClient ? createSupabaseStorage(supabaseClient) : null;
  }, [effectiveOwnerId, getToken, isSignedIn, supabaseConfigured, testStorage]);

  const unavailableMessage = useMemo(() => {
    if (testStorage) return null;
    if (!isSignedIn || !effectiveOwnerId) {
      return "Sign in to use Commonplace notes.";
    }
    if (!supabaseConfigured || !storage) {
      return "Commonplace storage is not available right now.";
    }
    return null;
  }, [effectiveOwnerId, isSignedIn, storage, supabaseConfigured, testStorage]);

  const loadNotes = useCallback(async () => {
    if (!storage || !effectiveOwnerId) return;

    setIsLoading(true);
    setError(null);
    const result = await storage.listCommonplaceNotes(effectiveOwnerId);
    setIsLoading(false);

    if (!result.ok) {
      setError("Could not load Commonplace notes. Please try again.");
      return;
    }

    setNotes(result.notes);
  }, [effectiveOwnerId, storage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotes();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNotes]);

  const openCreate = () => {
    setForm(emptyForm);
    setFieldErrors({});
    setSelectedNote(null);
    setDeleteConfirmVisible(false);
    setError(null);
    setMode("create");
  };

  const openLibrary = () => {
    setMode("library");
    setSelectedNote(null);
    setDeleteConfirmVisible(false);
    setError(null);
    setFieldErrors({});
  };

  const openDetail = async (noteId: string) => {
    if (!storage || !effectiveOwnerId) return;

    setError(null);
    setDeleteConfirmVisible(false);
    const result = await storage.getCommonplaceNoteById(effectiveOwnerId, noteId);
    if (!result.ok) {
      setError("Could not open that note. Please try again.");
      return;
    }

    setSelectedNote(result.note);
    setMode("detail");
  };

  const openEdit = () => {
    if (!selectedNote) return;
    setForm(formFromNote(selectedNote));
    setFieldErrors({});
    setDeleteConfirmVisible(false);
    setError(null);
    setMode("edit");
  };

  const handleSubmit = async () => {
    if (!storage || !effectiveOwnerId) return;

    const nextFieldErrors: Partial<
      Record<"sourceBook" | "title" | "insight", string>
    > = {};
    if (form.sourceBook.trim().length === 0) {
      nextFieldErrors.sourceBook = "Source book is required.";
    }
    if (form.title.trim().length === 0) {
      nextFieldErrors.title = "Title is required.";
    }
    if (form.insight.trim().length === 0) {
      nextFieldErrors.insight = "Insight is required.";
    }
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Please complete the required fields.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const formInput = inputFromForm(form);
    const result =
      mode === "edit" && selectedNote
        ? await storage.updateCommonplaceNote({
            ownerId: effectiveOwnerId,
            noteId: selectedNote.id,
            ...formInput,
          })
        : testStorage
          ? await storage.createCommonplaceNote({
              ownerId: effectiveOwnerId,
              ...formInput,
            })
          : await createCommonplaceNoteViaServer(formInput);

    setIsSaving(false);

    if (!result.ok) {
      if (result.error === "commonplace_auth_required") {
        setError("Please sign in to save notes.");
      } else if (result.error === "commonplace_validation_failed") {
        setError("Please complete the required fields.");
      } else {
        setError("Could not save this note. Please try again.");
      }
      return;
    }

    setSelectedNote(result.note);
    setNotes((current) => {
      const withoutSaved = current.filter((note) => note.id !== result.note.id);
      return [result.note, ...withoutSaved];
    });
    setForm(emptyForm);
    setMode("detail");
  };

  const handleDelete = async () => {
    if (!storage || !effectiveOwnerId || !selectedNote) return;

    setIsSaving(true);
    setError(null);
    const result = await storage.deleteCommonplaceNote(
      effectiveOwnerId,
      selectedNote.id,
    );
    setIsSaving(false);

    if (!result.ok) {
      setError("Could not delete this note. Please try again.");
      return;
    }

    setNotes((current) => current.filter((note) => note.id !== selectedNote.id));
    setSelectedNote(null);
    setDeleteConfirmVisible(false);
    setMode("library");
  };

  const handleDiscussInPodchat = () => {
    if (!selectedNote || !onDiscussInPodchat) return;

    onDiscussInPodchat({
      source: "commonplace",
      shortcode: selectedNote.shortcode,
      title: selectedNote.title ?? undefined,
      sourceBook: selectedNote.sourceBook || undefined,
      insight: selectedNote.insight,
      tags: selectedNote.tags,
    });
  };

  const updateField = (field: keyof CommonplaceFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (
      field === "sourceBook" ||
      field === "title" ||
      field === "insight"
    ) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const filteredNotes = useMemo(
    () => notes.filter((note) => noteMatchesSearch(note, searchQuery)),
    [notes, searchQuery],
  );

  return (
    <section
      className="min-h-[calc(100dvh-11rem)] overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm lg:min-h-0 lg:flex-1"
      data-testid="commonplace-view"
      aria-labelledby="commonplace-title"
    >
      <div className="flex min-h-full flex-col lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <CommonplaceSidebar
          notes={filteredNotes}
          selectedNoteId={selectedNote?.id ?? null}
          searchQuery={searchQuery}
          isLoading={isLoading}
          onSearchChange={setSearchQuery}
          onBackToFonetik={onBackToFonetik}
          onCreate={openCreate}
          onOpen={openDetail}
        />

        <div className="min-w-0 bg-[var(--brand-surface)] p-4 sm:p-6 lg:h-full lg:overflow-y-auto lg:p-8">
          {unavailableMessage ? (
            <div className="rounded-lg border border-[var(--brand-border)] bg-white px-4 py-3 text-sm text-[var(--brand-ink-soft)]">
              {unavailableMessage}
            </div>
          ) : (
            <>
              {error && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-[#B42318]/20 bg-[#FFF4F3] px-4 py-3 text-sm text-[#8A1F15]"
                >
                  {error}
                </p>
              )}

              {mode === "library" && (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal)]">
                        LIBRARY
                      </p>
                      <h2
                        id="commonplace-title"
                        className="mt-1 text-3xl font-semibold tracking-tight text-[var(--brand-ink)]"
                      >
                        Commonplace
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-ink-soft)]">
                        Capture book ideas, connect insights, and prepare them
                        for speaking practice.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNote(null);
                        setMode("main_maps_placeholder");
                      }}
                      className="rounded-lg border border-[var(--brand-teal)]/25 bg-[var(--brand-teal-soft)] px-4 py-2 text-sm font-semibold text-[var(--brand-teal-ink)] transition-colors hover:bg-[#BFEDE5]"
                      data-testid="commonplace-main-maps-btn"
                    >
                      Main Maps
                    </button>
                  </div>
                  <LibraryView
                    notes={filteredNotes}
                    isLoading={isLoading}
                    onCreate={openCreate}
                    onOpen={openDetail}
                  />
                </div>
              )}

              {(mode === "create" || mode === "edit") && (
                <NoteForm
                  mode={mode}
                  form={form}
                  fieldErrors={fieldErrors}
                  shortcode={mode === "edit" ? selectedNote?.shortcode : null}
                  isSaving={isSaving}
                  onBack={mode === "edit" && selectedNote ? () => setMode("detail") : openLibrary}
                  onSubmit={handleSubmit}
                  onChange={updateField}
                />
              )}

              {mode === "detail" && selectedNote && (
                <NoteDetail
                  note={selectedNote}
                  isSaving={isSaving}
                  deleteConfirmVisible={deleteConfirmVisible}
                  onBack={openLibrary}
                  onEdit={openEdit}
                  onDiscussInPodchat={onDiscussInPodchat ? handleDiscussInPodchat : undefined}
                  onAskDelete={() => setDeleteConfirmVisible(true)}
                  onCancelDelete={() => setDeleteConfirmVisible(false)}
                  onConfirmDelete={handleDelete}
                />
              )}

              {mode === "main_maps_placeholder" && (
                <MainMapsPlaceholder onBack={openLibrary} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function CommonplaceSidebar({
  notes,
  selectedNoteId,
  searchQuery,
  isLoading,
  onSearchChange,
  onBackToFonetik,
  onCreate,
  onOpen,
}: {
  notes: CommonplaceNote[];
  selectedNoteId: string | null;
  searchQuery: string;
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onBackToFonetik?: () => void;
  onCreate: () => void;
  onOpen: (noteId: string) => void;
}) {
  return (
    <aside
      data-testid="commonplace-sidebar"
      className="flex min-h-[18rem] flex-col border-b border-[var(--brand-border)] bg-[var(--brand-surface-2)] p-4 lg:h-full lg:border-b-0 lg:border-r"
      aria-label="Commonplace library"
    >
      <button
        type="button"
        onClick={onBackToFonetik}
        className="w-full rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-left text-sm font-semibold text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
      >
        ← Kembali ke Fonetik
      </button>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-muted)]">
          LIBRARY
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-[var(--brand-teal)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-teal-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2"
        >
          + Baru
        </button>
      </div>

      <label
        htmlFor="commonplace-search"
        className="mt-4 flex flex-col gap-2 text-xs font-semibold text-[var(--brand-ink)]"
      >
        Search notes
        <input
          id="commonplace-search"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Title, book, shortcode, tag"
          className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-sm font-normal text-[var(--brand-ink)] outline-none placeholder:text-[var(--brand-muted)] focus:border-[var(--brand-teal)] focus:ring-2 focus:ring-[var(--brand-teal)]/20"
        />
      </label>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        {isLoading ? (
          <p className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-sm text-[var(--brand-ink-soft)]">
            Loading notes...
          </p>
        ) : notes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--brand-border-strong)] bg-white/70 px-3 py-4 text-sm leading-6 text-[var(--brand-ink-soft)]">
            No matching notes yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2" data-testid="commonplace-sidebar-note-list">
            {notes.map((note) => (
              <SidebarNoteButton
                key={note.id}
                note={note}
                selected={note.id === selectedNoteId}
                onClick={() => onOpen(note.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarNoteButton({
  note,
  selected,
  onClick,
}: {
  note: CommonplaceNote;
  selected: boolean;
  onClick: () => void;
}) {
  const visibleTags = note.tags.slice(0, 2);
  const hiddenCount = Math.max(0, note.tags.length - visibleTags.length);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] ${
        selected
          ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)]"
          : "border-[var(--brand-border)] bg-white hover:bg-[var(--brand-surface)]"
      }`}
    >
      <span className="text-[11px] font-semibold text-[var(--brand-teal-ink)]">
        {note.shortcode}
      </span>
      <span className="mt-1 block truncate text-sm font-semibold text-[var(--brand-ink)]">
        {displayTitle(note)}
      </span>
      <span className="mt-1 block truncate text-xs text-[var(--brand-ink-soft)]">
        {note.sourceBook}
      </span>
      {note.tags.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--brand-teal)]/20 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--brand-teal-ink)]"
            >
              #{tag}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-muted)]">
              +{hiddenCount}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

function LibraryView({
  notes,
  isLoading,
  onCreate,
  onOpen,
}: {
  notes: CommonplaceNote[];
  isLoading: boolean;
  onCreate: () => void;
  onOpen: (noteId: string) => void;
}) {
  if (isLoading) {
    return (
      <p className="rounded-lg border border-[var(--brand-border)] bg-white px-4 py-3 text-sm text-[var(--brand-ink-soft)]">
        Loading Commonplace notes...
      </p>
    );
  }

  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 xl:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]"
      data-testid="commonplace-library-grid"
    >
      {notes.map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={() => onOpen(note.id)}
          className="group flex aspect-[3/4] min-h-[220px] flex-col overflow-hidden rounded-lg border border-[var(--brand-border)] bg-white text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-[var(--brand-teal)]/35 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)]"
        >
          <span className="flex flex-1 flex-col p-4">
            <span className="text-base font-semibold leading-5 text-[var(--brand-ink)]">
              {displayTitle(note)}
            </span>
            <span className="mt-2 text-xs font-medium text-[var(--brand-ink-soft)]">
              {note.sourceBook}
              {note.sourcePage ? `, p. ${note.sourcePage}` : ""}
            </span>
            <span className="mt-3 line-clamp-4 overflow-hidden text-sm leading-6 text-[var(--brand-ink-soft)]">
              {note.insight}
            </span>
            {note.tags.length > 0 && (
              <span className="mt-auto flex flex-wrap gap-1.5 pt-4">
                {note.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[var(--brand-teal)]/20 bg-[var(--brand-teal-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-teal-ink)]"
                  >
                    #{tag}
                  </span>
                ))}
              </span>
            )}
          </span>
          <span className="flex items-center justify-end border-t border-[var(--brand-border)] bg-[var(--brand-surface-2)] px-4 py-2">
            <span className="font-mono text-xs font-semibold text-[var(--brand-teal-ink)]">
              {note.shortcode}
            </span>
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={onCreate}
        className="flex aspect-[3/4] min-h-[220px] flex-col items-start justify-between rounded-lg border border-dashed border-[var(--brand-teal)]/45 bg-white p-5 text-left transition-colors hover:bg-[var(--brand-teal-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)]"
        aria-describedby="commonplace-empty-helper"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-teal)] text-white">
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
  );
}

function NoteForm({
  mode,
  form,
  fieldErrors,
  shortcode,
  isSaving,
  onBack,
  onSubmit,
  onChange,
}: {
  mode: "create" | "edit";
  form: CommonplaceFormState;
  fieldErrors: Partial<Record<"sourceBook" | "title" | "insight", string>>;
  shortcode: string | null | undefined;
  isSaving: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onChange: (field: keyof CommonplaceFormState, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-ink)]">
            {mode === "edit" ? "Edit note" : "Create note"}
          </h3>
          {shortcode && (
            <p className="mt-1 text-sm text-[#534AB7]">
              Shortcode {shortcode}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[var(--brand-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface-2)]"
        >
          Back
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          id="commonplace-source-book"
          label="Source book"
          value={form.sourceBook}
          placeholder="Untitled Source"
          required
          error={fieldErrors.sourceBook}
          onChange={(value) => onChange("sourceBook", value)}
        />
        <TextInput
          id="commonplace-source-page"
          label="Source page"
          value={form.sourcePage}
          onChange={(value) => onChange("sourcePage", value)}
        />
        <TextInput
          id="commonplace-note-title"
          label="Title"
          value={form.title}
          required
          error={fieldErrors.title}
          onChange={(value) => onChange("title", value)}
        />
        <TextInput
          id="commonplace-tags"
          label="Tags"
          value={form.tags}
          placeholder="politics, institutions"
          onChange={(value) => onChange("tags", value)}
        />
      </div>

      <TextArea
        id="commonplace-quote"
        label="Quote"
        value={form.quote}
        rows={3}
        onChange={(value) => onChange("quote", value)}
      />
      <TextArea
        id="commonplace-insight"
        label="Insight"
        value={form.insight}
        rows={5}
        required
        error={fieldErrors.insight}
        onChange={(value) => onChange("insight", value)}
      />
      <TextArea
        id="commonplace-connections"
        label="Connections"
        value={form.connections}
        rows={2}
        placeholder="#wnf1, #us1"
        onChange={(value) => onChange("connections", value)}
      />
      <TextArea
        id="commonplace-relevance"
        label="Relevance"
        value={form.relevance}
        rows={3}
        onChange={(value) => onChange("relevance", value)}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="rounded-lg bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#413797] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save note"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[var(--brand-border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface-2)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function NoteDetail({
  note,
  isSaving,
  deleteConfirmVisible,
  onBack,
  onEdit,
  onDiscussInPodchat,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  note: CommonplaceNote;
  isSaving: boolean;
  deleteConfirmVisible: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDiscussInPodchat?: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <article className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#534AB7]">
            {note.shortcode}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--brand-ink)]">
            {displayTitle(note)}
          </h3>
          <p className="mt-1 text-sm text-[var(--brand-ink-soft)]">
            {note.sourceBook}
            {note.sourcePage ? `, p. ${note.sourcePage}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-[var(--brand-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-surface-2)]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-[#534AB7]/30 bg-[#EEEDFE] px-4 py-2 text-sm font-semibold text-[#332C85] hover:bg-[#E3E0FF]"
          >
            Edit
          </button>
          {onDiscussInPodchat && (
            <button
              type="button"
              onClick={onDiscussInPodchat}
              className="rounded-lg border border-[#1F7A7A]/30 bg-[#EAF8F7] px-4 py-2 text-sm font-semibold text-[#155E5E] hover:bg-[#D8F0EF]"
            >
              Diskusi di Podchat
            </button>
          )}
          <button
            type="button"
            onClick={onAskDelete}
            className="rounded-lg border border-[#B42318]/25 bg-white px-4 py-2 text-sm font-semibold text-[#8A1F15] hover:bg-[#FFF4F3]"
          >
            Delete
          </button>
        </div>
      </div>

      <DetailBlock label="Insight" value={note.insight} />
      {note.quote && <DetailBlock label="Quote" value={note.quote} />}
      {note.relevance && (
        <DetailBlock label="Relevance" value={note.relevance} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <DetailList label="Tags" values={note.tags.map((tag) => `#${tag}`)} />
        <DetailList label="Connections" values={note.connections} />
      </div>

      <div className="grid gap-4 text-sm text-[var(--brand-ink-soft)] md:grid-cols-2">
        <p>Created {formatDate(note.createdAt)}</p>
        <p>Updated {formatDate(note.updatedAt)}</p>
      </div>

      {deleteConfirmVisible && (
        <div className="rounded-lg border border-[#B42318]/20 bg-[#FFF4F3] p-4">
          <p className="text-sm font-semibold text-[#8A1F15]">
            Delete this note?
          </p>
          <p className="mt-1 text-sm text-[#8A1F15]">
            This removes only this Commonplace note.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={isSaving}
              className="rounded-lg bg-[#8A1F15] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Deleting..." : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-lg border border-[#B42318]/25 bg-white px-4 py-2 text-sm font-semibold text-[#8A1F15]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function TextInput({
  id,
  label,
  value,
  placeholder,
  required = false,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm font-semibold text-[var(--brand-ink)]">
      <span>
        {label}
        {required && <span className="text-[#8A1F15]"> *</span>}
      </span>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.target.value)}
        className={`rounded-lg border bg-white px-3 py-2 text-sm font-normal text-[var(--brand-ink)] outline-none focus:ring-2 ${
          error
            ? "border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]/20"
            : "border-[var(--brand-border)] focus:border-[var(--brand-teal)] focus:ring-[var(--brand-teal)]/20"
        }`}
      />
      {error && (
        <span id={errorId} className="text-xs font-medium text-[#8A1F15]">
          {error}
        </span>
      )}
    </label>
  );
}

function TextArea({
  id,
  label,
  value,
  rows,
  required = false,
  placeholder,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  rows: number;
  required?: boolean;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm font-semibold text-[var(--brand-ink)]">
      <span>
        {label}
        {required && <span className="text-[#8A1F15]"> *</span>}
      </span>
      <textarea
        id={id}
        value={value}
        rows={rows}
        required={required}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.target.value)}
        className={`resize-y rounded-lg border bg-white px-3 py-2 text-sm font-normal leading-6 text-[var(--brand-ink)] outline-none focus:ring-2 ${
          error
            ? "border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]/20"
            : "border-[var(--brand-border)] focus:border-[var(--brand-teal)] focus:ring-[var(--brand-teal)]/20"
        }`}
      />
      {error && (
        <span id={errorId} className="text-xs font-medium text-[#8A1F15]">
          {error}
        </span>
      )}
    </label>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-lg border border-[var(--brand-border)] bg-white p-4">
      <h4 className="text-sm font-semibold text-[var(--brand-ink)]">{label}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--brand-ink-soft)]">
        {value}
      </p>
    </section>
  );
}

function DetailList({ label, values }: { label: string; values: string[] }) {
  return (
    <section className="rounded-lg border border-[var(--brand-border)] bg-white p-4">
      <h4 className="text-sm font-semibold text-[var(--brand-ink)]">{label}</h4>
      {values.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="rounded-full border border-[#534AB7]/20 bg-[#EEEDFE] px-2.5 py-1 text-xs text-[#332C85]"
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--brand-ink-soft)]">None</p>
      )}
    </section>
  );
}

function MainMapsPlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <section
      className="rounded-xl border border-dashed border-[var(--brand-border-strong)] bg-[var(--brand-surface-2)] p-6"
      data-testid="commonplace-main-maps-placeholder"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal)]">
        Main Maps
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--brand-ink)]">
        Main Maps is coming soon
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-ink-soft)]">
        This entry point is reserved for a future collection view. Phase 1A
        keeps the library focused on notes.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 rounded-lg border border-[var(--brand-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] transition-colors hover:bg-[var(--brand-surface)]"
      >
        Back to Library
      </button>
    </section>
  );
}
