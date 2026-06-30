import { phase1Modules, phase1TableNames, type Phase1TableName } from "@elate/shared";
import { getApiEnv, getMissingSupabaseEnv } from "../env";
import { createSupabaseAdminClient, createSupabasePublicClient } from "../supabase";

type TableCheck = {
  table: Phase1TableName;
  reachable: boolean;
  count: number | null;
  error: string | null;
};

type Phase1StatusOptions = {
  accessToken?: string;
  useServiceRole?: boolean;
};

export async function getPhase1SystemStatus(options: Phase1StatusOptions = {}) {
  const env = getApiEnv();
  const missingEnv = getMissingSupabaseEnv(env);

  if (missingEnv.length > 0) {
    return {
      ok: false,
      missingEnv,
      database: {
        connected: false,
        checkedWith: "none" as const,
        tables: [] as TableCheck[]
      },
      modules: phase1Modules
    };
  }

  const adminClient = options.useServiceRole ? createSupabaseAdminClient() : null;
  const client = adminClient ?? createSupabasePublicClient(options.accessToken);
  const checkedWith = adminClient ? "service_role" : options.accessToken ? "user_jwt" : "anon";

  const tables = await Promise.all(
    phase1TableNames.map(async (table) => {
      const { count, error } = await client.from(table).select("*", {
        count: "exact",
        head: true
      });

      return {
        table,
        reachable: !error,
        count: count ?? null,
        error: error?.message ?? null
      } satisfies TableCheck;
    })
  );

  return {
    ok: tables.every((table) => table.reachable),
    missingEnv,
    database: {
      connected: tables.some((table) => table.reachable),
      checkedWith,
      tables
    },
    modules: phase1Modules
  };
}

export async function getPhase1AdminSnapshot(accessToken?: string) {
  const status = await getPhase1SystemStatus({
    accessToken
  });
  const countsByTable = Object.fromEntries(
    status.database.tables.map((table) => [table.table, table.count ?? 0])
  ) as Partial<Record<Phase1TableName, number>>;

  return {
    databaseConnected: status.database.connected,
    checkedWith: status.database.checkedWith,
    counts: {
      schools: countsByTable.schools ?? 0,
      branches: countsByTable.branches ?? 0,
      academicYears: countsByTable.academic_years ?? 0,
      classes: countsByTable.classes ?? 0,
      staff: countsByTable.staff ?? 0,
      students: countsByTable.students ?? 0,
      announcements: countsByTable.announcements ?? 0,
      pendingFeeInstallments: countsByTable.fee_installments ?? 0,
      customFields: countsByTable.custom_field_definitions ?? 0
    },
    modules: phase1Modules
  };
}
