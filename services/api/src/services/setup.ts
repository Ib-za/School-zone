import { TRPCError } from "@trpc/server";
import {
  type CreateAcademicYearInput,
  type CreateBranchInput,
  type CreateClassInput,
  type CreateGradeInput,
  type CreateSectionInput,
  type CreateSubjectInput
} from "@elate/shared";
import { assertBranchAccess, type SchoolScopedStaffUser } from "../authz";
import { createSupabaseAdminClient } from "../supabase";

function requireAdminClient() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "SUPABASE_SECRET_KEY is required for setup operations."
    });
  }

  return supabase;
}

function optionalText(value?: string) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function raise(error: { message: string } | null | undefined, fallback: string): never {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: error?.message ?? fallback
  });
}

export async function getSetupSnapshot(user: SchoolScopedStaffUser) {
  const supabase = requireAdminClient();
  const branchFilter = user.role === "branch_admin" && user.branchId ? user.branchId : null;

  const [branches, academicYears, grades, sections, subjects, classes] = await Promise.all([
    supabase
      .from("branches")
      .select("id,name,address,timezone,currency,phone,email,principal_name")
      .eq("school_id", user.schoolId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("academic_years")
      .select("id,label,start_date,end_date,is_current")
      .eq("school_id", user.schoolId)
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
    supabase.from("grades").select("id,label,sort_order").eq("school_id", user.schoolId).order("sort_order"),
    supabase
      .from("sections")
      .select("id,branch_id,label")
      .eq("school_id", user.schoolId)
      .order("label"),
    supabase
      .from("subjects")
      .select("id,name,subject_code,display_order,is_optional")
      .eq("school_id", user.schoolId)
      .is("deleted_at", null)
      .order("display_order"),
    supabase
      .from("classes")
      .select("id,branch_id,academic_year_id,grade_id,section_id")
      .eq("school_id", user.schoolId)
      .is("deleted_at", null)
  ]);

  for (const result of [branches, academicYears, grades, sections, subjects, classes]) {
    if (result.error) {
      raise(result.error, "Unable to load setup data.");
    }
  }

  return {
    branches: branchFilter ? (branches.data ?? []).filter((branch) => branch.id === branchFilter) : branches.data ?? [],
    academicYears: academicYears.data ?? [],
    grades: grades.data ?? [],
    sections: branchFilter ? (sections.data ?? []).filter((section) => section.branch_id === branchFilter) : sections.data ?? [],
    subjects: subjects.data ?? [],
    classes: branchFilter ? (classes.data ?? []).filter((klass) => klass.branch_id === branchFilter) : classes.data ?? []
  };
}

export async function createBranch(user: SchoolScopedStaffUser, input: CreateBranchInput) {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from("branches")
    .insert({
      school_id: user.schoolId,
      name: input.name.trim(),
      address: optionalText(input.address),
      timezone: input.timezone,
      currency: input.currency.toUpperCase(),
      phone: optionalText(input.phone),
      email: optionalText(input.email),
      principal_name: optionalText(input.principalName),
      created_by: user.staffId,
      updated_by: user.staffId
    })
    .select("id,name")
    .single();

  if (error || !data) {
    raise(error, "Unable to create branch.");
  }

  return data;
}

export async function createAcademicYear(user: SchoolScopedStaffUser, input: CreateAcademicYearInput) {
  const supabase = requireAdminClient();

  if (input.isCurrent) {
    const { error: updateError } = await supabase
      .from("academic_years")
      .update({ is_current: false, updated_by: user.staffId })
      .eq("school_id", user.schoolId)
      .is("deleted_at", null);

    if (updateError) {
      raise(updateError, "Unable to clear current academic year.");
    }
  }

  const { data, error } = await supabase
    .from("academic_years")
    .insert({
      school_id: user.schoolId,
      label: input.label.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      is_current: input.isCurrent,
      created_by: user.staffId,
      updated_by: user.staffId
    })
    .select("id,label,start_date,end_date,is_current")
    .single();

  if (error || !data) {
    raise(error, "Unable to create academic year.");
  }

  return data;
}

export async function createGrade(user: SchoolScopedStaffUser, input: CreateGradeInput) {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from("grades")
    .insert({
      school_id: user.schoolId,
      label: input.label.trim(),
      sort_order: input.sortOrder
    })
    .select("id,label,sort_order")
    .single();

  if (error || !data) {
    raise(error, "Unable to create grade.");
  }

  return data;
}

export async function createSection(user: SchoolScopedStaffUser, input: CreateSectionInput) {
  assertBranchAccess(user, input.branchId);

  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from("sections")
    .insert({
      school_id: user.schoolId,
      branch_id: input.branchId,
      label: input.label.trim()
    })
    .select("id,branch_id,label")
    .single();

  if (error || !data) {
    raise(error, "Unable to create section.");
  }

  return data;
}

export async function createSubject(user: SchoolScopedStaffUser, input: CreateSubjectInput) {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from("subjects")
    .insert({
      school_id: user.schoolId,
      name: input.name.trim(),
      subject_code: optionalText(input.subjectCode),
      display_order: input.displayOrder,
      is_optional: input.isOptional
    })
    .select("id,name,subject_code,display_order,is_optional")
    .single();

  if (error || !data) {
    raise(error, "Unable to create subject.");
  }

  return data;
}

export async function createClass(user: SchoolScopedStaffUser, input: CreateClassInput) {
  assertBranchAccess(user, input.branchId);

  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({
      school_id: user.schoolId,
      branch_id: input.branchId,
      academic_year_id: input.academicYearId,
      grade_id: input.gradeId,
      section_id: input.sectionId,
      created_by: user.staffId,
      updated_by: user.staffId
    })
    .select("id,branch_id,academic_year_id,grade_id,section_id")
    .single();

  if (error || !data) {
    raise(error, "Unable to create class.");
  }

  return data;
}
