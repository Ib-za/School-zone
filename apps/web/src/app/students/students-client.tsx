"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { trpc } from "../../trpc/client";

type SetupSnapshot = Awaited<ReturnType<typeof trpc.setup.snapshot.query>>;
type StudentList = Awaited<ReturnType<typeof trpc.students.list.query>>;

type StudentsClientProps = {
  role: string;
};

function optionalValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

export function StudentsClient({ role }: StudentsClientProps) {
  const [setup, setSetup] = useState<SetupSnapshot | null>(null);
  const [students, setStudents] = useState<StudentList>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canCreateStudents = ["school_admin", "branch_admin"].includes(role);

  const branchById = useMemo(
    () => new Map((setup?.branches ?? []).map((branch) => [branch.id, branch.name])),
    [setup?.branches]
  );
  const gradeById = useMemo(
    () => new Map((setup?.grades ?? []).map((grade) => [grade.id, grade.label])),
    [setup?.grades]
  );
  const sectionById = useMemo(
    () => new Map((setup?.sections ?? []).map((section) => [section.id, section.label])),
    [setup?.sections]
  );
  const classOptions = useMemo(
    () => (setup?.classes ?? []).filter((klass) => !selectedBranchId || klass.branch_id === selectedBranchId),
    [selectedBranchId, setup?.classes]
  );

  async function loadData() {
    const [nextSetup, nextStudents] = await Promise.all([
      trpc.setup.snapshot.query(),
      trpc.students.list.query()
    ]);

    setSetup(nextSetup);
    setStudents(nextStudents);
    setSelectedBranchId((current) => current || nextSetup.branches[0]?.id || "");
  }

  useEffect(() => {
    loadData().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Unable to load student setup data.");
    });
  }, []);

  async function handleCreateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const parentMode = formData.get("parentMode") === "existing" ? "existing" : "create";

    try {
      const result = await trpc.students.create.mutate({
        branchId: String(formData.get("branchId") ?? ""),
        classId: String(formData.get("classId") ?? ""),
        admissionNumber: String(formData.get("admissionNumber") ?? ""),
        fullName: String(formData.get("fullName") ?? ""),
        dob: optionalValue(formData.get("dob")),
        gender: optionalValue(formData.get("gender")) as "male" | "female" | "other" | "prefer_not_to_say" | undefined,
        previousSchool: optionalValue(formData.get("previousSchool")),
        admissionDate: optionalValue(formData.get("admissionDate")),
        nationality: optionalValue(formData.get("nationality")),
        motherTongue: optionalValue(formData.get("motherTongue")),
        governmentIdNumber: optionalValue(formData.get("governmentIdNumber")),
        emisNumber: optionalValue(formData.get("emisNumber")),
        rollNumber: optionalValue(formData.get("rollNumber")),
        transportRequired: formData.get("transportRequired") === "on",
        hostelRequired: formData.get("hostelRequired") === "on",
        parent: {
          mode: parentMode,
          authUserId: optionalValue(formData.get("parentAuthUserId")),
          email: String(formData.get("parentEmail") ?? ""),
          password: optionalValue(formData.get("parentPassword")),
          fullName: String(formData.get("parentFullName") ?? ""),
          contactPhone: optionalValue(formData.get("parentPhone")),
          relation: String(formData.get("relation") || "guardian") as "father" | "mother" | "guardian" | "grandparent" | "other",
          isPrimaryContact: formData.get("isPrimaryContact") === "on",
          pickupAllowed: formData.get("pickupAllowed") === "on",
          isEmergencyContact: formData.get("isEmergencyContact") === "on"
        }
      });

      form.reset();
      await loadData();
      setMessage(`Created student ${result.studentId} and linked parent ${result.parentId}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create student.");
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
          <span>Students</span>
          <strong>{students.length}</strong>
        </div>
        <div className="panel metric">
          <span>Classes</span>
          <strong>{setup?.classes.length ?? 0}</strong>
        </div>
        <div className="panel metric">
          <span>Branches</span>
          <strong>{setup?.branches.length ?? 0}</strong>
        </div>
        <div className="panel metric">
          <span>Mode</span>
          <strong>{role}</strong>
        </div>
      </div>

      {canCreateStudents ? (
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Student</p>
              <h2>Create student and link parent</h2>
            </div>
            <span className="status-pill">{role}</span>
          </div>

          <form className="form-grid" onSubmit={handleCreateStudent}>
            <label>
              <span>Branch</span>
              <select
                name="branchId"
                onChange={(event) => setSelectedBranchId(event.target.value)}
                required
                value={selectedBranchId}
              >
                {(setup?.branches ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Class</span>
              <select name="classId" required>
                {classOptions.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {gradeById.get(klass.grade_id) ?? "Grade"} - {sectionById.get(klass.section_id) ?? "Section"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Admission number</span>
              <input name="admissionNumber" required />
            </label>
            <label>
              <span>Student full name</span>
              <input name="fullName" required />
            </label>
            <label>
              <span>Date of birth</span>
              <input name="dob" type="date" />
            </label>
            <label>
              <span>Gender</span>
              <select defaultValue="" name="gender">
                <option value="">Not set</option>
                <option value="male">male</option>
                <option value="female">female</option>
                <option value="other">other</option>
                <option value="prefer_not_to_say">prefer_not_to_say</option>
              </select>
            </label>
            <label>
              <span>Admission date</span>
              <input name="admissionDate" type="date" />
            </label>
            <label>
              <span>Roll number</span>
              <input name="rollNumber" />
            </label>
            <label>
              <span>Previous school</span>
              <input name="previousSchool" />
            </label>
            <label>
              <span>Nationality</span>
              <input name="nationality" />
            </label>
            <label>
              <span>Mother tongue</span>
              <input name="motherTongue" />
            </label>
            <label>
              <span>Government ID</span>
              <input name="governmentIdNumber" />
            </label>
            <label>
              <span>EMIS number</span>
              <input name="emisNumber" />
            </label>
            <div className="field-group">
              <span>Facilities</span>
              <label className="inline-field">
                <input name="transportRequired" type="checkbox" />
                Transport required
              </label>
              <label className="inline-field">
                <input name="hostelRequired" type="checkbox" />
                Hostel required
              </label>
            </div>

            <div className="wide-field field-group">
              <span>Parent user source</span>
              <label className="inline-field">
                <input defaultChecked name="parentMode" type="radio" value="create" />
                Create a new Supabase Auth user
              </label>
              <label className="inline-field">
                <input name="parentMode" type="radio" value="existing" />
                Associate an existing Auth user ID
              </label>
            </div>

            <label>
              <span>Existing parent Auth user ID</span>
              <input name="parentAuthUserId" placeholder="Required only for existing user mode" />
            </label>
            <label>
              <span>Parent email</span>
              <input name="parentEmail" required type="email" />
            </label>
            <label>
              <span>Parent temporary password</span>
              <input minLength={8} name="parentPassword" type="password" />
            </label>
            <label>
              <span>Parent full name</span>
              <input name="parentFullName" required />
            </label>
            <label>
              <span>Parent phone</span>
              <input name="parentPhone" />
            </label>
            <label>
              <span>Relation</span>
              <select defaultValue="guardian" name="relation">
                <option value="father">father</option>
                <option value="mother">mother</option>
                <option value="guardian">guardian</option>
                <option value="grandparent">grandparent</option>
                <option value="other">other</option>
              </select>
            </label>
            <div className="field-group">
              <span>Parent link permissions</span>
              <label className="inline-field">
                <input defaultChecked name="isPrimaryContact" type="checkbox" />
                Primary contact
              </label>
              <label className="inline-field">
                <input defaultChecked name="pickupAllowed" type="checkbox" />
                Pickup allowed
              </label>
              <label className="inline-field">
                <input defaultChecked name="isEmergencyContact" type="checkbox" />
                Emergency contact
              </label>
            </div>

            <div className="form-actions wide-field">
              <button disabled={loading || classOptions.length === 0} type="submit">
                {loading ? "Working..." : "Save student"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="form-error">Only school and branch admins can create students.</p>
      )}

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>Current students</h2>
          </div>
        </div>

        <div className="table-list">
          <div className="table-row table-head">
            <span>Name</span>
            <span>Admission</span>
            <span>Branch</span>
            <span>Class</span>
          </div>
          {students.map((student) => (
            <div className="table-row" key={student.id}>
              <span>{student.full_name}</span>
              <span>{student.admission_number}</span>
              <span>{branchById.get(student.branch_id) ?? student.branch_id}</span>
              <span>{student.class_id}</span>
            </div>
          ))}
          {students.length === 0 ? <p className="empty-copy">No students have been created yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
