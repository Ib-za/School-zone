import { TRPCError } from "@trpc/server";
import type { CreateStaffInput } from "@elate/shared";
import { assertBranchAccess, type SchoolScopedStaffUser } from "../authz";
import { createSupabaseAdminClient } from "../supabase";

function requireAdminClient() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "SUPABASE_SECRET_KEY is required for staff setup operations."
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

export async function listStaff(user: SchoolScopedStaffUser) {
  const supabase = requireAdminClient();
  const query = supabase
    .from("staff")
    .select("id,auth_user_id,school_id,branch_id,role,employee_code,full_name,contact_email,contact_phone,employment_status")
    .eq("school_id", user.schoolId)
    .is("deleted_at", null)
    .order("full_name");

  if (user.role === "branch_admin") {
    if (!user.branchId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Branch admin is missing branch_id claim."
      });
    }

    query.eq("branch_id", user.branchId);
  }

  const { data, error } = await query;

  if (error) {
    raise(error, "Unable to load staff.");
  }

  return data ?? [];
}

export async function createStaff(user: SchoolScopedStaffUser, input: CreateStaffInput) {
  assertBranchAccess(user, input.branchId);

  const supabase = requireAdminClient();
  let authUserId = input.authUserId ?? null;
  let createdAuthUserId: string | null = null;

  try {
    if (input.mode === "create") {
      const { data: authUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.fullName.trim()
        },
        app_metadata: {
          role: input.role,
          school_id: user.schoolId,
          branch_id: input.branchId
        }
      });

      if (createUserError || !authUser.user) {
        throw new TRPCError({
          code: "CONFLICT",
          message: createUserError?.message ?? "Unable to create staff auth user."
        });
      }

      authUserId = authUser.user.id;
      createdAuthUserId = authUser.user.id;
    }

    if (!authUserId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Staff auth user ID is required."
      });
    }

    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(authUserId);

    if (authUserError || !authUser.user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: authUserError?.message ?? "Auth user was not found."
      });
    }

    const { data: existingStaff, error: existingStaffError } = await supabase
      .from("staff")
      .select("id,school_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (existingStaffError) {
      raise(existingStaffError, "Unable to inspect existing staff.");
    }

    if (existingStaff && existingStaff.school_id !== user.schoolId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This Auth user is already associated with another school."
      });
    }

    const staffPayload = {
      auth_user_id: authUserId,
      school_id: user.schoolId,
      branch_id: input.branchId,
      role: input.role,
      employee_code: optionalText(input.employeeCode),
      full_name: input.fullName.trim(),
      contact_email: input.email,
      contact_phone: optionalText(input.contactPhone),
      department_id: input.departmentId ?? null,
      designation_id: input.designationId ?? null,
      joining_date: input.joiningDate ?? null,
      qualifications: optionalText(input.qualifications),
      experience_notes: optionalText(input.experienceNotes),
      updated_by: user.staffId,
      created_by: user.staffId,
      metadata: {
        source: "school_admin_staff_setup"
      }
    };

    const staffWrite = existingStaff
      ? supabase.from("staff").update(staffPayload).eq("id", existingStaff.id).select("id,role,branch_id").single()
      : supabase.from("staff").insert(staffPayload).select("id,role,branch_id").single();
    const { data: staff, error: staffError } = await staffWrite;

    if (staffError || !staff) {
      raise(staffError, "Unable to write staff.");
    }

    const { error: metadataError } = await supabase.auth.admin.updateUserById(authUserId, {
      app_metadata: {
        ...authUser.user.app_metadata,
        role: input.role,
        school_id: user.schoolId,
        branch_id: input.branchId,
        staff_id: staff.id
      },
      user_metadata: {
        ...authUser.user.user_metadata,
        full_name: input.fullName.trim()
      }
    });

    if (metadataError) {
      raise(metadataError, "Unable to update staff auth metadata.");
    }

    return {
      id: staff.id,
      authUserId,
      role: staff.role,
      branchId: staff.branch_id
    };
  } catch (error) {
    if (createdAuthUserId) {
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined);
    }

    throw error;
  }
}
