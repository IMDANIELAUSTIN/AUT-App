import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileArchive,
  FileText,
  Paintbrush,
  Plus,
  SwatchBook,
  Trash2,
  Type,
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

type BrandAssetType =
  | "Logomark"
  | "Typemark"
  | "Logo Suite"
  | "Color Palette"
  | "Brand Guidelines"
  | "Typography"
  | "Template"
  | "Photography"
  | "Other";

type BrandAsset = {
  id: string;
  name: string;
  type: BrandAssetType;
  mimeType: string;
  size: number;
  uploadedAt: string;
  dataUrl: string;
};

type BrandColor = {
  id: string;
  name: string;
  hex: string;
};

type BrandTypography = {
  primaryFont: string;
  secondaryFont: string;
  accentFont: string;
  guidelines: string;
};

type BrandKit = {
  assets: BrandAsset[];
  colors: BrandColor[];
  typography: BrandTypography;
};

const ASSET_TYPES: BrandAssetType[] = [
  "Logomark",
  "Typemark",
  "Logo Suite",
  "Color Palette",
  "Brand Guidelines",
  "Typography",
  "Template",
  "Photography",
  "Other",
];

const DEFAULT_TYPOGRAPHY: BrandTypography = {
  primaryFont: "",
  secondaryFont: "",
  accentFont: "",
  guidelines: "",
};

const DEFAULT_COLORS: BrandColor[] = [
  { id: "brand-primary", name: "Primary", hex: "#5a1f12" },
  { id: "brand-accent", name: "Accent", hex: "#ff9b54" },
  { id: "brand-neutral", name: "Neutral", hex: "#fff4ee" },
];

const MAX_ASSET_BYTES = 5_000_000;

function storageKey(profileId: string) {
  return `fyi:brand-kit:v1:${profileId}`;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function bytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function titleFromFile(file: File) {
  return file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
}

function normalizeHex(value: string) {
  const raw = value.trim();
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : null;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read brand asset."));
    reader.onerror = () => reject(reader.error || new Error("Could not read brand asset."));
    reader.readAsDataURL(file);
  });
}

function isBrandAsset(value: unknown): value is BrandAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<BrandAsset>;
  return (
    typeof asset.id === "string" &&
    typeof asset.name === "string" &&
    typeof asset.mimeType === "string" &&
    typeof asset.size === "number" &&
    typeof asset.uploadedAt === "string" &&
    typeof asset.dataUrl === "string" &&
    ASSET_TYPES.includes(asset.type as BrandAssetType)
  );
}

function isBrandColor(value: unknown): value is BrandColor {
  if (!value || typeof value !== "object") return false;
  const color = value as Partial<BrandColor>;
  return (
    typeof color.id === "string" &&
    typeof color.name === "string" &&
    typeof color.hex === "string" &&
    Boolean(normalizeHex(color.hex))
  );
}

function sanitizeKit(value: unknown): BrandKit {
  if (!value || typeof value !== "object") {
    return { assets: [], colors: DEFAULT_COLORS, typography: DEFAULT_TYPOGRAPHY };
  }
  const raw = value as Partial<BrandKit>;
  const colors = Array.isArray(raw.colors)
    ? raw.colors.filter(isBrandColor).map((color) => ({
        ...color,
        hex: normalizeHex(color.hex) || color.hex,
      }))
    : DEFAULT_COLORS;
  const typography = raw.typography || DEFAULT_TYPOGRAPHY;
  return {
    assets: Array.isArray(raw.assets) ? raw.assets.filter(isBrandAsset) : [],
    colors: colors.length ? colors : DEFAULT_COLORS,
    typography: {
      primaryFont: typeof typography.primaryFont === "string" ? typography.primaryFont : "",
      secondaryFont: typeof typography.secondaryFont === "string" ? typography.secondaryFont : "",
      accentFont: typeof typography.accentFont === "string" ? typography.accentFont : "",
      guidelines: typeof typography.guidelines === "string" ? typography.guidelines : "",
    },
  };
}

