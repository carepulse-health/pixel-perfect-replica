CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  workflow_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  related_reference text NOT NULL,
  trigger_key text NOT NULL UNIQUE,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY automation_runs_clinic_staff_read ON public.automation_runs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = automation_runs.clinic_id AND m.user_id = auth.uid()));

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

GRANT SELECT ON public.clinic_members TO authenticated;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinic_members_self_read ON public.clinic_members FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.clinics TO authenticated;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinics_authenticated_read ON public.clinics FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE ON public.patients TO authenticated;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY patients_self_or_clinic_staff_read ON public.patients FOR SELECT TO authenticated USING (auth_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = patients.clinic_id AND m.user_id = auth.uid()));
CREATE POLICY patients_self_register ON public.patients FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY patients_self_or_clinic_staff_update ON public.patients FOR UPDATE TO authenticated USING (auth_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = patients.clinic_id AND m.user_id = auth.uid())) WITH CHECK (auth_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = patients.clinic_id AND m.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY appointments_patient_or_clinic_staff_read ON public.appointments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointments.patient_id AND p.auth_user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = appointments.clinic_id AND m.user_id = auth.uid()));
CREATE POLICY appointments_clinic_staff_create ON public.appointments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = appointments.clinic_id AND m.user_id = auth.uid()));
CREATE POLICY appointments_clinic_staff_update ON public.appointments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = appointments.clinic_id AND m.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = appointments.clinic_id AND m.user_id = auth.uid()));

GRANT SELECT ON public.doctors TO authenticated;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY doctors_patient_or_clinic_staff_read ON public.doctors FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = doctors.clinic_id AND m.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.appointments a JOIN public.patients p ON p.id = a.patient_id WHERE a.doctor_id = doctors.id AND p.auth_user_id = auth.uid()));

GRANT SELECT ON public.doctor_schedules TO authenticated;
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY doctor_schedules_clinic_staff_read ON public.doctor_schedules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = doctor_schedules.clinic_id AND m.user_id = auth.uid()));

GRANT SELECT ON public.clinic_settings TO authenticated;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY clinic_settings_clinic_staff_read ON public.clinic_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = clinic_settings.clinic_id AND m.user_id = auth.uid()));

GRANT SELECT, INSERT ON public.consultation_logs TO authenticated;
ALTER TABLE public.consultation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY consultation_logs_clinic_staff_read ON public.consultation_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = consultation_logs.clinic_id AND m.user_id = auth.uid()));
CREATE POLICY consultation_logs_clinic_staff_create ON public.consultation_logs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = consultation_logs.clinic_id AND m.user_id = auth.uid()));

GRANT SELECT, UPDATE (is_read) ON public.notifications TO authenticated;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_patient_or_clinic_staff_read ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR (clinic_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = notifications.clinic_id AND m.user_id = auth.uid())));
CREATE POLICY notifications_patient_or_clinic_staff_mark_read ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid()) OR (clinic_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = notifications.clinic_id AND m.user_id = auth.uid()))) WITH CHECK ((user_id = auth.uid()) OR (clinic_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = notifications.clinic_id AND m.user_id = auth.uid())));

GRANT SELECT, UPDATE (review_status, reviewed_by) ON public.triage_records TO authenticated;
ALTER TABLE public.triage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY triage_records_clinic_staff_read ON public.triage_records FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = triage_records.clinic_id AND m.user_id = auth.uid()));
CREATE POLICY triage_records_clinic_staff_review ON public.triage_records FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = triage_records.clinic_id AND m.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = triage_records.clinic_id AND m.user_id = auth.uid()) AND (reviewed_by IS NULL OR reviewed_by = auth.uid()));

