export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button class="toggle" role="switch" aria-checked={on} onClick={() => onChange(!on)} />;
}
