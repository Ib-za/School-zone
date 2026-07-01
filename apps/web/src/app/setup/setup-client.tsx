"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { trpc } from "../../trpc/client";

type SetupSnapshot = Awaited<ReturnType<typeof trpc.setup.snapshot.query>>;

type SetupClientProps = {
  role: string;
};

function optionalValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

function numberValue(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SetupClient({ role }: SetupClientProps) {
  const [snapshot, setSnapshot] = useState<SetupSnapshot | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canCreateSchoolWide = role === "school_admin";

  const selectedBranchSections = useMemo(
    () => (snapshot?.sections ?? []).filter((section) => section.branch_id === selectedBranchId),
    [selectedBranchId, snapshot?.sections]
  );

  async function loadSnapshot() {
    const nextSnapshot = await trpc.setup.snapshot.query();
    setSnapshot(nextSnapshot);
    setSelectedBranchId((current) => current || nextSnapshot.branches[0]?.id || "");
  }

  useEffect(() => {
    loadSnapshot().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Unable to load setup data.");
    });
  }, []);

  async function runAction(form: HTMLFormElement, action: () => Promise<unknown>, success: string) {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await action();
      form.reset();
      await loadSnapshot();
      setMessage(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Setup action failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    return runAction(
      form,
      () =>
        trpc.setup.createBranch.mutate({
          name: String(formData.get("name") ?? ""),
          address: optionalValue(formData.get("address")),
          timezone: String(formData.get("timezone") || "Asia/Kolkata"),
          currency: String(formData.get("currency") || "INR"),
          phone: optionalValue(formData.get("phone")),
          email: optionalValue(formData.get("email")),
          principalName: optionalValue(formData.get("principalName"))
        }),
      "Branch created."
    );
  }

  function handleAcademicYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    return runAction(
      form,
      () =>
        trpc.setup.createAcademicYear.mutate({
          label: String(formData.get("label") ?? ""),
          startDate: String(formData.get("startDate") ?? ""),
          endDate: String(formData.get("endDate") ?? ""),
          isCurrent: formData.get("isCurrent") === "on"
        }),
      "Academic year created."
    );
  }

  function handleGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    return runAction(
      form,
      () =>
        trpc.setup.createGrade.mutate({
          label: String(formData.get("label") ?? ""),
          sortOrder: numberValue(formData.get("sortOrder"))
        }),
      "Grade created."
    );
  }

  function handleSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    return runAction(
      form,
      () =>
        trpc.setup.createSection.mutate({
          branchId: String(formData.get("branchId") ?? ""),
          label: String(formData.get("label") ?? "")
        }),
      "Section created."
    );
  }

  function handleSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    return runAction(
      form,
      () =>
        trpc.setup.createSubject.mutate({
          name: String(formData.get("name") ?? ""),
          subjectCode: optionalValue(formData.get("subjectCode")),
          displayOrder: numberValue(formData.get("displayOrder")),
          isOptional: formData.get("isOptional") === "on"
        }),
      "Subject created."
    );
  }

  function handleClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    return runAction(
      form,
      () =>
        trpc.setup.createClass.mutate({
          branchId: String(formData.get("branchId") ?? ""),
          academicYearId: String(formData.get("academicYearId") ?? ""),
          gradeId: String(formData.get("gradeId") ?? ""),
          sectionId: String(formData.get("sectionId") ?? "")
        }),
      "Class created."
    );
  }

  return (
    <div className="stack">
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="summary-grid">
        <div className="panel metric">
          <span>Branches</span>
          <strong>{snapshot?.branches.length ?? 0}</strong>
        </div>
        <div className="panel metric">
          <span>Academic years</span>
          <strong>{snapshot?.academicYears.length ?? 0}</strong>
        </div>
        <div className="panel metric">
          <span>Classes</span>
          <strong>{snapshot?.classes.length ?? 0}</strong>
        </div>
        <div className="panel metric">
          <span>Subjects</span>
          <strong>{snapshot?.subjects.length ?? 0}</strong>
        </div>
      </div>

      {canCreateSchoolWide ? (
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">School-wide</p>
              <h2>Branch, year, grade, and subject setup</h2>
            </div>
            <span className="status-pill">school_admin</span>
          </div>

          <div className="split-grid">
            <form className="form-grid compact-form" onSubmit={handleBranch}>
              <label>
                <span>Branch name</span>
                <input name="name" required />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" />
              </label>
              <label className="wide-field">
                <span>Address</span>
                <input name="address" />
              </label>
              <label>
                <span>Timezone</span>
                <input defaultValue="Asia/Kolkata" name="timezone" required />
              </label>
              <label>
                <span>Currency</span>
                <input defaultValue="INR" maxLength={3} minLength={3} name="currency" required />
              </label>
              <label>
                <span>Phone</span>
                <input name="phone" />
              </label>
              <label>
                <span>Principal</span>
                <input name="principalName" />
              </label>
              <div className="form-actions wide-field">
                <button disabled={loading} type="submit">Create branch</button>
              </div>
            </form>

            <form className="form-grid compact-form" onSubmit={handleAcademicYear}>
              <label>
                <span>Academic year</span>
                <input name="label" placeholder="2026-27" required />
              </label>
              <label>
                <span>Start date</span>
                <input name="startDate" required type="date" />
              </label>
              <label>
                <span>End date</span>
                <input name="endDate" required type="date" />
              </label>
              <label className="inline-field">
                <input name="isCurrent" type="checkbox" />
                Mark current year
              </label>
              <div className="form-actions wide-field">
                <button disabled={loading} type="submit">Create year</button>
              </div>
            </form>

            <form className="form-grid compact-form" onSubmit={handleGrade}>
              <label>
                <span>Grade label</span>
                <input name="label" placeholder="Grade 1" required />
              </label>
              <label>
                <span>Sort order</span>
                <input defaultValue={0} min={0} name="sortOrder" type="number" />
              </label>
              <div className="form-actions wide-field">
                <button disabled={loading} type="submit">Create grade</button>
              </div>
            </form>

            <form className="form-grid compact-form" onSubmit={handleSubject}>
              <label>
                <span>Subject name</span>
                <input name="name" required />
              </label>
              <label>
                <span>Subject code</span>
                <input name="subjectCode" />
              </label>
              <label>
                <span>Display order</span>
                <input defaultValue={0} min={0} name="displayOrder" type="number" />
              </label>
              <label className="inline-field">
                <input name="isOptional" type="checkbox" />
                Optional subject
              </label>
              <div className="form-actions wide-field">
                <button disabled={loading} type="submit">Create subject</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Branch structure</p>
            <h2>Sections and classes</h2>
          </div>
          <span className="status-pill">{role}</span>
        </div>

        <div className="split-grid">
          <form className="form-grid compact-form" onSubmit={handleSection}>
            <label>
              <span>Branch</span>
              <select
                name="branchId"
                onChange={(event) => setSelectedBranchId(event.target.value)}
                required
                value={selectedBranchId}
              >
                {(snapshot?.branches ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Section label</span>
              <input name="label" placeholder="A" required />
            </label>
            <div className="form-actions wide-field">
              <button disabled={loading || !selectedBranchId} type="submit">Create section</button>
            </div>
          </form>

          <form className="form-grid compact-form" onSubmit={handleClass}>
            <label>
              <span>Branch</span>
              <select
                name="branchId"
                onChange={(event) => setSelectedBranchId(event.target.value)}
                required
                value={selectedBranchId}
              >
                {(snapshot?.branches ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Academic year</span>
              <select name="academicYearId" required>
                {(snapshot?.academicYears ?? []).map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Grade</span>
              <select name="gradeId" required>
                {(snapshot?.grades ?? []).map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Section</span>
              <select name="sectionId" required>
                {selectedBranchSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions wide-field">
              <button disabled={loading || selectedBranchSections.length === 0} type="submit">Create class</button>
            </div>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Current setup</p>
            <h2>Configured records</h2>
          </div>
        </div>

        <div className="data-list">
          <section>
            <h3>Branches</h3>
            {(snapshot?.branches ?? []).map((branch) => <p key={branch.id}>{branch.name}</p>)}
          </section>
          <section>
            <h3>Academic years</h3>
            {(snapshot?.academicYears ?? []).map((year) => <p key={year.id}>{year.label}</p>)}
          </section>
          <section>
            <h3>Grades</h3>
            {(snapshot?.grades ?? []).map((grade) => <p key={grade.id}>{grade.label}</p>)}
          </section>
          <section>
            <h3>Subjects</h3>
            {(snapshot?.subjects ?? []).map((subject) => <p key={subject.id}>{subject.name}</p>)}
          </section>
        </div>
      </div>
    </div>
  );
}
