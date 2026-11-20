import { useEffect, useState } from 'react';
import { errMsg } from '@/lib/api';
import { patients } from '@/lib/backend';
import Select, { AutoComplete } from '@/components/ui/Select';
import { Field, Modal } from '@/components/ui';
import { PROVINCES } from '@/config/org';
import { useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import { toDayStr, todayStr } from '@/lib/dates';
import { checkForm, serverFieldErrors, useFieldErrors } from '@/lib/validation';
import { MAX, patientSchema, patientUpdateSchema } from '@shared/schemas/index.js';

const empty = () => ({ code: '', name: '', sex: 'M', age: '', diagnosis: '', province: '', dateIn: todayStr(), dateOut: '', status: 'ADMITTED', note: '' });

export default function PatientForm({ open, onClose, patient, onSaved }) {
  const { tr } = useLang();
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const { errors, setErrors } = useFieldErrors();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      patient
        ? { ...empty(), ...patient, age: patient.age ?? '', dateIn: toDayStr(patient.dateIn), dateOut: patient.dateOut ? toDayStr(patient.dateOut) : '' }
        : empty(),
    );
  }, [open, patient, setErrors]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const body = { ...form, age: form.age === '' ? null : Number(form.age), status: form.dateOut ? 'DISCHARGED' : 'ADMITTED' };
    const check = checkForm(patient ? patientUpdateSchema : patientSchema, body);
    setErrors(check.errors);
    if (!check.ok) return toast.error(check.message);
    setBusy(true);
    try {
      const data = patient ? await patients.update(patient._id, body) : await patients.create(body);
      toast(tr('បានរក្សាទុក', 'Saved'));
      onSaved?.(data);
      onClose();
    } catch (err) {
      setErrors(serverFieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? tr('កែប្រែព័ត៌មានអ្នកជំងឺ', 'Edit patient') : tr('បញ្ចូលអ្នកជំងឺថ្មី', 'New patient')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr('បោះបង់', 'Cancel')}
          </button>
          <button className="btn-primary" form="patient-form" disabled={busy}>
            {tr('រក្សាទុក', 'Save')}
          </button>
        </>
      }
    >
      <form id="patient-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field label={tr('ឈ្មោះអ្នកជំងឺ', 'Patient name')} required error={errors.name} className="sm:col-span-4">
          <input className="input" value={form.name} onChange={set('name')} required maxLength={MAX.name} autoFocus />
        </Field>
        <Field label={tr('លេខកូដ', 'Patient ID')} error={errors.code} className="sm:col-span-2">
          <input className="input" value={form.code} onChange={set('code')} maxLength={MAX.code} />
        </Field>
        <Field label={tr('ភេទ', 'Sex')} required error={errors.sex} className="sm:col-span-2">
          <Select
            value={form.sex}
            onChange={(v) => setForm((f) => ({ ...f, sex: v }))}
            options={[
              { value: 'M', label: tr('ប្រុស', 'Male') },
              { value: 'F', label: tr('ស្រី', 'Female') },
            ]}
          />
        </Field>
        <Field label={tr('អាយុ', 'Age')} error={errors.age} className="sm:col-span-2">
          <input type="number" min="0" max="150" step="1" className="input" value={form.age} onChange={set('age')} />
        </Field>
        <Field label={tr('ថ្ងៃចូល', 'Date in')} required error={errors.dateIn} className="sm:col-span-2">
          <input type="date" className="input" value={form.dateIn} onChange={set('dateIn')} required />
        </Field>
        <Field label={tr('រោគវិនិច្ឆ័យ', 'Diagnosis')} error={errors.diagnosis} className="sm:col-span-6">
          <input className="input" value={form.diagnosis} onChange={set('diagnosis')} maxLength={MAX.text} />
        </Field>
        <Field label={tr('អាសយដ្ឋាន / ខេត្ត', 'Address / Province')} error={errors.province} className="sm:col-span-3">
          <AutoComplete value={form.province} onChange={(v) => setForm((f) => ({ ...f, province: v }))} suggestions={PROVINCES} placeholder={tr('ជ្រើសរើស ឬវាយបញ្ចូល', 'Pick or type')} />
        </Field>
        <Field label={tr('ថ្ងៃចេញ', 'Date out')} error={errors.dateOut} hint={tr('ទុកទទេ បើកំពុងសម្រាកព្យាបាល', 'Leave empty while still admitted')} className="sm:col-span-3">
          <input type="date" className="input" value={form.dateOut} min={form.dateIn} onChange={set('dateOut')} />
        </Field>
        <Field label={tr('កំណត់សម្គាល់', 'Note')} error={errors.note} className="sm:col-span-6">
          <textarea rows={2} className="input" value={form.note} onChange={set('note')} maxLength={MAX.text} />
        </Field>
      </form>
    </Modal>
  );
}
