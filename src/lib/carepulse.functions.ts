import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emptyData = {
  clinics: [],
  appointments: [],
  patients: [],
  triage: [],
  notifications: [],
  runs: [],
  stats: { workflows: 7, active: 4, successful: 0, failed: 0, pendingNotifications: 0, appointments: 0, triage: 0, patients: 0 },
};

export const getClinicDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: memberships, error: membershipError } = await context.supabase
      .from("clinic_members")
      .select("clinic_id, role")
      .eq("user_id", context.userId);

    if (membershipError) throw new Error("Unable to check clinic membership.");
    if (!memberships?.length) return { ...emptyData, clinics: [] };

    const clinicIds = memberships.map((membership) => membership.clinic_id);
    const [clinicsResult, appointmentsCount, patientCount, triageCount, successfulCount, failedCount, pendingCount,
      appointmentsResult, patientsResult, triageResult, notificationsResult, runsResult] = await Promise.all([
      context.supabase.from("clinics").select("id, name, address, phone, email").in("id", clinicIds),
      context.supabase.from("appointments").select("id", { count: "exact", head: true }).in("clinic_id", clinicIds),
      context.supabase.from("patients").select("id", { count: "exact", head: true }).in("clinic_id", clinicIds),
      context.supabase.from("triage_records").select("id", { count: "exact", head: true }).in("clinic_id", clinicIds),
      context.supabase.from("automation_runs").select("id", { count: "exact", head: true }).in("clinic_id", clinicIds).eq("status", "success"),
      context.supabase.from("automation_runs").select("id", { count: "exact", head: true }).in("clinic_id", clinicIds).eq("status", "failed"),
      context.supabase.from("notifications").select("id", { count: "exact", head: true }).in("clinic_id", clinicIds).eq("is_read", false),
      context.supabase.from("appointments").select("id, clinic_id, patient_id, doctor_id, appointment_date, appointment_time, status, created_at").in("clinic_id", clinicIds).order("appointment_date", { ascending: false }).limit(12),
      context.supabase.from("patients").select("id, clinic_id, full_name, phone, email, created_at").in("clinic_id", clinicIds).order("created_at", { ascending: false }).limit(40),
      context.supabase.from("triage_records").select("id, clinic_id, patient_id, priority_level, review_status, created_at, reviewed_by").in("clinic_id", clinicIds).order("created_at", { ascending: false }).limit(20),
      context.supabase.from("notifications").select("id, clinic_id, patient_id, title, message, notification_type, is_read, created_at").in("clinic_id", clinicIds).order("created_at", { ascending: false }).limit(20),
      context.supabase.from("automation_runs").select("id, clinic_id, workflow_name, status, related_reference, error_message, created_at, completed_at").in("clinic_id", clinicIds).order("created_at", { ascending: false }).limit(40),
    ]);

    const results = [clinicsResult, appointmentsCount, patientCount, triageCount, successfulCount, failedCount, pendingCount,
      appointmentsResult, patientsResult, triageResult, notificationsResult, runsResult];
    if (results.some((result) => result.error)) throw new Error("Some CarePulse records could not be loaded.");

    const appointments = appointmentsResult.data ?? [];
    const patientIds = [...new Set([
      ...(patientsResult.data ?? []).map((patient) => patient.id),
      ...appointments.map((appointment) => appointment.patient_id),
      ...(triageResult.data ?? []).map((entry) => entry.patient_id),
      ...(notificationsResult.data ?? []).flatMap((notification) => notification.patient_id ? [notification.patient_id] : []),
    ])];
    const doctorIds = [...new Set(appointments.flatMap((appointment) => appointment.doctor_id ? [appointment.doctor_id] : []))];
    const [patientDetails, doctorsResult] = await Promise.all([
      patientIds.length
        ? context.supabase.from("patients").select("id, full_name, phone, email").in("id", patientIds)
        : Promise.resolve({ data: [], error: null }),
      doctorIds.length
        ? context.supabase.from("doctors").select("id, full_name").in("id", doctorIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (patientDetails.error || doctorsResult.error) throw new Error("Related patient records could not be loaded.");

    const patientById = new Map((patientDetails.data ?? []).map((patient) => [patient.id, patient]));
    const doctorById = new Map((doctorsResult.data ?? []).map((doctor) => [doctor.id, doctor.full_name]));
    const patientName = (id: string) => patientById.get(id)?.full_name ?? "Patient record unavailable";

    return {
      clinics: (clinicsResult.data ?? []).map((clinic) => ({
        ...clinic,
        role: memberships.find((membership) => membership.clinic_id === clinic.id)?.role ?? "staff",
      })),
      appointments: appointments.map((appointment) => ({
        ...appointment,
        patient_name: patientName(appointment.patient_id),
        patient_phone: patientById.get(appointment.patient_id)?.phone ?? null,
        doctor_name: appointment.doctor_id ? doctorById.get(appointment.doctor_id) ?? null : null,
        clinic_name: clinicsResult.data?.find((clinic) => clinic.id === appointment.clinic_id)?.name ?? "Clinic",
      })),
      patients: (patientsResult.data ?? []).map((patient) => ({ ...patient, role: undefined })),
      triage: (triageResult.data ?? []).map((entry) => ({
        ...entry,
        patient_name: patientName(entry.patient_id),
      })),
      notifications: notificationsResult.data ?? [],
      runs: runsResult.data ?? [],
      stats: {
        workflows: 7,
        active: 4,
        successful: successfulCount.count ?? 0,
        failed: failedCount.count ?? 0,
        pendingNotifications: pendingCount.count ?? 0,
        appointments: appointmentsCount.count ?? 0,
        triage: triageCount.count ?? 0,
        patients: patientCount.count ?? 0,
      },
    };
  });

export const getAppointmentPasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: memberships, error: memberError } = await context.supabase
      .from("clinic_members").select("clinic_id").eq("user_id", context.userId);
    if (memberError) throw new Error("Unable to check clinic access.");
    const clinicIds = (memberships ?? []).map((member) => member.clinic_id);
    if (!clinicIds.length) return [];

    const { data: passes, error } = await context.supabase.from("appointment_passes")
      .select("id, clinic_id, appointment_id, patient_id, reference_code, qr_code, issued_at, expires_at")
      .in("clinic_id", clinicIds).order("issued_at", { ascending: false }).limit(100);
    if (error) throw new Error("Appointment passes could not be loaded.");
    if (!passes?.length) return [];

    const appointmentIds = [...new Set(passes.map((pass) => pass.appointment_id))];
    const patientIds = [...new Set(passes.map((pass) => pass.patient_id))];
    const [appointmentResult, patientResult, clinicResult, doctorResult] = await Promise.all([
      context.supabase.from("appointments").select("id, appointment_date, appointment_time, status, doctor_id").in("id", appointmentIds),
      context.supabase.from("patients").select("id, full_name").in("id", patientIds),
      context.supabase.from("clinics").select("id, name").in("id", clinicIds),
      context.supabase.from("doctors").select("id, full_name").in("clinic_id", clinicIds),
    ]);
    if (appointmentResult.error || patientResult.error || clinicResult.error || doctorResult.error) {
      throw new Error("Appointment pass details could not be loaded.");
    }
    const appointmentsById = new Map((appointmentResult.data ?? []).map((entry) => [entry.id, entry]));
    const patientsById = new Map((patientResult.data ?? []).map((entry) => [entry.id, entry.full_name]));
    const clinicsById = new Map((clinicResult.data ?? []).map((entry) => [entry.id, entry.name]));
    const doctorsById = new Map((doctorResult.data ?? []).map((entry) => [entry.id, entry.full_name]));
    return passes.map((pass) => {
      const appointment = appointmentsById.get(pass.appointment_id);
      return {
        ...pass,
        qr_code: pass.qr_code ?? "",
        patient_name: patientsById.get(pass.patient_id) ?? "Patient record unavailable",
        clinic_name: clinicsById.get(pass.clinic_id) ?? "Clinic",
        appointment_date: appointment?.appointment_date ?? "",
        appointment_time: appointment?.appointment_time ?? "",
        doctor_name: appointment?.doctor_id ? doctorsById.get(appointment.doctor_id) ?? null : null,
        status: appointment?.status ?? "unknown",
      };
    });
  });