export default function Branding() {
  const { activeProfile } = useEquation();
  const [kit, setKit] = useState<BrandKit>(() => ({
    assets: [],
    colors: DEFAULT_COLORS,
    typography: DEFAULT_TYPOGRAPHY,
  }));
  const [hydrated, setHydrated] = useState(false);
  const [assetType, setAssetType] = useState<BrandAssetType>("Logomark");
  const [assetName, setAssetName] = useState("");
  const [colorName, setColorName] = useState("Accent");
  const [colorHex, setColorHex] = useState("#FF9B54");
  const [previewAsset, setPreviewAsset] = useState<BrandAsset | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setHydrated(false);
    try {
      setKit(sanitizeKit(JSON.parse(localStorage.getItem(storageKey(activeProfile.id)) || "null")));
    } catch {
      setKit({ assets: [], colors: DEFAULT_COLORS, typography: DEFAULT_TYPOGRAPHY });
    }
    setHydrated(true);
  }, [activeProfile.id]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(activeProfile.id), JSON.stringify(kit));
    } catch {
      setError("This browser storage is full. Remove larger brand files or keep them outside FYI.");
    }
  }, [activeProfile.id, hydrated, kit]);

  const totalSize = useMemo(
    () => kit.assets.reduce((sum, asset) => sum + asset.size, 0),
    [kit.assets],
  );

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const nextAssets: BrandAsset[] = [];

    for (const file of Array.from(files)) {
      const accepted =
        file.type === "application/pdf" ||
        file.type === "image/svg+xml" ||
        file.type.startsWith("image/");
      if (!accepted) {
        setError("Upload images, SVGs, or PDFs for your brand kit.");
        continue;
      }
      if (file.size > MAX_ASSET_BYTES) {
        setError("Keep each brand asset under 5 MB for local storage.");
        continue;
      }

      nextAssets.push({
        id: uid("brand-asset"),
        name: assetName.trim() || titleFromFile(file),
        type: assetType,
        mimeType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        dataUrl: await readAsDataUrl(file),
      });
    }

    if (nextAssets.length) {
      setKit((current) => ({ ...current, assets: [...nextAssets, ...current.assets] }));
      setAssetName("");
      toast.success(nextAssets.length === 1 ? "Brand asset added" : "Brand assets added");
    }
  };

  const addColor = () => {
    const hex = normalizeHex(colorHex);
    if (!hex) {
      setError("Use a six-digit hex value like #FF9B54.");
      return;
    }
    setError("");
    setKit((current) => ({
      ...current,
      colors: [
        { id: uid("brand-color"), name: colorName.trim() || "Brand Color", hex },
        ...current.colors,
      ],
    }));
    toast.success("Color added");
  };

  const updateTypography = (patch: Partial<BrandTypography>) => {
    setKit((current) => ({
      ...current,
      typography: { ...current.typography, ...patch },
    }));
  };

  const deleteAsset = (id: string) => {
    setKit((current) => ({
      ...current,
      assets: current.assets.filter((asset) => asset.id !== id),
    }));
    setPreviewAsset((current) => (current?.id === id ? null : current));
    toast.success("Brand asset deleted");
  };

  const deleteColor = (id: string) => {
    setKit((current) => ({
      ...current,
      colors: current.colors.filter((color) => color.id !== id),
    }));
    toast.success("Color removed");
  };

  const downloadAsset = (asset: BrandAsset) => {
    const link = window.document.createElement("a");
    link.href = asset.dataUrl;
    link.download = asset.name;
    link.click();
  };

  const copyColor = async (hex: string) => {
    await navigator.clipboard?.writeText(hex);
    toast.success(`${hex} copied`);
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Branding
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Keep logos, colors, typography, and brand guidelines organized for this business.
          </p>
        </div>
        <div className="rounded-lg bg-surface-2/45 px-3 py-2 text-xs text-muted-foreground sharp-edge">
          {kit.assets.length} Assets · {bytes(totalSize)}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Brand Asset</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Asset Name
                <Input
                  value={assetName}
                  onChange={(event) => setAssetName(event.target.value)}
                  placeholder="Optional custom name"
                />
              </label>
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Asset Type
                <Select
                  value={assetType}
                  onValueChange={(value) => setAssetType(value as BrandAssetType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                <Upload className="h-4 w-4" />
                Upload Asset
                <input
                  type="file"
                  multiple
                  accept="image/*,image/svg+xml,application/pdf"
                  className="sr-only"
                  onChange={(event) => {
                    void addFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {error && (
                <div className="rounded-lg bg-[color:var(--destructive)]/10 p-3 text-xs leading-relaxed text-[color:var(--destructive)] sharp-edge">
                  {error}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Color Palette</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_112px]">
                <Input
                  value={colorName}
                  onChange={(event) => setColorName(event.target.value)}
                  placeholder="Color name"
                />
                <Input
                  value={colorHex}
                  onChange={(event) => setColorHex(event.target.value)}
                  placeholder="#FF9B54"
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={normalizeHex(colorHex) || "#FF9B54"}
                  onChange={(event) => setColorHex(event.target.value)}
                  className="h-9 w-12 rounded-md bg-transparent p-1 sharp-edge"
                  aria-label="Color picker"
                />
                <Button type="button" className="flex-1" onClick={addColor}>
                  <Plus className="h-3.5 w-3.5" /> Add Color
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <BrandTextField
                label="Primary Font"
                value={kit.typography.primaryFont}
                placeholder="Helvetica, Inter, Neue Haas..."
                onChange={(value) => updateTypography({ primaryFont: value })}
              />
              <BrandTextField
                label="Secondary Font"
                value={kit.typography.secondaryFont}
                placeholder="Editorial or body font"
                onChange={(value) => updateTypography({ secondaryFont: value })}
              />
              <BrandTextField
                label="Accent Font"
                value={kit.typography.accentFont}
                placeholder="Display or campaign font"
                onChange={(value) => updateTypography({ accentFont: value })}
              />
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Brand Guidelines
                <textarea
                  value={kit.typography.guidelines}
                  onChange={(event) => updateTypography({ guidelines: event.target.value })}
                  placeholder="Voice, logo usage, spacing, photography style..."
                  rows={5}
                  className="min-h-28 w-full resize-y rounded-md bg-input px-3 py-2 text-sm text-foreground sharp-edge placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Brand Palette</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {kit.colors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className="overflow-hidden rounded-xl bg-surface-2/45 text-left sharp-edge-card"
                    onClick={() => void copyColor(color.hex)}
                  >
                    <span
                      className="block h-20"
                      style={{ backgroundColor: normalizeHex(color.hex) || color.hex }}
                    />
                    <span className="flex items-center justify-between gap-2 p-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {color.name}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                          {color.hex}
                        </span>
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-[color:var(--destructive)]"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteColor(color.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            deleteColor(color.id);
                          }
                        }}
                        aria-label={`Delete ${color.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand Asset Gallery</CardTitle>
            </CardHeader>
            <CardBody>
              {kit.assets.length ? (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {kit.assets.map((asset) => (
                    <BrandAssetCard
                      key={asset.id}
                      asset={asset}
                      onPreview={() => setPreviewAsset(asset)}
                      onDownload={() => downloadAsset(asset)}
                      onDelete={() => deleteAsset(asset.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid min-h-80 place-items-center rounded-lg bg-surface-2/35 text-center sharp-edge">
                  <div>
                    <FileArchive className="mx-auto h-10 w-10 text-muted-foreground" />
                    <div className="mt-3 font-display text-lg font-semibold text-foreground">
                      No Brand Assets Yet
                    </div>
                    <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                      Upload logomarks, typemarks, palettes, guidelines, templates, or photography
                      to build a brand repository.
                    </p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand System Summary</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryTile icon={SwatchBook} label="Colors" value={String(kit.colors.length)} />
                <SummaryTile icon={Paintbrush} label="Assets" value={String(kit.assets.length)} />
                <SummaryTile
                  icon={Type}
                  label="Fonts"
                  value={String(
                    [
                      kit.typography.primaryFont,
                      kit.typography.secondaryFont,
                      kit.typography.accentFont,
                    ].filter(Boolean).length,
                  )}
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <BrandPreviewDialog
        asset={previewAsset}
        onOpenChange={(open) => {
          if (!open) setPreviewAsset(null);
        }}
        onDownload={() => previewAsset && downloadAsset(previewAsset)}
      />
    </div>
  );
}

function BrandTextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      {label}
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof SwatchBook;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-surface-2/45 p-3 sharp-edge">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-3 font-display text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function BrandAssetCard({
  asset,
  onPreview,
  onDownload,
  onDelete,
}: {
  asset: BrandAsset;
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const isImage = asset.mimeType.startsWith("image/");

  return (
    <div className="overflow-hidden rounded-xl bg-surface-2/45 sharp-edge-card">
      <div className="aspect-[4/3] bg-background/45">
        {isImage ? (
          <img
            src={asset.dataUrl}
            alt={asset.name}
            className="h-full w-full object-contain p-4"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <FileText className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{asset.name}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span>{asset.type}</span>
            <span>·</span>
            <span>{bytes(asset.size)}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPreview}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" /> Save
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

function BrandPreviewDialog({
  asset,
  onOpenChange,
  onDownload,
}: {
  asset: BrandAsset | null;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
}) {
  const isImage = asset?.mimeType.startsWith("image/") || false;

  return (
    <Dialog.Root open={Boolean(asset)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[min(88vh,820px)] w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-2xl outline-none sharp-edge-card duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          {asset && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 sharp-divider-b px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <Dialog.Title className="truncate font-display text-lg font-semibold text-foreground">
                    {asset.name}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                    {asset.type} · {bytes(asset.size)}
                  </Dialog.Description>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={onDownload}>
                    <Download className="h-3.5 w-3.5" /> Save
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
                      src={asset.dataUrl}
                      alt={asset.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <iframe
                      src={asset.dataUrl}
                      title={asset.name}
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
