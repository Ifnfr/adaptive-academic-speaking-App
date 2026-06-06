import { useCallback, useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import type { FonetikSupabaseClient } from "../lib/supabase";
import { CommonplaceMindMapCanvas } from "./CommonplaceMindMapCanvas";
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
} from "../lib/storage/supabase-commonplace-mindmap-adapter";
import type {
  CommonplaceMindMapListResult,
  CommonplaceMindMapGraphResult,
  CommonplaceMindMapResult,
  CreateCommonplaceMindMapInput,
  SaveCommonplaceMindMapInput,
} from "../lib/storage/supabase-commonplace-mindmap-adapter";

type CommonplaceMode = "library" | "create" | "detail" | "edit" | "mindmap";

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

  // Mind map additions
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
  };
}

export function CommonplaceView({
  ownerId,
  isSignedIn = false,
  getToken,
  supabaseConfigured = isSupabaseConfigured(),
  onDiscussInPodchat,
}: CommonplaceViewProps) {
  const [mode, setMode] = useState<CommonplaceMode>("library");
  const [notes, setNotes] = useState<CommonplaceNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<CommonplaceNote | null>(null);
  const [form, setForm] = useState<CommonplaceFormState>(emptyForm);
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
    setDeleteConfirmVisible(false);
    setError(null);
    setMode("edit");
  };

  const openMindMap = () => {
    if (!selectedNote) return;
    setDeleteConfirmVisible(false);
    setError(null);
    setMode("mindmap");
  };

  const handleSubmit = async () => {
    if (!storage || !effectiveOwnerId) return;
    if (form.insight.trim().length === 0) {
      setError("Insight is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const result =
      mode === "edit" && selectedNote
        ? await storage.updateCommonplaceNote({
            ownerId: effectiveOwnerId,
            noteId: selectedNote.id,
            ...inputFromForm(form),
          })
        : await storage.createCommonplaceNote({
            ownerId: effectiveOwnerId,
            ...inputFromForm(form),
          });

    setIsSaving(false);

    if (!result.ok) {
      setError("Could not save this note. Please check the fields and try again.");
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
  };

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="commonplace-view"
      aria-labelledby="commonplace-title"
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm brand-grid">
        <div className="border-b border-[var(--brand-border)] bg-[#EEEDFE] px-6 py-5">
          <p className="text-xs font-semibold uppercase text-[#534AB7]">
            Library
          </p>
          <h2
            id="commonplace-title"
            className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]"
          >
            Commonplace
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--brand-ink-soft)]">
            Capture book ideas, connect insights, and prepare them for speaking
            practice.
          </p>
        </div>

        <div className="p-6">
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
                <LibraryView
                  notes={notes}
                  isLoading={isLoading}
                  onCreate={openCreate}
                  onOpen={openDetail}
                />
              )}

              {(mode === "create" || mode === "edit") && (
                <NoteForm
                  mode={mode}
                  form={form}
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
                  onOpenMindMap={openMindMap}
                  onDiscussInPodchat={onDiscussInPodchat ? handleDiscussInPodchat : undefined}
                  onAskDelete={() => setDeleteConfirmVisible(true)}
                  onCancelDelete={() => setDeleteConfirmVisible(false)}
                  onConfirmDelete={handleDelete}
                />
              )}

              {mode === "mindmap" && selectedNote && (
                <CommonplaceMindMapCanvas
                  note={selectedNote}
                  onBackToDetail={() => setMode("detail")}
                  onLookupByShortcode={async (shortcode) => {
                    if (!storage || !effectiveOwnerId) {
                      return { ok: false as const, error: "Storage unavailable" };
                    }
                    return storage.getCommonplaceNoteByShortcode(
                      effectiveOwnerId,
                      shortcode,
                    );
                  }}
                  ownerId={effectiveOwnerId}
                  storage={storage}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
      <button
        type="button"
        onClick={onCreate}
        className="flex min-h-[190px] flex-col items-start justify-between rounded-lg border border-dashed border-[#534AB7]/45 bg-white p-5 text-left transition-colors hover:bg-[#EEEDFE] focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)]"
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

      {notes.map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={() => onOpen(note.id)}
          className="flex min-h-[190px] flex-col rounded-lg border border-[var(--brand-border)] bg-white p-5 text-left shadow-sm transition-colors hover:bg-[#F8F7FF] focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:ring-offset-2 focus:ring-offset-[var(--brand-bg)]"
        >
          <span className="text-xs font-semibold text-[#534AB7]">
            {note.shortcode}
          </span>
          <span className="mt-2 text-base font-semibold text-[var(--brand-ink)]">
            {displayTitle(note)}
          </span>
          <span className="mt-1 text-xs text-[var(--brand-ink-soft)]">
            {note.sourceBook}
            {note.sourcePage ? `, p. ${note.sourcePage}` : ""}
          </span>
          <span className="mt-3 max-h-[4.75rem] overflow-hidden text-sm leading-6 text-[var(--brand-ink-soft)]">
            {note.insight}
          </span>
          {note.tags.length > 0 && (
            <span className="mt-4 flex flex-wrap gap-2">
              {note.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#534AB7]/20 bg-[#EEEDFE] px-2.5 py-1 text-xs text-[#332C85]"
                >
                  #{tag}
                </span>
              ))}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function NoteForm({
  mode,
  form,
  shortcode,
  isSaving,
  onBack,
  onSubmit,
  onChange,
}: {
  mode: "create" | "edit";
  form: CommonplaceFormState;
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
  onOpenMindMap,
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
  onOpenMindMap: () => void;
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
            onClick={onOpenMindMap}
            className="rounded-lg border border-[#534AB7]/30 bg-white px-4 py-2 text-sm font-semibold text-[#332C85] hover:bg-[#F8F7FF]"
          >
            Buka mind map
          </button>
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
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm font-semibold text-[var(--brand-ink)]">
      {label}
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-sm font-normal text-[var(--brand-ink)] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/20"
      />
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
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  rows: number;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2 text-sm font-semibold text-[var(--brand-ink)]">
      {label}
      <textarea
        id={id}
        value={value}
        rows={rows}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="resize-y rounded-lg border border-[var(--brand-border)] bg-white px-3 py-2 text-sm font-normal leading-6 text-[var(--brand-ink)] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/20"
      />
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
