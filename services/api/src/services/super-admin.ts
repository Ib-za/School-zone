import { TRPCError } from "@trpc/server";
import {
  type SuperAdminAssociateStaffInput,
  type SuperAdminOnboardSchoolInput
} from "@elate/shared";
import { createSupabaseAdminClient } from "../supabase";

type SchoolSummary = {
  id: string;
  name: string;
  branches: Array<{
    id: string;
    name: string;
  }>;
};

function requireAdminClient() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "SUPABASE_SECRET_KEY is required for Super Admin onboarding."
    });
  }

  return supabase;
}

function cleanOptional(value?: string) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

async function upsertStaffAssociation(input: SuperAdminAssociateStaffInput) {
  const supabase = requireAdminClient();
  const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(input.authUserId);

  if (authUserError || !authUser.user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: authUserError?.message ?? "Auth user was not found."
    });
  }

  const { data: existingStaff, error: existingStaffError } = await supabase
    .from("staff")
    .select("id")
    .eq("auth_user_id", input.authUserId)
    .maybeSingle();

  if (existingStaffError) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: existingStaffError.message
    });
  }

  const staffPayload = {
    auth_user_id: input.authUserId,
    school_id: input.schoolId,
    branch_id: input.branchId,
    role: input.role,
    employee_code: cleanOptional(input.employeeCode),
    full_name: input.fullName.trim(),
    contact_email: cleanOptional(input.email),
    contact_phone: cleanOptional(input.contactPhone),
    metadata: {
      source: "super_admin_onboarding"
    }
  };

  const staffWrite = existingStaff
    ? supabase.from("staff").update(staffPayload).eq("id", existingStaff.id).select("id").single()
    : supabase.from("staff").insert(staffPayload).select("id").single();
  const { data: staff, error: staffError } = await staffWrite;

  if (staffError || !staff) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: staffError?.message ?? "Unable to write staff association."
    });
  }

  const { error: metadataError } = await supabase.auth.admin.updateUserById(input.authUserId, {
    app_metadata: {
      ...authUser.user.app_metadata,
      role: input.role,
      school_id: input.schoolId,
      branch_id: input.branchId,
      staff_id: staff.id
    },
    user_metadata: {
      ...authUser.user.user_metadata,
      full_name: input.fullName.trim()
    }
  });

  if (metadataError) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: metadataError.message
    });
  }

  return {
    staffId: staff.id,
    authUserId: input.authUserId,
    role: input.role,
    schoolId: input.schoolId,
    branchId: input.branchId
  };
}

export async function listOnboardedSchools(): Promise<SchoolSummary[]> {
  const supabase = requireAdminClient();
  const { data: schools, error } = await supabase
    .from("schools")
    .select("id,name,branches(id,name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message
    });
  }

  return (schools ?? []).map((school) => ({
    id: school.id,
    name: school.name,
    branches: school.branches ?? []
  }));
}

export async function associateStaffUser(input: SuperAdminAssociateStaffInput) {
  return upsertStaffAssociation(input);
}

export async function onboardSchool(input: SuperAdminOnboardSchoolInput) {
  const supabase = requireAdminClient();
  let createdSchoolId: string | null = null;
  let createdAuthUserId: string | null = null;

  try {
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .insert({
        name: input.school.name.trim(),
        subscription_tier: input.school.subscriptionTier.trim()
      })
      .select("id,name")
      .single();

    if (schoolError || !school) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: schoolError?.message ?? "Unable to create school."
      });
    }

    createdSchoolId = school.id;

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .insert({
        school_id: school.id,
        name: input.branch.name.trim(),
        address: cleanOptional(input.branch.address),
        timezone: input.branch.timezone,
        currency: input.branch.currency.toUpperCase(),
        phone: cleanOptional(input.branch.phone),
        email: cleanOptional(input.branch.email),
        principal_name: cleanOptional(input.branch.principalName)
      })
      .select("id,name")
      .single();

    if (branchError || !branch) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: branchError?.message ?? "Unable to create branch."
      });
    }

    const { data: academicYear, error: academicYearError } = await supabase
      .from("academic_years")
      .insert({
        school_id: school.id,
        label: input.academicYear.label.trim(),
        start_date: input.academicYear.startDate,
        end_date: input.academicYear.endDate,
        is_current: true
      })
      .select("id,label")
      .single();

    if (academicYearError || !academicYear) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: academicYearError?.message ?? "Unable to create academic year."
      });
    }

    let authUserId = input.admin.authUserId ?? null;

    if (input.admin.mode === "create") {
      const { data: authUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: input.admin.email,
        password: input.admin.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.admin.fullName.trim()
        },
        app_metadata: {
          role: "school_admin",
          school_id: school.id,
          branch_id: branch.id
        }
      });

      if (createUserError || !authUser.user) {
        throw new TRPCError({
          code: "CONFLICT",
          message: createUserError?.message ?? "Unable to create admin auth user."
        });
      }

      authUserId = authUser.user.id;
      createdAuthUserId = authUser.user.id;
    }

    if (!authUserId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Admin auth user ID is required."
      });
    }

    const association = await upsertStaffAssociation({
      authUserId,
      schoolId: school.id,
      branchId: branch.id,
      role: "school_admin",
      email: input.admin.email,
      fullName: input.admin.fullName,
      employeeCode: input.admin.employeeCode,
      contactPhone: input.admin.contactPhone
    });

    return {
      school,
      branch,
      academicYear,
      admin: association
    };
  } catch (error) {
    if (createdAuthUserId) {
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined);
    }

    if (createdSchoolId) {
      await supabase.from("schools").delete().eq("id", createdSchoolId);
    }

    throw error;
  }
}
