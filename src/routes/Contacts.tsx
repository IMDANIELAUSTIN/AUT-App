import { useEffect, useMemo, useState } from "react";
import { Building2, Mail, Phone, Plus, Search, Tag, Trash2, UserRound } from "lucide-react";
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

type ContactType = "client" | "vendor" | "both";

type BusinessContact = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  type: ContactType;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const CONTACT_TYPES: Array<{ value: ContactType; label: string }> = [
  { value: "client", label: "Client" },
  { value: "vendor", label: "Vendor" },
  { value: "both", label: "Client & Vendor" },
];

function storageKey(profileId: string) {
  return `fyi:business-contacts:v1:${profileId}`;
}

function uid() {
  return `contact-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newContact(): BusinessContact {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: "",
    company: "",
    email: "",
    phone: "",
    type: "client",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

function isContact(value: unknown): value is BusinessContact {
  if (!value || typeof value !== "object") return false;
  const contact = value as Partial<BusinessContact>;
  return (
    typeof contact.id === "string" &&
    typeof contact.name === "string" &&
    typeof contact.company === "string" &&
    typeof contact.email === "string" &&
    typeof contact.phone === "string" &&
    typeof contact.notes === "string" &&
    (contact.type === "client" || contact.type === "vendor" || contact.type === "both")
  );
}

function typeLabel(type: ContactType) {
  return CONTACT_TYPES.find((item) => item.value === type)?.label || "Client";
}

export default function Contacts() {
  const { activeProfile } = useEquation();
  const [contacts, setContacts] = useState<BusinessContact[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState<BusinessContact>(() => newContact());
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<ContactType | "all">("all");

  useEffect(() => {
    setHydrated(false);
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(activeProfile.id)) || "[]");
      setContacts(Array.isArray(parsed) ? parsed.filter(isContact) : []);
    } catch {
      setContacts([]);
    }
    setHydrated(true);
  }, [activeProfile.id]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(activeProfile.id), JSON.stringify(contacts));
    } catch {
      toast.error("Could not save contacts", {
        description: "Browser storage may be full.",
      });
    }
  }, [activeProfile.id, contacts, hydrated]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchesType =
        activeType === "all" ? true : contact.type === activeType || contact.type === "both";
      const matchesText =
        !text ||
        `${contact.name} ${contact.company} ${contact.email} ${contact.phone} ${contact.notes}`
          .toLowerCase()
          .includes(text);
      return matchesType && matchesText;
    });
  }, [activeType, contacts, query]);

  const counts = useMemo(
    () => ({
      clients: contacts.filter((contact) => contact.type === "client" || contact.type === "both")
        .length,
      vendors: contacts.filter((contact) => contact.type === "vendor" || contact.type === "both")
        .length,
      both: contacts.filter((contact) => contact.type === "both").length,
    }),
    [contacts],
  );

  const updateDraft = <K extends keyof BusinessContact>(key: K, value: BusinessContact[K]) => {
    setDraft((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  };

  const saveDraft = () => {
    const clean: BusinessContact = {
      ...draft,
      name: draft.name.trim(),
      company: draft.company.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      notes: draft.notes.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (!clean.name && !clean.company) {
      toast.error("Add a name or company before saving.");
      return;
    }
    setContacts((current) =>
      current.some((contact) => contact.id === clean.id)
        ? current.map((contact) => (contact.id === clean.id ? clean : contact))
        : [clean, ...current],
    );
    setDraft(newContact());
    toast.success("Contact saved");
  };

  const editContact = (contact: BusinessContact) => setDraft(contact);

  const deleteContact = (id: string) => {
    setContacts((current) => current.filter((contact) => contact.id !== id));
    setDraft((current) => (current.id === id ? newContact() : current));
    toast.success("Contact deleted");
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Contacts
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Track clients, vendors, and hybrid relationships for this business dashboard.
          </p>
        </div>
        <div className="rounded-lg bg-surface-2/45 px-3 py-2 text-xs text-muted-foreground sharp-edge">
          {contacts.length} Contact{contacts.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {contacts.some((contact) => contact.id === draft.id)
                  ? "Edit Contact"
                  : "Add Contact"}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <ContactField
                label="Name"
                value={draft.name}
                placeholder="Primary contact"
                onChange={(value) => updateDraft("name", value)}
              />
              <ContactField
                label="Company"
                value={draft.company}
                placeholder="Business or organization"
                onChange={(value) => updateDraft("company", value)}
              />
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Relationship
                <Select
                  value={draft.type}
                  onValueChange={(value) => updateDraft("type", value as ContactType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <ContactField
                label="Email"
                value={draft.email}
                placeholder="name@example.com"
                onChange={(value) => updateDraft("email", value)}
              />
              <ContactField
                label="Phone"
                value={draft.phone}
                placeholder="(555) 000-0000"
                onChange={(value) => updateDraft("phone", value)}
              />
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                Notes
                <textarea
                  value={draft.notes}
                  onChange={(event) => updateDraft("notes", event.target.value)}
                  placeholder="Rates, terms, account notes, project context..."
                  rows={4}
                  className="min-h-24 w-full resize-y rounded-md bg-input px-3 py-2 text-sm text-foreground sharp-edge placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="flex gap-2">
                <Button type="button" className="flex-1" onClick={saveDraft}>
                  <Plus className="h-3.5 w-3.5" /> Save Contact
                </Button>
                <Button type="button" variant="outline" onClick={() => setDraft(newContact())}>
                  Clear
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Mix</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid gap-3">
                <CountTile label="Clients" value={counts.clients} />
                <CountTile label="Vendors" value={counts.vendors} />
                <CountTile label="Both" value={counts.both} />
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <CardTitle>Contact Directory</CardTitle>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
              <label className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search contacts"
                  className="pl-9"
                />
              </label>
              <Select
                value={activeType}
                onValueChange={(value) => setActiveType(value as ContactType | "all")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CONTACT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardBody>
            {filtered.length ? (
              <div className="grid gap-3 2xl:grid-cols-2">
                {filtered.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onEdit={() => editContact(contact)}
                    onDelete={() => deleteContact(contact.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid min-h-80 place-items-center rounded-lg bg-surface-2/35 text-center sharp-edge">
                <div>
                  <UserRound className="mx-auto h-10 w-10 text-muted-foreground" />
                  <div className="mt-3 font-display text-lg font-semibold text-foreground">
                    No Contacts Yet
                  </div>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Add clients, vendors, and partners so invoices, expenses, and legal documents
                    can connect back to real business relationships.
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ContactField({
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

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-2/45 p-3 sharp-edge">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="font-display text-2xl font-semibold tabular text-foreground">{value}</span>
    </div>
  );
}

function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: BusinessContact;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl bg-surface-2/45 p-4 sharp-edge-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-foreground">
            {contact.name || contact.company}
          </div>
          {contact.company && contact.name && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{contact.company}</div>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] sharp-edge",
            contact.type === "client" && "bg-[color:var(--success)]/15 text-[color:var(--success)]",
            contact.type === "vendor" && "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
            contact.type === "both" && "bg-primary/15 text-primary",
          )}
        >
          {typeLabel(contact.type)}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
        {contact.email && (
          <a
            className="flex items-center gap-2 hover:text-foreground"
            href={`mailto:${contact.email}`}
          >
            <Mail className="h-3.5 w-3.5" /> {contact.email}
          </a>
        )}
        {contact.phone && (
          <a
            className="flex items-center gap-2 hover:text-foreground"
            href={`tel:${contact.phone}`}
          >
            <Phone className="h-3.5 w-3.5" /> {contact.phone}
          </a>
        )}
        {contact.company && (
          <span className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" /> {contact.company}
          </span>
        )}
        {contact.notes && (
          <span className="flex items-start gap-2 leading-relaxed">
            <Tag className="mt-0.5 h-3.5 w-3.5" /> {contact.notes}
          </span>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[color:var(--destructive)] hover:bg-[color:var(--destructive)]/10"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}
