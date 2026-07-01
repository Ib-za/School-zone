import { TRPCError } from "@trpc/server";
import type { CreateStudentInput } from "@elate/shared";
import { assertBranchAccess, type SchoolScopedStaffUser } from "../authz";
import { createSupabaseAdminClient } from "../supabase";

function requireAdminClient() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "SUPABASE_SECRET_KEY is required for student setup operations."
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

function createQrIdentifier(schoolId: string, admissionNumber: string) {
  return `${schoolId}:${admissionNumber.trim()}`;
}

export async function listStudents(user: SchoolScopedStaffUser) {
  const supabase = requireAdminClient();
  const query = supabase
    .from("students")
    .select("id,school_id,branch_id,class_id,admission_number,full_name,dob,gender,roll_number,transport_required,hostel_required")
    .eq("school_id", user.schoolId)
    .is("deleted_at", null)
    .order("full_name");

  if (user.role === "branch_admin" && user.branchId) {
    query.eq("branch_id", user.branchId);
  }

  const { data, error } = await query;

  if (error) {
    raise(error, "Unable to load students.");
  }

  return data ?? [];
}

export async function createStudent(user: SchoolScopedStaffUser, input: CreateStudentInput) {
  assertBranchAccess(user, input.branchId);

  const supabase = requireAdminClient();
  let createdAuthUserId: string | null = null;
  let createdStudentId: string | null = null;

  try {
    const { data: klass, error: classError } = await supabase
      .from("classes")
      .select("id,school_id,branch_id")
      .eq("id", input.classId)
      .eq("school_id", user.schoolId)
      .eq("branch_id", input.branchId)
      .maybeSingle();

    if (classError) {
      raise(classError, "Unable to validate class.");
    }

    if (!klass) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Class does not belong to the selected branch and school."
      });
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .insert({
        school_id: user.schoolId,
        branch_id: input.branchId,
        class_id: input.classId,
        admission_number: input.admissionNumber.trim(),
        qr_identifier: createQrIdentifier(user.schoolId, input.admissionNumber),
        full_name: input.fullName.trim(),
        dob: input.dob ?? null,
        gender: input.gender ?? null,
        previous_school: optionalText(input.previousSchool),
        admission_date: input.admissionDate ?? null,
        nationality: optionalText(input.nationality),
        mother_tongue: optionalText(input.motherTongue),
        government_id_number: optionalText(input.governmentIdNumber),
        emis_number: optionalText(input.emisNumber),
        roll_number: optionalText(input.rollNumber),
        transport_required: input.transportRequired,
        hostel_required: input.hostelRequired,
        created_by: user.staffId,
        updated_by: user.staffId
      })
      .select("id,full_name")
      .single();

    if (studentError || !student) {
      raise(studentError, "Unable to create student.");
    }

    createdStudentId = student.id;

    let parentAuthUserId = input.parent.authUserId ?? null;

    if (input.parent.mode === "create") {
      const { data: authUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: input.parent.email,
        password: input.parent.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.parent.fullName.trim()
        },
        app_metadata: {
          role: "parent",
          school_id: user.schoolId
        }
      });

      if (createUserError || !authUser.user) {
        throw new TRPCError({
          code: "CONFLICT",
          message: createUserError?.message ?? "Unable to create parent auth user."
        });
      }

      parentAuthUserId = authUser.user.id;
      createdAuthUserId = authUser.user.id;
    }

    if (!parentAuthUserId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Parent auth user ID is required."
      });
    }

    const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(parentAuthUserId);

    if (authUserError || !authUser.user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: authUserError?.message ?? "Parent Auth user was not found."
      });
    }

    const { data: existingParent, error: existingParentError } = await supabase
      .from("parents")
      .select("id,primary_school_id")
      .eq("auth_user_id", parentAuthUserId)
      .maybeSingle();

    if (existingParentError) {
      raise(existingParentError, "Unable to inspect existing parent.");
    }

    if (existingParent?.primary_school_id && existingParent.primary_school_id !== user.schoolId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This parent is already associated with another primary school."
      });
    }

    const parentPayload = {
      auth_user_id: parentAuthUserId,
      primary_school_id: user.schoolId,
      full_name: input.parent.fullName.trim(),
      contact_email: input.parent.email,
      contact_phone: optionalText(input.parent.contactPhone)
    };

    const parentWrite = existingParent
      ? supabase.from("parents").update(parentPayload).eq("id", existingParent.id).select("id").single()
      : supabase.from("parents").insert(parentPayload).select("id").single();
    const { data: parent, error: parentError } = await parentWrite;

    if (parentError || !parent) {
      raise(parentError, "Unable to write parent profile.");
    }

    const { error: linkError } = await supabase.from("parent_student_links").insert({
      school_id: user.schoolId,
      parent_id: parent.id,
      student_id: student.id,
      relation: input.parent.relation,
      is_primary_contact: input.parent.isPrimaryContact,
      pickup_allowed: input.parent.pickupAllowed,
      is_emergency_contact: input.parent.isEmergencyContact
    });

    if (linkError) {
      raise(linkError, "Unable to link parent to student.");
    }

    const { error: metadataError } = await supabase.auth.admin.updateUserById(parentAuthUserId, {
      app_metadata: {
        ...authUser.user.app_metadata,
        role: "parent",
        school_id: user.schoolId,
        parent_id: parent.id
      },
      user_metadata: {
        ...authUser.user.user_metadata,
        full_name: input.parent.fullName.trim()
      }
    });

    if (metadataError) {
      raise(metadataError, "Unable to update parent auth metadata.");
    }

    return {
      studentId: student.id,
      parentId: parent.id,
      parentAuthUserId
    };
  } catch (error) {
    if (createdStudentId) {
      await supabase.from("students").delete().eq("id", createdStudentId).then(() => undefined);
    }

    if (createdAuthUserId) {
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined);
    }

    throw error;
  }
}
