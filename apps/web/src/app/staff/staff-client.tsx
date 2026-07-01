"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { trpc } from "../../trpc/client";

type SetupSnapshot = Awaited<ReturnType<typeof trpc.setup.snapshot.query>>;
type StaffList = Awaited<ReturnType<typeof trpc.staff.list.query>>;

type StaffClientProps = {
  role: string;
};

function optionalValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

export function StaffClient({ role }: StaffClientProps) {
  const [setup, setSetup] = useState<SetupSnapshot | null>(null);
  const [staff, setStaff] = useState<StaffList>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canCreateStaff = role === "school_admin";

  const branchById = useMemo(
    () => new Map((setup?.branches ?? []).map((branch) => [branch.id, branch.name])),
    [setup?.branches]
  );

  async function loadData() {
    const [nextSetup, nextStaff] = await Promise.all([
      trpc.setup.snapshot.query(),
      trpc.staff.list.query()
    ]);

    setSetup(nextSetup);
    setStaff(nextStaff);
  }

  useEffect(() => {
    loadData().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Unable to load staff setup data.");
    });
  }, []);

  async function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const mode = formData.get("mode") === "existing" ? "existing" : "create";

    try {
      const result = await trpc.staff.create.mutate({
        mode,
        authUserId: optionalValue(formData.get("authUserId")),
        email: String(formData.get("email") ?? ""),
        password: optionalValue(formData.get("password")),
        fullName: String(formData.get("fullName") ?? ""),
        role: String(formData.get("role") ?? "teacher") as "branch_admin" | "teacher",
        branchId: String(formData.get("branchId") ?? ""),
        employeeCode: optionalValue(formData.get("employeeCode")),
        contactPhone: optionalValue(formData.get("contactPhone")),
        joiningDate: optionalValue(formData.get("joiningDate")),
        qualifications: optionalValue(formData.get("qualifications")),
        experienceNotes: optionalValue(formData.get("experienceNotes"))
      });

      form.reset();
      await loadData();
      setMessage(`Staff user ${result.authUserId} assigned as ${result.role}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create staff user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="summary-grid">
        <div className="panel metric">
          <span>Total staff</span>
          <strong>{staff.length}</strong>
        </div>
        <div className="panel metric">
          <span>Teachers</span>
          <strong>{staff.filter((member) => member.role === "teacher").length}</strong>
        </div>
        <div className="panel metric">
          <span>Branch admins</span>
          <strong>{staff.filter((member) => member.role === "branch_admin").length}</strong>
        </div>
        <div className="panel metric">
          <span>Branches</span>
          <strong>{setup?.branches.length ?? 0}</strong>
        </div>
      </div>

      {canCreateStaff ? (
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Staff user</p>
              <h2>Create or associate staff</h2>
            </div>
            <span className="status-pill">school_admin</span>
          </div>

          <form className="form-grid" onSubmit={handleCreateStaff}>
            <div className="wide-field field-group">
              <span>User source</span>
              <label className="inline-field">
                <input defaultChecked name="mode" type="radio" value="create" />
                Create a new Supabase Auth user
              </label>
              <label className="inline-field">
                <input name="mode" type="radio" value="existing" />
                Associate an existing Auth user ID
              </label>
            </div>

            <label>
              <span>Existing Auth user ID</span>
              <input name="authUserId" placeholder="Required only for existing user mode" />
            </label>
            <label>
              <span>Email</span>
              <input name="email" required type="email" />
            </label>
            <label>
              <span>Temporary password</span>
              <input minLength={8} name="password" type="password" />
            </label>
            <label>
              <span>Full name</span>
              <input name="fullName" required />
            </label>
            <label>
              <span>Role</span>
              <select defaultValue="teacher" name="role" required>
                <option value="teacher">teacher</option>
                <option value="branch_admin">branch_admin</option>
              </select>
            </label>
            <label>
              <span>Branch</span>
              <select name="branchId" required>
                {(setup?.branches ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Employee code</span>
              <input name="employeeCode" />
            </label>
            <label>
              <span>Phone</span>
              <input name="contactPhone" />
            </label>
            <label>
              <span>Joining date</span>
              <input name="joiningDate" type="date" />
            </label>
            <label>
              <span>Qualifications</span>
              <input name="qualifications" />
            </label>
            <label className="wide-field">
              <span>Experience notes</span>
              <input name="experienceNotes" />
            </label>

            <div className="form-actions wide-field">
              <button disabled={loading || (setup?.branches.length ?? 0) === 0} type="submit">
                {loading ? "Working..." : "Save staff"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="form-error">Only school admins can create or associate staff users.</p>
      )}

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>Current staff</h2>
          </div>
        </div>

        <div className="table-list">
          <div className="table-row table-head">
            <span>Name</span>
            <span>Role</span>
            <span>Branch</span>
            <span>Email</span>
          </div>
          {staff.map((member) => (
            <div className="table-row" key={member.id}>
              <span>{member.full_name}</span>
              <span>{member.role}</span>
              <span>{member.branch_id ? branchById.get(member.branch_id) ?? member.branch_id : "School-wide"}</span>
              <span>{member.contact_email ?? "No email"}</span>
            </div>
          ))}
          {staff.length === 0 ? <p className="empty-copy">No staff users have been created yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
