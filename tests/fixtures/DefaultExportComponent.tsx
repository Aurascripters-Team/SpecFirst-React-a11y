type ButtonProps = {
  label: string;
  onPress: () => void;
};

function PrimaryButton({ label, onPress }: ButtonProps) {
  return <button onClick={onPress}>{label}</button>;
}

export default PrimaryButton;