CREATE UNIQUE INDEX appointment_passes_appointment_id_unique ON public.appointment_passes (appointment_id);
GRANT SELECT ON public.appointment_passes TO authenticated;
ALTER TABLE public.appointment_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY appointment_passes_patient_or_clinic_staff_read ON public.appointment_passes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointment_passes.patient_id AND p.auth_user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.clinic_members m WHERE m.clinic_id = appointment_passes.clinic_id AND m.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.carepulse_patient_registered() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_run_id uuid;
BEGIN
  INSERT INTO public.automation_runs (clinic_id, workflow_name, status, related_reference, trigger_key)
  VALUES (NEW.clinic_id, 'Patient registration', 'pending', NEW.id::text, 'patient-registration:' || NEW.id::text)
  ON CONFLICT (trigger_key) DO NOTHING RETURNING id INTO v_run_id;
  IF v_run_id IS NULL THEN RETURN NEW; END IF;
  BEGIN
    INSERT INTO public.notifications (clinic_id, user_id, patient_id, title, message, notification_type, is_read)
    VALUES (NEW.clinic_id, NEW.auth_user_id, NEW.id, 'Welcome to CarePulse', 'Your patient profile is ready with your clinic.', 'registration_welcome', false);
    UPDATE public.automation_runs SET status = 'success', completed_at = now() WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.automation_runs SET status = 'failed', error_message = SQLSTATE || ': ' || SQLERRM, completed_at = now() WHERE id = v_run_id;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.carepulse_patient_registered() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER carepulse_patient_registered AFTER INSERT ON public.patients FOR EACH ROW EXECUTE FUNCTION public.carepulse_patient_registered();

CREATE OR REPLACE FUNCTION public.carepulse_appointment_confirmed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_run_id uuid; v_patient public.patients%ROWTYPE; v_clinic public.clinics%ROWTYPE; v_doctor_name text; v_reference text; v_token text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'confirmed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'confirmed' THEN RETURN NEW; END IF;
  INSERT INTO public.automation_runs (clinic_id, workflow_name, status, related_reference, trigger_key)
  VALUES (NEW.clinic_id, 'Appointment confirmation', 'pending', NEW.id::text, 'appointment-confirmed:' || NEW.id::text)
  ON CONFLICT (trigger_key) DO NOTHING RETURNING id INTO v_run_id;
  IF v_run_id IS NULL THEN RETURN NEW; END IF;
  BEGIN
    SELECT * INTO v_patient FROM public.patients WHERE id = NEW.patient_id;
    SELECT * INTO v_clinic FROM public.clinics WHERE id = NEW.clinic_id;
    IF NEW.doctor_id IS NOT NULL THEN SELECT full_name INTO v_doctor_name FROM public.doctors WHERE id = NEW.doctor_id; END IF;
    v_reference := 'CP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    v_token := encode(gen_random_bytes(32), 'hex');
    INSERT INTO public.appointment_passes (clinic_id, appointment_id, patient_id, reference_code, qr_code)
    VALUES (NEW.clinic_id, NEW.id, NEW.patient_id, v_reference, v_token)
    ON CONFLICT (appointment_id) DO NOTHING;
    INSERT INTO public.notifications (clinic_id, user_id, patient_id, title, message, notification_type, is_read)
    VALUES (NEW.clinic_id, v_patient.auth_user_id, NEW.patient_id, 'Appointment confirmed', 'Your appointment at ' || v_clinic.name || ' on ' || to_char(NEW.appointment_date, 'Mon FMDD, YYYY') || ' at ' || to_char(NEW.appointment_time, 'FMHH12:MI AM') || ' is confirmed. Reference: ' || v_reference || '.', 'appointment_confirmed', false);
    UPDATE public.automation_runs SET status = 'success', completed_at = now() WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.automation_runs SET status = 'failed', error_message = SQLSTATE || ': ' || SQLERRM, completed_at = now() WHERE id = v_run_id;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.carepulse_appointment_confirmed() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER carepulse_appointment_confirmed_insert AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.carepulse_appointment_confirmed();
CREATE TRIGGER carepulse_appointment_confirmed_update AFTER UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.carepulse_appointment_confirmed();

