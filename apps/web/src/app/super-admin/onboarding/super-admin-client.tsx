"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { trpc } from "../../../trpc/client";

type SchoolOption = {
  id: string;
  name: string;
  branches: Array<{
    id: string;
    name: string;
  }>;
};

function optionalValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

export function OnboardingClient() {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId),
    [schools, selectedSchoolId]
  );

  async function loadSchools() {
    const nextSchools = await trpc.superAdmin.schools.query();
    setSchools(nextSchools);
    setSelectedSchoolId((current) => current || nextSchools[0]?.id || "");
  }

  useEffect(() => {
    loadSchools().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Unable to load onboarded schools.");
    });
  }, []);

  async function handleOnboardSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const mode = formData.get("adminMode") === "existing" ? "existing" : "create";

    try {
      const result = await trpc.superAdmin.onboardSchool.mutate({
        school: {
          name: String(formData.get("schoolName") ?? ""),
          subscriptionTier: String(formData.get("subscriptionTier") || "basic")
        },
        branch: {
          name: String(formData.get("branchName") ?? ""),
          address: optionalValue(formData.get("branchAddress")),
          timezone: String(formData.get("timezone") || "Asia/Kolkata"),
          currency: String(formData.get("currency") || "INR"),
          phone: optionalValue(formData.get("branchPhone")),
          email: optionalValue(formData.get("branchEmail")),
          principalName: optionalValue(formData.get("principalName"))
        },
        academicYear: {
          label: String(formData.get("academicYearLabel") ?? ""),
          startDate: String(formData.get("startDate") ?? ""),
          endDate: String(formData.get("endDate") ?? "")
        },
        admin: {
          mode,
          authUserId: optionalValue(formData.get("adminAuthUserId")),
          email: String(formData.get("adminEmail") ?? ""),
          password: optionalValue(formData.get("adminPassword")),
          fullName: String(formData.get("adminFullName") ?? ""),
          employeeCode: optionalValue(formData.get("adminEmployeeCode")),
          contactPhone: optionalValue(formData.get("adminPhone"))
        }
      });

      form.reset();
      await loadSchools();
      setMessage(`Created ${result.school.name} and assigned school admin ${result.admin.authUserId}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "School onboarding failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAssociateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const result = await trpc.superAdmin.associateStaffUser.mutate({
        authUserId: String(formData.get("authUserId") ?? ""),
        schoolId: String(formData.get("schoolId") ?? ""),
        branchId: String(formData.get("branchId") ?? ""),
        role: String(formData.get("role") ?? "teacher") as "school_admin" | "branch_admin" | "teacher",
        email: optionalValue(formData.get("email")),
        fullName: String(formData.get("fullName") ?? ""),
        employeeCode: optionalValue(formData.get("employeeCode")),
        contactPhone: optionalValue(formData.get("contactPhone"))
      });

      form.reset();
      setMessage(`Associated ${result.authUserId} as ${result.role} for the selected school and branch.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "User association failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">New school</p>
            <h2>Create school and first admin</h2>
          </div>
          <span className="status-pill">platform_admin only</span>
        </div>

        <form className="form-grid" onSubmit={handleOnboardSchool}>
          <label>
            <span>School name</span>
            <input name="schoolName" required />
          </label>
          <label>
            <span>Subscription tier</span>
            <input defaultValue="basic" name="subscriptionTier" required />
          </label>
          <label>
            <span>Branch name</span>
            <input name="branchName" required />
          </label>
          <label>
            <span>Branch email</span>
            <input name="branchEmail" type="email" />
          </label>
          <label className="wide-field">
            <span>Branch address</span>
            <input name="branchAddress" />
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
            <span>Branch phone</span>
            <input name="branchPhone" />
          </label>
          <label>
            <span>Principal name</span>
            <input name="principalName" />
          </label>
          <label>
            <span>Academic year</span>
            <input name="academicYearLabel" placeholder="2026-27" required />
          </label>
          <label>
            <span>Start date</span>
            <input name="startDate" required type="date" />
          </label>
          <label>
            <span>End date</span>
            <input name="endDate" required type="date" />
          </label>

          <div className="wide-field field-group">
            <span>Admin user source</span>
            <label className="inline-field">
              <input defaultChecked name="adminMode" type="radio" value="create" />
              Create a new Supabase Auth user
            </label>
            <label className="inline-field">
              <input name="adminMode" type="radio" value="existing" />
              Associate an existing Supabase Auth user ID
            </label>
          </div>

          <label>
            <span>Existing Auth user ID</span>
            <input name="adminAuthUserId" placeholder="Required only for existing user mode" />
          </label>
          <label>
            <span>Admin email</span>
            <input name="adminEmail" required type="email" />
          </label>
          <label>
            <span>Temporary password</span>
            <input minLength={8} name="adminPassword" type="password" />
          </label>
          <label>
            <span>Admin full name</span>
            <input name="adminFullName" required />
          </label>
          <label>
            <span>Employee code</span>
            <input name="adminEmployeeCode" />
          </label>
          <label>
            <span>Admin phone</span>
            <input name="adminPhone" />
          </label>

          <div className="form-actions wide-field">
            <button disabled={loading} type="submit">
              {loading ? "Working..." : "Onboard school"}
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Existing user</p>
            <h2>Associate Auth user to school and branch</h2>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleAssociateStaff}>
          <label>
            <span>Auth user ID</span>
            <input name="authUserId" required />
          </label>
          <label>
            <span>School</span>
            <select
              name="schoolId"
              onChange={(event) => setSelectedSchoolId(event.target.value)}
              required
              value={selectedSchoolId}
            >
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Branch</span>
            <select name="branchId" required>
              {(selectedSchool?.branches ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Role</span>
            <select defaultValue="teacher" name="role" required>
              <option value="school_admin">school_admin</option>
              <option value="branch_admin">branch_admin</option>
              <option value="teacher">teacher</option>
            </select>
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" />
          </label>
          <label>
            <span>Full name</span>
            <input name="fullName" required />
          </label>
          <label>
            <span>Employee code</span>
            <input name="employeeCode" />
          </label>
          <label>
            <span>Phone</span>
            <input name="contactPhone" />
          </label>

          <div className="form-actions wide-field">
            <button disabled={loading || schools.length === 0} type="submit">
              {loading ? "Working..." : "Associate user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
