import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CirclePlus, Copy, Eye, EyeOff, GripVertical, Pencil, Search, Trash2, UtensilsCrossed, X } from "lucide-react";
import { useSeatServe } from "../../state/SeatServeContext";
import type { MenuCategory, MenuDefinition, MenuItem } from "../../types/domain";
import "./MenuManager.css";

type MenuDraft = Omit<MenuItem, "id">;
type CategoryDraft = Omit<MenuCategory, "id">;
type MenuDefinitionDraft = Omit<MenuDefinition, "id">;

const emptyCategory: CategoryDraft = { name: "", emoji: "🍽️", imageUrl: "", visible: true, sortOrder: 1 };
const emptyDraft: MenuDraft = {
    name: "",
    category: "Entrées",
    categoryId: "",
    description: "",
    price: 0,
    available: true,
    kind: "standard",
    condiments: [],
    emoji: "🍔",
    imageUrl: "",
    imageAlt: "",
    displayStyle: "image-with-emoji-fallback",
};

export default function MenuManager() {
    const { data, addMenuCategory, updateMenuCategory, reorderMenuCategories, reorderMenuItems, deleteMenuCategory, addMenuItem, updateMenuItem, duplicateMenuItem, deleteMenuItem, addMenu, updateMenu, deleteMenu, assignMenuToEvent } = useSeatServe();
    const [activeTab, setActiveTab] = useState<"items" | "menus" | "assignments">("items");
    const [query, setQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [editing, setEditing] = useState<MenuItem | null>(null);
    const [draft, setDraft] = useState<MenuDraft>(emptyDraft);
    const [condimentText, setCondimentText] = useState("");
    const [itemOpen, setItemOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
    const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(emptyCategory);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [draggedCategoryId, setDraggedCategoryId] = useState<string>();
    const [draggedItem, setDraggedItem] = useState<{ id: string; categoryId: string }>();
    const [menuOpen, setMenuOpen] = useState(false);
    const [editingMenu, setEditingMenu] = useState<MenuDefinition | null>(null);
    const [menuDraft, setMenuDraft] = useState<MenuDefinitionDraft>({ name: "", description: "", active: true, itemIds: [], priceOverrides: {}, hiddenItemIds: [] });

    useEffect(() => {
        const onStorageError = (event: Event) => {
            const detail = (event as CustomEvent<{ message?: string }>).detail;
            window.alert(detail?.message ?? "SeatServe could not save this change locally.");
            setItemOpen(true);
        };
        window.addEventListener("seatserve:storage-error", onStorageError);
        return () => window.removeEventListener("seatserve:storage-error", onStorageError);
    }, []);

    const categories = useMemo(() => [...data.menuCategories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [data.menuCategories]);
    const assignableEvents = useMemo(() => [...data.events]
        .filter((event) => event.status === "live" || event.status === "scheduled" || event.status === "draft")
        .sort((a, b) => {
            if (a.status === "live" && b.status !== "live") return -1;
            if (b.status === "live" && a.status !== "live") return 1;
            return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
        }), [data.events]);

    const groupedItems = useMemo(() => {
        const filtered = data.menuItems.filter((item) => {
            const matchesCategory = categoryFilter === "All" || item.categoryId === categoryFilter || item.category === categoryFilter;
            const term = query.trim().toLowerCase();
            return matchesCategory && (!term || `${item.name} ${item.description ?? ""} ${item.category}`.toLowerCase().includes(term));
        });
        return categories
            .map((category) => [category, filtered.filter((item) => item.categoryId === category.id || item.category === category.name)] as const)
            .filter(([, items]) => items.length > 0);
    }, [categories, data.menuItems, categoryFilter, query]);

    const beginAdd = () => {
        const first = categories[0];
        setEditing(null);
        setDraft({ ...emptyDraft, category: first?.name ?? "Entrées", categoryId: first?.id ?? "", emoji: first?.emoji ?? "🍔" });
        setCondimentText("");
        setItemOpen(true);
    };

    const beginEdit = (item: MenuItem) => {
        setEditing(item);
        setDraft({
            ...item,
            description: item.description ?? "",
            condiments: item.condiments ?? [],
            emoji: item.emoji ?? "🍽️",
            imageUrl: item.imageUrl ?? "",
            imageAlt: item.imageAlt ?? item.name,
            displayStyle: item.displayStyle ?? "image-with-emoji-fallback"
        });
        // Bulletproof array mapping to prevent undefined crashes
        setCondimentText(Array.isArray(item.condiments) ? item.condiments.join(", ") : "");
        setItemOpen(true);
    };

    const duplicateAndEdit = (item: MenuItem) => {
        const newId = duplicateMenuItem(item.id);
        if (!newId) return;
        const copy: MenuItem = { ...item, id: newId, name: `${item.name || ""} Copy`, condiments: [...(item.condiments ?? [])] };
        setEditing(copy);
        setDraft({
            ...copy,
            description: copy.description ?? "",
            condiments: [...(copy.condiments ?? [])],
            emoji: copy.emoji ?? "🍽️",
            imageUrl: copy.imageUrl ?? "",
            imageAlt: copy.imageAlt ?? copy.name,
            displayStyle: copy.displayStyle ?? "image-with-emoji-fallback"
        });
        setCondimentText(Array.isArray(copy.condiments) ? copy.condiments.join(", ") : "");
        setItemOpen(true);
    };

    const beginAddCategory = () => { setEditingCategory(null); setCategoryDraft({ ...emptyCategory, sortOrder: categories.length + 1 }); setCategoryOpen(true); };
    const beginEditCategory = (category: MenuCategory) => { setEditingCategory(category); setCategoryDraft({ name: category.name, emoji: category.emoji, imageUrl: category.imageUrl ?? "", visible: category.visible, sortOrder: category.sortOrder }); setCategoryOpen(true); };

    const submitItem = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const category = categories.find((entry) => entry.id === draft.categoryId) ?? categories.find((entry) => entry.name === draft.category);

        // NULL-SAFETY FIX: Prevent the 'split' crash if condimentText is completely undefined
        const safeCondimentText = typeof condimentText === "string" ? condimentText : "";
        const condiments = safeCondimentText.split(",").map((value) => value.trim()).filter(Boolean);

        const clean: MenuDraft = {
            ...draft,
            name: (draft.name || "").trim(),
            category: (category?.name || draft.category || "").trim(),
            categoryId: category?.id ?? draft.categoryId,
            description: (draft.description || "").trim(),
            price: Number(draft.price) || 0,
            condiments,
            emoji: (draft.emoji || "").trim() || category?.emoji || "🍽️",
            imageAlt: (draft.imageAlt || "").trim() || (draft.name || "").trim(),
            imageUrl: (draft.imageUrl || "").trim()
        };

        if (!clean.name || !clean.category || clean.price < 0) return;
        try {
            if (editing) updateMenuItem(editing.id, clean); else addMenuItem(clean);
            setEditing(null);
            setItemOpen(false);
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Unable to save this menu item.");
        }
    };

    const submitCategory = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const clean = { ...categoryDraft, name: (categoryDraft.name || "").trim(), emoji: (categoryDraft.emoji || "").trim() || "🍽️", sortOrder: Math.max(1, Number(categoryDraft.sortOrder)) };
        if (!clean.name) return;
        if (editingCategory) updateMenuCategory(editingCategory.id, clean); else addMenuCategory(clean);
        setCategoryOpen(false);
    };

    const chooseCategory = (id: string) => {
        const category = categories.find((entry) => entry.id === id);
        setDraft((current) => ({ ...current, categoryId: id, category: category?.name ?? current.category, emoji: current.emoji || category?.emoji || "🍽️" }));
    };

    const dropCategory = (targetId: string) => {
        if (!draggedCategoryId || draggedCategoryId === targetId) return;
        const ids = categories.map((category) => category.id);
        const from = ids.indexOf(draggedCategoryId);
        const to = ids.indexOf(targetId);
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        reorderMenuCategories(ids);
        setDraggedCategoryId(undefined);
    };

    const dropItem = (targetId: string, categoryId: string) => {
        if (!draggedItem || draggedItem.categoryId !== categoryId || draggedItem.id === targetId) return;
        const ids = data.menuItems.filter((item) => item.categoryId === categoryId).map((item) => item.id);
        const from = ids.indexOf(draggedItem.id);
        const to = ids.indexOf(targetId);
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        reorderMenuItems(categoryId, ids);
        setDraggedItem(undefined);
    };

    const beginAddMenu = () => {
        setEditingMenu(null);
        setMenuDraft({ name: "", description: "", active: true, itemIds: data.menuItems.map((item) => item.id), priceOverrides: {}, hiddenItemIds: [] });
        setMenuOpen(true);
    };
    const beginEditMenu = (menu: MenuDefinition) => {
        setEditingMenu(menu);
        setMenuDraft({ name: menu.name, description: menu.description ?? "", active: menu.active, itemIds: [...menu.itemIds], priceOverrides: { ...(menu.priceOverrides ?? {}) }, hiddenItemIds: [...(menu.hiddenItemIds ?? [])] });
        setMenuOpen(true);
    };
    const submitMenu = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const clean = { ...menuDraft, name: (menuDraft.name || "").trim(), description: (menuDraft.description || "").trim(), itemIds: Array.from(new Set(menuDraft.itemIds)), priceOverrides: menuDraft.priceOverrides ?? {}, hiddenItemIds: menuDraft.hiddenItemIds ?? [] };
        if (!clean.name) return;
        if (editingMenu) updateMenu(editingMenu.id, clean); else addMenu(clean);
        setMenuOpen(false);
    };
    const toggleMenuItem = (itemId: string) => setMenuDraft((current) => ({ ...current, itemIds: current.itemIds.includes(itemId) ? current.itemIds.filter((id) => id !== itemId) : [...current.itemIds, itemId] }));

    return (
        <section className="menu-page">
            <header className="menu-page__header">
                <div>
                    <p className="menu-eyebrow">Administration</p>
                    <h1>Menu Management</h1>
                    <p>Create categories, grouped quick-add items, customizable food, condiments, emoji, and images.</p>
                </div>
                <div className="menu-header-actions">
                    <button className="menu-button" onClick={beginAddCategory}><CirclePlus size={18} /> Add category</button>
                    <button className="menu-button menu-button--primary" onClick={beginAdd}><CirclePlus size={18} /> Add item</button>
                </div>
            </header>

            <nav className="menu-tabs" aria-label="Menu Management sections">
                <button className={activeTab === "items" ? "is-active" : ""} onClick={() => setActiveTab("items")}>Items and Categories</button>
                <button className={activeTab === "menus" ? "is-active" : ""} onClick={() => setActiveTab("menus")}>Menus</button>
                <button className={activeTab === "assignments" ? "is-active" : ""} onClick={() => setActiveTab("assignments")}>Event Assignments</button>
            </nav>

            {activeTab === "items" && (
                <>
                    <div className="menu-summary">
                        <article><UtensilsCrossed /><span>Total items</span><strong>{data.menuItems.length}</strong></article>
                        <article><span>Available</span><strong>{data.menuItems.filter((item) => item.available).length}</strong></article>
                        <article><span>Categories</span><strong>{categories.length}</strong></article>
                    </div>

                    <section className="category-manager">
                        <header>
                            <div>
                                <h2>Categories</h2>
                                <p>Drag categories into the order customers should see them.</p>
                            </div>
                            <button className="menu-button" onClick={beginAddCategory}><CirclePlus size={16} /> New category</button>
                        </header>
                        <div className="category-manager__grid">
                            {categories.map((category) => (
                                <article key={category.id} draggable onDragStart={() => setDraggedCategoryId(category.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropCategory(category.id)} className={`${!category.visible ? "is-hidden " : ""}${draggedCategoryId === category.id ? "is-dragging" : ""}`}>
                                    <span className="drag-handle" title="Drag to reorder"><GripVertical size={18} /></span>
                                    <div className="category-visual">{category.imageUrl ? <img src={category.imageUrl} alt="" /> : <span>{category.emoji}</span>}</div>
                                    <div><strong>{category.name}</strong><small>Order {category.sortOrder}</small></div>
                                    <span className="category-visibility">{category.visible ? <Eye size={15} /> : <EyeOff size={15} />}</span>
                                    <button onClick={() => beginEditCategory(category)} title="Edit category"><Pencil size={16} /></button>
                                    <button className="is-danger" title="Delete category" onClick={() => { if (!deleteMenuCategory(category.id)) window.alert("Move or delete the items in this category first."); }}><Trash2 size={16} /></button>
                                </article>
                            ))}
                        </div>
                    </section>

                    <div className="menu-toolbar">
                        <label className="menu-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search menu items" /></label>
                        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="All">All categories</option>{categories.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select>
                    </div>

                    <div className="menu-groups">
                        {groupedItems.map(([group, items]) => (
                            <section className="menu-group" key={group.id}>
                                <header>
                                    <div><span className="menu-group__emoji">{group.emoji}</span><span>{group.name}</span><small>{items.length} items - drag to reorder</small></div>
                                    <strong>{items.filter((item) => item.available).length} available</strong>
                                </header>
                                <div className="menu-group__rows">
                                    {items.map((item) => (
                                        <article className={`menu-row ${draggedItem?.id === item.id ? "is-dragging" : ""}`} draggable onDragStart={() => setDraggedItem({ id: item.id, categoryId: group.id })} onDragOver={(event) => event.preventDefault()} onDrop={() => dropItem(item.id, group.id)} key={item.id}>
                                            <span className="drag-handle" title="Drag to reorder"><GripVertical size={18} /></span>
                                            <div className="menu-item-visual">{item.imageUrl && item.displayStyle !== "emoji" ? <img src={item.imageUrl} alt={item.imageAlt || item.name} /> : <span>{item.emoji || group.emoji}</span>}</div>
                                            <div className="menu-row__main">
                                                <div><strong>{item.name}</strong><span className={item.available ? "menu-status is-active" : "menu-status"}>{item.available ? "Available" : "Sold out"}</span></div>
                                                <p>{item.description || "No description"}</p>
                                                <small>{item.kind === "quick-add" ? "Inline quantity" : "Customizable item"}</small>
                                            </div>
                                            <div className="menu-row__meta"><strong>${item.price.toFixed(2)}</strong><span>{item.available ? "Available" : "Sold out"}</span></div>
                                            <div className="menu-row__actions">
                                                <button title="Edit" onClick={() => beginEdit(item)}><Pencil size={17} /></button>
                                                <button title="Duplicate item" onClick={() => duplicateAndEdit(item)}><Copy size={17} /></button>
                                                <button className="is-danger" title="Delete" onClick={() => window.confirm(`Delete ${item.name}?`) && deleteMenuItem(item.id)}><Trash2 size={17} /></button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        ))}
                        {groupedItems.length === 0 && (
                            <div className="menu-empty">
                                <UtensilsCrossed size={40} />
                                <h2>No menu items found</h2>
                                <p>Add an item or change the current filters.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === "menus" && (
                <section className="menu-definitions">
                    <header>
                        <div>
                            <h2>Menus</h2>
                            <p>Create reusable menus for different sports and event levels.</p>
                        </div>
                        <button className="menu-button menu-button--primary" onClick={beginAddMenu}><CirclePlus size={17} /> Add menu</button>
                    </header>
                    <div className="menu-definition-grid">
                        {data.menus.map((menu) => (
                            <article key={menu.id}>
                                <div>
                                    <span className={menu.active ? "menu-status is-active" : "menu-status"}>{menu.active ? "Active" : "Inactive"}</span>
                                    <h3>{menu.name}</h3>
                                    <p>{menu.description || "No description"}</p>
                                    <small>{menu.itemIds.length} items</small>
                                </div>
                                <div className="menu-definition-actions">
                                    <button onClick={() => beginEditMenu(menu)}><Pencil size={16} /> Edit</button>
                                    <button className="is-danger" onClick={() => { if (!deleteMenu(menu.id)) window.alert("This menu is assigned to an event. Reassign the event before deleting it."); }}><Trash2 size={16} /> Delete</button>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {activeTab === "assignments" && (
                <section className="menu-assignments">
                    <header>
                        <h2>Event menu assignments</h2>
                        <p>Only live, scheduled, and draft events in the current workspace are shown. Completed events remain available in Reports.</p>
                    </header>
                    <div>
                        {assignableEvents.map((event) => (
                            <article key={event.id} className={event.status === "live" ? "is-live" : ""}>
                                <div><strong>{event.name}{event.status === "live" ? " - LIVE" : ""}</strong><span>{event.opponent ? `vs. ${event.opponent}` : ""}</span><small>{new Date(event.startsAt).toLocaleString()}</small></div>
                                <label>Menu<select value={event.menuId ?? ""} onChange={(change) => assignMenuToEvent(event.id, change.target.value || undefined)}><option value="">No menu assigned</option>{data.menus.filter((menu) => menu.active).map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select></label>
                            </article>
                        ))}
                        {assignableEvents.length === 0 && <p className="menu-empty-note">No live, scheduled, or draft events exist in this workspace.</p>}
                    </div>
                </section>
            )}

            {menuOpen && (
                <div className="menu-modal-backdrop" onMouseDown={() => setMenuOpen(false)}>
                    <div className="menu-modal menu-modal--wide" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="menu-modal__heading">
                            <div>
                                <p className="menu-eyebrow">Event menu</p>
                                <h2>{editingMenu ? "Edit menu" : "Add menu"}</h2>
                            </div>
                            <button onClick={() => setMenuOpen(false)}><X /></button>
                        </div>
                        <form onSubmit={submitMenu}>
                            <label>Menu name<input required value={menuDraft.name} onChange={(event) => setMenuDraft({ ...menuDraft, name: event.target.value })} placeholder="Varsity Football Menu" /></label>
                            <label>Description<textarea value={menuDraft.description ?? ""} onChange={(event) => setMenuDraft({ ...menuDraft, description: event.target.value })} placeholder="Full game-night menu for varsity football" /></label>
                            <label className="menu-check"><input type="checkbox" checked={menuDraft.active} onChange={(event) => setMenuDraft({ ...menuDraft, active: event.target.checked })} /> Available for event assignment</label>
                            <section className="menu-item-picker">
                                <h3>Items in this menu</h3>
                                <p>Select the reusable products that should appear for this menu.</p>
                                {categories.map((category) => (
                                    <div key={category.id}>
                                        <strong>{category.emoji} {category.name}</strong>
                                        {data.menuItems.filter((item) => item.categoryId === category.id || item.category === category.name).map((item) => (
                                            <label key={item.id}><input type="checkbox" checked={menuDraft.itemIds.includes(item.id)} onChange={() => toggleMenuItem(item.id)} /><span>{item.emoji} {item.name}</span><span>${item.price.toFixed(2)}</span></label>
                                        ))}
                                    </div>
                                ))}
                            </section>
                            <div className="menu-modal__actions">
                                <button type="button" className="menu-button" onClick={() => setMenuOpen(false)}>Cancel</button>
                                <button className="menu-button menu-button--primary" type="submit">Save menu</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {itemOpen && (
                <div className="menu-modal-backdrop" onMouseDown={() => setItemOpen(false)}>
                    <div className="menu-modal menu-modal--wide" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="menu-modal__heading">
                            <div>
                                <p className="menu-eyebrow">Menu item</p>
                                <h2>{editing ? "Edit item" : "Add item"}</h2>
                            </div>
                            <button onClick={() => setItemOpen(false)}><X /></button>
                        </div>
                        <form onSubmit={submitItem}>
                            <div className="menu-form-grid">
                                <label>Item name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
                                <label>Category<select required value={draft.categoryId} onChange={(event) => chooseCategory(event.target.value)}>{categories.map((category) => <option value={category.id} key={category.id}>{category.emoji} {category.name}</option>)}</select></label>
                            </div>
                            <label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
                            <div className="menu-form-grid menu-form-grid--single">
                                <label>Price<input required type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
                            </div>
                            <div className="menu-form-grid">
                                <label>Customer interaction<select value={draft.kind ?? "standard"} onChange={(event) => setDraft({ ...draft, kind: event.target.value as MenuItem["kind"] })}><option value="standard">Open customization sheet</option><option value="quick-add">Inline quantity controls</option></select></label>
                                <label>Display style<select value={draft.displayStyle ?? "image-with-emoji-fallback"} onChange={(event) => setDraft({ ...draft, displayStyle: event.target.value as MenuItem["displayStyle"] })}><option value="emoji">Emoji only</option><option value="image">Image only</option><option value="image-with-emoji-fallback">Image with emoji fallback</option></select></label>
                            </div>
                            <section className="appearance-editor">
                                <div className="appearance-preview">{draft.imageUrl && draft.displayStyle !== "emoji" ? <img src={draft.imageUrl} alt="Preview" /> : <span>{draft.emoji || "🍽️"}</span>}</div>
                                <div>
                                    <label>Emoji icon<input value={draft.emoji ?? ""} onChange={(event) => setDraft({ ...draft, emoji: event.target.value })} placeholder="🍔" /></label>
                                    <label>Image URL<input type="text" placeholder="https://example.com/image.png" value={draft.imageUrl ?? ""} onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.target.value }))} /></label>
                                    {draft.imageUrl && <button type="button" className="text-button" onClick={() => setDraft({ ...draft, imageUrl: "" })}>Remove image</button>}
                                </div>
                            </section>
                            <label>Condiments<small>Editable for this item; separate choices with commas. Leave blank when none apply.</small><input value={condimentText} onChange={(event) => setCondimentText(event.target.value)} placeholder="Ketchup, Mustard, Pickles, Onions" /></label>
                            <label className="menu-check"><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} /> Available to customers</label>
                            <div className="menu-modal__actions">
                                <button type="button" className="menu-button" onClick={() => setItemOpen(false)}>Cancel</button>
                                <button className="menu-button menu-button--primary" type="submit">Save item</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {categoryOpen && (
                <div className="menu-modal-backdrop" onMouseDown={() => setCategoryOpen(false)}>
                    <div className="menu-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="menu-modal__heading">
                            <div>
                                <p className="menu-eyebrow">Category</p>
                                <h2>{editingCategory ? "Edit category" : "Add category"}</h2>
                            </div>
                            <button onClick={() => setCategoryOpen(false)}><X /></button>
                        </div>
                        <form onSubmit={submitCategory}>
                            <div className="menu-form-grid">
                                <label>Category name<input required value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} placeholder="Entrées" /></label>
                                <label>Emoji<input value={categoryDraft.emoji} onChange={(event) => setCategoryDraft({ ...categoryDraft, emoji: event.target.value })} placeholder="🍔" /></label>
                            </div>
                            <label>Display order<input type="number" min="1" value={categoryDraft.sortOrder} onChange={(event) => setCategoryDraft({ ...categoryDraft, sortOrder: Number(event.target.value) })} /></label>
                            <label className="menu-check"><input type="checkbox" checked={categoryDraft.visible} onChange={(event) => setCategoryDraft({ ...categoryDraft, visible: event.target.checked })} /> Visible in Customer Ordering</label>
                            <div className="menu-modal__actions">
                                <button type="button" className="menu-button" onClick={() => setCategoryOpen(false)}>Cancel</button>
                                <button className="menu-button menu-button--primary" type="submit">Save category</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