CREATE OR REPLACE FUNCTION public.carepulse_triage_submitted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_run_id uuid; v_emergency boolean;
BEGIN
  INSERT INTO public.automation_runs (clinic_id, workflow_name, status, related_reference, trigger_key)
  VALUES (NEW.clinic_id, 'Triage alert', 'pending', NEW.id::text, 'triage-submitted:' || NEW.id::text)
  ON CONFLICT (trigger_key) DO NOTHING RETURNING id INTO v_run_id;
  IF v_run_id IS NULL THEN RETURN NEW; END IF;
  v_emergency := lower(trim(NEW.priority_level)) = 'emergency';
  BEGIN
    INSERT INTO public.notifications (clinic_id, title, message, notification_type, is_read)
    VALUES (NEW.clinic_id, CASE WHEN v_emergency THEN 'EMERGENCY — review triage now' ELSE 'New triage submitted' END,
      'Priority: ' || NEW.priority_level || '. AI-generated classification; clinical judgment is required. Triage record: ' || NEW.id::text,
      CASE WHEN v_emergency THEN 'triage_emergency' ELSE 'triage_alert' END, false);
    UPDATE public.automation_runs SET status = 'success', completed_at = now() WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.automation_runs SET status = 'failed', error_message = SQLSTATE || ': ' || SQLERRM, completed_at = now() WHERE id = v_run_id;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.carepulse_triage_submitted() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER carepulse_triage_submitted AFTER INSERT ON public.triage_records FOR EACH ROW EXECUTE FUNCTION public.carepulse_triage_submitted();

CREATE OR REPLACE FUNCTION public.carepulse_send_due_appointment_reminders() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_appointment record; v_run_id uuid; v_sent integer := 0; v_trigger_key text;
BEGIN
  FOR v_appointment IN
    SELECT a.id, a.clinic_id, a.patient_id, a.doctor_id, a.appointment_date, a.appointment_time,
      p.auth_user_id, p.full_name AS patient_name, c.name AS clinic_name, d.full_name AS doctor_name
    FROM public.appointments a
    JOIN public.patients p ON p.id = a.patient_id
    JOIN public.clinics c ON c.id = a.clinic_id
    LEFT JOIN public.doctors d ON d.id = a.doctor_id
    WHERE a.status = 'confirmed'
      AND a.appointment_date = (now() AT TIME ZONE 'Africa/Lagos')::date + 1
  LOOP
    v_trigger_key := 'appointment-reminder:' || v_appointment.id::text || ':' || v_appointment.appointment_date::text;
    INSERT INTO public.automation_runs (clinic_id, workflow_name, status, related_reference, trigger_key)
    VALUES (v_appointment.clinic_id, 'Appointment reminder', 'pending', v_appointment.id::text, v_trigger_key)
    ON CONFLICT (trigger_key) DO NOTHING RETURNING id INTO v_run_id;
    IF v_run_id IS NULL THEN CONTINUE; END IF;
    BEGIN
      INSERT INTO public.notifications (clinic_id, user_id, patient_id, title, message, notification_type, is_read)
      VALUES (
        v_appointment.clinic_id, v_appointment.auth_user_id, v_appointment.patient_id, 'Appointment tomorrow',
        v_appointment.patient_name || ', a reminder for your appointment at ' || v_appointment.clinic_name || ' tomorrow, ' || to_char(v_appointment.appointment_date, 'Mon FMDD, YYYY') || ' at ' || to_char(v_appointment.appointment_time, 'FMHH12:MI AM') || CASE WHEN v_appointment.doctor_name IS NOT NULL THEN ' with ' || v_appointment.doctor_name ELSE '' END || '.',
        'appointment_reminder', false
      );
      UPDATE public.automation_runs SET status = 'success', completed_at = now() WHERE id = v_run_id;
      v_sent := v_sent + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.automation_runs SET status = 'failed', error_message = SQLSTATE || ': ' || SQLERRM, completed_at = now() WHERE id = v_run_id;
    END;
  END LOOP;
  RETURN v_sent;
END;
$$;
REVOKE ALL ON FUNCTION public.carepulse_send_due_appointment_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.carepulse_send_due_appointment_reminders() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('carepulse-appointment-reminders', '0 8 * * *', 'SELECT public.carepulse_send_due_appointment_reminders()');
