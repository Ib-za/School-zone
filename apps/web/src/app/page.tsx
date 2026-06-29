import { adminRoles } from "../roles";

export default function AdminHome() {
  return (
    <main>
      <section className="shell">
        <div className="panel">
          <p>Elate Admin</p>
          <h1>School operations console</h1>
          <p>Role-gated workspace for {adminRoles.join(" and ")} users.</p>
        </div>
      </section>
    </main>
  );
}
