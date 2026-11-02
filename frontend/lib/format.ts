const nf = (d: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmt = (v: number, d = 0) => nf(d).format(v);

export function fmtKg(kg: number) {
  if (Math.abs(kg) >= 1000) return `${fmt(kg / 1000, 2)} t`;
  return `${fmt(kg, kg < 10 ? 1 : 0)} kg`;
}

export function fmtUsd(v: number) {
  return `US$ ${fmt(v, 0)}`;
}

/** Hora simulada → "Lun 14:30". El horizonte arranca lunes 00:00. */
const DAYS = ["Lun", "Mar", "Mié"];
export function fmtClock(t: number) {
  const day = Math.floor(t / 24);
  const h = Math.floor(t % 24);
  const m = Math.floor((t % 1) * 60);
  return { day: DAYS[day] ?? `D${day + 1}`, hm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
}

export function fmtSlot(slot: number) {
  const { day, hm } = fmtClock(slot / 2);
  return `${day} ${hm}`;
}
