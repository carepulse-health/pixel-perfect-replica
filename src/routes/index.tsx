import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, ArrowUpRight, CalendarDays, Clock3, HeartPulse, RefreshCw, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { getClinicDashboard } from "@/lib/carepulse.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CarePulse | Clinic dashboard" },
      { name: "description", content: "A live overview of clinic patients, appointments, reminders, and urgent alerts." },
      { property: "og:title", content: "CarePulse | Clinic dashboard" },
      { property: "og:description", content: "A live overview of clinic patients, appointments, reminders, and urgent alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string | null;
  patient_name: string;
  doctor_name: string | null;
  clinic_name: string;
};

type TriageAlert = {
  id: string;
  priority_level: string;
  review_status: string | null;
  created_at: string | null;
  patient_name: string;
};

type Notice = {
  id: string;
  title: string;
  message: string;
  notification_type: string | null;
  is_read: boolean | null;
  created_at: string | null;
};

function Dashboard() {
  const fetchDashboard = useServerFn(getClinicDashboard);
  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: ["carepulse-dashboard"],
    queryFn: () => fetchDashboard(),
    refetchInterval: 60_000,
    retry: false,
  });

  const now = new Date();
  const upcomingAppointments = ((data?.appointments ?? []) as Appointment[])
    .filter((appointment) => appointmentTimestamp(appointment) >= now.getTime())
    .sort((first, second) => appointmentTimestamp(first) - appointmentTimestamp(second));
  const activeAlerts = ((data?.triage ?? []) as TriageAlert[]).filter((alert) =>
    alert.review_status !== "reviewed" && /urgent|high|emergency|critical/i.test(alert.priority_level),
  );
  const emergencyNotices = ((data?.notifications ?? []) as Notice[]).filter((notice) =>
    !notice.is_read && /emergency|urgent|critical/i.test(`${notice.notification_type ?? ""} ${notice.title}`),
  );
  const emergencyCount = activeAlerts.length + emergencyNotices.length;
  const clinicName = data?.clinics?.[0]?.name;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <HeartPulse aria-hidden="true" className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">CarePulse</p>
              <p className="truncate text-sm text-muted-foreground">{clinicName ?? "Clinic overview"}</p>
            </div>
          </div>
          <Button variant="outline" size="icon" aria-label="Refresh dashboard" title="Refresh dashboard" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "animate-spin" : ""} aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-primary">{formatToday()}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">Clinic dashboard</h1>
            <p className="mt-2 text-sm text-muted-foreground">A clear view of care happening today.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            Live clinic data
          </div>
        </section>

        {error ? (
          <section className="mb-6 flex flex-col gap-4 border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <div>
              <h2 className="font-semibold">Dashboard data unavailable</h2>
              <p className="mt-1 text-sm text-muted-foreground">Please sign in with clinic staff access and try again.</p>
            </div>
            <Button variant="outline" onClick={() => void refetch()}>Try again</Button>
          </section>
        ) : null}

        <section aria-label="Clinic summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <SummaryCard icon={<Users aria-hidden="true" />} label="Patients" value={isPending ? null : data?.stats.patients ?? 0} detail="Registered with your clinic" tone="teal" />
          <SummaryCard icon={<CalendarDays aria-hidden="true" />} label="Upcoming appointments" value={isPending ? null : upcomingAppointments.length} detail="Scheduled from now onward" tone="blue" />
          <SummaryCard icon={<AlertTriangle aria-hidden="true" />} label="Active alerts" value={isPending ? null : emergencyCount} detail="Needs prompt attention" tone="rose" />
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section aria-labelledby="reminders-title" className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 id="reminders-title" className="text-lg font-semibold">Upcoming reminders</h2>
                <p className="mt-1 text-sm text-muted-foreground">The next appointments on your schedule</p>
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">{upcomingAppointments.length} scheduled</span>
            </div>
            <div className="divide-y divide-border border-y border-border bg-card">
              {isPending ? (
                <LoadingRows />
              ) : upcomingAppointments.length ? (
                upcomingAppointments.slice(0, 8).map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} />)
              ) : (
                <EmptyState icon={<CalendarDays aria-hidden="true" />} title="No upcoming appointments" description="New appointments will appear here when they are scheduled." />
              )}
            </div>
          </section>

          <section aria-labelledby="alerts-title" className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 id="alerts-title" className="text-lg font-semibold">Emergency alerts</h2>
                <p className="mt-1 text-sm text-muted-foreground">Urgent items requiring staff attention</p>
              </div>
              {emergencyCount > 0 ? <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-destructive/10 px-2 py-1 text-sm font-semibold text-destructive">{emergencyCount}</span> : null}
            </div>
            <div className="divide-y divide-border border-y border-border bg-card">
              {isPending ? (
                <LoadingRows />
              ) : emergencyCount ? (
                <div className="divide-y divide-border">
                  {activeAlerts.map((alert) => (
                    <AlertRow key={alert.id} title={`${alert.priority_level} triage`} description={`Patient: ${alert.patient_name}`} timestamp={alert.created_at} />
                  ))}
                  {emergencyNotices.map((notice) => (
                    <AlertRow key={notice.id} title={notice.title} description={notice.message} timestamp={notice.created_at} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<Activity aria-hidden="true" />} title="No active emergency alerts" description="Urgent clinic alerts will appear here as they arrive." />
              )}
            </div>
          </section>
        </div>

        {!isPending && data?.clinics.length === 0 && !error ? (
          <p className="mt-6 border border-border bg-accent/40 px-4 py-3 text-sm text-muted-foreground">No clinic is linked to this account yet. Clinic activity will appear when access is set up.</p>
        ) : null}
      </div>
    </main>
  );
}

function SummaryCard({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: number | null; detail: string; tone: "teal" | "blue" | "rose" }) {
  const iconTone = tone === "teal" ? "bg-primary/10 text-primary" : tone === "blue" ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive";
  return (
    <div className="flex min-h-36 items-start justify-between gap-3 border border-border bg-card p-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {value === null ? <div className="mt-3 h-9 w-16 animate-pulse rounded bg-muted" aria-label="Loading" /> : <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>{icon}</span>
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  return (
    <article className="flex items-center gap-4 px-4 py-4 sm:px-5">
      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-accent/70 text-accent-foreground">
        <CalendarDays aria-hidden="true" className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{appointment.patient_name}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{appointment.doctor_name ? `Dr. ${appointment.doctor_name}` : appointment.clinic_name}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium">{formatAppointmentDate(appointment)}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" />{formatAppointmentTime(appointment)}</p>
      </div>
      <ArrowUpRight aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block" />
    </article>
  );
}

function AlertRow({ title, description, timestamp }: { title: string; description: string; timestamp: string | null }) {
  return (
    <article className="flex gap-3 px-4 py-4 sm:px-5">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><AlertTriangle aria-hidden="true" className="size-5" /></span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {timestamp ? <p className="mt-2 text-xs text-muted-foreground">{formatRelativeTime(timestamp)}</p> : null}
      </div>
    </article>
  );
}

function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">{icon}</span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div aria-label="Loading records" className="space-y-4 px-5 py-5">
      {[0, 1, 2].map((item) => <div key={item} className="flex items-center gap-4"><div className="size-10 animate-pulse rounded-lg bg-muted" /><div className="flex-1 space-y-2"><div className="h-3 w-2/5 animate-pulse rounded bg-muted" /><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /></div></div>)}
    </div>
  );
}

function appointmentTimestamp(appointment: Appointment) {
  return new Date(`${appointment.appointment_date}T${appointment.appointment_time}+01:00`).getTime();
}

function formatToday() {
  return new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(new Date());
}

function formatAppointmentDate(appointment: Appointment) {
  const date = new Date(`${appointment.appointment_date}T${appointment.appointment_time}+01:00`);
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const isToday = dateKey === todayKey;
  return isToday ? "Today" : new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(date);
}

function formatAppointmentTime(appointment: Appointment) {
  const date = new Date(`${appointment.appointment_date}T${appointment.appointment_time}+01:00`);
  return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(date);
}

function formatRelativeTime(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}