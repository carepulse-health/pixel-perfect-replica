CREATE OR REPLACE FUNCTION public.verify_appointment_pass(_reference_code text, _token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointment_passes ap
    JOIN public.clinic_members cm ON cm.clinic_id = ap.clinic_id
    WHERE ap.reference_code = _reference_code
      AND ap.qr_code = _token
      AND cm.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.verify_appointment_pass(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_appointment_pass(text, text) TO authenticated;
