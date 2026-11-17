"use client";

import { useState, type FormEvent } from "react";
import type { Profile } from "@/lib/api/types";
import {
  normalizePlace,
  OTHER_CONTROLS_CHIPS,
  PLACE_CATEGORIES,
  rolePlacePlaceholder,
  type PlaceCategory,
  type StructuredPlace,
} from "@/lib/places";
import { ROLE_NOTE_MAX, ROLE_PRESETS } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { Button, Panel } from "./ui";

interface SetupFormProps {
  initial: Profile | null;
  onSave: (profile: Profile) => void;
  onCancel?: () => void;
  busy: boolean;
}

export function SetupForm({
  initial,
  onSave,
  onCancel,
  busy,
}: SetupFormProps) {
  const [role, setRole] = useState<Role>(initial?.role ?? "ward_officer");
  const [name, setName] = useState(initial?.name ?? "");
  const [roleNote, setRoleNote] = useState(initial?.roleNote ?? "");
  const [placesList, setPlacesList] = useState<StructuredPlace[]>(() =>
    (initial?.places ?? []).map(normalizePlace),
  );

  const [newPlaceName, setNewPlaceName] = useState("");
  const [newCategory, setNewCategory] = useState<PlaceCategory>("industrial");
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [newContact, setNewContact] = useState("");
  const [showContact, setShowContact] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  function handleAddPlace() {
    const trimmed = newPlaceName.trim();
    if (!trimmed || placesList.length >= 10) return;
    const entry: StructuredPlace = {
      name: trimmed,
      category: newCategory,
      customCategory: newCategory === "other" && newCustomCategory.trim() ? newCustomCategory.trim() : null,
      contact: newContact.trim() || null,
    };
    setPlacesList((prev) => [...prev, entry]);
    setNewPlaceName("");
    setNewCustomCategory("");
    setNewContact("");
    setShowContact(false);
  }

  function handleRemovePlace(index: number) {
    setPlacesList((prev) => prev.filter((_, i) => i !== index));
  }

  function handleToggleChip(chip: string) {
    const current = roleNote.trim();
    if (current.toLowerCase().includes(chip.toLowerCase())) {
      const filtered = current
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !s.toLowerCase().includes(chip.toLowerCase()))
        .join(", ");
      setRoleNote(filtered);
    } else {
      const next = current ? `${current}, ${chip}` : chip;
      setRoleNote(next.slice(0, ROLE_NOTE_MAX));
    }
  }

  function handleApplyBulk() {
    const lines = bulkText.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
    const existing = new Set(placesList.map((p) => p.name.toLowerCase()));
    const added: StructuredPlace[] = [];
    for (const line of lines) {
      if (placesList.length + added.length >= 10) break;
      if (!existing.has(line.toLowerCase())) {
        added.push({ name: line, category: "other", customCategory: null, contact: null });
        existing.add(line.toLowerCase());
      }
    }
    setPlacesList((prev) => [...prev, ...added]);
    setBulkText("");
    setBulkMode(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      role,
      name: name.trim(),
      roleNote: role === "other" ? roleNote.trim() || null : null,
      places: placesList.slice(0, 10),
    });
  }

  return (
    <Panel
      title="Open your case file"
      description="Tell Inspector Pawan who is asking. Actions, letters and notices are written for what you can actually do."
      className="mx-auto w-full max-w-2xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 font-medium">Who is asking?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLE_PRESETS.map((preset) => (
              <label
                key={preset.id}
                className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 transition-colors ${
                  role === preset.id ? "border-accent bg-haze" : "border-line hover:border-accent"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={preset.id}
                  checked={role === preset.id}
                  onChange={() => setRole(preset.id)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  <span className="block font-medium">{preset.label}</span>
                  <span className="block text-sm text-muted">{preset.noticeTitle}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {role === "other" ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              What is your place, and what do you control?
              <input
                value={roleNote}
                maxLength={ROLE_NOTE_MAX}
                onChange={(event) => setRoleNote(event.target.value)}
                className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm"
                placeholder="Clinic: waiting area, opening hours, patient notices"
              />
              <span className="text-xs text-muted">{roleNote.length}/{ROLE_NOTE_MAX}</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Quick suggestions:</span>
              {OTHER_CONTROLS_CHIPS.map((chip) => {
                const active = roleNote.toLowerCase().includes(chip.toLowerCase());
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleToggleChip(chip)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-accent text-accent-ink"
                        : "border border-line bg-surface text-ink hover:border-accent"
                    }`}
                  >
                    {active ? `✓ ${chip}` : `+ ${chip}`}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <label className="flex flex-col gap-1">
          Place name
          <input
            required
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm"
            placeholder={rolePlacePlaceholder(role)}
          />
        </label>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Nearby places you may write to ({placesList.length}/10)</span>
            <button
              type="button"
              onClick={() => setBulkMode(!bulkMode)}
              className="text-xs text-accent hover:underline"
            >
              {bulkMode ? "Switch to builder" : "Paste text list"}
            </button>
          </div>

          {bulkMode ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={bulkText}
                rows={3}
                onChange={(e) => setBulkText(e.target.value)}
                className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm"
                placeholder="Paste names, one per line (e.g. Govindpura Industrial Area, City Hospital)"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" kind="quiet" onClick={() => setBulkMode(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleApplyBulk}>
                  Add from text
                </Button>
              </div>
            </div>
          ) : (
            <>
              {placesList.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {placesList.map((item, index) => {
                    const catPreset = PLACE_CATEGORIES.find((c) => c.id === item.category);
                    const label = item.category === "other" && item.customCategory
                      ? `Other: ${item.customCategory}`
                      : catPreset?.label ?? item.category;
                    return (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex items-center justify-between rounded-[10px] border border-line bg-surface px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          <span className="rounded-full bg-haze px-2 py-0.5 text-xs text-muted">
                            {label}
                          </span>
                          {item.contact ? (
                            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                              {item.contact}
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePlace(index)}
                          aria-label={`Remove ${item.name}`}
                          className="ml-2 text-muted hover:text-warn text-base leading-none"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Add nearby factories, schools, hospitals, or construction sites so Pawan can draft targeted action letters to them.
                </p>
              )}

              {placesList.length < 10 ? (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <input
                      value={newPlaceName}
                      maxLength={120}
                      onChange={(e) => setNewPlaceName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPlace();
                        }
                      }}
                      className="flex-1 min-w-[200px] rounded-[10px] border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      placeholder={PLACE_CATEGORIES.find((c) => c.id === newCategory)?.placeholder ?? "Enter nearby place name..."}
                    />
                    <div className="relative shrink-0">
                      <select
                        aria-label="Place category"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as PlaceCategory)}
                        className="rounded-[10px] border border-line bg-surface px-3 py-2 pr-8 text-sm font-medium text-ink focus:border-accent focus:outline-none cursor-pointer appearance-none"
                      >
                        {PLACE_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddPlace}
                      disabled={!newPlaceName.trim()}
                    >
                      + Add
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                    {newCategory === "other" ? (
                      <input
                        value={newCustomCategory}
                        maxLength={100}
                        onChange={(e) => setNewCustomCategory(e.target.value)}
                        className="w-full sm:w-72 rounded-[8px] border border-line bg-surface px-2.5 py-1 text-xs focus:border-accent focus:outline-none"
                        placeholder="Specify type (e.g. Timber Yard, Depot, Brick Kiln)"
                      />
                    ) : <span />}

                    {showContact ? (
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <input
                          value={newContact}
                          maxLength={120}
                          onChange={(e) => setNewContact(e.target.value)}
                          className="w-full sm:w-64 rounded-[8px] border border-line bg-surface px-2.5 py-1 text-xs focus:border-accent focus:outline-none"
                          placeholder="Phone (WhatsApp) or email"
                        />
                        <button
                          type="button"
                          onClick={() => { setShowContact(false); setNewContact(""); }}
                          className="text-muted hover:text-ink text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowContact(true)}
                        className="text-muted hover:text-accent transition-colors"
                      >
                        + Add phone / email for 1-click sharing
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
          <span className="text-xs text-muted">Used only to address letters. The ward office is always included.</span>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || !name.trim()}>
            Save workspace
          </Button>
          {onCancel ? (
            <Button type="button" kind="quiet" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}