export const updateClinicAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appointmentId: string; status: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input.appointmentId)) throw new Error("Invalid appointment.");
    if (!new Set(["pending", "confirmed", "cancelled", "completed"]).has(input.status)) throw new Error("Invalid appointment status.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: appointment, error } = await context.supabase.from("appointments")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.appointmentId).select("id, clinic_id").maybeSingle();
    if (error || !appointment) throw new Error("You cannot update this appointment.");
    return { ok: true };
  });

export const markClinicNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { notificationId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input.notificationId)) throw new Error("Invalid notification.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error, count } = await context.supabase.from("notifications")
      .update({ is_read: true }, { count: "exact" }).eq("id", data.notificationId);
    if (error || count === 0) throw new Error("Notification could not be marked as read.");
    return { ok: true };
  });

export const reviewClinicTriage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { triageId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input.triageId)) throw new Error("Invalid triage record.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: record, error } = await context.supabase.from("triage_records")
      .update({ review_status: "reviewed", reviewed_by: context.userId })
      .eq("id", data.triageId).select("id").maybeSingle();
    if (error || !record) throw new Error("This alert could not be reviewed.");
    return { ok: true };
  });

export const verifyClinicAppointmentPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { referenceCode: string; token: string }) => {
    const referenceCode = input.referenceCode.trim();
    const token = input.token.trim();
    if (referenceCode.length < 3 || referenceCode.length > 80 || token.length < 16 || token.length > 200) {
      throw new Error("Enter a valid pass reference and QR code.");
    }
    return { referenceCode, token };
  })
  .handler(async ({ data, context }) => {
    const { data: isValid, error } = await context.supabase.rpc("verify_appointment_pass", {
      _reference_code: data.referenceCode,
      _token: data.token,
    });
    if (error) throw new Error("Pass verification is temporarily unavailable.");
    return { valid: isValid === true };
  });