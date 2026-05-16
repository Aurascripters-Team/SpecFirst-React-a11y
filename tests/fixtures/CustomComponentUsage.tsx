function Button({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick}>{children}</button>;
}

export function CustomTrigger({ onChange }: { onChange: (value: string) => void }) {
  return <Button onClick={() => onChange("apple")}>Apple</Button>;
}
