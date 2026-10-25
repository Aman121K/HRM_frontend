import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { employees } from "@/lib/org-data";

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = employees[id];
  if (!employee) notFound();

  const departmentClass = `dept-${employee.department.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <AppShell>
      <main className="profile-page">
        <Link className="profile-back" href="/directory/organization-chart">
          <ArrowLeft size={15} /> Back to organization chart
        </Link>

        <section className={`profile-hero ${departmentClass}`}>
          <span className="profile-monogram" aria-hidden="true">{employee.initials}</span>
          <div className="profile-identity">
            <p className="eyebrow">EMPLOYEE PROFILE · {employee.department}</p>
            <h1>{employee.name}</h1>
            <p>{employee.title}</p>
            <em className={`profile-presence ${employee.status.toLowerCase()}`}>{employee.status}</em>
          </div>
          <a className="profile-email-action" href={`mailto:${employee.email}`}>
            <Mail size={16} /> Send email
          </a>
        </section>

        <div className="profile-layout">
          <section className="profile-section profile-work">
            <p className="eyebrow">ORGANIZATION</p>
            <h2>Work information</h2>
            <dl>
              <div><dt>Department</dt><dd>{employee.department}</dd></div>
              <div><dt>Location</dt><dd><MapPin size={14} />{employee.location}</dd></div>
              <div>
                <dt>Manager</dt>
                <dd>{employee.managerId ? <Link href={`/people/${employee.managerId}`}>{employees[employee.managerId].name}<ArrowUpRight size={13} /></Link> : "Board of Directors"}</dd>
              </div>
              <div><dt>Direct reports</dt><dd>{employee.reports.length}</dd></div>
            </dl>
          </section>

          <aside className="profile-section profile-aside">
            <div className="profile-contact">
              <p className="eyebrow">GET IN TOUCH</p>
              <h2>Contact</h2>
              <a href={`mailto:${employee.email}`}><Mail size={15} /><span>{employee.email}</span></a>
              <a href={`tel:${employee.phone}`}><Phone size={15} /><span>{employee.phone}</span></a>
            </div>
            {employee.reports.length > 0 && (
              <div className="profile-team">
                <p className="eyebrow">REPORTING TO {employee.name.split(" ")[0].toUpperCase()}</p>
                <h2>Team</h2>
                {employee.reports.map((reportId) => (
                  <Link className="profile-report" key={reportId} href={`/people/${reportId}`}>
                    <span>{employees[reportId].initials}</span>
                    <strong>{employees[reportId].name}<small>{employees[reportId].title}</small></strong>
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
