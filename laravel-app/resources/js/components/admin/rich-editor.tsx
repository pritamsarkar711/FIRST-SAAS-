import { useEffect, useRef, useState } from "react";

/**
 * CKEditor 5 (classic build, full featured) loaded from the official CDN.
 * Loaded lazily once and attached to a plain textarea-like div.
 */
const CK_URL = "https://cdn.ckeditor.com/ckeditor5/41.4.2/classic/ckeditor.js";

declare global {
  interface Window { ClassicEditor?: unknown }
}

let loadingPromise: Promise<void> | null = null;

function loadCK(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.ClassicEditor) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the editor. Check your connection."));
    document.head.appendChild(script);
  });
  return loadingPromise;
}

export function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<{ destroy: () => void; model: { document: { on: (ev: string, cb: () => void) => void }; getData: () => string } } | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCK().then(() => {
      if (cancelled || !holder.current || !window.ClassicEditor) return;
      const CE = window.ClassicEditor as {
        create: (el: HTMLElement, config: Record<string, unknown>) => Promise<never>;
      };
      CE.create(holder.current, {
        toolbar: {
          items: [
            "heading", "|", "bold", "italic", "underline", "link", "|",
            "bulletedList", "numberedList", "|", "outdent", "indent", "|",
            "blockQuote", "insertTable", "mediaEmbed", "horizontalLine", "|",
            "undo", "redo",
          ],
        },
        heading: {
          options: [
            { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
            { model: "heading2", view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
            { model: "heading3", view: "h3", title: "Heading 3", class: "ck-heading_heading3" },
            { model: "heading4", view: "h4", title: "Heading 4", class: "ck-heading_heading4" },
          ],
        },
        table: { contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"] },
      }).then((editor: never) => {
        if (cancelled) {
          (editor as { destroy: () => void }).destroy();
          return;
        }
        const inst = editor as unknown as {
          model: { document: { on: (ev: string, cb: () => void) => void } };
          getData: () => string;
          destroy: () => void;
        };
        instanceRef.current = inst;
        setReady(true);
        inst.model.document.on("change:data", () => {
          onChangeRef.current(inst.getData());
        });
        if (value && !holder.current?.innerHTML.trim()) {
          inst.setData(value);
        }
      }).catch((e: Error) => setError(e.message));
    }).catch((e: Error) => setError(e.message));

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
    };
     
  }, []);

  // Handle external value resets (loading a post into the editor)
  useEffect(() => {
    if (ready && instanceRef.current && value !== instanceRef.current.getData()) {
      instanceRef.current.setData(value);
    }
     
  }, [value === ""]);

  return (
    <div>
      {error ? (
        <div>
          <p className="mb-2 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">{error} Using the plain editor instead.</p>
          <textarea
            value={value}
            onChange={(e) => onChangeRef.current(e.target.value)}
            rows={16}
            className="w-full rounded-md border border-input px-3 py-2.5 font-mono text-sm"
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-input">
          <div ref={holder} className="min-h-[340px] px-4 py-3 text-[15px] leading-relaxed" />
        </div>
      )}
    </div>
  );
}
