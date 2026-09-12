import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminApi, qs, type Paged } from "../lib/adminApi";
import { Icon } from "../../lib/icons";
import { Pager } from "../../components/ui/Pager";
import { Modal } from "../../components/ui/Modal";
import { ListEditor, type ListRow } from "../components/ListEditor";
import { ServiceImageUpload } from "../components/ServiceImageUpload";
import { CategoryManager } from "../components/CategoryManager";

interface Category { id: string; name: string; slug: string; is_active: boolean; display_order: number; }
interface ServiceRow { id: string; slug: string; name: string; category: string; is_popular: boolean; is_active: boolean; }

/** Full record loaded when the editor opens — the list query is slim on purpose. */
interface ServiceFull extends ServiceRow {
  description: string | null;
  short_description: string | null;
  estimated_duration: string | null;
  is_online_available: boolean;
  online_note: string | null;
  recommended_muhurat: string | null;
  display_order: number | null;
  meta_title: string | null;
  meta_description: string | null;
  image_url: string | null;
  benefits: ListRow[] | null;
  process: ListRow[] | null;
  faqs: ListRow[] | null;
  samagri_list: ListRow[] | null;
}

const asRows = (v: unknown): ListRow[] => (Array.isArray(v) ? (v as ListRow[]) : []);

export default function AdminServices() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Paged<ServiceRow> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Partial<ServiceRow> | "new" | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [full, setFull] = useState<ServiceFull | null>(null);
  const [benefits, setBenefits] = useState<ListRow[]>([]);
  const [process, setProcess] = useState<ListRow[]>([]);
  const [samagri, setSamagri] = useState<ListRow[]>([]);
  const [faqs, setFaqs] = useState<ListRow[]>([]);

  /**
   * Which "open the editor" click is the current one.
   *
   * Clearing the form before each fetch (below) fixed opening B after A had
   * finished loading. It did NOT fix opening B while A was still in flight:
   * both responses land, and if A's arrives second it calls setFull(A),
   * which remounts the form — via its `key` — with A's name, description and
   * meta tags while `editing` is still B. Pressing Save then PUTs to B's slug
   * carrying A's content. Clicking one service and then another before the
   * first has loaded is an ordinary thing to do, and it is how services came
   * to hold a neighbour's copy.
   *
   * Every response is checked against this counter and a superseded one is
   * dropped, the same rule lib/useApi.ts applies to public fetches. Closing
   * the modal or saving bumps it too, so a reply that arrives after the
   * editor is gone cannot repopulate it either.
   */
  const editSeq = useRef(0);

  /** Opens the editor, pulling the full record for an existing service. */
  async function beginEdit(target: ServiceRow | "new") {
    const seq = ++editSeq.current;
    setEditing(target);
    // Cleared FIRST, every time. The plain inputs below are uncontrolled and
    // read `full` through defaultValue, which React applies only when the
    // input mounts — a later setFull() does not update a field that is
    // already on screen. Opening service B straight after service A therefore
    // mounted the form with A's name, description, duration, muhurat, meta
    // tags and online note still in it, and pressing Save wrote A's values
    // onto B. That is how eighteen services ended up carrying their
    // neighbour's copy. Clearing here, plus the `key` on the form and the
    // loading guard below, means the form can only ever mount once the right
    // record is in hand.
    setFull(null); setBenefits([]); setProcess([]); setSamagri([]); setFaqs([]);
    if (target === "new") return;
    try {
      const detail = await adminApi.get<ServiceFull>(`/services/${target.slug}/detail`);
      // A later click (or a close) already superseded this one — dropping it
      // is the whole point; writing it would put this record into someone
      // else's open form.
      if (seq !== editSeq.current) return;
      setFull(detail);
      setBenefits(asRows(detail.benefits));
      setProcess(asRows(detail.process));
      setSamagri(asRows(detail.samagri_list));
      setFaqs(asRows(detail.faqs));
    } catch (err) {
      if (seq !== editSeq.current) return;
      setError(err instanceof Error ? err.message : "Could not load service");
    }
  }
  const [error, setError] = useState("");

  async function loadCategories() {
    setCategories(await adminApi.get<Category[]>("/service-categories"));
  }
  async function loadServices() {
    try {
      setRows(await adminApi.get<Paged<ServiceRow>>(`/services${qs({ search, page, perPage: 30 })}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load services");
    }
  }

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadServices(); }, [search, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSaveCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      await adminApi.post("/service-categories", { name: data.get("name"), slug: data.get("slug") });
      setCatModalOpen(false);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    }
  }

  async function onSaveService(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      if (editing === "new") {
        await adminApi.post("/services", {
          categoryId: data.get("categoryId"),
          name: data.get("name"),
          slug: data.get("slug"),
          description: data.get("description"),
          shortDescription: data.get("shortDescription"),
          estimatedDuration: data.get("estimatedDuration"),
          recommendedMuhurat: data.get("recommendedMuhurat"),
          isPopular: data.get("isPopular") === "on",
          displayOrder: data.get("displayOrder"),
          metaTitle: data.get("metaTitle"),
          metaDescription: data.get("metaDescription"),
          isOnlineAvailable: data.get("isOnlineAvailable") === "on",
          onlineNote: data.get("onlineNote"),
          benefits, process, faqs, samagri,
        });
      } else if (editing) {
        await adminApi.put(`/services/${editing.slug}`, {
          name: data.get("name"),
          description: data.get("description"),
          shortDescription: data.get("shortDescription"),
          estimatedDuration: data.get("estimatedDuration"),
          recommendedMuhurat: data.get("recommendedMuhurat"),
          isPopular: data.get("isPopular") === "on",
          displayOrder: data.get("displayOrder"),
          metaTitle: data.get("metaTitle"),
          metaDescription: data.get("metaDescription"),
          isOnlineAvailable: data.get("isOnlineAvailable") === "on",
          onlineNote: data.get("onlineNote"),
          benefits, process, faqs, samagri,
        });
      }
      editSeq.current++;
      setEditing(null);
      await loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save service");
    }
  }

  async function removeService(slug: string) {
    if (!confirm(`Deactivate service "${slug}"?\n\nIt disappears from the public site. Nothing is lost and you can activate it again.`)) return;
    await adminApi.del(`/services/${slug}`);
    await loadServices();
  }

  async function activateService(slug: string) {
    await adminApi.patch(`/services/${slug}/active`, { isActive: true });
    await loadServices();
  }

  /**
   * The real one. Deactivating only hides a service; this removes the row.
   *
   * The server refuses (409) when a devotee has ever clicked, enquired about
   * or reviewed it — that history is what makes the record worth keeping — so
   * the error is surfaced as-is rather than swallowed.
   */
  async function destroyService(slug: string, name: string) {
    if (!confirm(`Delete "${name}" permanently?\n\nThis cannot be undone. The service, its samagri list and its pandit/temple links are removed. Deactivate instead if you only want it off the site.`)) return;
    try {
      await adminApi.del(`/services/${slug}/permanent`);
      await loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this service");
    }
  }

  async function destroyCategory(id: string, name: string) {
    if (!confirm(`Delete category "${name}" permanently?\n\nOnly possible while no service belongs to it.`)) return;
    try {
      await adminApi.del(`/service-categories/${id}/permanent`);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this category");
    }
  }

  return (
    <>
      <div className="admin-page-head">
        <div>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.4rem" }}>Services</h2>
          <p>Categories and the rituals listed under each — samagri lists live under each service on the public site.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setCatModalOpen(true)}><Icon name="plus" size={14} /> Add category</button>
          <button className="btn btn-gold btn-sm" onClick={() => beginEdit("new")}><Icon name="plus" size={14} /> Add service</button>
        </div>
      </div>

      {error && <div className="admin-login__error" style={{ marginBottom: 18 }}>{error}</div>}

      <div className="admin-panel" style={{ marginBottom: 18 }}>
        <div className="admin-panel__head"><h2>Categories</h2></div>
        <div className="admin-panel__body row wrap" style={{ gap: 8 }}>
          {categories.map((c) => (
            <span key={c.id} className={`admin-pill ${c.is_active ? "admin-pill--gold" : "admin-pill--gray"}`}>
              {c.name}
              <button
                type="button"
                onClick={() => destroyCategory(c.id, c.name)}
                title={`Delete ${c.name}`}
                aria-label={`Delete category ${c.name}`}
                style={{ marginLeft: 6, border: "none", background: "none", cursor: "pointer", font: "inherit", opacity: 0.65, padding: 0 }}
              >✕</button>
            </span>
          ))}
          {!categories.length && <span className="muted">No categories yet.</span>}
        </div>
      </div>

      <CategoryManager />

      <div className="admin-panel">
        <form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); setPage(1); loadServices(); }}>
          <input className="input" placeholder="Search services…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-outline btn-sm" type="submit">Search</button>
          {rows && <span className="muted" style={{ marginLeft: "auto", fontSize: ".85rem" }}>{rows.total} services</span>}
        </form>
        <div className="admin-table-wrap">
          {!rows ? (
            <div className="admin-empty">Loading…</div>
          ) : rows.data.length ? (
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Category</th><th>Popular</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.data.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td className="muted-cell">{s.category}</td>
                    <td>{s.is_popular ? <span className="admin-pill admin-pill--gold">popular</span> : "—"}</td>
                    <td><span className={`admin-pill ${s.is_active ? "admin-pill--green" : "admin-pill--red"}`}>{s.is_active ? "active" : "inactive"}</span></td>
                    <td className="row" style={{ gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => beginEdit(s)}>Edit</button>
                      {/* Deactivating used to be one-way: the button vanished
                          with is_active and nothing brought the service back. */}
                      {s.is_active
                        ? <button className="btn btn-ghost btn-sm" onClick={() => removeService(s.slug)}>Deactivate</button>
                        : <button className="btn btn-ghost btn-sm" onClick={() => activateService(s.slug)}>Activate</button>}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "#b91c1c" }}
                        onClick={() => destroyService(s.slug, s.name)}
                      >Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="admin-empty">No services matched.</div>
          )}
        </div>
        {rows && rows.totalPages > 1 && (
          <div style={{ padding: "10px 20px 18px" }}><Pager page={rows.page} pages={rows.totalPages} onChange={setPage} /></div>
        )}
      </div>

      <Modal open={editing !== null} onClose={() => { editSeq.current++; setEditing(null); }} size="full">
        <div style={{ padding: 24 }}>
        <h3 style={{ fontSize: "1.3rem" }}>{editing === "new" ? "Add a service" : `Edit ${(editing as ServiceRow)?.name || ""}`}</h3>
        {editing !== "new" && !full ? (
          <p className="muted" style={{ marginTop: 16 }}>Loading…</p>
        ) : (
        <form key={full?.slug ?? "new"} onSubmit={onSaveService} style={{ marginTop: 16 }}>
          <div className="admin-form-grid">
            <div className="admin-field"><label>Name</label><input className="input" name="name" required defaultValue={editing !== "new" ? editing?.name : ""} /></div>
            <div className="admin-field"><label>Slug</label><input className="input" name="slug" required disabled={editing !== "new"} defaultValue={editing !== "new" ? editing?.slug : ""} /></div>
            {editing === "new" && (
              <div className="admin-field admin-field--full">
                <label>Category</label>
                <select className="select" name="categoryId" required>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="admin-field"><label>Estimated duration</label><input className="input" name="estimatedDuration" placeholder="e.g. 2-3 hours" defaultValue={full?.estimated_duration || ""} /></div>
            {/* "Mark as popular" was the only homepage control, and its name
                said nothing about what it did: it decides which pujas the
                homepage grid shows. Position was not settable at all — the
                grid came out alphabetical. Both live here now, together, so
                it is clear they are one decision. */}
            <div className="admin-field admin-field--full" style={{ background: "#fffdf7", border: "1px solid var(--admin-line, #e8d5b7)", borderRadius: 10, padding: 12 }}>
              <label className="row" style={{ gap: 8, fontWeight: 700 }}>
                <input type="checkbox" name="isPopular" defaultChecked={full?.is_popular} />
                🏠 Home page par dikhayein
              </label>
              <p style={{ fontSize: ".8rem", opacity: .72, margin: "6px 0 8px" }}>
                Tick karne par yeh puja home page ki services grid me aayegi.
                Position se tay hota hai kaun pehle aayega — chhota number pehle
                (1, 2, 3 …). Grid me sabse upar wali <strong>6</strong> pujas
                dikhti hain, to 6 se zyada tick karne par position hi decide
                karegi kaun si 6 aayengi.
              </p>
              <label style={{ fontSize: ".8rem", fontWeight: 600 }}>Home position</label>
              <input
                className="input" name="displayOrder" type="number" step={1}
                style={{ maxWidth: 160 }}
                placeholder="e.g. 1"
                defaultValue={full?.display_order ?? 0}
              />
            </div>
            <div className="admin-field admin-field--full"><label>Short description</label><input className="input" name="shortDescription" defaultValue={full?.short_description || ""} /></div>
            <div className="admin-field admin-field--full"><label>Description</label><textarea className="textarea" name="description" defaultValue={full?.description || ""} /></div>
            <div className="admin-field admin-field--full" style={{ background: "#fffdf7", border: "1px solid var(--admin-line, #e8d5b7)", borderRadius: 10, padding: 12 }}>
              <label className="row" style={{ gap: 8, fontWeight: 700 }}>
                <input type="checkbox" name="isOnlineAvailable" defaultChecked={full?.is_online_available} />
                🌐 Online puja / havan available
              </label>
              <p style={{ fontSize: ".8rem", opacity: .72, margin: "6px 0 8px" }}>
                Tick karne par yeh ritual “Online Puja” listing me aayega. Phir har Pandit ji ke
                edit page par choose karein ki kaun ise online kar sakte hain.
              </p>
              <input
                className="input" name="onlineNote" maxLength={300}
                placeholder="Online kaise hoti hai — e.g. Zoom par live havan, sankalp aapke naam se"
                defaultValue={full?.online_note || ""}
              />
            </div>

            {/* These two columns have existed since the beginning and the
                editor never exposed them, so the only way to set a page's
                search title or snippet was a direct database write. Blank is
                meaningful: seoMeta.js then derives them from the name and
                short description, which is the right default for most
                services. */}
            <div className="admin-field admin-field--full" style={{ background: "#fffdf7", border: "1px solid var(--admin-line, #e8d5b7)", borderRadius: 10, padding: 12 }}>
              <label className="row" style={{ gap: 8, fontWeight: 700 }}>🔍 Google search me kaise dikhe</label>
              <p style={{ fontSize: ".8rem", opacity: .72, margin: "6px 0 8px" }}>
                Khaali chhod dein to naam aur short description se apne aap ban
                jayega. Bharein tabhi jab Google me kuch alag dikhana ho.
              </p>
              <label style={{ fontSize: ".8rem", fontWeight: 600 }}>Meta title <span style={{ opacity: .6 }}>(~60 characters)</span></label>
              <input className="input" name="metaTitle" maxLength={200}
                placeholder="e.g. Rudrabhishek Puja | PanditSuggest"
                defaultValue={full?.meta_title || ""} />
              <label style={{ fontSize: ".8rem", fontWeight: 600, marginTop: 8, display: "block" }}>Meta description <span style={{ opacity: .6 }}>(~155 characters)</span></label>
              <textarea className="textarea" name="metaDescription" maxLength={500} rows={2}
                placeholder="Ek line jo search result me dikhegi"
                defaultValue={full?.meta_description || ""} />
            </div>

            <div className="admin-field admin-field--full"><label>Recommended muhurat</label><input className="input" name="recommendedMuhurat" placeholder="e.g. Brahma Muhurat, 4:30–6:00 AM" defaultValue={full?.recommended_muhurat || ""} /></div>

            {editing !== "new" && full && (
              <ServiceImageUpload
                slug={full.slug}
                currentUrl={full.image_url}
                onUploaded={(url) => setFull({ ...full, image_url: url })}
              />
            )}

            {/* These four replace the hardcoded tables that used to live in
                frontend/app/src/data/serviceMeta.ts. */}
            <ListEditor
              label="Benefits" addLabel="+ Add benefit"
              hint="Public page ke 'blessings' section me dikhenge."
              rows={benefits} onChange={setBenefits}
              fields={[
                { key: "icon", label: "Icon", icon: true, width: "full" },
                { key: "title", label: "Benefit", placeholder: "Shatru baadha se raksha" },
                { key: "detail", label: "Detail", placeholder: "Short explanation", width: "full", multiline: true },
              ]}
            />
            <ListEditor
              label="Puja steps (vidhi)" addLabel="+ Add step"
              hint="Sequence me likhein — public page par timeline banega."
              rows={process} onChange={setProcess}
              fields={[
                { key: "title", label: "Step", placeholder: "Sankalp" },
                { key: "duration", label: "Duration", placeholder: "15 min" },
                { key: "detail", label: "Detail", placeholder: "Kya hota hai is step me", width: "full", multiline: true },
              ]}
            />
            <ListEditor
              label="Samagri" addLabel="+ Add samagri"
              hint="Puja me lagne wali saamagri aur maatra."
              rows={samagri} onChange={setSamagri}
              fields={[
                { key: "item", label: "Item", placeholder: "Haldi" },
                { key: "qty", label: "Quantity", placeholder: "2 kg" },
              ]}
            />
            <ListEditor
              label="FAQs" addLabel="+ Add FAQ"
              rows={faqs} onChange={setFaqs}
              fields={[
                { key: "q", label: "Question", placeholder: "Yeh puja kitne din chalti hai?", width: "full" },
                { key: "a", label: "Answer", placeholder: "…", width: "full", multiline: true },
              ]}
            />
          </div>
          <button className="btn btn-gold btn-block" type="submit" style={{ marginTop: 18 }}>Save</button>
        </form>
        )}
        </div>
      </Modal>

      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)}>
        <div style={{ padding: 24 }}>
        <h3 style={{ fontSize: "1.3rem" }}>Add a category</h3>
        <form onSubmit={onSaveCategory} style={{ marginTop: 16 }}>
          <div className="admin-field"><label>Name</label><input className="input" name="name" required /></div>
          <div className="admin-field" style={{ marginTop: 12 }}><label>Slug</label><input className="input" name="slug" required /></div>
          <button className="btn btn-gold btn-block" type="submit" style={{ marginTop: 18 }}>Save</button>
        </form>
        </div>
      </Modal>
    </>
  );
}
