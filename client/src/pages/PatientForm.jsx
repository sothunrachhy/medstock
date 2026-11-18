import { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import Select, { AutoComplete } from '../components/Select';
import { Field, Modal } from '../components/ui';
import { PROVINCES } from '../config/org';
import { useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';
import { toDayStr, todayStr } from '../utils/dates';

const empty = () => ({ code: '', name: '', sex: 'M', age: '', diagnosis: '', province: '', dateIn: todayStr(), dateOut: '', status: 'ADMITTED', note: '' });

export default function PatientForm({ open, onClose, patient, onSaved }) {
  const { tr } = useLang();
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      patient
        ? { ...empty(), ...patient, age: patient.age ?? '', dateIn: toDayStr(patient.dateIn), dateOut: patient.dateOut ? toDayStr(patient.dateOut) : '' }
        : empty(),
    );
  }, [open, patient]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form, age: form.age === '' ? null : Number(form.age), status: form.dateOut ? 'DISCHARGED' : 'ADMITTED' };
      const { data } = patient ? await api.put(`/patients/${patient._id}`, body) : await api.post('/patients', body);
      toast(tr('បានរក្សាទុក', 'Saved'));
      onSaved?.(data);
      onClose();
    } catch (err) {
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
        <Field label={tr('ឈ្មោះអ្នកជំងឺ', 'Patient name')} required className="sm:col-span-4">
          <input className="input" value={form.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label={tr('លេខកូដ', 'Patient ID')} className="sm:col-span-2">
          <input className="input" value={form.code} onChange={set('code')} />
        </Field>
        <Field label={tr('ភេទ', 'Sex')} required className="sm:col-span-2">
          <Select
            value={form.sex}
            onChange={(v) => setForm((f) => ({ ...f, sex: v }))}
            options={[
              { value: 'M', label: tr('ប្រុស', 'Male') },
              { value: 'F', label: tr('ស្រី', 'Female') },
            ]}
          />
        </Field>
        <Field label={tr('អាយុ', 'Age')} className="sm:col-span-2">
          <input type="number" min="0" max="150" className="input" value={form.age} onChange={set('age')} />
        </Field>
        <Field label={tr('ថ្ងៃចូល', 'Date in')} required className="sm:col-span-2">
          <input type="date" className="input" value={form.dateIn} onChange={set('dateIn')} required />
        </Field>
        <Field label={tr('រោគវិនិច្ឆ័យ', 'Diagnosis')} className="sm:col-span-6">
          <input className="input" value={form.diagnosis} onChange={set('diagnosis')} />
        </Field>
        <Field label={tr('អាសយដ្ឋាន / ខេត្ត', 'Address / Province')} className="sm:col-span-3">
          <AutoComplete value={form.province} onChange={(v) => setForm((f) => ({ ...f, province: v }))} suggestions={PROVINCES} placeholder={tr('ជ្រើសរើស ឬវាយបញ្ចូល', 'Pick or type')} />
        </Field>
        <Field label={tr('ថ្ងៃចេញ', 'Date out')} hint={tr('ទុកទទេ បើកំពុងសម្រាកព្យាបាល', 'Leave empty while still admitted')} className="sm:col-span-3">
          <input type="date" className="input" value={form.dateOut} min={form.dateIn} onChange={set('dateOut')} />
        </Field>
        <Field label={tr('កំណត់សម្គាល់', 'Note')} className="sm:col-span-6">
          <textarea rows={2} className="input" value={form.note} onChange={set('note')} />
        </Field>
      </form>
    </Modal>
  );
}
