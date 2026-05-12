import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  Eye,
  FileArchive,
  FileText,
  Printer,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/openui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/openui/Card";
import { Input } from "@/components/openui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/openui/Select";
import { useEquation } from "@/lib/equation";
import { cn } from "@/lib/utils";

type LegalCategory =
  | "Articles of Incorporation"
  | "Trademark Filing"
  | "Trademark Registration"
  | "Copyright Filing"
  | "Copyright Registration"
  | "Operating Agreement"
  | "EIN / Tax Letter"
  | "Contract"
  | "Other";

type LegalDocument = {
  id: string;
  name: string;
  category: LegalCategory;
  mimeType: string;
  size: number;
  uploadedAt: string;
  dataUrl: string;
};

const LEGAL_CATEGORIES: LegalCategory[] = [
  "Articles of Incorporation",
  "Trademark Filing",
  "Trademark Registration",
  "Copyright Filing",
  "Copyright Registration",
  "Operating Agreement",
  "EIN / Tax Letter",
  "Contract",
  "Other",
];

const MAX_DOCUMENT_BYTES = 5_000_000;

function storageKey(profileId: string) {
  return `fyi:legal-documents:v1:${profileId}`;
}

function uid() {
  return `legal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function bytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function titleFromFile(file: File) {
  return file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
}

function isLegalDocument(value: unknown): value is LegalDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<LegalDocument>;
  return (
    typeof document.id === "string" &&
    typeof document.name === "string" &&
    typeof document.mimeType === "string" &&
    typeof document.size === "number" &&
    typeof document.uploadedAt === "string" &&
    typeof document.dataUrl === "string" &&
    LEGAL_CATEGORIES.includes(document.category as LegalCategory)
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read document."));
    reader.onerror = () => reject(reader.error || new Error("Could not read document."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(document: LegalDocument) {
  return fetch(document.dataUrl)
    .then((response) => response.blob())
    .then(
      (blob) =>
        new File([blob], document.name, {
          type: document.mimeType || blob.type || "application/octet-stream",
        }),
    );
}

export default function Legal() {
  const { activeProfile } = useEquation();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [documentsHydrated, setDocumentsHydrated] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<LegalDocument | null>(null);
  const [category, setCategory] = useState<LegalCategory>("Articles of Incorporation");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setDocumentsHydrated(false);
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(activeProfile.id)) || "[]");
      setDocuments(Array.isArray(parsed) ? parsed.filter(isLegalDocument) : []);
    } catch {
      setDocuments([]);
    }
    setDocumentsHydrated(true);
  }, [activeProfile.id]);

  useEffect(() => {
    if (!documentsHydrated) return;
    try {
      localStorage.setItem(storageKey(activeProfile.id), JSON.stringify(documents));
    } catch {
      setError("This browser storage is full. Remove older files or keep larger PDFs outside FYI.");
    }
  }, [activeProfile.id, documents, documentsHydrated]);

  const documentCount = documents.length;
  const totalSize = useMemo(
    () => documents.reduce((sum, document) => sum + document.size, 0),
    [documents],
  );

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const next: LegalDocument[] = [];

    for (const file of Array.from(files)) {
      const accepted = file.type === "application/pdf" || file.type.startsWith("image/");
      if (!accepted) {
        setError("Upload PDF files or images only.");
        continue;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        setError("Keep each legal document under 5 MB for local storage.");
        continue;
      }

      const dataUrl = await readAsDataUrl(file);
      next.push({
        id: uid(),
        name: customName.trim() || titleFromFile(file),
        category,
        mimeType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        dataUrl,
      });
    }

    if (next.length) {
      setDocuments((current) => [...next, ...current]);
      setCustomName("");
      toast.success(next.length === 1 ? "Document added" : `${next.length} documents added`);
    }
  };

  const removeDocument = (id: string) => {
    setDocuments((current) => current.filter((document) => document.id !== id));
    setPreviewDocument((current) => (current?.id === id ? null : current));
    toast.success("Document deleted");
  };

  const printDocument = async (document: LegalDocument) => {
    try {
      await printFromHiddenFrame(document);
      toast.success("Print dialog opened");
    } catch {
      setPreviewDocument(document);
      toast.error("Print was blocked", {
        description:
          "The document was opened in Preview so you can use your browser print control.",
      });
    }
  };

  const shareDocument = async (document: LegalDocument) => {
    const canShareFiles = "canShare" in navigator;
    try {
      const file = await dataUrlToFile(document);
      const shareData: ShareData = {
        title: document.name,
        text: `${document.category} for ${activeProfile.name || "Business Dashboard"}`,
        files: [file],
      };
      if (navigator.share && (!canShareFiles || navigator.canShare?.(shareData))) {
        await navigator.share(shareData);
        toast.success("Document shared");
        return;
      }
    } catch (error) {
      if (isShareAbort(error)) {
        toast.message("Share cancelled");
        return;
      }
      // Fall through to text share or download.
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: document.name,
          text: `${document.category} is saved in the Legal tab.`,
        });
        toast.success("Document shared");
      } catch (error) {
        if (!isShareAbort(error)) {
          downloadDocument(document);
          toast.info("Share was unavailable here, so the document was downloaded.");
          return;
        }
        toast.message("Share cancelled");
      }
      return;
    }

    downloadDocument(document);
    toast.info("Native share is unavailable here, so the document was downloaded.");
  };

  const downloadDocument = (document: LegalDocument) => {
    const link = window.document.createElement("a");
    link.href = document.dataUrl;
    link.download = document.name;
    link.click();
  };

  const openPreview = (document: LegalDocument) => setPreviewDocument(document);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Legal
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Store business documents, keep previews close by, and print or share from any device.
          </p>
        </div>
        <div className="rounded-lg bg-surface-2/45 px-3 py-2 text-xs text-muted-foreground sharp-edge">
          {documentCount} Documents · {bytes(totalSize)}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Add Legal Document</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Document Name
              <Input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Optional custom name"
              />
            </label>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Document Type
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as LegalCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEGAL_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                <Upload className="h-4 w-4" />
                Upload PDF / Image
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  className="sr-only"
                  onChange={(event) => {
                    void addFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-transparent px-3 text-sm font-medium text-foreground transition-colors sharp-edge hover:bg-muted">
                <Camera className="h-4 w-4" />
                Scan On Mobile
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => {
                    void addFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-[color:var(--destructive)]/10 p-3 text-xs leading-relaxed text-[color:var(--destructive)] sharp-edge">
                {error}
              </div>
            )}

            <div className="rounded-lg bg-surface-2/45 p-3 text-xs leading-relaxed text-muted-foreground sharp-edge">
              Mobile scanning uses the device camera when the browser supports capture. PDFs and
              images are saved locally per business dashboard for fast access.
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document Gallery</CardTitle>
          </CardHeader>
          <CardBody>
            {documents.length ? (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {documents.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    onPrint={() => void printDocument(document)}
                    onShare={() => void shareDocument(document)}
                    onPreview={() => openPreview(document)}
                    onDelete={() => removeDocument(document.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center rounded-lg bg-surface-2/35 text-center sharp-edge">
                <div>
                  <FileArchive className="mx-auto h-10 w-10 text-muted-foreground" />
                  <div className="mt-3 font-display text-lg font-semibold text-foreground">
                    No Legal Documents Yet
                  </div>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Upload articles, trademark filings, copyright registrations, contracts, or tax
                    letters to build a business document gallery.
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <DocumentPreviewDialog
        document={previewDocument}
        onOpenChange={(open) => {
          if (!open) setPreviewDocument(null);
        }}
        onPrint={() => previewDocument && void printDocument(previewDocument)}
        onShare={() => previewDocument && void shareDocument(previewDocument)}
      />
    </div>
  );
}

function DocumentCard({
  document,
  onPrint,
  onShare,
  onPreview,
  onDelete,
}: {
  document: LegalDocument;
  onPrint: () => void;
  onShare: () => void;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const isImage = document.mimeType.startsWith("image/");

  return (
    <div className="overflow-hidden rounded-xl bg-surface-2/45 sharp-edge-card">
      <div className="aspect-[4/3] bg-background/40">
        {isImage ? (
          <img
            src={document.dataUrl}
            alt={document.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="relative h-full">
            <iframe
              src={document.dataUrl}
              title={document.name}
              className="h-full w-full bg-white"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3">
              <FileText className="h-5 w-5 text-white" />
            </div>
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{document.name}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span>{document.category}</span>
            <span>·</span>
            <span>{bytes(document.size)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPrint}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onShare}>
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onPreview}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("text-[color:var(--destructive)] hover:bg-[color:var(--destructive)]/10")}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocumentPreviewDialog({
  document,
  onOpenChange,
  onPrint,
  onShare,
}: {
  document: LegalDocument | null;
  onOpenChange: (open: boolean) => void;
  onPrint: () => void;
  onShare: () => void;
}) {
  const isImage = document?.mimeType.startsWith("image/") || false;

  return (
    <Dialog.Root open={Boolean(document)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[min(88vh,820px)] w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-2xl outline-none sharp-edge-card duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          {document && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 sharp-divider-b px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <Dialog.Title className="truncate font-display text-lg font-semibold text-foreground">
                    {document.name}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                    {document.category} · {bytes(document.size)}
                  </Dialog.Description>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={onPrint}>
                    <Printer className="h-3.5 w-3.5" /> Print
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={onShare}>
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </Button>
                  <Dialog.Close asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label="Close Preview">
                      <X className="h-4 w-4" />
                    </Button>
                  </Dialog.Close>
                </div>
              </div>

              <div className="min-h-0 flex-1 bg-background/55 p-3 sm:p-4">
                <div className="grid h-full place-items-center overflow-hidden rounded-lg bg-white sharp-edge">
                  {isImage ? (
                    <img
                      src={document.dataUrl}
                      alt={document.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <iframe
                      src={document.dataUrl}
                      title={document.name}
                      className="h-full w-full bg-white"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function printFromHiddenFrame(document: LegalDocument) {
  return new Promise<void>((resolve, reject) => {
    const frame = window.document.createElement("iframe");
    frame.setAttribute("title", `${document.name} Print Frame`);
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.opacity = "0";

    const cleanup = () => {
      window.setTimeout(() => frame.remove(), 500);
    };

    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        cleanup();
      }
    };

    frame.onerror = () => {
      cleanup();
      reject(new Error("Could not prepare document for print."));
    };

    window.document.body.appendChild(frame);

    if (document.mimeType.startsWith("image/")) {
      const frameDocument = frame.contentDocument;
      if (!frameDocument) {
        cleanup();
        reject(new Error("Could not prepare image for print."));
        return;
      }
      frameDocument.open();
      frameDocument.write(`
        <html>
          <head><title>${document.name}</title></head>
          <body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#fff;">
            <img src="${document.dataUrl}" alt="${document.name}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
          </body>
        </html>
      `);
      frameDocument.close();
      return;
    }

    frame.src = document.dataUrl;
  });
}

function isShareAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
