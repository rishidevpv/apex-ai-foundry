export const ANSWERS_KEY = 'if_answers_v1';

export const emptyAnswers = () => ({
  step: 0, business_type: null, team_size_band: null, needs: [], something_else: false, hours: {}, outcomes: [],
  budget: null, software: [], tech_comfort: null, urgency: null, priority: null, free_text: '', completed: false,
  business_type_other: '', something_else_text: '', software_other: '',
});

export function loadAnswers() {
  try { return { ...emptyAnswers(), ...JSON.parse(localStorage.getItem(ANSWERS_KEY) || '{}') }; } catch { return emptyAnswers(); }
}
export const saveAnswers = (a) => localStorage.setItem(ANSWERS_KEY, JSON.stringify(a));

export function toPayload(a) {
  const { step, completed, ...rest } = a;
  return { ...rest, hours: Object.fromEntries(a.needs.map((n) => [n, Number(a.hours[n] ?? 0)])) };
}

export const PENDING_KEY = 'if_pending_submit';
